from box_sdk_gen import BoxClient
from box_sdk_gen.schemas.file_full import FileFull
from box_sdk_gen.schemas.folder_mini import FolderMini
from box_sdk_gen.schemas.web_link import WebLink

from onyx.access.models import ExternalAccess


def resolve_box_ancestor_access(
    client: BoxClient,
    path_entries: list[FolderMini] | None,
    enterprise_id: str,
) -> ExternalAccess | None:
    return None


def resolve_box_folder_access(
    client: BoxClient,
    folder_id: str,
    inherited_access: ExternalAccess | None,
    enterprise_id: str,
) -> ExternalAccess | None:
    return None


def resolve_box_file_access(
    client: BoxClient,
    file: FileFull,
    folder_access: ExternalAccess,
    enterprise_id: str,
) -> ExternalAccess | None:
    return None


def resolve_box_web_link_access(
    web_link: WebLink,
    folder_access: ExternalAccess,
    enterprise_id: str,
) -> ExternalAccess | None:
    return None
