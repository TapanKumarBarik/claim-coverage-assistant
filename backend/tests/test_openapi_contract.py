"""The committed OpenAPI file is the API contract; the code must not drift from it."""

from __future__ import annotations

import json
from pathlib import Path

from app.core.config import Settings
from app.main import create_app

CONTRACT = Path(__file__).resolve().parents[2] / "docs" / "openapi.json"
SUCCESS_STATUSES = {"200", "201", "204"}
SECRET_WORDS = ("key", "secret", "password")
POSTURE_REF = "#/components/schemas/SecretsPosture"  # booleans about how secrets are handled, not secrets
WRITE_ONLY_INPUTS = {"CredentialsInput": "api_key", "AdminLogin": "password"}  # sent in, never sent back


def test_committed_contract_matches_the_implementation(settings: Settings) -> None:
    live = json.loads(json.dumps(create_app(settings, llm=None).openapi()))
    committed = json.loads(CONTRACT.read_text(encoding="utf-8"))
    assert live == committed, "API changed: run `python -m app.cli openapi` and commit docs/openapi.json"


def test_every_operation_is_documented(settings: Settings) -> None:
    spec = create_app(settings, llm=None).openapi()
    for path, methods in spec["paths"].items():
        for method, operation in methods.items():
            assert operation.get("summary"), f"{method.upper()} {path} has no summary"
            assert SUCCESS_STATUSES & set(operation["responses"]), (
                f"{method.upper()} {path} has no success response"
            )


def test_credentials_are_write_only_and_never_part_of_a_response() -> None:
    schemas = json.loads(CONTRACT.read_text(encoding="utf-8"))["components"]["schemas"]
    for name, field in WRITE_ONLY_INPUTS.items():
        assert schemas[name]["properties"][field]["writeOnly"] is True
    for name, schema in schemas.items():
        if name in WRITE_ONLY_INPUTS:
            continue
        exposed = [
            prop
            for prop, spec in schema.get("properties", {}).items()
            if any(word in prop for word in SECRET_WORDS) and spec.get("$ref") != POSTURE_REF
        ]
        assert not exposed, f"{name} exposes {exposed}"
