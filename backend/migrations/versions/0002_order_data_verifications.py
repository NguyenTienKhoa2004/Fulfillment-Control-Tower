"""Audit thủ công cập nhật và xác minh dữ liệu nguồn của đơn hàng."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002_order_data_verifications"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "order_data_verifications",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("order_id", sa.Uuid(), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("previous_data", postgresql.JSONB(), nullable=False),
        sa.Column("verified_data", postgresql.JSONB(), nullable=False),
    )
    op.create_index(
        "ix_order_data_verifications_order_id", "order_data_verifications", ["order_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_order_data_verifications_order_id", table_name="order_data_verifications")
    op.drop_table("order_data_verifications")
