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
- [Editing the agents](#editing-the-agents)
- [Admins](#admins)
- [Chat retention and privacy](#chat-retention-and-privacy)
- [Backups](#backups)
- [Upgrading Onyx](#upgrading-onyx)
- [Not done yet](#not-done-yet)

## How it works

- **Onyx Lite mode**: Postgres, Redis, the API server, the web server and nginx. No vector database and no embedding model, so it runs on modest hardware without AVX.
- **No RAG.** Each agent's documents are attached to the agent as files. On every question the model gets the full text of all its documents (both sets fit well within DeepSeek Flash's 1M-token context). If a set ever grows too large, Onyx switches to letting the model open files itself with its `read_file` tool.
- **Citations** are clickable and point to the source file; the model adds the page or section after each one.
- **Built-in agents.** The two agents are part of the backend: on every start the API server creates or updates them, syncs their documents from two folders, adds the DeepSeek provider if none exists, and turns off Onyx's default assistant. A new deployment works with no setup clicks, and every account gets both agents pinned.
- **Our changes to Onyx** are listed in [CUSTOMIZATIONS.md](CUSTOMIZATIONS.md). We build our own backend and web images from this repo.

| Path | What it is |
|---|---|
| `deploy/compose.sh` | Runs upstream compose + Lite overlay + our overlay. Use it instead of `docker compose`. |
| `deploy/docker-compose.override.yml` | Our overlay: loads `deploy/.env`, runs Redis, turns off the code sandbox |
| `deploy/.env.example` | Template for `deploy/.env` (never commit `deploy/.env`) |
| `deploy/knowledge/policies/`, `deploy/knowledge/behaviour/` | The agents' documents (git-ignored; set `PAO_KNOWLEDGE_HOST_DIR` to use another folder) |
| `backend/onyx/seeding/pao_agents.py` | The built-in agents: names, descriptions, starter questions, folder sync |
| `backend/onyx/seeding/pao_prompts/` | The agent system prompts |

## Run locally

Needs Docker with Compose v2.

```bash
cp deploy/.env.example deploy/.env
# Fill in USER_AUTH_SECRET, ENCRYPTION_KEY_SECRET and POSTGRES_PASSWORD, each from:
openssl rand -hex 32
# and DEEPSEEK_API_KEY.

# Put the documents in place (see Documents):
#   deploy/knowledge/policies/   YK Pao policies
#   deploy/knowledge/behaviour/  behaviour best-practice guidance

deploy/compose.sh build api_server web_server   # our images; first build ~15 min
deploy/compose.sh up -d --wait
deploy/compose.sh ps                            # all services healthy
```

Open the site. On an empty database the first account to sign up becomes admin. Both agents are already there.

Docker Hub pulls can fail with `EOF` on some networks; just rerun the command, or `docker pull` the failing image until it succeeds.

## Environment variables

All live in `deploy/.env`. Any variable from `deployment/docker_compose/env.template` can also go there.

| Variable | Purpose |
|---|---|
| `IMAGE_TAG` | Upstream Onyx release this fork is based on |
| `ONYX_BACKEND_IMAGE`, `ONYX_WEB_SERVER_IMAGE` | Our images, built from this repo |
| `USER_AUTH_SECRET`, `ENCRYPTION_KEY_SECRET`, `POSTGRES_PASSWORD` | Secrets. `ENCRYPTION_KEY_SECRET` encrypts the stored LLM key and SSO secret: lose it and you must re-enter them. |
| `WEB_DOMAIN` | `http://localhost` locally, `https://<domain>` in production. Must match the Entra redirect URI. |
| `VALID_EMAIL_DOMAINS` | Email domains allowed to sign in, e.g. your school domain |
| `OIDC_PKCE_ENABLED` | Forces PKCE on for SSO sign-in |
| `DISABLE_TELEMETRY` | `true`: no usage telemetry to Onyx |
| `MCP_SERVER_ENABLED` | `false`: no access for outside AI clients |
| `DEEPSEEK_API_KEY` | Adds the DeepSeek provider on first start, when no chat model exists. Onyx then keeps the key, encrypted, in its database. |
| `PAO_KNOWLEDGE_HOST_DIR` | Folder holding `policies/` and `behaviour/`. Default `deploy/knowledge`. |

## LLM provider (DeepSeek)

Onyx connects to DeepSeek directly through its built-in OpenAI-compatible provider. The API server adds it on first start from `DEEPSEEK_API_KEY` and stores the key encrypted in the database. To change the key or model later, or to add it by hand:

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

| Agent | Folder on the server | Contents |
|---|---|---|
| Policy Assistant | `deploy/knowledge/policies/` | YK Pao policies: Behaviour Policy, Dress Code, Technology Use Policy |
| Behaviour Assistant | `deploy/knowledge/behaviour/` | Behaviour best-practice guidance: DfE, Ofsted, EEF |

The folders are the source of truth. On every start the API server compares each folder with the agent's documents: new or changed files are added, and files no longer in the folder are removed from the agent. To apply a change without a full restart:

```bash
deploy/compose.sh restart api_server
```

New files take a short time to process after the restart. The log shows what was synced: `deploy/compose.sh logs api_server | grep PaoTeacherAgent`.

**Replace an outdated policy** so old consequences are never cited:

1. Delete the old file from `deploy/knowledge/policies/` and copy in the new one.
2. Run `deploy/compose.sh restart api_server`.
3. Ask a question the change affects and check the answer cites the new file.

**File rules:**

- Use PDF, DOCX or PPTX. Convert old `.doc` files to `.docx`; `.doc` files are skipped.
- Don't add standalone images (PNG/JPG); they are skipped. The model would see them as if the teacher had just sent them. Add the document that contains the image instead.
- Scanned PDFs have no text; add a text version.

Admins can also attach extra files to an agent in the agent editor (**⋯ → Edit → Knowledge → Your Files**). The folder sync keeps those; it only manages files that came from the folders.

## Editing the agents

The agents are defined in the backend:

- Prompts: `backend/onyx/seeding/pao_prompts/policy_assistant.md` and `behaviour_assistant.md`.
- Names, descriptions, starter questions and folders: `AGENTS` in `backend/onyx/seeding/pao_agents.py`.

After an edit, rebuild and restart (the rebuild is quick; only the code layer changes):

```bash
deploy/compose.sh build api_server
deploy/compose.sh up -d --wait
```

Start a new chat to see a prompt change. Edits made in the agent editor to these fields are overwritten on the next start.

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

Also back up the knowledge folders (`deploy/knowledge/` or `PAO_KNOWLEDGE_HOST_DIR`): they are the source of truth for the agents' documents.

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
# 1. Set IMAGE_TAG=vX.Y.Z and the vX.Y.Z tag in ONYX_BACKEND_IMAGE and ONYX_WEB_SERVER_IMAGE
#    in deploy/.env (and deploy/.env.example)
deploy/compose.sh build api_server web_server
deploy/compose.sh up -d --wait   # database migrations run automatically on start
```

Check the upstream release notes first, and test the upgrade locally before production. Rolling back after a migration needs the database backup.

## Not done yet

- **Evaluation:** `eval/questions.yaml` and the runner script.
- **Production deployment:** HTTPS for the school domain.
- **School logo:** a placeholder "P" mark is used until the logo is provided.
- **Safeguarding policy:** not yet uploaded, so the agents can only point to the designated safeguarding lead, not cite the procedure.
- **Hiding agent creation from teachers:** not done; any teacher can create their own agents.
