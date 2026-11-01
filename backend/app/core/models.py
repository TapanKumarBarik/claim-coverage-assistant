"""Shared pydantic base for anything returned by the API."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ApiModel(BaseModel):
    """Fields with defaults are always present in responses, so the published schema (and the
    generated client types) should say they are required."""

    model_config = ConfigDict(json_schema_serialization_defaults_required=True)
