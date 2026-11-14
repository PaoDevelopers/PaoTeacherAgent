from sqlalchemy.orm import Session

from onyx.db.models import User


def _get_user_external_group_ids(
    db_session: Session,  # noqa: ARG001
    user: User,  # noqa: ARG001
) -> list[str]:
    return []


def get_user_external_group_ids(db_session: Session, user: User) -> list[str]:
    return _get_user_external_group_ids(db_session, user)
