"""
路由蓝图注册
"""


def register_all(app):
    from .analyze import bp as analyze_bp
    from .reports import bp as reports_bp
    from .standards import bp as standards_bp
    from .employees import bp as employees_bp
    from .dashboard import bp as dashboard_bp
    from .batch import bp as batch_bp
    from .export import bp as export_bp
    from .settings import bp as settings_bp

    app.register_blueprint(analyze_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(standards_bp)
    app.register_blueprint(employees_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(batch_bp)
    app.register_blueprint(export_bp)
    app.register_blueprint(settings_bp)
