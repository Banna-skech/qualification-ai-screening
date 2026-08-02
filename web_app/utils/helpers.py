"""
通用工具函数
"""
import re
from datetime import datetime


def extract_level_from_filename(filename: str) -> str:
    """从文件名提取申报级别，如 'S4-3'"""
    m = re.search(r'[SPT]\d-\d', filename)
    return m.group(0) if m else ''


def format_datetime(dt, fmt='%Y-%m-%d %H:%M'):
    if dt is None:
        return ''
    return dt.strftime(fmt)


def now_utc():
    return datetime.utcnow()
