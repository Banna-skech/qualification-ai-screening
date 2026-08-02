"""
数据迁移脚本 — 从文件系统导入数据到数据库
将 standards_registry.json 中的标准导入到 Standard 表
将 输出报告/ 中的已有报告导入到 Report 表
"""
import json
import re
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import create_app
from database import db
from models.standard import Standard, StandardDuty
from models.report import Report
from models.employee import Employee
from config import REGISTRY_FILE, STANDARDS_DIR, OUTPUT_DIR
from services.parser_service import parse_pdf, parse_xlsx, find_standard_file


def migrate_standards():
    """从 standards_registry.json 导入标准到数据库"""
    print("\n[Standards] Migrating...")

    if not REGISTRY_FILE.exists():
        print("  [WARN] standards_registry.json not found, skip")
        return

    registry = json.loads(REGISTRY_FILE.read_text(encoding='utf-8'))

    for std_data in registry.get("岗位标准清单", []):
        registry_id = std_data.get("id", "")
        name = std_data.get("岗位名称", "")
        std_file = std_data.get("标准文件", "")

        # 检查是否已存在
        existing = Standard.query.filter_by(registry_id=registry_id).first()
        if existing:
            print(f"  [SKIP] Already exists: {name}")
            continue

        # 尝试解析标准文件获取结构化的职责（支持序列子文件夹）
        filepath = find_standard_file(STANDARDS_DIR, std_file) or (STANDARDS_DIR / std_file)
        duties = []
        if filepath.exists():
            try:
                if str(filepath).endswith('.pdf'):
                    parsed = parse_pdf(str(filepath))
                elif str(filepath).endswith('.xlsx'):
                    parsed = parse_xlsx(str(filepath))
                else:
                    parsed = None

                if parsed:
                    # 尝试从解析内容中提取结构化职责
                    duties = _extract_duties_from_text(parsed['full_text'], std_data)
            except Exception as e:
                print(f"  [WARN] Parse {std_file} failed: {e}")

        # 创建标准记录
        std = Standard(
            registry_id=registry_id,
            name=name,
            sequence=std_data.get("序列", "").replace("序列", "").replace("P", "P").replace("S", "S").replace("T", "T"),
            department_scope=std_data.get("覆盖部门", []),
            level_coverage=std_data.get("级别覆盖", []),
            keywords=std_data.get("关键词", []),
            special_rules=std_data.get("特殊规则"),
            version="V1.0",
            status="active",
            file_name=std_file,
            file_path=str(filepath) if filepath.exists() else None,
            duty_count=std_data.get("职责数量", len(duties)),
        )
        db.session.add(std)
        db.session.flush()

        # 添加职责条目
        for i, duty in enumerate(duties):
            sd = StandardDuty(
                standard_id=std.id,
                level=duty.get("level", "ALL"),
                duty_number=duty.get("duty_number", i + 1),
                duty_name=duty.get("duty_name", ""),
                item_number=duty.get("item_number", f"{i+1}.1"),
                item_type=duty.get("item_type", "key_result"),
                description=duty.get("description", ""),
                sort_order=i,
            )
            db.session.add(sd)

        print(f"  [OK] Imported: {name} ({len(duties)} duties)")

    db.session.commit()
    print(f"  Done! Total standards: {Standard.query.count()}")


def _extract_duties_from_text(text: str, std_data: dict) -> list:
    """从标准文件文本中尝试提取职责结构"""
    duties = []
    duty_count = std_data.get("职责数量", 0)

    # 查找 "职责一" "职责二" 等模式
    for i in range(1, max(duty_count + 1, 15)):
        pattern = rf'职责\s*{_num_to_cn(i)}[：:\s]*(.+?)(?=职责\s*{_num_to_cn(i+1)}|$)'
        match = re.search(pattern, text, re.DOTALL)
        if match:
            duty_name = match.group(1).strip()[:100]
            duties.append({
                "level": "ALL",
                "duty_number": i,
                "duty_name": f"职责{i}：{duty_name}",
                "item_number": f"{i}.1",
                "item_type": "key_result",
                "description": duty_name[:256],
            })
        else:
            # 尝试匹配 "第X部分" 或 "Part X"
            pattern2 = rf'(?:第\s*{i}\s*部分|Part\s*{i})[：:\s]*(.+?)(?=第\s*{i+1}\s*部分|Part\s*{i+1}|$)'
            match2 = re.search(pattern2, text, re.DOTALL)
            if match2:
                duty_name = match2.group(1).strip()[:100]
                duties.append({
                    "level": "ALL",
                    "duty_number": i,
                    "duty_name": duty_name[:256],
                    "item_number": f"{i}.1",
                    "item_type": "key_result",
                    "description": duty_name[:256],
                })

    return duties


def _num_to_cn(n: int) -> str:
    """数字转中文"""
    cn = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
          "十一", "十二", "十三", "十四", "十五"]
    return cn[n] if n < len(cn) else str(n)


def migrate_reports():
    """从 输出报告/ 目录导入已有报告到数据库"""
    print("\n[Reports] Migrating...")

    if not OUTPUT_DIR.exists():
        print("  [WARN] Output dir not found, skip")
        return

    md_files = list(OUTPUT_DIR.glob("*.md"))
    if not md_files:
        print("  No report files found")
        return

    for md_file in md_files:
        filename = md_file.name

        # 检查是否已导入
        existing = Report.query.filter_by(saved_filename=filename).first()
        if existing:
            print(f"  [SKIP] Already exists: {filename}")
            continue

        content = md_file.read_text(encoding='utf-8')

        # 从文件名提取信息: 姓名_岗位_级别_认证报告_日期.md
        name_part = filename.rsplit('.', 1)[0]
        parts = name_part.split('_')

        emp_name = parts[0] if len(parts) > 0 else "未知"
        emp_position = parts[1] if len(parts) > 1 else ""
        emp_level = parts[2] if len(parts) > 2 else ""

        # 尝试从内容提取更多信息
        dept_match = re.search(r'所在部门.*?[：:]\s*(.+?)(?:\||\n|$)', content)
        dept = dept_match.group(1).strip() if dept_match else ""

        # 提取总分
        score_match = re.search(r'\*\*综合总分\*\*.*?\|\s*[\d.]+\s*\|\s*([\d.]+)', content)
        if not score_match:
            score_match = re.search(r'总\s*分.*?\|\s*[\d.]+\s*\|\s*([\d.]+)', content)
        total_score = float(score_match.group(1)) if score_match else None

        # 提取结论
        conclusion = 'conditional'
        if '✅ 通过' in content and '有条件' not in content:
            conclusion = 'pass'
        elif '❌ 不通过' in content:
            conclusion = 'fail'

        # 查找或创建员工
        employee = None
        if emp_name and emp_name != '未知':
            employee = Employee.query.filter_by(name=emp_name).first()
            if not employee:
                employee = Employee(
                    name=emp_name,
                    department=dept,
                    position=emp_position,
                )
                db.session.add(employee)
                db.session.flush()

        report = Report(
            employee_id=employee.id if employee else None,
            employee_name=emp_name,
            employee_department=dept,
            applied_position=emp_position,
            applied_level=emp_level,
            total_score=total_score,
            conclusion=conclusion,
            raw_markdown=content,
            saved_filename=filename,
            status='final',
            ai_model='deepseek-V4-pro',
        )
        db.session.add(report)
        print(f"  [OK] Imported: {filename} (score: {total_score}, conclusion: {conclusion})")

    db.session.commit()
    print(f"  Done! Total reports: {Report.query.count()}")


def main():
    app = create_app()
    with app.app_context():
        print("=" * 50)
        print("[Migration] Starting...")
        print("=" * 50)

        migrate_standards()
        migrate_reports()

        print("\n" + "=" * 50)
        print("[Migration] Done!")
        print(f"   Standards: {Standard.query.count()}")
        print(f"   Reports: {Report.query.count()}")
        print(f"   Employees: {Employee.query.count()}")
        print("=" * 50)


if __name__ == '__main__':
    main()
