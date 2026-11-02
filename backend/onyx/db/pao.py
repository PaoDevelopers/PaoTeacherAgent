"""Queries for the PaoTeacherAgent startup seeding (onyx/seeding/pao_agents.py)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from onyx.db.models import Persona


def get_persona_id_by_name(db_session: Session, name: str) -> int | None:
    return db_session.scalar(
        select(Persona.id).where(Persona.name == name, Persona.deleted.is_(False))
    )
