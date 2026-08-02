"""
仪表盘分析路由
"""
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request

from database import db
from models.report import Report, ReportLineItem
from models.standard import Standard
from models.employee import Employee
from sqlalchemy import func

bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')


@bp.route('/summary', methods=['GET'])
def dashboard_summary():
    """仪表盘概览数据"""
    total_reports = Report.query.filter(Report.status == 'final').count()
    pass_count = Report.query.filter(Report.status == 'final', Report.conclusion == 'pass').count()
    conditional_count = Report.query.filter(Report.status == 'final', Report.conclusion == 'conditional').count()
    fail_count = Report.query.filter(Report.status == 'final', Report.conclusion == 'fail').count()

    # 本月数据
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0)
    this_month = Report.query.filter(
        Report.status == 'final',
        Report.created_at >= month_start
    ).count()

    # 活跃标准数
    active_standards = Standard.query.filter(Standard.status == 'active').count()

    # 员工数
    employee_count = Employee.query.filter(Employee.is_active == True).count()

    pass_rate = round(pass_count / total_reports * 100, 1) if total_reports else 0

    return jsonify({
        'total_reports': total_reports,
        'this_month': this_month,
        'pass_count': pass_count,
        'conditional_count': conditional_count,
        'fail_count': fail_count,
        'pass_rate': pass_rate,
        'active_standards': active_standards,
        'employee_count': employee_count,
    })


@bp.route('/pass-rate', methods=['GET'])
def pass_rate_trend():
    """月度通过率趋势"""
    months = request.args.get('months', 6, type=int)

    # 查询最近 N 个月的数据
    results = []
    now = datetime.utcnow()
    for i in range(months - 1, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=1)).replace(day=1) if i > 0 else now.replace(day=1)
        # simpler: iterate months back
        target_month = now.month - i
        target_year = now.year
        while target_month <= 0:
            target_month += 12
            target_year -= 1

        month_start = datetime(target_year, target_month, 1)
        if target_month == 12:
            month_end = datetime(target_year + 1, 1, 1)
        else:
            month_end = datetime(target_year, target_month + 1, 1)

        total = Report.query.filter(
            Report.status == 'final',
            Report.created_at >= month_start,
            Report.created_at < month_end
        ).count()
        passed = Report.query.filter(
            Report.status == 'final',
            Report.conclusion == 'pass',
            Report.created_at >= month_start,
            Report.created_at < month_end
        ).count()

        results.append({
            'month': f'{target_year}-{target_month:02d}',
            'total': total,
            'passed': passed,
            'pass_rate': round(passed / total * 100, 1) if total else 0,
        })

    return jsonify({'trend': results})


@bp.route('/departments', methods=['GET'])
def department_summary():
    """按部门汇总"""
    rows = db.session.query(
        Report.employee_department,
        func.count(Report.id).label('total'),
        func.avg(Report.total_score).label('avg_score'),
        func.sum(db.case((Report.conclusion == 'pass', 1), else_=0)).label('pass_count'),
        func.sum(db.case((Report.conclusion == 'conditional', 1), else_=0)).label('conditional_count'),
        func.sum(db.case((Report.conclusion == 'fail', 1), else_=0)).label('fail_count'),
    ).filter(
        Report.status == 'final',
        Report.employee_department != '',
    ).group_by(Report.employee_department).order_by(func.count(Report.id).desc()).all()

    return jsonify({
        'departments': [
            {
                'name': r.employee_department,
                'total': r.total,
                'avg_score': round(r.avg_score, 1) if r.avg_score else 0,
                'pass': r.pass_count or 0,
                'conditional': r.conditional_count or 0,
                'fail': r.fail_count or 0,
            }
            for r in rows
        ]
    })


@bp.route('/gaps', methods=['GET'])
def common_gaps():
    """高频差距分析 — 所有报告中得分最低的标准条目"""
    limit = request.args.get('limit', 10, type=int)

    rows = db.session.query(
        ReportLineItem.duty_name,
        ReportLineItem.item_number,
        ReportLineItem.item_type,
        func.avg(ReportLineItem.score).label('avg_score'),
        func.count(ReportLineItem.id).label('occurrences'),
    ).join(Report).filter(
        Report.status == 'final',
    ).group_by(
        ReportLineItem.duty_name,
        ReportLineItem.item_number,
        ReportLineItem.item_type,
    ).order_by('avg_score').limit(limit).all()

    return jsonify({
        'gaps': [
            {
                'duty_name': r.duty_name,
                'item_number': r.item_number,
                'item_type': r.item_type,
                'avg_score': round(r.avg_score, 1) if r.avg_score else 0,
                'occurrences': r.occurrences,
            }
            for r in rows
        ]
    })


@bp.route('/standards-usage', methods=['GET'])
def standards_usage():
    """标准使用频率"""
    rows = db.session.query(
        Report.standard_name,
        func.count(Report.id).label('count'),
        func.avg(Report.total_score).label('avg_score'),
    ).filter(
        Report.status == 'final',
        Report.standard_name != '',
    ).group_by(Report.standard_name).order_by(func.count(Report.id).desc()).all()

    return jsonify({
        'usage': [
            {
                'standard_name': r.standard_name,
                'count': r.count,
                'avg_score': round(r.avg_score, 1) if r.avg_score else 0,
            }
            for r in rows
        ]
    })
