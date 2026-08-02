"""
批量作业模型
"""
from database import db, BaseModel


class BatchJob(BaseModel):
    __tablename__ = 'batch_jobs'

    name = db.Column(db.String(256), nullable=True)
    status = db.Column(db.String(16), default='pending')  # pending | running | completed | failed
    total_items = db.Column(db.Integer, default=0)
    completed_items = db.Column(db.Integer, default=0)
    failed_items = db.Column(db.Integer, default=0)
    summary_markdown = db.Column(db.Text, nullable=True)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)

    items = db.relationship('BatchJobItem', backref='batch_job', lazy='dynamic',
                            cascade='all, delete-orphan', order_by='BatchJobItem.sort_order')

    def to_dict(self, include_items=False):
        result = {
            'id': self.id,
            'name': self.name,
            'status': self.status,
            'total_items': self.total_items,
            'completed_items': self.completed_items,
            'failed_items': self.failed_items,
            'summary_markdown': self.summary_markdown,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_items:
            result['items'] = [it.to_dict() for it in self.items.all()]
        return result


class BatchJobItem(BaseModel):
    __tablename__ = 'batch_job_items'

    batch_id = db.Column(db.Integer, db.ForeignKey('batch_jobs.id'), nullable=False, index=True)
    ppt_filename = db.Column(db.String(256), nullable=True)
    ppt_text = db.Column(db.Text, nullable=True)
    employee_name = db.Column(db.String(128), nullable=True)
    standard_id = db.Column(db.Integer, db.ForeignKey('standards.id'), nullable=True)
    target_level = db.Column(db.String(16), nullable=True)
    status = db.Column(db.String(16), default='pending')  # pending | running | completed | failed
    report_id = db.Column(db.Integer, db.ForeignKey('reports.id'), nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    sort_order = db.Column(db.Integer, default=0)

    report = db.relationship('Report', backref='batch_item', uselist=False,
                             foreign_keys=[report_id])

    def to_dict(self):
        result = {
            'id': self.id,
            'batch_id': self.batch_id,
            'ppt_filename': self.ppt_filename,
            'employee_name': self.employee_name,
            'standard_id': self.standard_id,
            'target_level': self.target_level,
            'status': self.status,
            'report_id': self.report_id,
            'error_message': self.error_message,
            'sort_order': self.sort_order,
        }
        if self.report_id and self.report:
            result['report_summary'] = {
                'total_score': self.report.total_score,
                'conclusion': self.report.conclusion,
            }
        return result
