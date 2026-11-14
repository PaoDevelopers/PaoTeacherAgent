from unittest.mock import MagicMock, patch

from onyx.background.celery.apps.primary import celery_app
from onyx.background.periodic_poller import (
    _build_periodic_tasks,
    _run_oauth_provider_cleanup,
)
from shared_configs.contextvars import CURRENT_TENANT_ID_CONTEXTVAR


def test_oauth_provider_cleanup_always_runs() -> None:
    assert "oauth-provider-cleanup" in [t.name for t in _build_periodic_tasks()]


_TASKS_MODULE = "onyx.background.celery.tasks.oauth_provider.tasks"


@patch(f"{_TASKS_MODULE}.delete_idle_oauth_provider_clients__no_commit", return_value=0)
@patch(
    f"{_TASKS_MODULE}.delete_expired_oauth_provider_grants__no_commit", return_value=0
)
@patch(f"{_TASKS_MODULE}.get_catalog_session")
@patch(f"{_TASKS_MODULE}.get_session_with_current_tenant")
def test_oauth_provider_cleanup_keeps_poller_tenant_context(
    _mock_tenant_session: MagicMock,
    _mock_catalog_session: MagicMock,
    mock_delete_grants: MagicMock,
    mock_delete_clients: MagicMock,
) -> None:
    celery_app.set_current()
    token = CURRENT_TENANT_ID_CONTEXTVAR.set("tenant_1")
    try:
        _run_oauth_provider_cleanup()
        assert CURRENT_TENANT_ID_CONTEXTVAR.get() == "tenant_1"
    finally:
        CURRENT_TENANT_ID_CONTEXTVAR.reset(token)

    mock_delete_grants.assert_called_once()
    mock_delete_clients.assert_called_once()
