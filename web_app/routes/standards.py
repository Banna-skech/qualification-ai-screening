"""
标准管理路由 — CRUD + AI生成/审查 + 文件夹同步
"""
import json
import os
import re
from datetime import datetime
from pathlib import Path
from flask import Blueprint, jsonify, request, Response, stream_with_context, current_app

from database import db
from models.standard import Standard, StandardDuty
from services.ai_service import (
    stream_analysis, call_analysis,
    STANDARD_GENERATION_PROMPT, STANDARD_REVIEW_PROMPT, STANDARD_AUDIT_PROMPT
)
from config import REGISTRY_FILE, STANDARDS_DIR

bp = Blueprint('standards_v2', __name__, url_prefix='/api/v2/standards')


@bp.route('/registry', methods=['GET'])
def get_standards_registry():
    """获取标准注册表数据"""
    try:
        if REGISTRY_FILE.exists():
            registry = json.loads(REGISTRY_FILE.read_text(encoding='utf-8'))
            return jsonify(registry)
        return jsonify({'error': '注册表文件不存在'}), 404
    except Exception as e:
        return jsonify({'error': f'读取注册表失败: {str(e)}'}), 500


@bp.route('', methods=['GET'])
def list_standards():
    """标准列表 — 支持筛选"""
    sequence = request.args.get('sequence', '').strip()
    department = request.args.get('dept', '').strip()
    status = request.args.get('status', '').strip()
    search = request.args.get('search', '').strip()

    query = Standard.query

    if sequence:
        query = query.filter(Standard.sequence == sequence)
    if status:
        query = query.filter(Standard.status == status)
    else:
        query = query.filter(Standard.status == 'active')
    if search:
        # 只按岗位名称匹配关键词（description存的是职责概要，匹配它会带出大量不相关岗位）
        query = query.filter(Standard.name.contains(search))

    # 序列排序：T → S → P
    seq_order = db.case(
        (Standard.sequence == 'T', 0),
        (Standard.sequence == 'S', 1),
        (Standard.sequence == 'P', 2),
        else_=3,
    )
    standards = query.order_by(seq_order, Standard.name).all()

    return jsonify({
        'items': [s.to_dict() for s in standards],
        'total': len(standards),
    })


@bp.route('/<int:std_id>', methods=['GET'])
def get_standard(std_id):
    """获取标准详情（含职责树）"""
    std = Standard.query.get_or_404(std_id)
    return jsonify(std.to_dict(include_duties=True))


@bp.route('', methods=['POST'])
def create_standard():
    """手动创建标准"""
    data = request.json
    std = Standard(
        name=data.get('name', ''),
        sequence=data.get('sequence', 'S'),
        department_scope=data.get('department_scope', []),
        level_coverage=data.get('level_coverage', []),
        keywords=data.get('keywords', []),
        special_rules=data.get('special_rules'),
        description=data.get('description', ''),
        version=data.get('version', 'V1.0'),
        status=data.get('status', 'draft'),
    )
    db.session.add(std)
    db.session.flush()

    # 添加职责
    duties = data.get('duties', [])
    for i, duty in enumerate(duties):
        sd = StandardDuty(
            standard_id=std.id,
            level=duty.get('level', 'ALL'),
            duty_number=duty.get('duty_number', i + 1),
            duty_name=duty.get('duty_name', ''),
            item_number=duty.get('item_number', f'{i+1}.1'),
            item_type=duty.get('item_type', 'key_result'),
            description=duty.get('description', ''),
            weight_override=duty.get('weight_override'),
            sort_order=duty.get('sort_order', i),
        )
        db.session.add(sd)

    std.duty_count = len(duties)
    db.session.commit()

    return jsonify(std.to_dict(include_duties=True)), 201


@bp.route('/<int:std_id>', methods=['PUT'])
def update_standard(std_id):
    """更新标准元数据"""
    std = Standard.query.get_or_404(std_id)
    data = request.json

    for field in ['name', 'sequence', 'department_scope', 'level_coverage',
                   'keywords', 'special_rules', 'description', 'version', 'status']:
        if field in data:
            setattr(std, field, data[field])

    db.session.commit()
    return jsonify(std.to_dict())


@bp.route('/<int:std_id>', methods=['DELETE'])
def delete_standard(std_id):
    """删除/归档标准"""
    std = Standard.query.get_or_404(std_id)
    std.status = 'archived'
    db.session.commit()
    return jsonify({'success': True})


@bp.route('/<int:std_id>/duties', methods=['POST'])
def add_duty(std_id):
    """添加职责条目"""
    Standard.query.get_or_404(std_id)
    data = request.json
    sd = StandardDuty(
        standard_id=std_id,
        level=data.get('level', 'ALL'),
        duty_number=data.get('duty_number', 1),
        duty_name=data.get('duty_name', ''),
        item_number=data.get('item_number', ''),
        item_type=data.get('item_type', 'key_result'),
        description=data.get('description', ''),
        weight_override=data.get('weight_override'),
        sort_order=data.get('sort_order', 0),
    )
    db.session.add(sd)
    db.session.commit()
    return jsonify(sd.to_dict()), 201


@bp.route('/<int:std_id>/duties/<int:duty_id>', methods=['PUT'])
def update_duty(std_id, duty_id):
    """更新职责条目"""
    sd = StandardDuty.query.filter_by(id=duty_id, standard_id=std_id).first_or_404()
    data = request.json
    for field in ['level', 'duty_number', 'duty_name', 'item_number',
                   'item_type', 'description', 'weight_override', 'sort_order']:
        if field in data:
            setattr(sd, field, data[field])
    db.session.commit()
    return jsonify(sd.to_dict())


@bp.route('/<int:std_id>/duties/<int:duty_id>', methods=['DELETE'])
def delete_duty(std_id, duty_id):
    """删除职责条目"""
    sd = StandardDuty.query.filter_by(id=duty_id, standard_id=std_id).first_or_404()
    db.session.delete(sd)
    db.session.commit()
    return jsonify({'success': True})


@bp.route('/sync/to-registry', methods=['POST'])
def sync_standards_to_registry():
    """将数据库中的标准同步回注册表"""
    try:
        # 读取当前注册表
        if REGISTRY_FILE.exists():
            registry = json.loads(REGISTRY_FILE.read_text(encoding='utf-8'))
        else:
            registry = {
                "_说明": "本注册表定义所有岗位标准及其文件路径、级别映射、序列代码。Agent自动读取此文件进行标准匹配。",
                "_版本": "1.0",
                "_最后更新": "2026-07-01",
                "序列定义": {
                    "P序列": "职能序列 — 人事、行政、财务、法务等职能岗位",
                    "S序列": "营销序列 — 运营、GTM、MKT、社媒等营销岗位",
                    "T序列": "技术序列 — 产品市场、结构工程、采购等技术岗位"
                },
                "级别对照": {
                    "助理": "仅设1档（序列+1）如 T1、P1、S1",
                    "初级": "设3档（序列+2-档位）如 T2-1、P2-2、S2-3",
                    "中级": "设3档（序列+3-档位）如 T3-1、P3-2、S3-3",
                    "高级": "设3档（序列+4-档位）如 T4-1、P4-2、S4-3",
                    "专家": "设3档（序列+5-档位）如 T5-1、P5-2、S5-3"
                },
                "岗位标准清单": []
            }

        registry_standards = registry.get('岗位标准清单', [])
        existing_ids = {s['id'] for s in registry_standards}

        # 获取数据库中的标准
        db_standards = Standard.query.filter(Standard.status == 'active').all()

        added_count = 0
        updated_count = 0

        for std in db_standards:
            # 如果没有registry_id，生成一个
            if not std.registry_id:
                # 从名称生成ID
                new_id = std.name.lower().replace(' ', '').replace('-', '')[:20]
                std.registry_id = new_id

            # 检查是否已在注册表中
            existing = None
            for i, reg_std in enumerate(registry_standards):
                if reg_std['id'] == std.registry_id:
                    existing = i
                    break

            # 构建级别覆盖（反向转换）
            level_coverage = []
            if std.level_coverage:
                has_assistant = any('1' in lvl and '-1' not in lvl for lvl in std.level_coverage)
                has_junior = any('2' in lvl for lvl in std.level_coverage)
                has_intermediate = any('3' in lvl for lvl in std.level_coverage)
                has_senior = any('4' in lvl for lvl in std.level_coverage)
                has_expert = any('5' in lvl for lvl in std.level_coverage)

                if has_assistant:
                    level_coverage.append('助理')
                if has_junior:
                    level_coverage.append('初级')
                if has_intermediate:
                    level_coverage.append('中级')
                if has_senior:
                    level_coverage.append('高级')
                if has_expert:
                    level_coverage.append('专家')

            # 构建标准条目
            std_entry = {
                'id': std.registry_id,
                '岗位名称': std.name,
                '序列': f"{std.sequence}序列" if std.sequence else 'P序列',
                '覆盖部门': std.department_scope or [],
                '标准文件': std.file_name or f"{std.name}-任职资格标准-V1.0.xlsx",
                '级别覆盖': level_coverage if level_coverage else ['助理', '初级', '中级', '高级', '专家'],
                '关键词': std.keywords or [],
                '职责数量': std.duty_count or 0,
                '特殊规则': std.special_rules
            }

            if existing is not None:
                # 更新现有条目
                registry_standards[existing] = std_entry
                updated_count += 1
            else:
                # 添加新条目
                registry_standards.append(std_entry)
                added_count += 1

        # 更新注册表
        registry['岗位标准清单'] = registry_standards
        registry['_最后更新'] = datetime.now().strftime('%Y-%m-%d')

        # 写回文件
        REGISTRY_FILE.write_text(
            json.dumps(registry, ensure_ascii=False, indent=2),
            encoding='utf-8'
        )

        db.session.commit()

        return jsonify({
            'success': True,
            'message': f'同步到注册表完成：新增 {added_count} 个，更新 {updated_count} 个',
            'added': added_count,
            'updated': updated_count,
            'total': len(registry_standards)
        })

    except Exception as e:
        db.session.rollback()
        import traceback
        return jsonify({'error': f'同步到注册表失败: {str(e)}', 'detail': traceback.format_exc()}), 500


@bp.route('/extract-summaries', methods=['POST'])
def extract_summaries():
    """从标准XLSX文件中提取摘要信息（职责清单/覆盖部门/版本），回填数据库"""
    from services.parser_service import find_standard_file, extract_standard_summary

    updated, failed = 0, []
    standards = Standard.query.filter(Standard.status == 'active').all()
    for std in standards:
        if not std.file_name or not std.file_name.endswith('.xlsx'):
            continue
        filepath = find_standard_file(STANDARDS_DIR, std.file_name)
        if not filepath:
            failed.append(std.name)
            continue
        try:
            summary = extract_standard_summary(filepath)
            if summary['duty_names']:
                std.duty_count = len(summary['duty_names'])
                std.description = '；'.join(summary['duty_names'])
            if summary['departments']:
                std.department_scope = summary['departments']
            # 从文件名解析版本号
            vm = re.search(r'[Vv]\d+(?:\.\d+)?', std.file_name)
            if vm:
                std.version = vm.group(0).upper()
            updated += 1
        except Exception as e:
            failed.append(f'{std.name}({e})')

    db.session.commit()
    return jsonify({
        'success': True,
        'message': f'已提取 {updated} 个标准的摘要信息' + (f'，{len(failed)} 个失败' if failed else ''),
        'updated': updated,
        'failed': failed,
    })


@bp.route('/audit', methods=['POST'])
def audit_new_standard():
    """新岗位标准入库前审核（流式）— 按四维度审核要求"""
    from datetime import date

    data = request.json
    standard_text = data.get('standard_text', '')
    standard_filename = data.get('standard_filename', '未命名标准')
    if not standard_text:
        return jsonify({'error': '缺少标准内容'}), 400

    today_str = date.today().strftime('%Y年%m月%d日')
    user_prompt = f"""
## 待审核的新岗位标准
- 文件名：{standard_filename}
- 审核日期：{today_str}

### 标准内容
{standard_text[:15000]}

---
请按审核要求输出完整审核报告。报告中的审核日期使用：{today_str}
"""

    def generate():
        try:
            for text in stream_analysis(STANDARD_AUDIT_PROMPT, user_prompt):
                yield f"data: {json.dumps({'type': 'chunk', 'content': text}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )


@bp.route('/audit/save', methods=['POST'])
def save_audit_report():
    """保存标准审核报告：Word到输出报告文件夹 + 同步到报告管理（标准审核版块）"""
    from datetime import datetime as dt
    from config import OUTPUT_DIR
    from routes.export import markdown_to_docx
    from models.report import Report

    data = request.json
    markdown = data.get('markdown', '')
    standard_name = data.get('standard_name', '未命名标准')
    if not markdown:
        return jsonify({'error': '缺少报告内容'}), 400

    safe = re.sub(r'[\\/:*?"<>|]', '_', standard_name)
    if safe.lower().endswith(('.xlsx', '.pdf')):
        safe = safe.rsplit('.', 1)[0]
    filename = f"{safe}_标准审核报告_{dt.now().strftime('%Y%m%d_%H%M%S')}.docx"
    try:
        markdown_to_docx(markdown).save(str(OUTPUT_DIR / filename))
    except Exception as e:
        return jsonify({'error': f'保存失败: {e}'}), 500

    # ── 同步到报告管理数据库（标准审核版块） ──
    try:
        # 解析审核结论
        conclusion = None
        if re.search(r'✅\s*建议通过入库', markdown):
            conclusion = 'pass'
        elif re.search(r'⚠️?\s*修改后入库', markdown):
            conclusion = 'conditional'
        elif re.search(r'❌\s*退回重写', markdown):
            conclusion = 'fail'
        # 解析整体评估表的各维度分数（x/10），总分取平均
        scores = [float(m) for m in re.findall(r'\|\s*\**([\d.]+)\**\s*/\s*10\b', markdown)]
        total_score = round(sum(scores) / len(scores), 1) if scores else None

        report = Report(
            report_type='standard_audit',
            standard_name=safe,
            employee_name='—',
            raw_markdown=markdown,
            ppt_filename=standard_name,
            saved_filename=filename,
            total_score=total_score,
            conclusion=conclusion,
            status='final',
            ai_model='deepseek-V4-pro',
        )
        db.session.add(report)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f'Audit report DB save error: {e}')

    return jsonify({'success': True, 'filename': filename, 'message': f'已保存到输出报告文件夹并同步到报告管理：{filename}'})


@bp.route('/refresh', methods=['POST'])
def refresh_standards():
    """一键同步刷新：注册表/文件夹 → 数据库 → 重新提取摘要信息"""
    # 第一步：同步注册表和文件夹中的标准到数据库
    sync_resp = sync_standards_from_folder()
    if isinstance(sync_resp, tuple):  # (response, status_code) 表示出错
        return sync_resp
    sync_data = sync_resp.get_json()

    # 第二步：从标准文件重新提取摘要（同步会重置摘要字段，必须在其后执行）
    ext_resp = extract_summaries()
    ext_data = ext_resp.get_json()

    return jsonify({
        'success': True,
        'message': f"{sync_data.get('message', '同步完成')}；{ext_data.get('message', '')}",
        'sync': sync_data,
        'extract': ext_data,
    })


@bp.route('/sync', methods=['POST'])
def sync_standards_from_folder():
    """从文件夹同步标准文件到数据库"""
    try:
        # 读取注册表
        registry = json.loads(REGISTRY_FILE.read_text(encoding='utf-8'))
        registry_standards = {item['id']: item for item in registry.get('岗位标准清单', [])}
        # 建立文件名到注册表标准的映射
        registry_by_filename = {}
        for std_id, reg_std in registry_standards.items():
            filename = reg_std.get('标准文件', '')
            if filename:
                registry_by_filename[filename] = reg_std

        # 扫描文件夹中的文件
        folder_files = []
        if STANDARDS_DIR.exists():
            for seq_folder in ['P序列', 'S序列', 'T序列']:
                seq_path = STANDARDS_DIR / seq_folder
                if seq_path.exists():
                    for ext in ['*.pdf', '*.xlsx', '*.docx']:
                        for file_path in seq_path.glob(ext):
                            # 跳过临时文件和特殊文件
                            if file_path.name.startswith('~$'):
                                continue
                            # 跳过分级/补充说明类文件
                            if '分级' in file_path.name or '说明' in file_path.name or '补充' in file_path.name:
                                continue
                            folder_files.append({
                                'name': file_path.name,
                                'path': str(file_path.relative_to(STANDARDS_DIR)),
                                'full_path': str(file_path),
                                'sequence': seq_folder[0],  # P, S, T
                            })

        # 获取数据库中现有标准
        existing_by_registry = {s.registry_id: s for s in Standard.query.filter(Standard.registry_id.isnot(None)).all()}
        existing_by_file = {s.file_name: s for s in Standard.query.filter(Standard.file_name.isnot(None)).all()}

        synced_count = 0
        updated_count = 0
        errors = []

        # 第一步：同步注册表中的标准
        for std_id, reg_std in registry_standards.items():
            file_name = reg_std.get('标准文件', '')
            sequence = reg_std.get('序列', '')[0] if reg_std.get('序列') else 'S'

            # 构建级别覆盖（根据新的职级体系）
            level_coverage = []
            levels = reg_std.get('级别覆盖', [])
            for level_name in levels:
                if level_name == '助理':
                    level_coverage.append(f"{sequence}1")
                elif level_name == '初级':
                    level_coverage.extend([f"{sequence}2-1", f"{sequence}2-2", f"{sequence}2-3"])
                elif level_name == '中级':
                    level_coverage.extend([f"{sequence}3-1", f"{sequence}3-2", f"{sequence}3-3"])
                elif level_name == '高级':
                    level_coverage.extend([f"{sequence}4-1", f"{sequence}4-2", f"{sequence}4-3"])
                elif level_name == '专家':
                    level_coverage.extend([f"{sequence}5-1", f"{sequence}5-2", f"{sequence}5-3"])

            # 构建描述
            keywords = reg_std.get('关键词', [])
            description = f"关键词: {', '.join(keywords)}" if keywords else ''
            if reg_std.get('特殊规则'):
                description += f" | 特殊规则: {reg_std['特殊规则']}"

            std_data = {
                'registry_id': std_id,
                'name': reg_std.get('岗位名称', ''),
                'sequence': sequence,
                'department_scope': reg_std.get('覆盖部门', []),
                'level_coverage': level_coverage,
                'keywords': keywords,
                'special_rules': reg_std.get('特殊规则'),
                'file_name': file_name,
                'file_path': f"{reg_std.get('序列', '')}/{file_name}" if file_name else None,
                'version': 'V1.0',
                'status': 'active',
                'duty_count': reg_std.get('职责数量', 0),
                'description': description,
            }

            # 检查是否已存在
            if std_id in existing_by_registry:
                std = existing_by_registry[std_id]
                # 更新字段
                for key, value in std_data.items():
                    if value is not None and getattr(std, key) != value:
                        setattr(std, key, value)
                updated_count += 1
            else:
                # 创建新标准
                std = Standard(**std_data)
                db.session.add(std)
                synced_count += 1

        # 第二步：处理文件夹中有但不在注册表中的文件
        for file_info in folder_files:
            file_name = file_info['name']

            # 检查是否已存在（通过文件名）
            if file_name in existing_by_file:
                continue

            # 检查是否匹配注册表中的某个标准（通过文件名匹配）
            matched_reg = None
            for reg_std in registry_standards.values():
                reg_file = reg_std.get('标准文件', '')
                # 如果文件名相同或相似
                if reg_file == file_name:
                    matched_reg = reg_std
                    break
                # 尝试提取岗位名称进行匹配
                reg_job = reg_std.get('岗位名称', '')
                if reg_job and reg_job in file_name:
                    matched_reg = reg_std
                    break

            if matched_reg:
                # 已作为注册表标准处理，跳过
                continue

            # 这是一个新的、不在注册表中的标准
            # 从文件名解析岗位名称
            # 文件名格式: "序号、岗位名称-任职资格标准-V1.0.xlsx"
            # 或者: "7-8、岗位名称-任职资格标准-V1.0.xlsx"
            # 先去除序号（支持格式：数字+顿号，或者数字-数字+顿号）
            job_name = re.sub(r'^[0-9\-]+、', '', file_name).strip()
            # 按 "-" 分割取第一部分
            job_name = job_name.split('-')[0] if '-' in job_name else job_name
            # 去除扩展名
            job_name = job_name.replace('.xlsx', '').replace('.pdf', '').replace('.docx', '').strip()
            # 如果包含"岗位任职资格标准"，只保留前面的岗位名称部分
            if '岗位任职资格标准' in job_name:
                job_name = job_name.split('岗位任职资格标准')[0].strip()

            std = Standard(
                name=job_name or '未命名岗位',
                sequence=file_info['sequence'],
                file_name=file_name,
                file_path=file_info['path'],
                version='V1.0',
                status='active',
                department_scope=[],
                level_coverage=[],
                keywords=[],
                description='从文件夹自动导入（未在注册表中定义）',
            )
            db.session.add(std)
            synced_count += 1

        db.session.commit()

        return jsonify({
            'success': True,
            'message': f'同步完成：新增 {synced_count} 个，更新 {updated_count} 个',
            'synced': synced_count,
            'updated': updated_count,
            'total_files': len(folder_files),
            'total_registry': len(registry_standards),
        })

    except Exception as e:
        db.session.rollback()
        import traceback
        return jsonify({'error': f'同步失败: {str(e)}', 'detail': traceback.format_exc()}), 500


@bp.route('/sync/preview', methods=['GET'])
def preview_sync_standards():
    """预览同步结果（不实际执行）"""
    try:
        # 读取注册表
        registry = json.loads(REGISTRY_FILE.read_text(encoding='utf-8'))
        registry_standards = registry.get('岗位标准清单', [])

        # 获取数据库中现有标准
        existing_ids = {s.registry_id for s in Standard.query.filter(Standard.registry_id.isnot(None)).all()}

        new_standards = []
        for std in registry_standards:
            if std['id'] not in existing_ids:
                new_standards.append({
                    'id': std['id'],
                    'name': std.get('岗位名称', ''),
                    'sequence': std.get('序列', ''),
                    'file': std.get('标准文件', ''),
                })

        return jsonify({
            'new_count': len(new_standards),
            'existing_count': len(existing_ids),
            'new_standards': new_standards[:10],  # 只显示前10个
        })

    except Exception as e:
        return jsonify({'error': f'预览失败: {str(e)}'}), 500


@bp.route('/clear', methods=['POST'])
def clear_standards():
    """清空数据库中的所有标准"""
    try:
        # 删除所有标准职责
        StandardDuty.query.delete()
        # 删除所有标准
        Standard.query.delete()
        db.session.commit()
        return jsonify({'success': True, 'message': '数据库已清空'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'清空失败: {str(e)}'}), 500
def generate_standard():
    """AI 从岗位描述生成标准（流式）"""
    data = request.json
    job_name = data.get('job_name', '')
    department = data.get('department', '')
    sequence = data.get('sequence', 'S')
    levels = data.get('levels', ['P2', 'P3', 'P4', 'P5'])
    description = data.get('description', '')
    company_context = data.get('company_context', '傲雷集团 — 移动照明与电子产品制造商')

    user_prompt = f"""
## 岗位信息
- 岗位名称：{job_name}
- 所属序列：{sequence}
- 覆盖部门：{department}
- 需要覆盖的级别：{', '.join(levels)}
- 岗位背景：{description}
- 公司背景：{company_context}

请为该岗位生成一份完整的任职资格标准，覆盖所有指定级别。
"""

    def generate():
        try:
            for text in stream_analysis(STANDARD_GENERATION_PROMPT, user_prompt):
                yield f"data: {json.dumps({'type': 'chunk', 'content': text}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )


@bp.route('/<int:std_id>/review', methods=['POST'])
def review_standard(std_id):
    """AI 审查标准质量（六维度）"""
    std = Standard.query.get_or_404(std_id)

    # 构建标准文本
    duties = std.duties.all()
    duties_text = ''
    current_duty = ''
    for d in duties:
        if d.duty_name != current_duty:
            current_duty = d.duty_name
            duties_text += f"\n### {d.duty_name}\n"
        duties_text += f"- [{d.level}] {d.item_type}: {d.description}\n"

    user_prompt = f"""
## 待审核标准
- 岗位名称：{std.name}
- 所属序列：{std.sequence}
- 级别覆盖：{std.level_coverage}
- 版本：{std.version}

{duties_text}

请对该标准进行六维度审核。
"""

    def generate():
        try:
            for text in stream_analysis(STANDARD_REVIEW_PROMPT, user_prompt):
                yield f"data: {json.dumps({'type': 'chunk', 'content': text}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )
