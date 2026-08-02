"""
报告管理路由
"""
from flask import Blueprint, jsonify, request
from database import db
from models.report import Report, ReportLineItem

bp = Blueprint('reports', __name__, url_prefix='/api/reports')


@bp.route('', methods=['GET'])
def list_reports():
    """报告列表 — 支持搜索、筛选、分页"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '').strip()
    department = request.args.get('dept', '').strip()
    conclusion = request.args.get('conclusion', '').strip()
    status = request.args.get('status', '').strip()
    date_from = request.args.get('date_from', '').strip()
    date_to = request.args.get('date_to', '').strip()
    sort_by = request.args.get('sort', 'created_at')
    order = request.args.get('order', 'desc')
    rtype = request.args.get('type', 'assessment').strip()  # assessment | standard_audit | all

    query = Report.query

    # 报告类型版块筛选（旧数据 report_type 为空视为 assessment）
    if rtype == 'standard_audit':
        query = query.filter(Report.report_type == 'standard_audit')
    elif rtype == 'assessment':
        query = query.filter(db.or_(Report.report_type == 'assessment', Report.report_type.is_(None)))

    if search:
        query = query.filter(
            db.or_(
                Report.employee_name.contains(search),
                Report.applied_position.contains(search),
                Report.standard_name.contains(search),
            )
        )
    if department:
        query = query.filter(Report.employee_department.contains(department))
    if conclusion:
        query = query.filter(Report.conclusion == conclusion)
    if status:
        query = query.filter(Report.status == status)
    else:
        query = query.filter(Report.status != 'archived')
    if date_from:
        query = query.filter(Report.created_at >= date_from)
    if date_to:
        query = query.filter(Report.created_at <= date_to + ' 23:59:59')

    # 排序
    sort_col = getattr(Report, sort_by, Report.created_at)
    if order == 'asc':
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'items': [r.to_dict() for r in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
        'per_page': per_page,
    })


@bp.route('/stats', methods=['GET'])
def report_stats():
    """报告统计数据"""
    total = Report.query.filter(Report.status == 'final').count()
    pass_count = Report.query.filter(Report.status == 'final', Report.conclusion == 'pass').count()
    conditional_count = Report.query.filter(Report.status == 'final', Report.conclusion == 'conditional').count()
    fail_count = Report.query.filter(Report.status == 'final', Report.conclusion == 'fail').count()

    return jsonify({
        'total': total,
        'pass': pass_count,
        'conditional': conditional_count,
        'fail': fail_count,
        'pass_rate': round(pass_count / total * 100, 1) if total else 0,
    })


@bp.route('/<int:report_id>', methods=['GET'])
def get_report(report_id):
    """获取单个报告（含逐项评分）"""
    report = Report.query.get_or_404(report_id)
    return jsonify(report.to_dict(detailed=True))


@bp.route('/<int:report_id>', methods=['DELETE'])
def delete_report(report_id):
    """删除报告"""
    report = Report.query.get_or_404(report_id)
    db.session.delete(report)
    db.session.commit()
    return jsonify({'success': True, 'message': '报告已删除'})


@bp.route('/batch', methods=['DELETE'])
def batch_delete_reports():
    """批量删除报告"""
    data = request.get_json() or {}
    ids = data.get('ids', [])

    if not ids:
        return jsonify({'error': '请提供要删除的报告ID列表'}), 400

    if not isinstance(ids, list):
        return jsonify({'error': 'ids必须是数组'}), 400

    # 查询并删除
    deleted_count = 0
    for report_id in ids:
        report = Report.query.get(report_id)
        if report:
            db.session.delete(report)
            deleted_count += 1

    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'成功删除 {deleted_count} 份报告',
        'deleted_count': deleted_count
    })


@bp.route('/<int:report_id>/archive', methods=['POST'])
def archive_report(report_id):
    """归档报告"""
    report = Report.query.get_or_404(report_id)
    report.status = 'archived'
    db.session.commit()
    return jsonify({'success': True, 'message': '报告已归档'})


@bp.route('/<int:report_id>/unarchive', methods=['POST'])
def unarchive_report(report_id):
    """取消归档"""
    report = Report.query.get_or_404(report_id)
    report.status = 'final'
    db.session.commit()
    return jsonify({'success': True, 'message': '报告已恢复'})


@bp.route('/compare', methods=['GET'])
def compare_reports():
    """比较 2-3 份报告"""
    ids_str = request.args.get('ids', '')
    if not ids_str:
        return jsonify({'error': '请提供报告ID'}), 400

    ids = [int(x.strip()) for x in ids_str.split(',') if x.strip()]
    if len(ids) < 2:
        return jsonify({'error': '至少需要2份报告进行比较'}), 400
    if len(ids) > 3:
        return jsonify({'error': '最多支持3份报告比较'}), 400

    reports = [Report.query.get_or_404(rid) for rid in ids]

    return jsonify({
        'reports': [r.to_dict(detailed=True) for r in reports],
        'comparison': _build_comparison(reports),
    })


def _build_comparison(reports):
    """构建报告对比数据"""
    dims = ['dim_results_score', 'dim_behavior_score', 'dim_knowledge_score', 'dim_education_score']
    dim_labels = ['关键成果', '关键行为', '知识技能', '学历经验']

    comparison = {
        'scores': [],
        'dimensions': [],
        'line_items': [],
    }

    for report in reports:
        comparison['scores'].append({
            'employee_name': report.employee_name,
            'total_score': report.total_score,
            'conclusion': report.conclusion,
            'dimensions': {
                dim_labels[i]: getattr(report, d, None) for i, d in enumerate(dims)
            }
        })

    # 对比逐项评分
    all_items = {}
    for report in reports:
        for li in report.line_items.all():
            key = f"{li.duty_name}|{li.item_number}|{li.item_type}"
            if key not in all_items:
                all_items[key] = {}
            all_items[key][report.employee_name or str(report.id)] = {
                'score': li.score,
                'coverage': li.coverage,
            }

    for key, scores_by_report in all_items.items():
        parts = key.split('|')
        comparison['line_items'].append({
            'duty_name': parts[0],
            'item_number': parts[1],
            'item_type': parts[2],
            'scores': scores_by_report,
        })

    return comparison
