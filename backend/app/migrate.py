"""Chạy migration; nhận diện an toàn database cũ được tạo bằng create_all."""

from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text

from app.db import engine

BASELINE = "0001_initial"


def upgrade_database() -> None:
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    # Ngăn hai lệnh setup cùng sửa schema; stamp và upgrade cùng một transaction.
    with engine.begin() as connection:
        connection.execute(text("SELECT pg_advisory_xact_lock(72631042)"))
        config.attributes["connection"] = connection
        current = MigrationContext.configure(connection)
        if not current.get_current_heads():
            baseline = ScriptDirectory.from_config(config).get_revision(BASELINE)
            metadata = baseline.module.baseline_metadata()
            expected = set(metadata.tables)
            existing = set(inspect(connection).get_table_names())
            if existing & expected:
                comparison = MigrationContext.configure(
                    connection,
                    opts={
                        "compare_type": True,
                        "compare_server_default": True,
                        "include_object": lambda obj, name, kind, reflected, other: (
                            kind != "table" or name in expected
                        ),
                    },
                )
                differences = compare_metadata(comparison, metadata)
                if differences:
                    raise RuntimeError(
                        "Schema cũ khác baseline; dừng migration để giữ dữ liệu. "
                        "Cần đối chiếu schema trước khi stamp/upgrade."
                    )
                command.stamp(config, BASELINE)
                print("Đã ghi nhận schema cũ ở baseline; giữ nguyên dữ liệu.")
        command.upgrade(config, "head")
    print("Database đã cập nhật đến migration head.")


if __name__ == "__main__":
    upgrade_database()
