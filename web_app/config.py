"""
任职资格认证系统 - 配置
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = WEB_DIR / 'instance'
INSTANCE_DIR.mkdir(exist_ok=True)

STANDARDS_DIR = BASE_DIR / "岗位标准"
REGISTRY_FILE = BASE_DIR / "标准注册表" / "standards_registry.json"
OUTPUT_DIR = BASE_DIR / "输出报告"
UPLOAD_DIR = WEB_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'qual-ai-screening-2026-production-key')
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        f'sqlite:///{INSTANCE_DIR / "qualification.db"}'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # 并行分析时多个请求同时写库，SQLite需要等待锁释放（默认立即报database is locked）
    SQLALCHEMY_ENGINE_OPTIONS = {'connect_args': {'timeout': 30}}
    MAX_CONTENT_LENGTH = 300 * 1024 * 1024  # 300MB（举证PPT含大量截图，容量普遍较大）

    # AI API 配置 — 请设置环境变量 DEEPSEEK_API_KEY
    DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY', '')
    AI_MODEL = os.environ.get('AI_MODEL', 'deepseek-V4-pro')
    AI_BASE_URL = os.environ.get('AI_BASE_URL', 'https://api.deepseek.com/anthropic')
    AI_MAX_TOKENS = int(os.environ.get('AI_MAX_TOKENS', '8192'))
    AI_TEMPERATURE = float(os.environ.get('AI_TEMPERATURE', '0.3'))
