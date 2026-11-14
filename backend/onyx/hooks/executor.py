"""CE hook executor.

HookSkipped and HookSoftFailed are real classes kept here because
process_message.py (CE code) uses isinstance checks against them.

execute_hook is the public entry point. It is a no-op that returns
HookSkipped().
"""

from typing import Any, TypeVar

from pydantic import BaseModel
from sqlalchemy.orm import Session

from onyx.db.enums import HookPoint


class HookSkipped:
    """No active hook configured for this hook point."""


class HookSoftFailed:
    """Hook was called but failed with SOFT fail strategy — continuing."""


T = TypeVar("T", bound=BaseModel)


def _execute_hook_impl(
    *,
    db_session: Session,  # noqa: ARG001
    hook_point: HookPoint,  # noqa: ARG001
    payload: dict[str, Any],  # noqa: ARG001
    response_type: type[T],  # noqa: ARG001
) -> T | HookSkipped | HookSoftFailed:
    """CE no-op — hooks are not available without EE."""
    return HookSkipped()


def execute_hook(
    *,
    db_session: Session,
    hook_point: HookPoint,
    payload: dict[str, Any],
    response_type: type[T],
) -> T | HookSkipped | HookSoftFailed:
    """Execute the hook for the given hook point."""
    return _execute_hook_impl(
        db_session=db_session,
        hook_point=hook_point,
        payload=payload,
        response_type=response_type,
    )
