from collections.abc import Iterator
from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from onyx.db.enums import AccountType, Permission
from onyx.db.models import User
from onyx.server.manage import users


def _user(email: str, account_type: AccountType = AccountType.STANDARD) -> User:
    return User(
        id=uuid4(),
        email=email,
        account_type=account_type,
        is_active=True,
        hashed_password="test-hash",
        personal_name=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        craft_enabled=None,
        effective_permissions=[Permission.FULL_ADMIN_PANEL_ACCESS.value],
    )


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = FastAPI()
    app.include_router(users.router)
    caller = _user("manager@example.com")
    caller.effective_permissions = []
    caller.is_group_manager = True
    for route in app.routes:
        if isinstance(route, APIRoute):
            for dependency in route.dependant.dependencies:
                if dependency.name in {"current_user", "_"}:
                    assert dependency.call is not None
                    app.dependency_overrides[dependency.call] = lambda: caller
    app.dependency_overrides[users.get_session] = lambda: MagicMock()
    with TestClient(app) as test_client:
        yield test_client
