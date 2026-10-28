"""Push deploy/agent_*_prompt.md into the two Onyx agents, keeping every other agent setting.

Usage: set -a; . deploy/.env; set +a; python3 deploy/sync_prompts.py
Needs ONYX_URL and ONYX_PAT (an admin's personal access token).
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
PROMPTS = {
    "Policy Assistant": HERE / "agent_policy_prompt.md",
    "Behaviour Assistant": HERE / "agent_behaviour_prompt.md",
}


def api(method: str, path: str, body: dict | None = None):
    req = urllib.request.Request(
        os.environ["ONYX_URL"].rstrip("/") + "/api" + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": f"Bearer {os.environ['ONYX_PAT']}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def main() -> None:
    by_name = {p["name"]: p["id"] for p in api("GET", "/persona")}
    for name, prompt_file in PROMPTS.items():
        if name not in by_name:
            sys.exit(f"Agent '{name}' not found; create it in the admin UI first.")
        p = api("GET", f"/persona/{by_name[name]}")
        # PATCH replaces the agent, so resend its current settings unchanged.
        body = {
            "name": p["name"],
            "description": p["description"],
            "document_set_ids": [d["id"] for d in p["document_sets"]],
            "starter_messages": p["starter_messages"],
            "tool_ids": [t["id"] for t in p["tools"]],
            "user_file_ids": p["user_file_ids"],
            "is_featured": p["is_featured"],
            "display_priority": p["display_priority"],
            "icon_name": p["icon_name"],
            "uploaded_image_id": p["uploaded_image_id"],
            "default_model_configuration_id": p["default_model_configuration_id"],
            "replace_base_system_prompt": p["replace_base_system_prompt"],
            "task_prompt": p["task_prompt"],
            "datetime_aware": p["datetime_aware"],
            "system_prompt": prompt_file.read_text(),
        }
        api("PATCH", f"/persona/{p['id']}", body)
        after = api("GET", f"/persona/{p['id']}")
        if after["system_prompt"] != body["system_prompt"] or sorted(
            after["user_file_ids"]
        ) != sorted(p["user_file_ids"]):
            sys.exit(f"'{name}': update did not apply cleanly, check it in the admin UI.")
        print(f"updated {name}")


if __name__ == "__main__":
    main()
