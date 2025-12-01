"""Add revoked tokens and user sessions tables

Revision ID: 001_add_security_tables
Revises: 
Create Date: 2025-11-27 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001_add_security_tables'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create revoked_tokens table
    op.create_table(
        'revoked_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('jti', sa.String(), nullable=False),
        sa.Column('token_type', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_revoked_tokens_id', 'revoked_tokens', ['id'])
    op.create_index('ix_revoked_tokens_jti', 'revoked_tokens', ['jti'], unique=True)

    # Create user_sessions table
    op.create_table(
        'user_sessions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('device_info', sa.String(), nullable=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('user_agent', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_activity', sa.DateTime(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('user_sessions')
    op.drop_index('ix_revoked_tokens_jti', 'revoked_tokens')
    op.drop_index('ix_revoked_tokens_id', 'revoked_tokens')
    op.drop_table('revoked_tokens')
