"""Which workspace a freshly issued session names.

Only a caller that has already decided the workspace may set it. The request's
own tenant context is whatever cookie the browser sent, which on a re-login can
name a workspace the user being authenticated does not belong to, so reading it
here would hand them a session for someone else's.
"""

from typing import Any

import pytest

from onyx.auth.users import resolve_tenant_for_user
from shared_configs.contextvars import (
    SESSION_TENANT_OVERRIDE_CONTEXTVAR,
)

_COOKIE_TENANT = "tenant_from_stale_cookie"
_MEMBER_TENANT = "tenant_the_user_belongs_to"
_PINNED_TENANT = "tenant_pinned_by_sso"


def _catalog_returns(tenant_id: str) -> Any:
    async def _resolve(**_kwargs: Any) -> str:
        return tenant_id

    return lambda *_args, **_kwargs: _resolve


@pytest.mark.asyncio
async def test_explicit_override_wins_over_the_catalog() -> None:
    """An SSO login pins its workspace before the user row exists, so the
    catalog cannot answer for a first-time member."""
    token = SESSION_TENANT_OVERRIDE_CONTEXTVAR.set(_PINNED_TENANT)
    try:
        resolved = await resolve_tenant_for_user("newcomer@example.com")
    finally:
        SESSION_TENANT_OVERRIDE_CONTEXTVAR.reset(token)

    assert resolved == _PINNED_TENANT
