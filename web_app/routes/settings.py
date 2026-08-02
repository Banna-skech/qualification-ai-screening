"""
系统设置路由
"""
from flask import Blueprint, jsonify, request

from database import db
from models.setting import Setting
from services.ai_service import reload_client

bp = Blueprint('settings', __name__, url_prefix='/api/settings')


@bp.route('', methods=['GET'])
def get_settings():
    """获取所有设置"""
    settings = Setting.query.all()
    result = {}
    for s in settings:
        # 敏感信息脱敏
        if 'key' in s.key.lower() or 'secret' in s.key.lower() or 'api' in s.key.lower():
            val = s.value
            if val and len(val) > 8:
                val = val[:4] + '****' + val[-4:]
            result[s.key] = val
        else:
            result[s.key] = s.value
    return jsonify(result)


@bp.route('/<key>', methods=['GET'])
def get_setting(key):
    """获取单个设置"""
    s = Setting.query.filter_by(key=key).first()
    if not s:
        return jsonify({'error': '设置不存在'}), 404
    return jsonify(s.to_dict())


@bp.route('/<key>', methods=['PUT'])
def update_setting(key):
    """更新设置"""
    data = request.json
    s = Setting.query.filter_by(key=key).first()
    if not s:
        s = Setting(key=key, value=data.get('value', ''))
        db.session.add(s)
    else:
        s.value = data.get('value', s.value)

    if 'description' in data:
        s.description = data['description']

    db.session.commit()

    # 如果修改了 API key，重新加载客户端
    if key == 'deepseek_api_key' and data.get('value'):
        reload_client(api_key=data['value'])
    if key == 'ai_base_url' and data.get('value'):
        reload_client(base_url=data['value'])

    return jsonify(s.to_dict())


def seed_defaults():
    """种子默认设置"""
    from config import Config
    defaults = [
        ('deepseek_api_key', Config.DEEPSEEK_API_KEY or '', 'DeepSeek API Key（请在环境变量中设置）'),
        ('ai_model', Config.AI_MODEL, 'AI 模型名称'),
        ('ai_base_url', Config.AI_BASE_URL, 'AI API 地址'),
        ('app_version', '2.0', '系统版本'),
    ]
    for key, value, desc in defaults:
        if not Setting.query.filter_by(key=key).first():
            db.session.add(Setting(key=key, value=value, description=desc))
    db.session.commit()
