"""Bring-your-own-credentials session API.

The visitor's Azure OpenAI key lives only in server memory, referenced by an HttpOnly cookie. It is
never written to disk, never logged and never sent back to the browser.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response

from app.api.deps import services_of
from app.api.schemas import CredentialsInput, ErrorBody, SessionStatus
from app.api.security import require_same_origin
from app.core.constants import API_PREFIX, Tag

router = APIRouter(
    prefix=f"{API_PREFIX}/session",
    tags=[Tag.SESSION],
    responses={status: {"model": ErrorBody} for status in (403, 422, 429, 503)},
)


@router.get("", response_model=SessionStatus, summary="Which Azure OpenAI credentials are in use")
async def get_session(request: Request) -> SessionStatus:
    services = services_of(request)
    return services.connector.status(services.cookies.cookie_value(request))


@router.put(
    "/credentials",
    response_model=SessionStatus,
    dependencies=[Depends(require_same_origin)],
    summary="Verify and use your own Azure OpenAI credentials",
)
async def put_credentials(body: CredentialsInput, request: Request, response: Response) -> SessionStatus:
    services = services_of(request)
    client = services.clients.identify(request)
    session_id, status = await services.connector.connect(client, body)
    services.cookies.set_cookie(response, session_id)
    return status


@router.delete(
    "/credentials",
    status_code=204,
    dependencies=[Depends(require_same_origin)],
    summary="Forget your credentials",
)
async def delete_credentials(request: Request) -> Response:
    services = services_of(request)
    services.connector.disconnect(services.cookies.cookie_value(request))
    response = Response(status_code=204)
    services.cookies.clear_cookie(response)
    return response
