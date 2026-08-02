"""
认证报告模型
"""
from database import db, BaseModel


class Report(BaseModel):
    __tablename__ = 'reports'

    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=True, index=True)
    standard_id = db.Column(db.Integer, db.ForeignKey('standards.id'), nullable=True)
    batch_item_id = db.Column(db.Integer, db.ForeignKey('batch_job_items.id'), nullable=True)

    # 员工快照 (冗余，便于搜索)
    employee_name = db.Column(db.String(128), nullable=True, index=True)
    employee_department = db.Column(db.String(256), nullable=True)
    current_position = db.Column(db.String(256), nullable=True)
    applied_position = db.Column(db.String(256), nullable=True)
    applied_level = db.Column(db.String(16), nullable=True, index=True)
    standard_name = db.Column(db.String(256), nullable=True)

    # 评分
    total_score = db.Column(db.Float, nullable=True)
    conclusion = db.Column(db.String(16), nullable=True, index=True)  # pass | conditional | fail
    dim_results_score = db.Column(db.Float, nullable=True)    # 关键成果 40%
    dim_behavior_score = db.Column(db.Float, nullable=True)   # 关键行为 35%
    dim_knowledge_score = db.Column(db.Float, nullable=True)  # 知识技能 15%
    dim_education_score = db.Column(db.Float, nullable=True)  # 学历经验 10%

    # 内容
    raw_markdown = db.Column(db.Text, nullable=True)
    ppt_filename = db.Column(db.String(256), nullable=True)
    saved_filename = db.Column(db.String(256), nullable=True)  # .md 文件路径

    status = db.Column(db.String(16), default='final')  # draft | final | archived
    ai_model = db.Column(db.String(64), nullable=True)
    report_type = db.Column(db.String(32), default='assessment', index=True)  # assessment 举证PPT审核 | standard_audit 标准审核

    line_items = db.relationship('ReportLineItem', backref='report', lazy='dynamic',
                                 cascade='all, delete-orphan',
                                 order_by='ReportLineItem.sort_order')

    __table_args__ = (
        db.Index('idx_report_conclusion_date', 'conclusion', 'created_at'),
        db.Index('idx_report_employee_date', 'employee_id', 'created_at'),
    )

    def to_dict(self, detailed=False):
        result = {
            'id': self.id,
            'employee_id': self.employee_id,
            'standard_id': self.standard_id,
            'employee_name': self.employee_name,
            'employee_department': self.employee_department,
            'current_position': self.current_position,
            'applied_position': self.applied_position,
            'applied_level': self.applied_level,
            'standard_name': self.standard_name,
            'total_score': self.total_score,
            'conclusion': self.conclusion,
            'dim_results_score': self.dim_results_score,
            'dim_behavior_score': self.dim_behavior_score,
            'dim_knowledge_score': self.dim_knowledge_score,
            'dim_education_score': self.dim_education_score,
            'ppt_filename': self.ppt_filename,
            'status': self.status,
            'ai_model': self.ai_model,
            'report_type': self.report_type or 'assessment',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if detailed:
            result['raw_markdown'] = self.raw_markdown
            result['line_items'] = [li.to_dict() for li in self.line_items.all()]
        return result


class ReportLineItem(BaseModel):
    __tablename__ = 'report_line_items'

    report_id = db.Column(db.Integer, db.ForeignKey('reports.id'), nullable=False, index=True)
    standard_duty_id = db.Column(db.Integer, db.ForeignKey('standard_duties.id'), nullable=True)

    duty_name = db.Column(db.String(256), nullable=True)
    item_number = db.Column(db.String(16), nullable=True)
    item_type = db.Column(db.String(32), nullable=True)
    standard_summary = db.Column(db.Text, nullable=True)
    evidence_summary = db.Column(db.Text, nullable=True)
    coverage = db.Column(db.String(16), nullable=True)   # full | partial | none
    score = db.Column(db.Float, nullable=True)
    issue_description = db.Column(db.Text, nullable=True)
    improvement_suggestion = db.Column(db.Text, nullable=True)
    sort_order = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'report_id': self.report_id,
            'duty_name': self.duty_name,
            'item_number': self.item_number,
            'item_type': self.item_type,
            'standard_summary': self.standard_summary,
            'evidence_summary': self.evidence_summary,
            'coverage': self.coverage,
            'score': self.score,
            'issue_description': self.issue_description,
            'improvement_suggestion': self.improvement_suggestion,
            'sort_order': self.sort_order,
        }
