"""PaoTeacherAgent: API behind the dean's admin page (/admin/dean).

- Knowledge: list, add and remove the files of the built-in agents.
- Prompts: read, change and reset each built-in agent's instructions. A saved prompt
  also goes in the key-value store so the next start does not overwrite it.
- Branding: app name, brand colour and logo.

Files that came from the server's knowledge folder (see onyx/seeding/pao_agents.py)
are listed as built in and cannot be removed here: the next start would add them back.
"""

import base64
import re
import threading
from typing import Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from onyx.auth.permissions import require_permission
from onyx.background.task_utils import drain_delete_loop, drain_processing_loop
from onyx.configs.app_configs import DISABLE_VECTOR_DB
from onyx.configs.constants import (
    ANONYMOUS_USER_EMAIL,
    OnyxCeleryPriority,
    OnyxCeleryQueues,
    OnyxCeleryTask,
)
from onyx.db.engine.sql_engine import get_session
from onyx.db.enums import Permission, UserFileStatus
from onyx.db.models import Persona, User, UserFile
from onyx.db.pao import get_persona_id_by_name
from onyx.db.projects import create_user_files
from onyx.db.users import get_user_by_email
from onyx.error_handling.error_codes import OnyxErrorCode
from onyx.error_handling.exceptions import OnyxError
from onyx.key_value_store.factory import get_kv_store
from onyx.key_value_store.interface import KvKeyNotFoundError
from onyx.seeding.pao_agents import (
    AGENTS,
    KV_CUSTOM_PROMPTS,
    KV_MANAGED_FILES,
    SKIP_SUFFIXES,
    default_prompt,
    load_custom_prompts,
)
from onyx.server.settings.store import (
    load_settings,
    settings_write_lock,
    store_settings,
)
from onyx.utils.logger import setup_logger
from shared_configs.contextvars import get_current_tenant_id

logger = setup_logger()

admin_router = APIRouter(prefix="/admin/pao")
router = APIRouter(prefix="/pao")

KV_LOGO = "pao_logo"
MAX_LOGO_BYTES = 1024 * 1024
LOGO_TYPES = {"image/png", "image/jpeg", "image/webp"}
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
MAX_APP_NAME_LENGTH = 40
MAX_PROMPT_LENGTH = 20_000


class KnowledgeFile(BaseModel):
    id: UUID
    name: str
    status: str
    built_in: bool


class KnowledgeAgent(BaseModel):
    persona_id: int
    name: str
    icon: str
    description: str
    files: list[KnowledgeFile]


class AgentPrompt(BaseModel):
    persona_id: int
    name: str
    icon: str
    description: str
    prompt: str
    is_custom: bool


class PromptUpdate(BaseModel):
    prompt: str


class Branding(BaseModel):
    app_name: str | None
    primary_color: str | None
    has_custom_logo: bool
    logo_version: int


class BrandingUpdate(BaseModel):
    """None or an empty string puts the default back."""

    app_name: str | None = None
    primary_color: str | None = None


def _built_in_ids(agent_name: str) -> set[str]:
    try:
        managed: dict[str, Any] = get_kv_store().load(KV_MANAGED_FILES)  # type: ignore[assignment]
    except KvKeyNotFoundError:
        return set()
    return {m["id"] for m in managed.get(agent_name, {}).values()}


def _agent_persona(db_session: Session, persona_id: int) -> tuple[Persona, str]:
    persona = db_session.get(Persona, persona_id)
    if persona is None or persona.deleted:
        raise OnyxError(OnyxErrorCode.NOT_FOUND, "Agent not found")
    if persona.name not in {a["name"] for a in AGENTS}:
        raise OnyxError(OnyxErrorCode.NOT_FOUND, "Not a built-in agent")
    return persona, persona.name


def _visible(user_file: UserFile) -> bool:
    return user_file.status != UserFileStatus.DELETING


@admin_router.get("/knowledge")
def list_knowledge(
    _: User = Depends(require_permission(Permission.FULL_ADMIN_PANEL_ACCESS)),
    db_session: Session = Depends(get_session),
) -> list[KnowledgeAgent]:
    result: list[KnowledgeAgent] = []
    for agent in AGENTS:
        persona_id = get_persona_id_by_name(db_session, agent["name"])
        if persona_id is None:
            continue
        persona = db_session.get(Persona, persona_id)
        if persona is None:
            continue
        built_in = _built_in_ids(agent["name"])
        files = sorted(
            (f for f in persona.user_files if _visible(f)), key=lambda f: f.name.lower()
        )
        result.append(
            KnowledgeAgent(
                persona_id=persona.id,
                name=persona.name,
                icon=agent["icon_name"],
                description=agent["description"],
                files=[
                    KnowledgeFile(
                        id=f.id,
                        name=f.name,
                        status=f.status.value,
                        built_in=str(f.id) in built_in,
                    )
                    for f in files
                ],
            )
        )
    return result


@admin_router.post("/knowledge/{persona_id}/files")
def add_knowledge_files(
    persona_id: int,
    files: list[UploadFile] = File(...),
    _: User = Depends(require_permission(Permission.FULL_ADMIN_PANEL_ACCESS)),
    db_session: Session = Depends(get_session),
) -> dict[str, list[str]]:
    persona, _name = _agent_persona(db_session, persona_id)
    owner = get_user_by_email(ANONYMOUS_USER_EMAIL, db_session)
    if owner is None:
        raise OnyxError(OnyxErrorCode.INTERNAL_ERROR, "Anonymous user missing")

    accepted = [
        f
        for f in files
        if not (f.filename or "").lower().endswith(tuple(SKIP_SUFFIXES))
    ]
    skipped = [f.filename or "" for f in files if f not in accepted]
    created = create_user_files(accepted, None, owner, db_session) if accepted else None
    rejected = skipped + [
        r.filename for r in (created.rejected_files if created else [])
    ]
    if created and created.user_files:
        persona.user_files.extend(created.user_files)
        db_session.commit()
        threading.Thread(
            target=drain_processing_loop, args=(get_current_tenant_id(),), daemon=True
        ).start()
    return {
        "added": [f.name for f in (created.user_files if created else [])],
        "rejected": rejected,
    }


@admin_router.delete("/knowledge/{persona_id}/files/{file_id}", status_code=204)
def remove_knowledge_file(
    persona_id: int,
    file_id: UUID,
    bg_tasks: BackgroundTasks,
    _: User = Depends(require_permission(Permission.FULL_ADMIN_PANEL_ACCESS)),
    db_session: Session = Depends(get_session),
) -> Response:
    persona, name = _agent_persona(db_session, persona_id)
    if str(file_id) in _built_in_ids(name):
        raise OnyxError(
            OnyxErrorCode.INVALID_INPUT,
            "This file comes from the server's knowledge folder. Remove it there.",
        )
    user_file = next((f for f in persona.user_files if f.id == file_id), None)
    if user_file is None:
        raise OnyxError(OnyxErrorCode.NOT_FOUND, "File not found")

    persona.user_files.remove(user_file)
    # Another agent or project may still use it; then only detach.
    if not user_file.assistants and not user_file.projects:
        user_file.status = UserFileStatus.DELETING
    db_session.commit()

    if user_file.status == UserFileStatus.DELETING:
        tenant_id = get_current_tenant_id()
        if DISABLE_VECTOR_DB:
            bg_tasks.add_task(drain_delete_loop, tenant_id)
        else:
            from onyx.background.celery.versioned_apps.client import app as client_app

            client_app.send_task(
                OnyxCeleryTask.DELETE_SINGLE_USER_FILE,
                kwargs={"user_file_id": str(user_file.id), "tenant_id": tenant_id},
                queue=OnyxCeleryQueues.USER_FILE_DELETE,
                priority=OnyxCeleryPriority.HIGH,
            )
    return Response(status_code=204)


def _agent_prompt(persona: Persona, custom: dict[str, str]) -> AgentPrompt:
    agent = next(a for a in AGENTS if a["name"] == persona.name)
    return AgentPrompt(
        persona_id=persona.id,
        name=persona.name,
        icon=agent["icon_name"],
        description=agent["description"],
        prompt=persona.system_prompt or "",
        is_custom=persona.name in custom,
    )


@admin_router.get("/prompts")
def list_prompts(
    _: User = Depends(require_permission(Permission.FULL_ADMIN_PANEL_ACCESS)),
    db_session: Session = Depends(get_session),
) -> list[AgentPrompt]:
    custom = load_custom_prompts()
    result: list[AgentPrompt] = []
    for agent in AGENTS:
        persona_id = get_persona_id_by_name(db_session, agent["name"])
        persona = db_session.get(Persona, persona_id) if persona_id else None
        if persona is not None and not persona.deleted:
            result.append(_agent_prompt(persona, custom))
    return result


def _store_custom_prompts(custom: dict[str, str]) -> None:
    get_kv_store().store(KV_CUSTOM_PROMPTS, custom)


@admin_router.put("/prompts/{persona_id}")
def update_prompt(
    persona_id: int,
    body: PromptUpdate,
    _: User = Depends(require_permission(Permission.FULL_ADMIN_PANEL_ACCESS)),
    db_session: Session = Depends(get_session),
) -> AgentPrompt:
    persona, name = _agent_persona(db_session, persona_id)
    prompt = body.prompt.strip()
    if not prompt:
        raise OnyxError(
            OnyxErrorCode.INVALID_INPUT,
            "The instructions cannot be empty. Use 'Back to default' instead.",
        )
    if len(prompt) > MAX_PROMPT_LENGTH:
        raise OnyxError(
            OnyxErrorCode.INVALID_INPUT,
            f"The instructions are too long (at most {MAX_PROMPT_LENGTH} characters).",
        )
    # Saved in the key-value store too: the seeder re-applies it on every start.
    custom = load_custom_prompts()
    custom[name] = prompt
    _store_custom_prompts(custom)
    persona.system_prompt = prompt
    db_session.commit()
    return _agent_prompt(persona, custom)


@admin_router.delete("/prompts/{persona_id}")
def reset_prompt(
    persona_id: int,
    _: User = Depends(require_permission(Permission.FULL_ADMIN_PANEL_ACCESS)),
    db_session: Session = Depends(get_session),
) -> AgentPrompt:
    persona, name = _agent_persona(db_session, persona_id)
    custom = load_custom_prompts()
    custom.pop(name, None)
    _store_custom_prompts(custom)
    persona.system_prompt = default_prompt(next(a for a in AGENTS if a["name"] == name))
    db_session.commit()
    return _agent_prompt(persona, custom)


def _branding() -> Branding:
    s = load_settings()
    return Branding(
        app_name=s.pao_app_name,
        primary_color=s.pao_primary_color,
        has_custom_logo=s.pao_logo_version > 0,
        logo_version=s.pao_logo_version,
    )


@admin_router.get("/branding")
def get_branding(
    _: User = Depends(require_permission(Permission.FULL_ADMIN_PANEL_ACCESS)),
) -> Branding:
    return _branding()


@admin_router.put("/branding")
def update_branding(
    update: BrandingUpdate,
    _: User = Depends(require_permission(Permission.FULL_ADMIN_PANEL_ACCESS)),
) -> Branding:
    name = (update.app_name or "").strip()
    color = (update.primary_color or "").strip()
    if len(name) > MAX_APP_NAME_LENGTH:
        raise OnyxError(
            OnyxErrorCode.INVALID_INPUT,
            f"The name can be at most {MAX_APP_NAME_LENGTH} characters.",
        )
    if color and not HEX_COLOR.match(color):
        raise OnyxError(
            OnyxErrorCode.INVALID_INPUT, "The colour must look like #5cb531."
        )
    with settings_write_lock():
        settings = load_settings()
        settings.pao_app_name = name or None
        settings.pao_primary_color = color.lower() or None
        store_settings(settings)
    return _branding()


@admin_router.put("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    _: User = Depends(require_permission(Permission.FULL_ADMIN_PANEL_ACCESS)),
) -> Branding:
    data = await file.read(MAX_LOGO_BYTES + 1)
    if len(data) > MAX_LOGO_BYTES:
        raise OnyxError(OnyxErrorCode.INVALID_INPUT, "The logo must be under 1 MB.")
    content_type = (file.content_type or "").lower()
    if content_type not in LOGO_TYPES:
        raise OnyxError(OnyxErrorCode.INVALID_INPUT, "Use a PNG, JPEG or WebP image.")
    get_kv_store().store(
        KV_LOGO,
        {"type": content_type, "data": base64.b64encode(data).decode("ascii")},
    )
    with settings_write_lock():
        settings = load_settings()
        settings.pao_logo_version += 1
        store_settings(settings)
    return _branding()


@admin_router.delete("/logo")
def reset_logo(
    _: User = Depends(require_permission(Permission.FULL_ADMIN_PANEL_ACCESS)),
) -> Branding:
    try:
        get_kv_store().delete(KV_LOGO)
    except KvKeyNotFoundError:
        pass
    with settings_write_lock():
        settings = load_settings()
        settings.pao_logo_version = 0
        store_settings(settings)
    return _branding()


@router.get("/logo")
def get_logo() -> Response:
    """Public: the login page shows the logo before anyone signs in."""
    try:
        stored: dict[str, str] = get_kv_store().load(KV_LOGO)  # type: ignore[assignment]
    except KvKeyNotFoundError:
        raise OnyxError(OnyxErrorCode.NOT_FOUND, "No custom logo")
    return Response(
        content=base64.b64decode(stored["data"]),
        media_type=stored["type"],
        headers={"Cache-Control": "no-cache"},
    )
