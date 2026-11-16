"""
Permissioning / AccessControl logic for JIRA Projects + Issues.
"""

from onyx.access.models import ExternalAccess
from onyx.connectors.jira.source_operations import JiraSourceOperations


def get_project_permissions(
    source_operations: JiraSourceOperations,
    jira_project: str,
    add_prefix: bool = False,
) -> ExternalAccess | None:
    """
    Fetch the project + issue level permissions / access-control.
    This functionality requires Enterprise Edition.

    Args:
        source_operations: The Jira gateway.
        jira_project: The JIRA project string.
        add_prefix: When True, prefix group IDs with source type (for indexing path).
                   When False (default), leave unprefixed (for permission sync path
                   where upsert_document_external_perms handles prefixing).

    Returns:
        ExternalAccess object for the page. None if EE is not enabled or no restrictions found.
    """

    # Check if EE is enabled
    return None
