from onyx.access.models import ExternalAccess
from onyx.access.utils import build_ext_group_name_for_onyx
from onyx.configs.constants import DocumentSource
from onyx.connectors.onedrive.models import OneDrivePermission


def get_onedrive_external_access(
    permissions: list[OneDrivePermission],
    owner_email: str,
    treat_organization_link_as_public: bool,
    *,
    add_prefix: bool,
) -> ExternalAccess:
    return ExternalAccess.empty()


def prefix_onedrive_external_groups(access: ExternalAccess) -> ExternalAccess:
    return ExternalAccess(
        external_user_emails=access.external_user_emails,
        external_user_group_ids={
            build_ext_group_name_for_onyx(group_id, DocumentSource.ONEDRIVE)
            for group_id in access.external_user_group_ids
        },
        is_public=access.is_public,
    )
