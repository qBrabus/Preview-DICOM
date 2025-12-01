"""Add database indexes for performance

Revision ID: 002_add_indexes
Revises: 001_add_security_tables
Create Date: 2025-11-27 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002_add_indexes'
down_revision = '001_add_security_tables'
branch_labels = None
depends_on = None


def upgrade():
    # Create indexes on frequently queried columns
    op.create_index('ix_patients_orthanc_patient_id', 'patients', ['orthanc_patient_id'])
    op.create_index('ix_patients_dicom_study_uid', 'patients', ['dicom_study_uid'])
    op.create_index('ix_patients_last_visit', 'patients', ['last_visit'])
    op.create_index('ix_users_status', 'users', ['status'])
    op.create_index('ix_users_group_id', 'users', ['group_id'])
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_timestamp', 'audit_logs', ['timestamp'])
    op.create_index('ix_audit_logs_resource_type', 'audit_logs', ['resource_type'])


def downgrade():
    op.drop_index('ix_audit_logs_resource_type', 'audit_logs')
    op.drop_index('ix_audit_logs_timestamp', 'audit_logs')
    op.drop_index('ix_audit_logs_user_id', 'audit_logs')
    op.drop_index('ix_users_group_id', 'users')
    op.drop_index('ix_users_status', 'users')
    op.drop_index('ix_patients_last_visit', 'patients')
    op.drop_index('ix_patients_dicom_study_uid', 'patients')
    op.drop_index('ix_patients_orthanc_patient_id', 'patients')
