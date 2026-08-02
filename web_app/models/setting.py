"""
系统设置模型
"""
from database import db, BaseModel


class Setting(BaseModel):
    __tablename__ = 'settings'

    key = db.Column(db.String(128), unique=True, nullable=False, index=True)
    value = db.Column(db.Text, nullable=True)
    description = db.Column(db.String(256), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'key': self.key,
            'value': self.value,
            'description': self.description,
        }
