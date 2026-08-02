"""
员工管理路由
"""
import re

from flask import Blueprint, jsonify, request
from database import db
from models.employee import Employee

bp = Blueprint('employees', __name__, url_prefix='/api/employees')


def _extract_profile_from_report(md: str) -> dict:
    """从认证报告的"学历经验匹配"表中提取员工学历/年限信息
    表格式: | 学历：本科及以上 | 专科 | ❌ |  第二列为员工实际情况
    """
    out = {}
    m = re.search(r'\|\s*学历[：:][^|]*\|\s*([^|]+)\|', md)
    if m:
        edu = m.group(1).strip().strip('*').strip()
        if edu and edu not in ('-', '—', '未知', '未提及', 'PPT中未体现'):
            out['education'] = edu[:100]
    for key, field in [('行业年限', 'years_experience'), ('本岗位年限', 'years_in_current')]:
        m = re.search(r'\|\s*' + key + r'[：:][^|]*\|\s*([^|]+)\|', md)
        if m:
            n = re.search(r'(\d+(?:\.\d+)?)\s*年', m.group(1))
            if n:
                out[field] = float(n.group(1))
    m = re.search(r'\|\s*管理经验[：:][^|]*\|\s*([^|]+)\|', md)
    if m:
        mgmt = m.group(1).strip().strip('*').strip()
        if mgmt and mgmt not in ('-', '—'):
            out['management'] = mgmt[:200]
    return out


@bp.route('', methods=['GET'])
def list_employees():
    """员工列表 — 搜索 + 分页"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '').strip()
    department = request.args.get('dept', '').strip()

    query = Employee.query.filter(Employee.is_active == True)

    if search:
        query = query.filter(
            db.or_(
                Employee.name.contains(search),
                Employee.position.contains(search),
                Employee.employee_code.contains(search),
            )
        )
    if department:
        query = query.filter(Employee.department.contains(department))

    pagination = query.order_by(Employee.name).paginate(
        page=page, per_page=per_page, error_out=False)

    return jsonify({
        'items': [e.to_dict() for e in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
    })


@bp.route('', methods=['POST'])
def create_employee():
    """创建员工"""
    data = request.json
    emp = Employee(
        employee_code=data.get('employee_code', ''),
        name=data.get('name', ''),
        department=data.get('department', ''),
        position=data.get('position', ''),
        education=data.get('education', ''),
        major=data.get('major', ''),
        years_experience=data.get('years_experience'),
        years_in_current=data.get('years_in_current'),
        email=data.get('email', ''),
        phone=data.get('phone', ''),
        extra=data.get('extra'),
    )
    db.session.add(emp)
    db.session.commit()
    return jsonify(emp.to_dict()), 201


@bp.route('/<int:emp_id>', methods=['GET'])
def get_employee(emp_id):
    """员工详情 — 含认证历史"""
    emp = Employee.query.get_or_404(emp_id)
    result = emp.to_dict()
    result['reports'] = [r.to_dict() for r in emp.reports.all()]
    return jsonify(result)


@bp.route('/<int:emp_id>', methods=['PUT'])
def update_employee(emp_id):
    """更新员工信息"""
    emp = Employee.query.get_or_404(emp_id)
    data = request.json
    for field in ['employee_code', 'name', 'department', 'position',
                   'education', 'major', 'years_experience', 'years_in_current',
                   'email', 'phone', 'extra']:
        if field in data:
            setattr(emp, field, data[field])
    db.session.commit()
    return jsonify(emp.to_dict())


@bp.route('/<int:emp_id>/reports', methods=['GET'])
def employee_reports(emp_id):
    """员工的所有认证报告"""
    emp = Employee.query.get_or_404(emp_id)
    reports = emp.reports.order_by(
        emp.reports._adapter.registry._class_registry['Report'].created_at.desc()
    ).all() if hasattr(emp.reports, '__iter__') else []
    # simpler approach:
    from models.report import Report
    reports = Report.query.filter_by(employee_id=emp_id).order_by(Report.created_at.desc()).all()
    return jsonify({
        'employee': emp.to_dict(),
        'reports': [r.to_dict() for r in reports],
        'total': len(reports),
    })


@bp.route('/<int:emp_id>/timeline', methods=['GET'])
def employee_timeline(emp_id):
    """员工认证时间线 — 含分数趋势"""
    from models.report import Report
    reports = Report.query.filter_by(
        employee_id=emp_id, status='final'
    ).order_by(Report.created_at.asc()).all()

    timeline = []
    for r in reports:
        timeline.append({
            'date': r.created_at.isoformat() if r.created_at else None,
            'total_score': r.total_score,
            'conclusion': r.conclusion,
            'applied_position': r.applied_position,
            'applied_level': r.applied_level,
            'report_id': r.id,
        })

    return jsonify({
        'employee': Employee.query.get_or_404(emp_id).to_dict(),
        'timeline': timeline,
    })


@bp.route('/sync', methods=['POST'])
def sync_employees():
    """从数据库报告、举证材料PPT中同步提取员工信息（同部门+姓名去重）"""
    from config import BASE_DIR
    from services.parser_service import parse_pptx, extract_employee_info, find_standard_file

    # ── 审计报告表：找到employee_id为空的报告，以及指向不存在员工的报告 ──
    # （标准审核报告与员工无关，排除在外）
    from models.report import Report
    existing_emp_ids = {e.id for e in Employee.query.with_entities(Employee.id).all()}
    orphan_reports = Report.query.filter(
        db.or_(Report.report_type != 'standard_audit', Report.report_type.is_(None)),
        db.or_(
            Report.employee_id.is_(None),
            Report.employee_id == 0,
            ~Report.employee_id.in_(existing_emp_ids) if existing_emp_ids else Report.employee_id.isnot(None),
        )
    ).all()

    INVALID_NAMES = ('', '未知', '—', '-', '待定')

    created, linked, skipped = 0, 0, 0

    # ── 先去重：按姓名+部门创建/查找员工 ──
    for r in orphan_reports:
        name = (r.employee_name or '').strip()
        if not name or name in INVALID_NAMES:
            continue
        dept = (r.employee_department or '').strip()
        # 已存在同名同部门则关联
        emp = Employee.query.filter_by(name=name, department=dept, is_active=True).first()
        if emp:
            r.employee_id = emp.id
            linked += 1
            continue
        # 仅姓名匹配（允许无部门记录）
        emp = Employee.query.filter_by(name=name, is_active=True).filter(
            db.or_(Employee.department == dept, Employee.department.is_(None), Employee.department == '')
        ).first()
        if emp:
            r.employee_id = emp.id
            if not emp.department and dept:
                emp.department = dept
            linked += 1
            continue
        # 新建员工
        emp = Employee(
            name=name,
            department=dept,
            position=r.applied_position or '',
        )
        db.session.add(emp)
        db.session.flush()
        r.employee_id = emp.id
        created += 1

    # ── 扫描举证材料里的PPT，提取员工信息入库（不重复） ──
    evidence_dir = BASE_DIR / '举证材料'
    ppt_scanned = 0
    if evidence_dir.exists():
        existing_names = {(e.name, e.department) for e in Employee.query.filter_by(is_active=True).all()}
        for ppt_file in evidence_dir.glob('*.pptx'):
            if ppt_file.name.startswith('~$'):
                continue
            try:
                parsed = parse_pptx(str(ppt_file))
                emp_info = extract_employee_info(parsed['full_text'], ppt_file.name)
                ppt_scanned += 1
                name = (emp_info.get('员工姓名') or '').strip()
                dept = (emp_info.get('所在部门') or '').strip()
                pos = (emp_info.get('申报岗位') or '').strip()
                if not name or name in INVALID_NAMES or (name, dept) in existing_names:
                    continue
                emp = Employee(
                    name=name,
                    department=dept,
                    position=pos,
                )
                db.session.add(emp)
                existing_names.add((name, dept))
                created += 1
            except Exception as e:
                print(f'PPT scan error: {ppt_file.name} - {e}')

    db.session.commit()

    # 再次关联：PPT扫描新建的员工可能能匹配之前未关联的报告
    for r in Report.query.filter(db.or_(Report.employee_id.is_(None), Report.employee_id == 0)).all():
        name = (r.employee_name or '').strip()
        if not name or name in INVALID_NAMES:
            continue
        dept = (r.employee_department or '').strip()
        emp = Employee.query.filter_by(name=name, department=dept, is_active=True).first()
        if not emp:
            emp = Employee.query.filter_by(name=name, is_active=True).first()
        if emp:
            r.employee_id = emp.id
            linked += 1

    db.session.commit()

    # ── 回填学历/年限：从每个员工最新报告的"学历经验匹配"表提取 ──
    enriched = 0
    for emp in Employee.query.filter_by(is_active=True).all():
        latest = Report.query.filter_by(employee_id=emp.id).filter(
            Report.raw_markdown.isnot(None)
        ).order_by(Report.created_at.desc()).first()
        if not latest or not latest.raw_markdown:
            continue
        profile = _extract_profile_from_report(latest.raw_markdown)
        changed = False
        if profile.get('education') and not emp.education:
            emp.education = profile['education']; changed = True
        if profile.get('years_experience') is not None and emp.years_experience is None:
            emp.years_experience = profile['years_experience']; changed = True
        if profile.get('years_in_current') is not None and emp.years_in_current is None:
            emp.years_in_current = profile['years_in_current']; changed = True
        if profile.get('management'):
            extra = dict(emp.extra or {})
            if not extra.get('管理经验'):
                extra['管理经验'] = profile['management']
                emp.extra = extra; changed = True
        if not emp.position and latest.applied_position:
            emp.position = latest.applied_position; changed = True
        if changed:
            enriched += 1

    db.session.commit()
    total_emps = Employee.query.filter_by(is_active=True).count()

    return jsonify({
        'success': True,
        'message': f'同步完成 — 新增 {created} 名员工、关联 {linked} 份报告、回填 {enriched} 人学历/年限信息，共扫描 {ppt_scanned} 份PPT；当前员工总数 {total_emps} 人',
        'created': created,
        'linked': linked,
        'enriched': enriched,
        'ppt_scanned': ppt_scanned,
        'total_employees': total_emps,
    })


@bp.route('/<int:emp_id>', methods=['DELETE'])
def delete_employee(emp_id):
    """删除/禁用员工"""
    emp = Employee.query.get_or_404(emp_id)
    emp.is_active = False
    db.session.commit()
    return jsonify({'success': True, 'message': '员工已删除'})
