"""
员工模型
"""
from database import db, BaseModel


class Employee(BaseModel):
    __tablename__ = 'employees'

    employee_code = db.Column(db.String(64), nullable=True, index=True)  # 工号
    name = db.Column(db.String(128), nullable=False, index=True)
    department = db.Column(db.String(256), nullable=True)
    position = db.Column(db.String(256), nullable=True)
    education = db.Column(db.String(128), nullable=True)
    major = db.Column(db.String(128), nullable=True)
    years_experience = db.Column(db.Float, nullable=True)
    years_in_current = db.Column(db.Float, nullable=True)  # 本岗位年限
    email = db.Column(db.String(128), nullable=True)
    phone = db.Column(db.String(32), nullable=True)
    extra = db.Column(db.JSON, nullable=True)  # 扩展字段
    is_active = db.Column(db.Boolean, default=True)

    reports = db.relationship('Report', backref='employee', lazy='dynamic',
                              order_by='Report.created_at.desc()')

    def to_dict(self):
        return {
            'id': self.id,
            'employee_code': self.employee_code,
            'name': self.name,
            'department': self.department,
            'position': self.position,
            'education': self.education,
            'major': self.major,
            'years_experience': self.years_experience,
            'years_in_current': self.years_in_current,
            'email': self.email,
            'phone': self.phone,
            'extra': self.extra,
            'is_active': self.is_active,
            'report_count': self.reports.count(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
