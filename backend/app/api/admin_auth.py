"""Admin sign-in: exchange the admin password for a session cookie, check it, end it."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request, Response

from app.api.admin_sessions import AdminSession
from app.api.deps import services_of
from app.api.schemas import AdminLogin, AdminSessionStatus, ErrorBody
from app.api.security import authenticate_admin, bearer_token, require_same_origin
from app.core.constants import ADMIN_PREFIX, Tag
from app.core.errors import NotConfigured, Unauthorized

log = logging.getLogger(__name__)

router = APIRouter(
    prefix=f"{ADMIN_PREFIX}/session",
    tags=[Tag.ADMIN],
    responses={status: {"model": ErrorBody} for status in (401, 403, 422, 429, 503)},
)


@router.post(
    "",
    response_model=AdminSessionStatus,
    dependencies=[Depends(require_same_origin)],
    summary="Sign in as administrator",
)
async def sign_in(body: AdminLogin, request: Request, response: Response) -> AdminSessionStatus:
    services = services_of(request)
    authenticate_admin(request, body.password.get_secret_value())
    session_id, session = services.admin_sessions.create()  # a new id on every sign-in
    services.admin_cookie.set(response, session_id)
    log.info("admin_signed_in", extra={"client": services.clients.identify(request)})
    return _status(request, session)


@router.get("", response_model=AdminSessionStatus, summary="Am I signed in as administrator?")
async def current(request: Request) -> AdminSessionStatus:
    """The page asks this on load. Being signed out is an answer, not a failed attempt: not counted."""
    services = services_of(request)
    if not services.admin_auth.enabled:
        raise NotConfigured("The admin area is disabled on this deployment.")
    session = services.admin_sessions.get(services.admin_cookie.value(request))
    if session is None:
        token = bearer_token(request)
        if token is None:
            raise Unauthorized("Not signed in.")
        authenticate_admin(request, token)  # a script checking its token is an attempt like any other
    return _status(request, session)


@router.delete(
    "",
    status_code=204,
    dependencies=[Depends(require_same_origin)],
    summary="Sign out",
)
async def sign_out(request: Request) -> Response:
    services = services_of(request)
    services.admin_sessions.delete(services.admin_cookie.value(request))
    response = Response(status_code=204)
    services.admin_cookie.clear(response)
    return response


def _status(request: Request, session: AdminSession | None) -> AdminSessionStatus:
    """Bearer-token callers have no session, and so no expiry."""
    services = services_of(request)
    return AdminSessionStatus(expires_at=services.admin_sessions.expires_at(session) if session else None)
