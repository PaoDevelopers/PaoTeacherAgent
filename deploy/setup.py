"""Set up a PaoTeacherAgent deployment, or bring an existing one in line. Safe to re-run.

- Adds the DeepSeek provider if no LLM provider exists yet (needs DEEPSEEK_API_KEY).
- Turns off the built-in default assistant.
- Creates the Policy and Behaviour Assistants, or updates their prompts and settings
  from this folder. Other agent settings made in the UI are kept.
- With --policy-dir / --behaviour-dir: uploads every file in that folder and makes it
  that agent's whole knowledge (replaces the files it had).
- Pins both agents for the admin running it.

Run it before teachers sign up: Onyx pins featured agents only when an account is created.

Usage:
  set -a; . deploy/.env; set +a
  python3 deploy/setup.py [--policy-dir DIR] [--behaviour-dir DIR]
Needs ONYX_URL and ONYX_PAT (an admin's personal access token).
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import sys
import time
import urllib.request
import uuid
from pathlib import Path

HERE = Path(__file__).parent
MODEL = "deepseek-flash"
# Images go to the model as if the teacher sent them; .doc has no text extractor.
SKIP_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".doc"}

AGENTS = [
    {
        "name": "Policy Assistant",
        "description": "Ask about school rules, behavior, and consequences.",
        "prompt": HERE / "agent_policy_prompt.md",
        "display_priority": 0,
        "dir_arg": "policy_dir",
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
        "prompt": HERE / "agent_behaviour_prompt.md",
        "display_priority": 1,
        "dir_arg": "behaviour_dir",
        "starters": [
            "How do I deal with low-level disruption without stopping the lesson?",
            "How can I keep a talkative class focused during group work?",
            "What routines help a class settle quickly at the start of a lesson?",
            "How can I support a student whose behaviour may be linked to anxiety?",
        ],
    },
]


def request(method: str, path: str, data: bytes | None, content_type: str):
    req = urllib.request.Request(
        os.environ["ONYX_URL"].rstrip("/") + "/api" + path,
        method=method,
        data=data,
        headers={
            "Authorization": f"Bearer {os.environ['ONYX_PAT']}",
            "Content-Type": content_type,
        },
    )
    with urllib.request.urlopen(req) as r:
        raw = r.read()
    return json.loads(raw) if raw else None


def api(method: str, path: str, body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    return request(method, path, data, "application/json")


def upload(files: list[Path]) -> list[str]:
    boundary = uuid.uuid4().hex
    parts = []
    for f in files:
        ctype = mimetypes.guess_type(f.name)[0] or "application/octet-stream"
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="files"; '
            f'filename="{f.name}"\r\nContent-Type: {ctype}\r\n\r\n'.encode()
            + f.read_bytes()
            + b"\r\n"
        )
    data = b"".join(parts) + f"--{boundary}--\r\n".encode()
    res = request(
        "POST", "/user/projects/file/upload", data, f"multipart/form-data; boundary={boundary}"
    )
    if res["rejected_files"]:
        sys.exit(f"Onyx rejected: {res['rejected_files']}")
    ids = [f["id"] for f in res["user_files"]]
    for _ in range(120):  # wait up to 10 min for text extraction
        status = [api("GET", f"/user/projects/file/{i}")["status"] for i in ids]
        if all(s == "COMPLETED" for s in status):
            return ids
        if "FAILED" in status:
            sys.exit("A file failed to process; check it opens and has text.")
        time.sleep(5)
    sys.exit("Files still processing after 10 minutes.")


def folder_files(folder: str) -> list[Path]:
    files = sorted(p for p in Path(folder).iterdir() if p.is_file() and not p.name.startswith("."))
    skipped = [p.name for p in files if p.suffix.lower() in SKIP_SUFFIXES]
    if skipped:
        print(f"  skipped (images or .doc): {', '.join(skipped)}")
    files = [p for p in files if p.suffix.lower() not in SKIP_SUFFIXES]
    if not files:
        sys.exit(f"No usable files in {folder}")
    return files


def ensure_llm() -> None:
    if api("GET", "/admin/llm/provider")["providers"]:
        return
    key = os.environ.get("DEEPSEEK_API_KEY")
    if not key:
        sys.exit("No LLM provider yet: set DEEPSEEK_API_KEY in deploy/.env and re-run.")
    provider = api(
        "PUT",
        "/admin/llm/provider?is_creation=true",
        {
            "name": "DeepSeek",
            "provider": "openai_compatible",
            "api_base": "https://api.deepseek.com",
            "api_key": key,
            "api_key_changed": True,
            "is_public": True,
            "model_configurations": [
                {
                    "name": MODEL,
                    "display_name": "DeepSeek Flash",
                    "is_visible": True,
                    "max_input_tokens": 1048576,
                    "supports_image_input": True,
                }
            ],
        },
    )
    for kind in ("default", "default-vision"):
        api("POST", f"/admin/llm/{kind}", {"provider_id": provider["id"], "model_name": MODEL})
    print("added DeepSeek provider")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--policy-dir")
    parser.add_argument("--behaviour-dir")
    args = parser.parse_args()

    ensure_llm()
    api("PATCH", "/admin/settings", {"disable_default_assistant": True})
    read_file = next(t["id"] for t in api("GET", "/tool") if t["name"] == "read_file")
    existing = {p["name"]: p["id"] for p in api("GET", "/persona")}

    ids = []
    for a in AGENTS:
        folder = getattr(args, a["dir_arg"])
        current = api("GET", f"/persona/{existing[a['name']]}") if a["name"] in existing else None
        if folder:
            file_ids = upload(folder_files(folder))
        elif current:
            file_ids = current["user_file_ids"]
        else:
            sys.exit(f"'{a['name']}' doesn't exist yet: pass --{a['dir_arg'].replace('_', '-')}.")
        body = {
            "name": a["name"],
            "description": a["description"],
            "system_prompt": a["prompt"].read_text(),
            "task_prompt": "",
            "datetime_aware": True,
            "document_set_ids": [],
            "tool_ids": [read_file],
            "user_file_ids": file_ids,
            "starter_messages": [{"name": q, "message": q} for q in a["starters"]],
            "is_public": True,
            "is_featured": True,
            "display_priority": a["display_priority"],
        }
        if current:  # PATCH replaces the agent, so carry over what this script doesn't own
            for k in ("icon_name", "uploaded_image_id", "default_model_configuration_id",
                      "replace_base_system_prompt"):
                body[k] = current[k]
            body.pop("is_public")  # sharing is managed separately; None keeps it
            pid = api("PATCH", f"/persona/{current['id']}", body)["id"]
        else:
            pid = api("POST", "/persona", body)["id"]
        after = api("GET", f"/persona/{pid}")
        if after["system_prompt"] != body["system_prompt"] or sorted(after["user_file_ids"]) != sorted(file_ids):
            sys.exit(f"'{a['name']}': update did not apply cleanly, check it in the admin UI.")
        print(f"{'updated' if current else 'created'} {a['name']} ({len(file_ids)} files)")
        ids.append(pid)

    api("PATCH", "/user/pinned-assistants", {"ordered_assistant_ids": ids})


if __name__ == "__main__":
    main()
