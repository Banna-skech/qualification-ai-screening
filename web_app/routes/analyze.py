"""
分析路由 — PPT上传 / 标准上传 / 核心分析
"""
import json
import re
import uuid
import os
from datetime import datetime
from pathlib import Path

from flask import Blueprint, request, jsonify, Response, stream_with_context

from config import REGISTRY_FILE, STANDARDS_DIR, UPLOAD_DIR, OUTPUT_DIR
from services.parser_service import parse_pptx, parse_pdf, parse_xlsx, extract_employee_info, match_standard, find_standard_file
from services.ai_service import stream_analysis, ANALYSIS_SYSTEM_PROMPT
from database import db
from models import Employee, Report

bp = Blueprint('analyze', __name__, url_prefix='/api')


def _parse_report_metadata(markdown: str, emp_info: dict, target_level: str) -> dict:
    """从AI生成的报告Markdown中提取总分、结论、维度得分"""
    result = {
        'total_score': None,
        'conclusion': None,
        'dim_results_score': None,
        'dim_behavior_score': None,
        'dim_knowledge_score': None,
        'dim_education_score': None,
        'applied_level': '',
        'applied_position': '',
        'current_position': '',
        'department': '',
    }

    # Level: 优先 emp_info 的完整级别 (如 T3-2)，其次 target_level (如 T3)
    emp_level = emp_info.get('申报级别', '')
    # emp_level is like "T3-2" or "S4-3", target_level is like "T3" or "S4"
    if emp_level and emp_level not in ('未知', ''):
        result['applied_level'] = emp_level
    elif target_level and target_level not in ('未知', ''):
        result['applied_level'] = target_level

    # Also try to extract from report content (申报级别 row)
    level_match = re.search(r'申报级别[：:]\s*\**\s*([SPT]\d[-‐]\d)', markdown)
    if level_match:
        result['applied_level'] = level_match.group(1)

    # 从报告基本信息表提取岗位/部门（AI从PPT全文提取，比文件名正则可靠，作为兜底）
    for key, field in [('申报岗位', 'applied_position'), ('当前岗位', 'current_position'), ('所在部门', 'department')]:
        m = re.search(r'\|\s*' + key + r'\s*\|\s*([^|]+)\|', markdown)
        if m:
            val = m.group(1).strip().strip('*').strip()
            if val and val not in ('未知', '-', '—', 'XXX'):
                result[field] = val

    # Total score — look for 综合总分: | **综合总分** | **XX / 16** | or | **综合总分** | **100** | ...
    score_patterns = [
        r'\*\*综合总分\*\*.*?\|\s*\**([\d.]+)\s*/\s*16\**',
        r'\*\*综合总分\*\*.*?\|\s*\**([\d.]+)\**\s*\|\s*—',
        r'综合总分.*?\|\s*\**([\d.]+)\s*/\s*16\**',
        r'\*\*综合总分\*\*.*?\|\s*\**100\**\s*\|\s*\**([\d.]+)\**',
        r'综合总分.*?\|\s*\**100\**\s*\|\s*\**([\d.]+)\**',
    ]
    for pat in score_patterns:
        m = re.search(pat, markdown)
        if m:
            try:
                result['total_score'] = float(m.group(1))
            except ValueError:
                pass
            break

    # Conclusion
    if '✅ 通过' in markdown and '有条件' not in markdown.split('✅ 通过')[0][-200:]:
        # Check if it's a "通过" conclusion or just mention
        if re.search(r'认证结论.*?✅\s*通过', markdown, re.DOTALL):
            result['conclusion'] = 'pass'
    if result['conclusion'] is None:
        if re.search(r'⚠️\s*有条件通过', markdown) or re.search(r'有条件通过', markdown):
            result['conclusion'] = 'conditional'
    if result['conclusion'] is None:
        if re.search(r'❌\s*不通过', markdown):
            result['conclusion'] = 'fail'
    # Fallback: check the conclusion block text
    if result['conclusion'] is None:
        conc_match = re.search(r'>\s*\*\*\[?\s*(✅\s*通过|⚠️\s*有条件通过|❌\s*不通过)', markdown)
        if conc_match:
            if '通过' in conc_match.group(1) and '有条件' not in conc_match.group(1):
                result['conclusion'] = 'pass'
            elif '有条件' in conc_match.group(1):
                result['conclusion'] = 'conditional'
            elif '不通过' in conc_match.group(1):
                result['conclusion'] = 'fail'

    # Dimension scores from the overview table
    dim_patterns = [
        (r'关键成果达成.*?\|\s*40\s*\|\s*([\d.]+)', 'dim_results_score'),
        (r'关键成果[达表].*?\|\s*40\s*\|\s*([\d.]+)', 'dim_results_score'),
        (r'关键行为表现.*?\|\s*35\s*\|\s*([\d.]+)', 'dim_behavior_score'),
        (r'关键行为[表].*?\|\s*35\s*\|\s*([\d.]+)', 'dim_behavior_score'),
        (r'知识技能匹配.*?\|\s*15\s*\|\s*([\d.]+)', 'dim_knowledge_score'),
        (r'学历经验符合.*?\|\s*10\s*\|\s*([\d.]+)', 'dim_education_score'),
    ]
    for pat, key in dim_patterns:
        m = re.search(pat, markdown)
        if m:
            try:
                result[key] = float(m.group(1))
            except ValueError:
                pass

    return result


@bp.route('/upload-ppt', methods=['POST'])
def upload_ppt():
    """上传并解析PPT"""
    file = request.files.get('file')
    if not file:
        return jsonify({"error": "未收到文件"}), 400

    filename = file.filename
    safe_id = uuid.uuid4().hex
    filepath = UPLOAD_DIR / f"{safe_id}_{filename}"
    file.save(str(filepath))

    try:
        parsed = parse_pptx(str(filepath))
        emp_info = extract_employee_info(parsed['full_text'], filename)
        matched = match_standard(filename, parsed['full_text'], REGISTRY_FILE)

        filepath.unlink(missing_ok=True)

        return jsonify({
            "filename": filename,
            "slide_count": parsed['slide_count'],
            "full_text": parsed['full_text'],
            "emp_info": emp_info,
            "matched_standards": matched[:5],
        })
    except Exception as e:
        filepath.unlink(missing_ok=True)
        return jsonify({"error": f"解析失败: {str(e)}"}), 500


@bp.route('/upload-standard', methods=['POST'])
def upload_standard():
    """上传并解析标准文件"""
    file = request.files.get('file')
    if not file:
        return jsonify({"error": "未收到文件"}), 400

    filename = file.filename
    filepath = UPLOAD_DIR / f"{uuid.uuid4().hex}_{filename}"
    file.save(str(filepath))

    try:
        if filename.endswith('.pdf'):
            parsed = parse_pdf(str(filepath))
        elif filename.endswith('.xlsx'):
            parsed = parse_xlsx(str(filepath))
        else:
            filepath.unlink(missing_ok=True)
            return jsonify({"error": "不支持的文件格式"}), 400

        filepath.unlink(missing_ok=True)
        return jsonify({
            "filename": filename,
            "full_text": parsed['full_text'],
        })
    except Exception as e:
        filepath.unlink(missing_ok=True)
        return jsonify({"error": f"解析失败: {str(e)}"}), 500


@bp.route('/standards', methods=['GET'])
def list_standards():
    """获取所有已注册的岗位标准（兼容旧API）"""
    registry = json.loads(REGISTRY_FILE.read_text(encoding='utf-8'))
    # 也返回数据库中补充的标准
    return jsonify(registry["岗位标准清单"])


@bp.route('/standards/<std_id>', methods=['GET'])
def get_standard_text(std_id):
    """获取指定标准的内容（兼容旧API — 返回文件解析文本）"""
    registry = json.loads(REGISTRY_FILE.read_text(encoding='utf-8'))
    std = next((s for s in registry["岗位标准清单"] if s["id"] == std_id), None)
    if not std:
        return jsonify({"error": "标准不存在"}), 404

    std_file = find_standard_file(STANDARDS_DIR, std["标准文件"])
    if not std_file:
        return jsonify({"error": f"标准文件不存在: {std['标准文件']}"}), 404

    try:
        if str(std_file).endswith('.pdf'):
            parsed = parse_pdf(str(std_file))
        elif str(std_file).endswith('.xlsx'):
            parsed = parse_xlsx(str(std_file))
        else:
            return jsonify({"error": "不支持的文件格式"}), 400

        return jsonify({
            "id": std["id"],
            "岗位名称": std["岗位名称"],
            "标准文件": std["标准文件"],
            "序列": std["序列"],
            "full_text": parsed['full_text'],
            "级别覆盖": std.get("级别覆盖", []),
            "特殊规则": std.get("特殊规则"),
        })
    except Exception as e:
        return jsonify({"error": f"读取标准失败: {str(e)}"}), 500


@bp.route('/analyze', methods=['POST'])
def analyze():
    """核心分析接口 - 流式返回 (SSE)"""
    data = request.json
    ppt_text = data.get('ppt_text', '')
    ppt_filename = data.get('ppt_filename', '')
    standard_id = data.get('standard_id', '')
    standard_text = data.get('standard_text', '')
    target_level = data.get('target_level', '')

    if not ppt_text:
        return jsonify({"error": "缺少PPT内容"}), 400
    if not standard_text:
        return jsonify({"error": "缺少标准内容"}), 400

    # 提取员工信息
    emp_info = extract_employee_info(ppt_text, ppt_filename)

    # 加载标准元数据
    registry = json.loads(REGISTRY_FILE.read_text(encoding='utf-8'))
    std_meta = next((s for s in registry["岗位标准清单"] if s["id"] == standard_id), None)

    # 查找或创建员工
    employee = None
    emp_name = emp_info.get('员工姓名', '')
    emp_dept = emp_info.get('所在部门', '')
    if emp_name and emp_name != '未知':
        employee = Employee.query.filter_by(
            name=emp_name, department=emp_dept
        ).first()
        if not employee:
            employee = Employee(
                name=emp_name,
                department=emp_dept,
                position=emp_info.get('申报岗位', ''),
            )
            db.session.add(employee)
            # 立即提交：员工管理页第一时间可见，且流式分析中途异常也不会丢失
            db.session.commit()

    # 构建分析prompt（注入真实日期）
    from datetime import date
    today_str = date.today().strftime('%Y年%m月%d日')
    user_prompt = f"""
## 员工信息
- 姓名：{emp_info['员工姓名']}
- 所在部门：{emp_info['所在部门']}
- 申报岗位：{emp_info['申报岗位']}
- 申报级别：{target_level or emp_info['申报级别']}
- 当前岗位：{emp_info['当前岗位']}

## 岗位标准
{standard_text[:12000]}

## 员工举证PPT内容
{ppt_text[:15000]}

---
⚠️ 以上所有日期的默认值必须全部替换为: {today_str}
"""

    # 预备变量用于流结束时
    emp_info_holder = emp_info
    std_meta_holder = std_meta
    employee_holder = employee

    def generate():
        report_markdown = []
        try:
            for text in stream_analysis(ANALYSIS_SYSTEM_PROMPT, user_prompt):
                report_markdown.append(text)
                yield f"data: {json.dumps({'type': 'chunk', 'content': text}, ensure_ascii=False)}\n\n"

            full_md = ''.join(report_markdown)
            std_name = std_meta_holder['岗位名称'] if std_meta_holder else ''

            # 从AI生成的报告中提取分数、结论、级别
            meta = _parse_report_metadata(full_md, emp_info_holder, target_level)

            # 保存到数据库
            try:
                from services.parser_service import _clean_department, _clean_position

                def _pick(emp_val, meta_val, cleaner=None):
                    """优先用文件名/内容正则提取值；无效时兜底用AI报告提取值"""
                    v = emp_val if emp_val and emp_val != '未知' else (meta_val or '')
                    if v and cleaner:
                        v = cleaner(v) or v
                    return v if v != '未知' else ''

                report = Report(
                    employee_id=employee_holder.id if employee_holder else None,
                    employee_name=emp_info_holder.get('员工姓名', ''),
                    employee_department=_pick(emp_info_holder.get('所在部门', ''), meta.get('department'), _clean_department),
                    current_position=_pick(emp_info_holder.get('当前岗位', ''), meta.get('current_position'), _clean_position),
                    applied_position=_pick(emp_info_holder.get('申报岗位', ''), meta.get('applied_position'), _clean_position),
                    applied_level=meta['applied_level'] or target_level or emp_info_holder.get('申报级别', ''),
                    standard_name=std_name,
                    total_score=meta['total_score'],
                    conclusion=meta['conclusion'],
                    dim_results_score=meta['dim_results_score'],
                    dim_behavior_score=meta['dim_behavior_score'],
                    dim_knowledge_score=meta['dim_knowledge_score'],
                    dim_education_score=meta['dim_education_score'],
                    raw_markdown=full_md,
                    ppt_filename=ppt_filename,
                    status='final',
                    ai_model='deepseek-V4-pro',
                )
                db.session.add(report)
                db.session.commit()

                # 从报告中回填员工学历/年限信息
                if employee_holder:
                    try:
                        from routes.employees import _extract_profile_from_report
                        profile = _extract_profile_from_report(full_md)
                        if profile.get('education'):
                            employee_holder.education = profile['education']
                        if profile.get('years_experience') is not None:
                            employee_holder.years_experience = profile['years_experience']
                        if profile.get('years_in_current') is not None:
                            employee_holder.years_in_current = profile['years_in_current']
                        if profile.get('management'):
                            extra = dict(employee_holder.extra or {})
                            extra['管理经验'] = profile['management']
                            employee_holder.extra = extra
                        # 岗位/部门为空或未知时用报告值回填
                        if report.applied_position and (not employee_holder.position or employee_holder.position == '未知'):
                            employee_holder.position = report.applied_position
                        if report.employee_department and (not employee_holder.department or employee_holder.department == '未知'):
                            employee_holder.department = report.employee_department
                        db.session.commit()
                    except Exception as prof_err:
                        print(f"Profile backfill error: {prof_err}")

                # 同步保存Word版报告到文件系统
                safe_name = emp_info_holder.get('员工姓名', 'unknown')
                safe_pos = report.applied_position or emp_info_holder.get('申报岗位', 'position')
                safe_level = meta['applied_level'].replace('/', '_').replace('\\', '_')
                base_name = f"{safe_name}_{safe_pos}_{safe_level}_认证报告_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                base_name = re.sub(r'[\\/:*?"<>|]', '_', base_name)
                docx_filename = base_name + '.docx'
                try:
                    from routes.export import markdown_to_docx
                    markdown_to_docx(full_md).save(str(OUTPUT_DIR / docx_filename))
                    report.saved_filename = docx_filename
                except Exception as docx_err:
                    # Word生成失败时回退保存Markdown，保证报告不丢失
                    print(f"DOCX save error, fallback to md: {docx_err}")
                    md_filename = base_name + '.md'
                    (OUTPUT_DIR / md_filename).write_text(full_md, encoding='utf-8')
                    report.saved_filename = md_filename
                db.session.commit()
            except Exception as e:
                # 数据库保存失败不影响流式输出
                print(f"DB save error: {e}")

            yield f"data: {json.dumps({'type': 'done', 'emp_info': emp_info_holder, 'standard_name': std_name}, ensure_ascii=False)}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        }
    )


@bp.route('/save-report', methods=['POST'])
def save_report():
    """保存认证报告到文件"""
    data = request.json
    content = data.get('content', '')
    filename = data.get('filename', f'认证报告_{datetime.now().strftime("%Y%m%d_%H%M%S")}.md')

    filepath = OUTPUT_DIR / filename
    filepath.write_text(content, encoding='utf-8')

    # 同时更新数据库（如果存在对应记录）
    # 尝试从文件名匹配
    try:
        from models.report import Report
        report = Report.query.filter_by(saved_filename=filename).first()
        if report:
            report.raw_markdown = content
        else:
            # 创建新记录
            report = Report(
                raw_markdown=content,
                saved_filename=filename,
                status='final',
            )
            db.session.add(report)
        db.session.commit()
    except Exception as e:
        print(f"DB save error in save-report: {e}")

    return jsonify({"success": True, "path": str(filepath)})


@bp.route('/download/<filename>')
def download_report_file(filename):
    """下载报告文件"""
    filepath = OUTPUT_DIR / filename
    if filepath.exists():
        from flask import send_file
        return send_file(str(filepath), as_attachment=True, download_name=filename)
    return jsonify({"error": "文件不存在"}), 404
