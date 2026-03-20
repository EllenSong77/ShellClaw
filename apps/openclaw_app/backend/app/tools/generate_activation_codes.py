from __future__ import annotations

import argparse
import csv
import json
import secrets
import string
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.db.session import SessionLocal
from app.models.activation_code import ActivationCode
from app.models.enums import Plan


ALPHABET = string.ascii_uppercase + string.digits


@dataclass(frozen=True)
class GeneratedCode:
    code: str
    target_plan: str | None
    duration_days: int | None
    max_uses: int
    expires_at: str | None
    display_name: str | None
    bind_email: str | None
    note: str | None


class _CsvSink:
    def __init__(self) -> None:
        self.parts: list[str] = []

    def write(self, chunk: str) -> int:
        self.parts.append(chunk)
        return len(chunk)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Batch generate ShellClaw activation codes.")
    parser.add_argument("--count", type=int, required=True, help="Number of activation codes to generate.")
    parser.add_argument("--plan", choices=[plan.value for plan in Plan], default=None, help="Plan granted by the code.")
    parser.add_argument("--duration-days", type=int, default=None, help="Grant duration in days.")
    parser.add_argument("--max-uses", type=int, default=1, help="Maximum uses per activation code.")
    parser.add_argument("--expires-in-days", type=int, default=90, help="Expiration in days from now. Use 0 for no expiry.")
    parser.add_argument("--prefix", default="SHELL", help="Human-visible code prefix.")
    parser.add_argument("--display-name", default=None, help="Optional label shown in activation success messages.")
    parser.add_argument("--bind-email", default=None, help="Optional email that can exclusively use these codes.")
    parser.add_argument("--note", default=None, help="Internal note stored with the codes.")
    parser.add_argument("--format", choices=["csv", "json"], default="csv", help="Rendered output format.")
    parser.add_argument("--output", default=None, help="Optional file path for rendered output.")
    return parser.parse_args()


def random_block(length: int = 4) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(length))


def generate_code_value(prefix: str, existing: set[str]) -> str:
    normalized_prefix = "".join(ch for ch in prefix.upper() if ch in ALPHABET) or "SHELL"
    while True:
        candidate = f"{normalized_prefix}-{random_block()}-{random_block()}"
        if candidate not in existing:
            existing.add(candidate)
            return candidate


def render_csv(rows: list[GeneratedCode]) -> str:
    sink = _CsvSink()
    writer = csv.DictWriter(
        sink,
        fieldnames=[
            "code",
            "target_plan",
            "duration_days",
            "max_uses",
            "expires_at",
            "display_name",
            "bind_email",
            "note",
        ],
    )
    writer.writeheader()
    for row in rows:
        writer.writerow(asdict(row))
    return "".join(sink.parts)


def generate_codes(args: argparse.Namespace) -> tuple[list[GeneratedCode], str]:
    if args.count <= 0:
        raise SystemExit("--count must be greater than 0")
    if args.max_uses <= 0:
        raise SystemExit("--max-uses must be greater than 0")
    if args.duration_days is not None and args.duration_days <= 0:
        raise SystemExit("--duration-days must be greater than 0")

    session = SessionLocal()
    try:
        existing_codes = {row[0] for row in session.query(ActivationCode.code).all()}
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=args.expires_in_days) if args.expires_in_days > 0 else None
        target_plan = Plan(args.plan) if args.plan else None

        rows: list[GeneratedCode] = []
        for _ in range(args.count):
            code_value = generate_code_value(args.prefix, existing_codes)
            session.add(
                ActivationCode(
                    code=code_value,
                    max_uses=args.max_uses,
                    used_count=0,
                    enabled=True,
                    expires_at=expires_at,
                    bind_email=args.bind_email,
                    target_plan=target_plan,
                    duration_days=args.duration_days,
                    display_name=args.display_name,
                    note=args.note,
                )
            )
            rows.append(
                GeneratedCode(
                    code=code_value,
                    target_plan=target_plan.value if target_plan else None,
                    duration_days=args.duration_days,
                    max_uses=args.max_uses,
                    expires_at=expires_at.isoformat() if expires_at else None,
                    display_name=args.display_name,
                    bind_email=args.bind_email,
                    note=args.note,
                )
            )

        session.commit()
        rendered = (
            json.dumps([asdict(row) for row in rows], ensure_ascii=False, indent=2)
            if args.format == "json"
            else render_csv(rows)
        )
        return rows, rendered
    finally:
        session.close()


def main() -> int:
    args = parse_args()
    rows, rendered = generate_codes(args)
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(rendered, encoding="utf-8")
        print(f"Wrote {len(rows)} codes to {output_path}")
    else:
        print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
