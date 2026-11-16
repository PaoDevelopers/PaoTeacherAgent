"""Guards that an ambiguous workspace reaches the password login caller.

Resolution raises CONFLICT when an address has several pending invitations and
no active membership, because picking one would join a workspace the user never
accepted. That response tells them to choose. A blanket handler around the
lookup would flatten it into a generic credential failure, leaving the user with
no way to act and no signal that their account is fine.
"""

from types import SimpleNamespace
from typing import cast
from unittest.mock import MagicMock, patch

import pytest
from fastapi.security import OAuth2PasswordRequestForm

from onyx.auth.users import UserManager

_AUTH_MODULE = "onyx.auth.users"


def _credentials(username: str) -> OAuth2PasswordRequestForm:
    return cast(
        OAuth2PasswordRequestForm,
        SimpleNamespace(username=username, password="unused"),
    )


def _manager() -> UserManager:
    manager = UserManager.__new__(UserManager)
    manager.password_helper = MagicMock()
    return manager


@pytest.mark.asyncio
async def test_a_disabled_password_login_is_rejected_before_resolution() -> None:
    lookup = MagicMock()
    with (
        patch(f"{_AUTH_MODULE}.MULTI_TENANT", False),
        patch(f"{_AUTH_MODULE}.get_security_settings") as settings,
        patch(f"{_AUTH_MODULE}.emit_audit_event"),
    ):
        settings.return_value.password_auth_enabled = False
        with pytest.raises(Exception, match="PASSWORD_LOGIN_DISABLED"):
            await _manager().authenticate(_credentials("user@example.com"))

    lookup.assert_not_called()
