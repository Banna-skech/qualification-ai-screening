"""
报告比较组模型
"""
from database import db, BaseModel


class ComparisonSet(BaseModel):
    __tablename__ = 'comparison_sets'

    name = db.Column(db.String(256), nullable=False)
    description = db.Column(db.Text, nullable=True)

    items = db.relationship('ComparisonSetItem', backref='comparison_set', lazy='dynamic',
                            cascade='all, delete-orphan')

    def to_dict(self, include_items=False):
        result = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_items:
            result['items'] = [it.to_dict() for it in self.items.all()]
        return result


class ComparisonSetItem(BaseModel):
    __tablename__ = 'comparison_set_items'

    set_id = db.Column(db.Integer, db.ForeignKey('comparison_sets.id'), nullable=False, index=True)
    report_id = db.Column(db.Integer, db.ForeignKey('reports.id'), nullable=False)
    sort_order = db.Column(db.Integer, default=0)

    report = db.relationship('Report')

    def to_dict(self):
        return {
            'id': self.id,
            'set_id': self.set_id,
            'report_id': self.report_id,
            'sort_order': self.sort_order,
            'employee_name': self.report.employee_name if self.report else None,
            'total_score': self.report.total_score if self.report else None,
            'conclusion': self.report.conclusion if self.report else None,
        }
