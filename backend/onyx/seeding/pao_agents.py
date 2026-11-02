"""PaoTeacherAgent: built-in agents, created or updated on every api_server start.

- Policy Assistant and Behaviour Assistant, with prompts from pao_prompts/.
- Each agent's knowledge files are synced from a folder (PAO_KNOWLEDGE_DIR/<folder>):
  new or changed files are uploaded, removed files are detached. Files an admin
  attaches in the agent editor are kept.
- The DeepSeek provider is added from DEEPSEEK_API_KEY when no chat model exists.
- Onyx's default assistant is turned off.
"""

import hashlib
import os
import threading
from io import BytesIO
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import UploadFile
from starlette.datastructures import Headers
from sqlalchemy.orm import Session

from onyx.background.task_utils import drain_processing_loop
from onyx.configs.constants import ANONYMOUS_USER_EMAIL
from onyx.db.enums import LLMModelFlowType
from onyx.db.llm import fetch_default_model
from onyx.db.llm import update_default_model
from onyx.db.llm import update_default_vision_provider
from onyx.db.llm import upsert_llm_provider
from onyx.db.models import StarterMessage
from onyx.db.pao import get_persona_id_by_name
from onyx.db.persona import get_persona_by_id
from onyx.db.persona import upsert_persona
from onyx.db.projects import create_user_files
from onyx.db.tools import get_tool_by_name
from onyx.db.users import get_user_by_email
from onyx.file_processing.file_types import guess_mime_type
from onyx.key_value_store.factory import get_kv_store
from onyx.key_value_store.interface import KvKeyNotFoundError
from onyx.llm.constants import LlmProviderNames
from onyx.server.manage.llm.models import LLMProviderUpsertRequest
from onyx.server.manage.llm.models import ModelConfigurationUpsertRequest
from onyx.server.settings.store import load_settings
from onyx.server.settings.store import store_settings
from onyx.utils.logger import setup_logger
from shared_configs.contextvars import get_current_tenant_id

logger = setup_logger()

PROMPTS_DIR = Path(__file__).parent / "pao_prompts"
KNOWLEDGE_DIR = Path(os.environ.get("PAO_KNOWLEDGE_DIR", "/app/pao_knowledge"))
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = "deepseek-flash"
# The persona -> {file name: {sha256, user_file id}} of the files this module attached.
KV_MANAGED_FILES = "pao_seeded_knowledge_files"
# Images reach the model as if the teacher sent them; .doc has no text extractor.
SKIP_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".doc"}

AGENTS: list[dict[str, Any]] = [
    {
        "name": "Policy Assistant",
        "description": "Ask about school rules, behavior, and consequences.",
        "prompt": "policy_assistant.md",
        "folder": "policies",
        "display_priority": 0,
        "starters": [
            "What is the consequence if a student uses a phone during class?",
            "What should I do if I suspect a student cheated on a test?",
            "How many late arrivals before a parent is contacted?",
            "What do I do if a student tells me something worrying about their home life?",
        ],
    },
    {
        "name": "Behaviour Assistant",
        "description": "Get best-practice ideas for managing behaviour and classroom routines.",
        "prompt": "behaviour_assistant.md",
        "folder": "behaviour",
        "display_priority": 1,
        "starters": [
            "How do I deal with low-level disruption without stopping the lesson?",
            "How can I keep a talkative class focused during group work?",
            "What routines help a class settle quickly at the start of a lesson?",
            "How can I support a student whose behaviour may be linked to anxiety?",
        ],
    },
]


def _ensure_deepseek(db_session: Session) -> None:
    if not DEEPSEEK_API_KEY or fetch_default_model(db_session, LLMModelFlowType.CHAT):
        return
    provider = upsert_llm_provider(
        llm_provider_upsert_request=LLMProviderUpsertRequest(
            name="DeepSeek",
            provider=LlmProviderNames.OPENAI_COMPATIBLE,
            api_key=DEEPSEEK_API_KEY,
            api_key_changed=True,
            api_base="https://api.deepseek.com",
            is_public=True,
            model_configurations=[
                ModelConfigurationUpsertRequest(
                    name=DEEPSEEK_MODEL,
                    display_name="DeepSeek Flash",
                    is_visible=True,
                    max_input_tokens=1_048_576,
                    supports_image_input=True,
                )
            ],
        ),
        db_session=db_session,
    )
    update_default_model(
        db_session=db_session,
        provider_id=provider.id,
        model=DEEPSEEK_MODEL,
        flow_type=LLMModelFlowType.CHAT,
    )
    update_default_vision_provider(provider.id, DEEPSEEK_MODEL, db_session)
    logger.notice("PaoTeacherAgent: added the DeepSeek provider")


def _sync_folder(
    db_session: Session, folder: Path, managed: dict[str, dict[str, str]]
) -> tuple[dict[str, dict[str, str]], bool]:
    """Returns the new managed map, and whether any file was uploaded."""
    owner = get_user_by_email(ANONYMOUS_USER_EMAIL, db_session)
    if owner is None:
        raise RuntimeError("anonymous user missing; it is created by a migration")
    result: dict[str, dict[str, str]] = {}
    uploaded = False
    for path in sorted(p for p in folder.iterdir() if p.is_file()):
        if path.name.startswith(".") or path.suffix.lower() in SKIP_SUFFIXES:
            logger.warning("PaoTeacherAgent: skipping knowledge file %s", path)
            continue
        data = path.read_bytes()
        sha = hashlib.sha256(data).hexdigest()
        if managed.get(path.name, {}).get("sha256") == sha:
            result[path.name] = managed[path.name]
            continue
        content_type = guess_mime_type(path.name) or "application/octet-stream"
        upload = UploadFile(
            file=BytesIO(data),
            filename=path.name,
            headers=Headers({"content-type": content_type}),
        )
        created = create_user_files([upload], None, owner, db_session)
        if not created.user_files:
            logger.error("PaoTeacherAgent: Onyx rejected %s: %s", path, created.rejected_files)
            continue
        result[path.name] = {"sha256": sha, "id": str(created.user_files[0].id)}
        uploaded = True
    return result, uploaded


def seed_pao_agents(db_session: Session) -> None:
    _ensure_deepseek(db_session)

    settings = load_settings()
    if not settings.disable_default_assistant:
        settings.disable_default_assistant = True
        store_settings(settings)

    kv = get_kv_store()
    try:
        all_managed: dict[str, Any] = dict(kv.load(KV_MANAGED_FILES))  # type: ignore[arg-type]
    except KvKeyNotFoundError:
        all_managed = {}

    read_file_tool = get_tool_by_name("read_file", db_session)
    any_uploaded = False
    for agent in AGENTS:
        persona_id = get_persona_id_by_name(db_session, agent["name"])
        current_files: set[str] = set()
        if persona_id is not None:
            current_files = {
                str(f.id) for f in get_persona_by_id(persona_id, None, db_session).user_files
            }

        old_managed: dict[str, dict[str, str]] = all_managed.get(agent["name"], {})
        folder = KNOWLEDGE_DIR / agent["folder"]
        if folder.is_dir():
            new_managed, uploaded = _sync_folder(db_session, folder, old_managed)
            any_uploaded |= uploaded
        else:
            logger.warning("PaoTeacherAgent: %s not found; keeping current knowledge", folder)
            new_managed = old_managed
        all_managed[agent["name"]] = new_managed

        old_ids = {m["id"] for m in old_managed.values()}
        new_ids = {m["id"] for m in new_managed.values()}
        file_ids = (current_files - old_ids) | new_ids

        upsert_persona(
            user=None,
            persona_id=persona_id,
            name=agent["name"],
            description=agent["description"],
            starter_messages=[StarterMessage(name=q, message=q) for q in agent["starters"]],
            system_prompt=(PROMPTS_DIR / agent["prompt"]).read_text(),
            task_prompt="",
            datetime_aware=True,
            is_public=True,
            is_featured=True,
            is_listed=True,
            display_priority=agent["display_priority"],
            document_set_ids=[],
            tool_ids=[read_file_tool.id],
            user_file_ids=[UUID(i) for i in sorted(file_ids)],
            db_session=db_session,
        )
        logger.notice(
            "PaoTeacherAgent: %s %s with %d files",
            "updated" if persona_id is not None else "created",
            agent["name"],
            len(file_ids),
        )

    kv.store(KV_MANAGED_FILES, all_managed)
    if any_uploaded:
        # Lite mode extracts text in-process; don't hold up startup for it.
        threading.Thread(
            target=drain_processing_loop, args=(get_current_tenant_id(),), daemon=True
        ).start()
