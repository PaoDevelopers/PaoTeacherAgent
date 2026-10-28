# PaoTeacherAgent

AI assistant for YK Pao School teachers, built on [Onyx](https://github.com/onyx-dot-app/onyx) Community Edition (MIT). Teachers sign in with their school Microsoft account and pick one of two agents:

| Agent | Answers from | For |
|---|---|---|
| **Policy Assistant** (default) | YK Pao School policies only | Rules, behaviour, consequences, what to record and who to tell |
| **Behaviour Assistant** | Behaviour best-practice guidance chosen by the school (DfE, Ofsted, EEF) | Classroom management, routines, engagement, students with additional needs |

The assistants inform teachers; they never make disciplinary decisions. Both put safeguarding first and never repeat student names.

- [How it works](#how-it-works)
- [Run locally](#run-locally)
- [Environment variables](#environment-variables)
- [LLM provider (DeepSeek)](#llm-provider-deepseek)
- [Microsoft Entra sign-in](#microsoft-entra-sign-in)
- [Documents](#documents)
- [Editing the agent prompts](#editing-the-agent-prompts)
- [Admins](#admins)
- [Chat retention and privacy](#chat-retention-and-privacy)
- [Backups](#backups)
- [Upgrading Onyx](#upgrading-onyx)
- [Not done yet](#not-done-yet)

## How it works

- **Onyx Lite mode**: Postgres, Redis, the API server, the web server and nginx. No vector database and no embedding model, so it runs on modest hardware without AVX.
- **No RAG.** Each agent's documents are attached to the agent as files. On every question the model gets the full text of all its documents (both sets fit well within DeepSeek Flash's 1M-token context). If a set ever grows too large, Onyx switches to letting the model open files itself with its `read_file` tool.
- **Citations** are clickable and point to the source file; the model adds the page or section after each one.
- **Our changes to Onyx** are small and listed in [CUSTOMIZATIONS.md](CUSTOMIZATIONS.md). Everything of ours lives in `deploy/`.

| Path | What it is |
|---|---|
| `deploy/compose.sh` | Runs upstream compose + Lite overlay + our overlay. Use it instead of `docker compose`. |
| `deploy/docker-compose.override.yml` | Our overlay: loads `deploy/.env`, runs Redis, turns off the code sandbox |
| `deploy/.env.example` | Template for `deploy/.env` (never commit `deploy/.env`) |
| `deploy/agent_policy_prompt.md`, `deploy/agent_behaviour_prompt.md` | The agent system prompts |
| `deploy/sync_prompts.py` | Pushes the prompt files into the running agents |

## Run locally

Needs Docker with Compose v2.

```bash
cp deploy/.env.example deploy/.env
# Fill in USER_AUTH_SECRET, ENCRYPTION_KEY_SECRET and POSTGRES_PASSWORD, each from:
openssl rand -hex 32

deploy/compose.sh build web_server   # our branded web image, ~5 min
deploy/compose.sh up -d --wait
deploy/compose.sh ps                 # all services healthy
```

Open http://localhost. On an empty database, the first account to sign up becomes admin.

Docker Hub pulls can fail with `EOF` on some networks; just rerun the command, or `docker pull` the failing image until it succeeds.

## Environment variables

All live in `deploy/.env`. Any variable from `deployment/docker_compose/env.template` can also go there.

| Variable | Purpose |
|---|---|
| `IMAGE_TAG` | Upstream Onyx release the backend images come from. Must match the release this fork is based on. |
| `ONYX_WEB_SERVER_IMAGE` | Our web image, built from this repo |
| `USER_AUTH_SECRET`, `ENCRYPTION_KEY_SECRET`, `POSTGRES_PASSWORD` | Secrets. `ENCRYPTION_KEY_SECRET` encrypts the stored LLM key and SSO secret: lose it and you must re-enter them. |
| `WEB_DOMAIN` | `http://localhost` locally, `https://<domain>` in production. Must match the Entra redirect URI. |
| `VALID_EMAIL_DOMAINS` | Email domains allowed to sign in, e.g. your school domain |
| `OIDC_PKCE_ENABLED` | Forces PKCE on for SSO sign-in |
| `DISABLE_TELEMETRY` | `true`: no usage telemetry to Onyx |
| `MCP_SERVER_ENABLED` | `false`: no access for outside AI clients |
| `ONYX_URL`, `ONYX_PAT` | For `deploy/sync_prompts.py`: the site URL and an admin's access token |

## LLM provider (DeepSeek)

Onyx connects to DeepSeek directly through its built-in OpenAI-compatible provider. The API key is stored encrypted in the Onyx database, not in env.

1. **Admin Panel → Language Models → add an OpenAI-Compatible provider.**
2. API base `https://api.deepseek.com`, your API key, model `deepseek-flash` (1M context, reads images).
3. Set it as the **default** model and the **default vision** model.
4. Test it with a chat.

Answer time: about 5–10 s for the Policy Assistant and 15–30 s for the Behaviour Assistant, which reads a much larger set. The first question after an agent's files change can take a minute or two while DeepSeek processes the new text.

## Microsoft Entra sign-in

SSO is set up in the admin panel (Onyx v5 no longer uses `AUTH_TYPE` env variables). It is free in Community Edition.

### 1. Register the app in Entra

At **entra.microsoft.com → Applications → App registrations → New registration**:

1. **Name** `PaoTeacherAgent`. **Supported account types:** *Accounts in this organizational directory only (Single tenant)*.
2. **Redirect URI:** platform **Web**, `http://localhost/api/auth/oidc/entra/callback`. Under **Authentication → Add URI**, also add `https://<domain>/api/auth/oidc/entra/callback`. The path ends in the provider *Name* from step 2 (`entra`).
3. **Certificates & secrets → New client secret.** Copy the *Value* immediately.
4. **API permissions → Microsoft Graph → Delegated:** `openid`, `profile`, `email` (and the default `User.Read`), then **Grant admin consent**.
5. **Token configuration → Add optional claim → ID → `email`.**
6. From **Overview**, copy the *Application (client) ID* and the *Directory (tenant) ID*.

### 2. Add the provider in Onyx

**Admin Panel → SSO Providers → Add Provider:**

| Field | Value |
|---|---|
| Provider Type | OIDC |
| Name | `entra` (can't be changed later) |
| Display Name | `Microsoft` |
| Client ID / Client Secret | from step 1 |
| OpenID Configuration URL | `https://login.microsoftonline.com/<TENANT_ID>/v2.0/.well-known/openid-configuration` |
| Require Verified Email Claim | **Off** (Entra doesn't send it) |
| Enable PKCE | On |
| Scopes | empty |
| Allowed Email Domains | your school email domain(s) |

The single-tenant app plus your tenant ID in the URL means only your school's accounts can sign in.

### 3. Lock it down, in this order

1. Sign in with Microsoft to check it works.
2. Make your Microsoft account an admin (see [Admins](#admins)) and sign in again to confirm you can open the Admin Panel.
3. **Admin Panel → Security & Hardening → turn off password login.**

Do step 3 last. Turning off password login before a Microsoft account is admin locks everyone out of the admin panel.

## Documents

| Agent | Source folder | Contents |
|---|---|---|
| Policy Assistant | *YK Pao Behaviour Policies* | Behaviour Policy, Dress Code, Technology Use Policy |
| Behaviour Assistant | *Best Practice Documents for Behaviour Leadership* | DfE, Ofsted, EEF and similar guidance |

Documents are files attached to each agent; there is no folder sync.

**Add or remove documents:** in the sidebar, open the agent's **⋯ → Edit** (or go to `/app/agents/edit/1` for Policy, `/app/agents/edit/2` for Behaviour) → **Knowledge → Your Files**. Use **Add File** to upload; tick or untick files to attach or detach them; then **Save**. A new file takes a few seconds to process.

**Replace an outdated policy** so old consequences are never cited:

1. Open the Policy Assistant's editor → Knowledge → Your Files.
2. Untick the old version, **Add File** with the new one, make sure it is ticked, and **Save**.
3. Delete the old file from the list so nobody re-attaches it.
4. Ask a question the change affects and check the answer cites the new file.

**File rules:**

- Upload PDF, DOCX or PPTX. Convert old `.doc` files to `.docx` first.
- Don't upload standalone images (PNG/JPG). The model sees them as if the teacher had just sent them. Upload the document that contains the image instead.
- Scanned PDFs have no text; upload a text version.
- Keep one admin in charge of documents: the list is that admin's own files, and a different admin may not see them.

## Editing the agent prompts

The source of truth is `deploy/agent_policy_prompt.md` and `deploy/agent_behaviour_prompt.md`. Edit them, then push them into the running agents:

```bash
set -a; . deploy/.env; set +a
python3 deploy/sync_prompts.py
```

It changes only the prompts and keeps every other agent setting. `ONYX_PAT` is an admin's access token: **avatar menu → Settings → Access Tokens → New Access Token**.

Avoid editing the prompts in the agent editor: the next sync overwrites them. Start a new chat to see a prompt change.

## Admins

**Admin Panel → Users →** change the person's role to **Admin**. They must have signed in once first. On a new, empty database, the first person to sign in becomes admin automatically.

## Chat retention and privacy

- **Where chats are stored:** the Postgres database on our server (Docker volume `onyx_db_volume`), together with users, agents and uploaded files.
- **Who can read them:** each teacher sees only their own chats in the app. Community Edition has no admin screen for browsing other people's chats (query history is a paid Onyx feature), but anyone with server or database access can read everything.
- **Retention:** kept forever. Automatic deletion after N days is a paid (Enterprise) Onyx feature. Teachers can delete their own chats.
- **Memory:** Onyx can remember facts about a teacher (role, year groups) across chats. The prompts tell it never to store anything about students. Teachers can view, delete or turn off memory under **Settings → Personalization**.
- **What leaves the server:** chat content goes only to DeepSeek. Telemetry is off (`DISABLE_TELEMETRY=true`). Onyx also fetches public model lists from GitHub, which contain no chat content. The code sandbox and the MCP server are turned off.
- **Student data:** the agents never ask for student names and don't repeat them, but whatever a teacher types is stored with the chat and sent to DeepSeek.

## Backups

In Lite mode everything lives in Postgres: chats, users, agents, settings and the uploaded documents. One dump covers it all.

```bash
# Backup (also keep a copy of deploy/.env: without ENCRYPTION_KEY_SECRET the stored
# DeepSeek key and SSO secret can't be decrypted)
docker exec onyx-relational_db-1 pg_dump -U postgres -Fc postgres > paoteacheragent-$(date +%F).dump

# Restore into a fresh deployment with the same deploy/.env
deploy/compose.sh up -d relational_db
docker exec -i onyx-relational_db-1 pg_restore -U postgres -d postgres --clean --if-exists < paoteacheragent-YYYY-MM-DD.dump
deploy/compose.sh up -d --wait
```

Run the backup on a schedule (e.g. a nightly cron job) and store copies off the server.

## Upgrading Onyx

This repo is a fork of Onyx pinned to a release tag (see `IMAGE_TAG`). To move to a new release:

```bash
# 0. Back up first (see Backups)
git fetch upstream tag vX.Y.Z --no-tags
git merge vX.Y.Z
#    Conflicts can only be in the files listed in CUSTOMIZATIONS.md;
#    re-apply each change there. For README.md, keep ours.
# 1. Set IMAGE_TAG=vX.Y.Z and ONYX_WEB_SERVER_IMAGE=paoteacheragent-web:vX.Y.Z in deploy/.env
#    (and deploy/.env.example)
deploy/compose.sh build web_server
deploy/compose.sh up -d --wait   # database migrations run automatically on start
```

Check the upstream release notes first, and test the upgrade locally before production. Rolling back after a migration needs the database backup.

## Not done yet

- **Evaluation:** `eval/questions.yaml` and the runner script.
- **Production deployment:** HTTPS for the school domain.
- **School logo:** a placeholder "P" mark is used until the logo is provided.
- **Safeguarding policy:** not yet uploaded, so the agents can only point to the designated safeguarding lead, not cite the procedure.
- **Hiding agent creation from teachers:** not done; any teacher can create their own agents.
