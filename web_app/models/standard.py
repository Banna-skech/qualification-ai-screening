"""
岗位标准模型
"""
from database import db, BaseModel


class Standard(BaseModel):
    __tablename__ = 'standards'

    name = db.Column(db.String(256), nullable=False, index=True)
    sequence = db.Column(db.String(16), nullable=True)  # P/S/T
    department_scope = db.Column(db.JSON, nullable=True)  # ["手电事业部", ...]
    level_coverage = db.Column(db.JSON, nullable=True)   # ["P2","P3","P4","P5"]
    keywords = db.Column(db.JSON, nullable=True)          # ["GTM","上市",...]
    special_rules = db.Column(db.Text, nullable=True)
    description = db.Column(db.Text, nullable=True)
    version = db.Column(db.String(32), default='V1.0')
    status = db.Column(db.String(16), default='active')   # active | archived | draft
    file_name = db.Column(db.String(256), nullable=True)  # 原始文件名
    file_path = db.Column(db.String(512), nullable=True)
    duty_count = db.Column(db.Integer, default=0)
    registry_id = db.Column(db.String(64), nullable=True, index=True)  # 对应 registry JSON 的 id

    duties = db.relationship('StandardDuty', backref='standard', lazy='dynamic',
                             cascade='all, delete-orphan',
                             order_by='StandardDuty.sort_order')

    def to_dict(self, include_duties=False):
        result = {
            'id': self.id,
            'registry_id': self.registry_id,
            'name': self.name,
            'sequence': self.sequence,
            'department_scope': self.department_scope,
            'level_coverage': self.level_coverage,
            'keywords': self.keywords,
            'special_rules': self.special_rules,
            'description': self.description,
            'version': self.version,
            'status': self.status,
            'file_name': self.file_name,
            'file_path': self.file_path,
            'duty_count': self.duty_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_duties:
            result['duties'] = [d.to_dict() for d in self.duties.all()]
        return result


class StandardDuty(BaseModel):
    __tablename__ = 'standard_duties'

    standard_id = db.Column(db.Integer, db.ForeignKey('standards.id'), nullable=False, index=True)
    level = db.Column(db.String(16), nullable=True, index=True)  # "S4" or "ALL"
    duty_number = db.Column(db.Integer, nullable=True)
    duty_name = db.Column(db.String(256), nullable=True)
    item_number = db.Column(db.String(16), nullable=True)   # "1.1"
    item_type = db.Column(db.String(32), nullable=True)     # key_result | key_behavior | knowledge | education
    description = db.Column(db.Text, nullable=False)
    weight_override = db.Column(db.Float, nullable=True)
    sort_order = db.Column(db.Integer, default=0)

    __table_args__ = (
        db.Index('idx_std_level_duty', 'standard_id', 'level', 'duty_number', 'sort_order'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'standard_id': self.standard_id,
            'level': self.level,
            'duty_number': self.duty_number,
            'duty_name': self.duty_name,
            'item_number': self.item_number,
            'item_type': self.item_type,
            'description': self.description,
            'weight_override': self.weight_override,
            'sort_order': self.sort_order,
        }
