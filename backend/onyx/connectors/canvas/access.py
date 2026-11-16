from typing import Any

from onyx.access.models import ExternalAccess
from onyx.connectors.canvas.client import CanvasApiClient


def get_course_permissions(
    canvas_client: CanvasApiClient,
    course_id: int,
) -> ExternalAccess | None:
    return None


def build_course_permission_context(
    canvas_client: CanvasApiClient,
    course_id: int,
) -> Any | None:
    return None


def get_page_permissions(course_context: Any) -> ExternalAccess | None:
    return None


def get_assignment_permissions(
    course_context: Any,
    assignment: Any,
) -> ExternalAccess | None:
    return None


def get_announcement_permissions(
    course_context: Any,
    announcement: Any,
) -> ExternalAccess | None:
    return None
