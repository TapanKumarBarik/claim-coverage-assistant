"""Typed access to the composition root from request handlers."""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from fastapi import Request

if TYPE_CHECKING:
    from app.bootstrap import Services


def services_of(request: Request) -> Services:
    return cast("Services", request.app.state.services)
