from unittest.mock import MagicMock
from uuid import UUID, uuid4


def _mock_user(
    user_id: UUID | None = None, email: str = "test@example.com"
) -> MagicMock:
    user = MagicMock()
    user.id = user_id or uuid4()
    user.email = email
    user.oauth_accounts = []
    return user


def _make_query_chain() -> MagicMock:
    """Returns a mock that supports .filter(...).delete() and .filter(...).update(...)"""
    chain = MagicMock()
    chain.filter.return_value = chain
    return chain
