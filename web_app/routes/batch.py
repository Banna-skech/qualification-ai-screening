"""
批量处理路由
"""
import json
from datetime import datetime

from flask import Blueprint, jsonify, request, Response, stream_with_context

from database import db
from config import REGISTRY_FILE
from models.batch import BatchJob, BatchJobItem
from models.report import Report
from services.parser_service import extract_employee_info, match_standard
from services.ai_service import stream_analysis, ANALYSIS_SYSTEM_PROMPT

bp = Blueprint('batch', __name__, url_prefix='/api/analyze')


@bp.route('/batch', methods=['POST'])
def create_batch_job():
    """创建批量分析作业"""
    data = request.json
    files = data.get('files', [])  # [{filename, full_text, emp_info?}]
    standard_id = data.get('standard_id', '')
    standard_text = data.get('standard_text', '')
    target_level = data.get('target_level', '')

    if not files:
        return jsonify({'error': '缺少文件'}), 400
    if not standard_text:
        return jsonify({'error': '请先选择标准'}), 400

    job = BatchJob(
        name=f'批量认证_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}',
        status='pending',
        total_items=len(files),
    )
    db.session.add(job)
    db.session.flush()

    for i, f in enumerate(files):
        emp_info = extract_employee_info(f.get('full_text', ''), f.get('filename', ''))
        item = BatchJobItem(
            batch_id=job.id,
            ppt_filename=f.get('filename', ''),
            ppt_text=f.get('full_text', ''),
            employee_name=emp_info.get('员工姓名', '未知'),
            standard_id=None,  # will be set during processing
            target_level=target_level,
            status='pending',
            sort_order=i,
        )
        db.session.add(item)

    db.session.commit()

    # 启动后台处理（简化版：在响应后立即开始）
    _process_batch_async(job.id, standard_id, standard_text, target_level)

    return jsonify(job.to_dict(include_items=True)), 201


@bp.route('/batch/<int:batch_id>', methods=['GET'])
def get_batch_status(batch_id):
    """获取批量作业状态"""
    job = BatchJob.query.get_or_404(batch_id)
    return jsonify(job.to_dict(include_items=True))


@bp.route('/batch/<int:batch_id>/items', methods=['GET'])
def get_batch_items(batch_id):
    """获取批量作业各项目状态"""
    job = BatchJob.query.get_or_404(batch_id)
    return jsonify({
        'items': [it.to_dict() for it in job.items.all()],
    })


def _process_batch_async(job_id, standard_id, standard_text, target_level):
    """在后台线程中处理批量作业"""
    import threading

    def process():
        from app import create_app
        app = create_app()
        with app.app_context():
            job = BatchJob.query.get(job_id)
            if not job:
                return

            job.status = 'running'
            job.started_at = datetime.utcnow()
            db.session.commit()

            summaries = []

            for item in job.items.order_by(BatchJobItem.sort_order).all():
                if not item.ppt_text:
                    item.status = 'failed'
                    item.error_message = '缺少PPT内容'
                    job.failed_items += 1
                    db.session.commit()
                    continue

                try:
                    item.status = 'running'
                    db.session.commit()

                    emp_info = extract_employee_info(item.ppt_text, item.ppt_filename)
                    user_prompt = f"""
## 员工信息
- 姓名：{emp_info.get('员工姓名', '')}
- 所在部门：{emp_info.get('所在部门', '')}
- 申报岗位：{emp_info.get('申报岗位', '')}
- 申报级别：{target_level or emp_info.get('申报级别', '')}
- 当前岗位：{emp_info.get('当前岗位', '')}

## 岗位标准
{standard_text[:12000]}

## 员工举证PPT内容
{item.ppt_text[:15000]}
"""
                    # 非流式调用
                    from services.ai_service import call_analysis
                    full_md = call_analysis(ANALYSIS_SYSTEM_PROMPT, user_prompt)

                    # 保存报告
                    report = Report(
                        employee_name=emp_info.get('员工姓名', ''),
                        employee_department=emp_info.get('所在部门', ''),
                        applied_position=emp_info.get('申报岗位', ''),
                        applied_level=target_level or emp_info.get('申报级别', ''),
                        standard_name='',
                        raw_markdown=full_md,
                        ppt_filename=item.ppt_filename,
                        status='final',
                    )
                    db.session.add(report)
                    db.session.flush()

                    item.status = 'completed'
                    item.report_id = report.id
                    job.completed_items += 1

                    # 收集摘要
                    summaries.append({
                        'employee_name': emp_info.get('员工姓名', ''),
                        'applied_level': target_level,
                        'filename': item.ppt_filename,
                        'report_id': report.id,
                    })

                except Exception as e:
                    item.status = 'failed'
                    item.error_message = str(e)
                    job.failed_items += 1

                db.session.commit()

            job.status = 'completed'
            job.completed_at = datetime.utcnow()
            db.session.commit()

    t = threading.Thread(target=process, daemon=True)
    t.start()
