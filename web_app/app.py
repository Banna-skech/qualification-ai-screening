"""
任职资格认证 AI 初筛系统 — Web 后端
Flask + Anthropic SDK (DeepSeek 兼容) + SQLAlchemy + SQLite
"""
import json
import os
import sys
from pathlib import Path

from flask import Flask, render_template

from config import Config, STANDARDS_DIR, REGISTRY_FILE
from database import init_app
from routes import register_all
from routes.settings import seed_defaults


def create_app():
    """工厂模式创建 Flask 应用"""
    app = Flask(__name__)
    app.config.from_object(Config)

    # 数据库
    init_app(app)

    # 种子默认设置
    with app.app_context():
        seed_defaults()

    # 注册所有路由蓝图
    register_all(app)

    # 友好的错误提示
    @app.errorhandler(413)
    def file_too_large(e):
        from flask import jsonify
        limit_mb = app.config['MAX_CONTENT_LENGTH'] // (1024 * 1024)
        return jsonify({"error": f"文件过大，超出 {limit_mb}MB 上传限制，请压缩PPT中的图片后重试"}), 413

    # ============================================================
    # 主页面
    # ============================================================
    @app.route('/')
    def index():
        """渲染主页面 — 注入标准列表和数据库统计"""
        try:
            registry = json.loads(REGISTRY_FILE.read_text(encoding='utf-8'))
        except Exception:
            registry = {"岗位标准清单": []}

        # 尝试获取数据库统计
        stats = {}
        try:
            from models.report import Report
            from models.standard import Standard
            from models.employee import Employee
            stats = {
                'report_count': Report.query.filter(Report.status == 'final').count(),
                'standard_count': Standard.query.filter(Standard.status == 'active').count(),
                'employee_count': Employee.query.filter(Employee.is_active == True).count(),
            }
        except Exception:
            stats = {'report_count': 0, 'standard_count': 0, 'employee_count': 0}

        return render_template('index.html',
                               standards=registry["岗位标准清单"],
                               stats=stats,
                               has_api_key=bool(Config.DEEPSEEK_API_KEY))

    return app


# ============================================================
# 启动
# ============================================================
if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print("=" * 60)
    print("  Job Qualification AI Screening System v2.0")
    print("=" * 60)

    standards_count = len(list(STANDARDS_DIR.glob('*'))) if STANDARDS_DIR.exists() else 0
    print(f"  Standards: {standards_count} files")
    port = int(os.environ.get('PORT', 5890))
    print(f"  URL: http://localhost:{port}")
    print("=" * 60)

    app = create_app()
    debug = os.environ.get('FLASK_DEBUG', '0') == '1'
    app.run(host='0.0.0.0', port=port, debug=debug, threaded=True)
