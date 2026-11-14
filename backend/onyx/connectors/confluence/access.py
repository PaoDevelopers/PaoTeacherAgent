from typing import Any

from onyx.access.models import ExternalAccess
from onyx.connectors.confluence.source_operations import ConfluenceSourceOperations


def get_page_restrictions(
    source_operations: ConfluenceSourceOperations,
    page_id: str,
    page_restrictions: dict[str, Any],
    ancestors: list[dict[str, Any]],
    add_prefix: bool = False,
) -> ExternalAccess | None:
    """
    Get page access restrictions for a Confluence page.
    This functionality requires Enterprise Edition.

    add_prefix: True for the indexing path (Document.external_access) so group
    ids carry the source-type prefix the search filter expects. False for the
    permission-sync path, where upsert_document_external_perms adds the prefix.

    Returns ExternalAccess for the page, or None if EE is not enabled or no
    restrictions are found.
    """
    return None


def get_page_restrictions_with_per_ancestor_fetch(
    source_operations: ConfluenceSourceOperations,
    page_id: str,
    page_restrictions: dict[str, Any],
    ancestors: list[dict[str, Any]],
    ancestor_restrictions_cache: dict[str, dict[str, Any] | None],
    add_prefix: bool = False,
) -> ExternalAccess | None:
    """CONFCLOUD-77618 variant of `get_page_restrictions`. Ancestors
    arrive without inline restrictions; each is fetched via
    `restriction/byOperation` with 403/404 swallowed for drafts. EE-only."""
    return None


def get_all_space_permissions(
    source_operations: ConfluenceSourceOperations,
    is_cloud: bool,
    add_prefix: bool = False,
) -> dict[str, ExternalAccess]:
    """
    Get access permissions for all spaces in Confluence.
    This functionality requires Enterprise Edition.

    add_prefix: True for the indexing path (Document.external_access) so group
    ids carry the source-type prefix the search filter expects. False for the
    permission-sync path, where upsert_document_external_perms adds the prefix.

    Returns a mapping of space key to ExternalAccess. Empty dict if EE is not
    enabled.
    """
    return {}
