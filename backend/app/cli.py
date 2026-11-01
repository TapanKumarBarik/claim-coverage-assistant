"""Operational commands: ``python -m app.cli <command>``."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import tempfile
from enum import StrEnum
from pathlib import Path

from app.bootstrap import Services, build_services
from app.catalog.domain import VersionStatus
from app.catalog.ops import bootstrap_from_manifest, reindex_version
from app.core.config import get_settings
from app.core.secrets import Redactor, new_admin_token
from app.main import MANIFEST_NAME, create_app


class Command(StrEnum):
    SEED = "seed"
    REINDEX = "reindex"
    OPENAPI = "openapi"
    ADMIN_TOKEN = "admin-token"  # noqa: S105 - a command name, not a credential


def _services() -> Services:
    settings = get_settings()
    return build_services(settings, redactor=Redactor(settings.secret_values()))


async def _seed(force: bool) -> None:
    settings = get_settings()
    services = _services()
    try:
        if not services.store.is_empty and not force:
            print("Storage already seeded; use --force to seed anyway.")
            return
        created = await bootstrap_from_manifest(
            services.store, services.embedder, settings.data_dir / MANIFEST_NAME, settings.data_dir
        )
        print(f"Seeded {created} document version(s) into {settings.storage_dir}")
    finally:
        await services.http_client.aclose()


async def _reindex() -> None:
    services = _services()
    try:
        for contract in services.store.catalog.contracts:
            for document in contract.documents:
                for version in document.versions:
                    if version.status is VersionStatus.LIVE and not version.has_embeddings:
                        await reindex_version(services.store, services.embedder, version.id)
                        print(f"Embedded {version.id}")
    finally:
        await services.http_client.aclose()


def _openapi(out: Path) -> None:
    # A scratch storage dir keeps spec generation from touching real data.
    scratch = get_settings().model_copy(update={"storage_dir": Path(tempfile.mkdtemp())})
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(create_app(scratch, llm=None).openapi(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {out}")


def _admin_token() -> None:
    token, digest = new_admin_token()
    print("Admin token (shown once; store it in a password manager):")
    print(f"  {token}")
    print("\nConfigure only the hash, as the ADMIN_TOKEN_SHA256 environment variable / Key Vault secret:")
    print(f"  {digest}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    seed = sub.add_parser(Command.SEED, help="Load the demo contracts from data/sources.yaml")
    seed.add_argument("--force", action="store_true")
    sub.add_parser(Command.REINDEX, help="Compute embeddings for live versions that lack them")
    spec = sub.add_parser(Command.OPENAPI, help="Export the OpenAPI contract")
    spec.add_argument("--out", type=Path, default=Path("../docs/openapi.json"))
    sub.add_parser(Command.ADMIN_TOKEN, help="Generate an admin token and the hash to configure")
    args = parser.parse_args(argv)

    match args.command:
        case Command.SEED:
            asyncio.run(_seed(args.force))
        case Command.REINDEX:
            asyncio.run(_reindex())
        case Command.OPENAPI:
            _openapi(args.out)
        case Command.ADMIN_TOKEN:
            _admin_token()
    return 0


if __name__ == "__main__":
    sys.exit(main())
