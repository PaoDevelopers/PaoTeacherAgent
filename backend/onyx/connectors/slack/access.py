from onyx.access.models import ExternalAccess
from onyx.connectors.models import BasicExpertInfo
from onyx.connectors.slack.models import ChannelType
from onyx.connectors.slack.source_operations import SlackSourceOperations


def get_channel_access(
    slack_client: SlackSourceOperations,
    channel: ChannelType,
    user_cache: dict[str, BasicExpertInfo | None],
    team_id_to_user_emails: dict[str, set[str]] | None = None,
) -> ExternalAccess | None:
    """Get channel access permissions for a Slack channel. EE only.

    ``team_id_to_user_emails`` (Grid only): when provided, public channels
    are scoped to the union of the workspaces they're shared into instead of
    being marked org-public.
    """
    return None
