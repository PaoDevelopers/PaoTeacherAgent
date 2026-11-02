"""Queries for the PaoTeacherAgent startup seeding (onyx/seeding/pao_agents.py)."""

from sqlalchemy import func, insert, literal, select
from sqlalchemy.orm import Session

from onyx.configs.constants import ANONYMOUS_USER_EMAIL
from onyx.db.models import Persona, User, User__PinnedPersona


def get_persona_id_by_name(db_session: Session, name: str) -> int | None:
    return db_session.scalar(
        select(Persona.id).where(Persona.name == name, Persona.deleted.is_(False))
    )


def pin_persona_for_existing_users(db_session: Session, persona_id: int) -> int:
    """Pin a new agent last in the sidebar of every existing user.

    Onyx pins featured agents only when an account is created, so accounts that
    exist before the agent would never get it. Call this once, when the agent is
    created. Do not call it on every start: that would undo a user's own unpin.
    Returns the number of users pinned.
    """
    next_order = func.coalesce(func.max(User__PinnedPersona.display_order) + 1, 0)
    result = db_session.execute(
        insert(User__PinnedPersona).from_select(
            ["user_id", "persona_id", "display_order"],
            select(
                User.id,
                literal(persona_id, User__PinnedPersona.persona_id.type),
                next_order,
            )
            .outerjoin(User__PinnedPersona, User__PinnedPersona.user_id == User.id)
            .where(User.email != ANONYMOUS_USER_EMAIL)
            .group_by(User.id),
        )
    )
    db_session.commit()
    return result.rowcount
