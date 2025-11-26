"""Initial schema

Revision ID: 0001
Revises: 
Create Date: 2024-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'groups',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name', sa.String(), nullable=False, unique=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('can_edit_patients', sa.Boolean(), default=False),
        sa.Column('can_export_data', sa.Boolean(), default=False),
        sa.Column('can_manage_users', sa.Boolean(), default=False),
        sa.Column('can_view_images', sa.Boolean(), default=True),
    )

    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('email', sa.String(), nullable=False, unique=True, index=True),
        sa.Column('full_name', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('role', sa.String(), default='user'),
        sa.Column('status', sa.String(), default='active'),
        sa.Column('expiration_date', sa.Date(), nullable=True),
        sa.Column('group_id', sa.Integer(), sa.ForeignKey('groups.id')),
    )

    op.create_table(
        'patients',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('external_id', sa.String(), nullable=False, unique=True),
        sa.Column('first_name', sa.String(), nullable=False),
        sa.Column('last_name', sa.String(), nullable=False),
        sa.Column('condition', sa.String(), nullable=True),
        sa.Column('date_of_birth', sa.String(), nullable=True),
        sa.Column('last_visit', sa.String(), nullable=True),
        sa.Column('dicom_study_uid', sa.String(), nullable=True),
        sa.Column('orthanc_patient_id', sa.String(), nullable=True),
        sa.Column('status', sa.String(), default='À interpréter'),
    )

    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('resource_id', sa.String(), nullable=True),
        sa.Column('resource_type', sa.String(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
    )

def downgrade():
    op.drop_table('audit_logs')
    op.drop_table('patients')
    op.drop_table('users')
    op.drop_table('groups')
