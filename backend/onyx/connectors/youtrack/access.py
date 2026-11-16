from onyx.access.models import ExternalAccess
from onyx.connectors.youtrack.models import YouTrackIssueAccess

_EE_ACCESS_MODULE: str = "onyx.external_permissions.youtrack.access"


def get_issue_access(
    base_url: str, issue: YouTrackIssueAccess
) -> ExternalAccess | None:
    return None


def get_project_node_access(base_url: str, project_id: str) -> ExternalAccess | None:
    return None
