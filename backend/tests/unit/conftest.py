"""Unit-suite conftest."""

from collections.abc import Generator
from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def _no_remote_catalog_fetch() -> Generator[None, None, None]:
    """Keeps the unit suite offline: catalog misses must not reach GitHub.

    Remote-catalog tests override this by patching
    ``model_catalog._fetch_provider_file`` themselves. Patching that seam
    (rather than ``httpx.get``) keeps every other httpx caller working.
    """
    from onyx.llm import model_catalog

    with patch.object(
        model_catalog,
        "_fetch_provider_file",
        side_effect=RuntimeError("remote catalog fetch in unit test"),
    ):
        yield
