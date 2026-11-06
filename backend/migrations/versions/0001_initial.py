"""Initial schema: bốn bảng nghiệp vụ, indexes, constraints và PostgreSQL enums.

Snapshot cố định, không import ORM hiện tại để migration cũ luôn tái lập được.
"""

import sqlalchemy as sa
from alembic import context, op
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

ENUM_VALUES = {
    "role": ("LOGISTICS_COORDINATOR", "STORE_STAFF"),
    "warehousestatus": ("NOT_READY", "READY", "UNKNOWN"),
    "deliverystatus": ("NOT_DISPATCHED", "DISPATCHED", "DELIVERED", "UNKNOWN"),
    "riskstatus": ("NOT_CHECKED", "AT_RISK", "CLEAR", "UNKNOWN"),
    "riskcode": (
        "WAREHOUSE_NOT_READY_BEFORE_HANDOVER",
        "HANDOVER_OVERDUE",
        "DELIVERY_ETA_LATE",
        "DELIVERY_OVERDUE",
    ),
    "alerttype": ("RISK", "DELAYED"),
    "incidentstatus": ("NEW", "IN_PROGRESS", "RESOLVED"),
    "eventtype": ("DETECTED", "ACCEPTED", "NOTE_ADDED", "RESOLVED"),
}


def baseline_metadata() -> sa.MetaData:
    metadata = sa.MetaData()

    def enum(name):
        return postgresql.ENUM(*ENUM_VALUES[name], name=name, create_type=False)

    def timestamp(name, nullable=True):
        return sa.Column(name, sa.DateTime(timezone=True), nullable=nullable)

    sa.Table(
        "profiles",
        metadata,
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("role", enum("role"), nullable=False),
        sa.Column("store_code", sa.String(20), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False),
    )
    sa.Table(
        "orders",
        metadata,
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("order_number", sa.String(40), nullable=False, unique=True),
        sa.Column("store_code", sa.String(20), nullable=False, index=True),
        sa.Column("customer_reference", sa.String(120), nullable=False),
        timestamp("planned_handover_at"),
        timestamp("original_delivery_due_at"),
        timestamp("estimated_delivery_at"),
        timestamp("dispatched_at"),
        timestamp("delivered_at"),
        sa.Column("warehouse_status", enum("warehousestatus"), nullable=False),
        sa.Column("delivery_status", enum("deliverystatus"), nullable=False),
        timestamp("data_verified_at"),
        sa.Column("risk_status", enum("riskstatus"), nullable=False),
        sa.Column("risk_reason", sa.Text(), nullable=True),
        sa.Column(
            "risk_assessments",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        timestamp("assessed_at"),
    )
    sa.Table(
        "incidents",
        metadata,
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("order_id", sa.Uuid(), sa.ForeignKey("orders.id"), nullable=False, index=True),
        sa.Column("risk_code", enum("riskcode"), nullable=False),
        sa.Column("alert_type", enum("alerttype"), nullable=False),
        sa.Column("status", enum("incidentstatus"), nullable=False),
        sa.Column("assignee_id", sa.Uuid(), sa.ForeignKey("profiles.id"), nullable=True),
        timestamp("created_at", nullable=False),
        timestamp("accepted_at"),
        timestamp("resolved_at"),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("order_id", "risk_code"),
    )
    sa.Table(
        "incident_events",
        metadata,
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "incident_id", sa.Uuid(), sa.ForeignKey("incidents.id"), nullable=False, index=True
        ),
        sa.Column("type", enum("eventtype"), nullable=False),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("profiles.id"), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        timestamp("created_at", nullable=False),
    )
    return metadata


def upgrade() -> None:
    bind = op.get_bind()
    for name, values in ENUM_VALUES.items():
        postgresql.ENUM(*values, name=name).create(bind, checkfirst=not context.is_offline_mode())
    for table in baseline_metadata().sorted_tables:
        table.create(bind, checkfirst=False)


def downgrade() -> None:
    bind = op.get_bind()
    for table in reversed(baseline_metadata().sorted_tables):
        table.drop(bind, checkfirst=False)
    for name, values in reversed(ENUM_VALUES.items()):
        postgresql.ENUM(*values, name=name).drop(bind, checkfirst=not context.is_offline_mode())
