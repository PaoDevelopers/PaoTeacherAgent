# PaoTeacherAgent

AI assistant for YK Pao School teachers, built on [Onyx](https://github.com/onyx-dot-app/onyx) Community Edition (MIT). Teachers sign in with their school Microsoft account and pick one of two agents:

| Agent | Answers from | For |
|---|---|---|
| **Policy Assistant** (default) | YK Pao School policies only | Rules, behaviour, consequences, what to record and who to tell |
| **Behaviour Assistant** | Behaviour best-practice guidance chosen by the school (DfE, Ofsted, EEF) | Classroom management, routines, engagement, students with additional needs |

The assistants inform teachers. They never make disciplinary decisions. Both put safeguarding first and never repeat student names.

- [How it works](#how-it-works)
- [Run locally](#run-locally)
- [Deploy with Docker Compose](#deploy-with-docker-compose)
- [Settings](#settings)
- [LLM provider (DeepSeek)](#llm-provider-deepseek)
- [Microsoft Entra sign-in](#microsoft-entra-sign-in)
- [Documents](#documents)
- [Editing the agents](#editing-the-agents)
- [Admins](#admins)
- [Chat retention and privacy](#chat-retention-and-privacy)
- [Backups](#backups)
- [Upgrading Onyx](#upgrading-onyx)
- [Troubleshooting](#troubleshooting)
- [Not done yet](#not-done-yet)

## How it works

- **Onyx Lite mode.** The stack is Postgres, Redis, the API server and the web server. The web server serves the site on port 80 and forwards `/api` to the API server. It has no vector database and no embedding model, so it runs on modest hardware without AVX.
- **No RAG.** Each agent's documents are attached to the agent as files. For each question the model gets the full text of all the agent's documents. Both sets fit well in the 1M-token context of DeepSeek Flash. If a set becomes too large, Onyx lets the model open files itself with its `read_file` tool.
- **Citations** are links to the source file. The model adds the page or section after each citation.
- **Built-in agents.** The two agents are part of the backend. On each start the API server:
  - creates or updates the two agents and pins them for every account
  - syncs their documents from two folders
  - adds the DeepSeek provider if no provider exists
  - turns off the default Onyx assistant

  A new deployment needs no setup clicks.
- **School branding.** The UI shows the YK Pao logo and the PaoTeacherAgent name. It is in English and Simplified Chinese only.
- **Our changes to Onyx** are in [CUSTOMIZATIONS.md](CUSTOMIZATIONS.md). This includes the upstream files we removed.
- **Our images.** GitHub Actions builds our backend and web images on each push to `main` and pushes them to the GitHub Container Registry (`ghcr.io/paodevelopers/paoteacheragent-backend` and `-web`, for amd64 and arm64). `docker compose pull` gets them, so a deployment does not build anything. The other images are the upstream images.

| Path | What it is |
|---|---|
| `compose.yaml` | The stack |
| `Dockerfile` | Our backend image: the upstream Onyx image (`IMAGE_TAG`) plus our `backend/onyx` code |
| `.env.example` | The settings. Copy it to `.env`. |
| `data/` | All data: `data/postgres/` (the database) and `data/knowledge/` (the agents' documents). Git ignores it. |
| `.github/workflows/build-images.yml` | Builds our backend and web images on each push to `main` and pushes them to GHCR |
| `backend/onyx/seeding/pao_agents.py` | The built-in agents: names, descriptions, starter questions, folder sync |
| `backend/onyx/seeding/pao_prompts/` | The agent system prompts |

## Run locally

You need Docker with Docker Compose.

```bash
cp .env.example .env      # then fill in .env (see Settings, and Database)
docker compose pull
docker compose up -d
```

Open http://localhost. The first account to sign up becomes admin. Both agents are already there.

To test code changes before you push them, build the images on your computer:

```bash
docker compose build      # the first web build takes about 15 min
docker compose up -d
```

`docker compose pull` gets the GHCR images again.

## Deploy with Docker Compose

Production is the same as local, on one Linux server with Docker.

1. Get the code: `git clone https://github.com/PaoDevelopers/PaoTeacherAgent.git && cd PaoTeacherAgent`
2. `cp .env.example .env` and fill in `.env` (see [Settings](#settings)). Set `WEB_DOMAIN=https://<your domain>` and `VALID_EMAIL_DOMAINS` to the school email domain.
3. Copy the documents into `data/knowledge/policies/` and `data/knowledge/behaviour/` (see [Documents](#documents)).
4. `docker compose pull && docker compose up -d`
5. Put a TLS reverse proxy (the school's proxy, or Caddy) in front of port 80. Answers stream for up to a few minutes, so allow long requests.
6. Open `https://<your domain>` and sign up. The first account becomes admin. Then set up [Microsoft Entra sign-in](#microsoft-entra-sign-in) and [Backups](#backups).

Keep a copy of `.env` in a safe place. Without `ENCRYPTION_KEY_SECRET`, Onyx cannot decrypt the stored DeepSeek key and SSO secret.

To update after a merge into `main` (wait until the **Build images** workflow finishes):

```bash
git pull
docker compose pull
docker compose up -d      # database migrations run automatically
```

Logs: `docker compose logs -f api_server`. Agent and document sync: `docker compose logs api_server | grep PaoTeacherAgent`.

## Settings

All settings are in `.env`.

| Setting | Purpose |
|---|---|
| `POSTGRES_URL` | Your Postgres database: `postgresql://<user>:<password>@<host>:<port>/<database>` |
| `POSTGRES_PASSWORD` | Only for the bundled Postgres (see below). Postgres reads it only when `data/postgres/` is empty. |
| `USER_AUTH_SECRET`, `ENCRYPTION_KEY_SECRET` | Make each with `openssl rand -hex 32`. `ENCRYPTION_KEY_SECRET` encrypts the stored LLM key and SSO secret. |
| `DEEPSEEK_API_KEY` | Adds the DeepSeek provider on first start. Onyx then keeps the key, encrypted, in its database. |
| `WEB_DOMAIN` | `http://localhost` locally, `https://<domain>` in production. Must agree with the Entra redirect URI. |
| `VALID_EMAIL_DOMAINS` | Email domains that can sign in. Empty allows all. |
| `OIDC_PKCE_ENABLED` | Turns on PKCE for SSO sign-in |
| `DISABLE_TELEMETRY` | `true`: no usage telemetry to Onyx |

The app does not start while a secret is still `changeme`.

**Database.** By default the stack uses the Postgres server in `POSTGRES_URL`. To run Postgres in the stack instead, with its data in `data/postgres/`:

1. In `compose.yaml`, uncomment the `relational_db` service and the `relational_db` entry under `api_server` → `depends_on`.
2. In `.env`, set `POSTGRES_PASSWORD` and use it in `POSTGRES_URL=postgresql://postgres:<password>@relational_db:5432/postgres`.

## LLM provider (DeepSeek)

Onyx connects to DeepSeek directly through its built-in OpenAI-compatible provider. The API server adds the provider on first start from `DEEPSEEK_API_KEY`, and stores the key encrypted in the database. To change the key or model later, or to add the provider manually:

1. **Admin Panel → Language Models → add an OpenAI-Compatible provider.**
2. Set the API base to `https://api.deepseek.com`, your API key, and the model `deepseek-flash` (1M context, reads images).
3. Set it as the **default** model and the **default vision** model.
4. Test it with a chat.

Answer time is about 5–10 s for the Policy Assistant and 15–30 s for the Behaviour Assistant, which reads a much larger set. After an agent's files change, the first question can take one or two minutes while DeepSeek processes the new text.

## Microsoft Entra sign-in

You set up SSO in the admin panel. Onyx v5 does not use `AUTH_TYPE` env variables. SSO is free in Community Edition.

### 1. Register the app in Entra

Go to **entra.microsoft.com → Applications → App registrations → New registration**:

1. Set **Name** to `PaoTeacherAgent`. Set **Supported account types** to *Accounts in this organizational directory only (Single tenant)*.
2. **Redirect URI:** platform **Web**, `http://localhost/api/auth/oidc/entra/callback`. Under **Authentication → Add URI**, also add `https://<domain>/api/auth/oidc/entra/callback`. The last part of the path is the provider *Name* from section 2 (`entra`).
3. **Certificates & secrets → New client secret.** Copy the *Value* immediately.
4. **API permissions → Microsoft Graph → Delegated:** add `openid`, `profile` and `email` (keep the default `User.Read`). Then select **Grant admin consent**.
5. **Token configuration → Add optional claim → ID → `email`.**
6. On **Overview**, copy the *Application (client) ID* and the *Directory (tenant) ID*.

### 2. Add the provider in Onyx

**Admin Panel → SSO Providers → Add Provider:**

| Field | Value |
|---|---|
| Provider Type | OIDC |
| Name | `entra` (you cannot change it later) |
| Display Name | `Microsoft` |
| Client ID / Client Secret | from section 1 |
| OpenID Configuration URL | `https://login.microsoftonline.com/<TENANT_ID>/v2.0/.well-known/openid-configuration` |
| Require Verified Email Claim | **Off** (Entra does not send it) |
| Enable PKCE | On |
| Scopes | empty |
| Allowed Email Domains | the school email domains |

A single-tenant app with your tenant ID in the URL lets only school accounts sign in.

### 3. Lock it down, in this order

1. Sign in with Microsoft to make sure it works.
2. Make your Microsoft account an admin (see [Admins](#admins)). Sign in again and make sure you can open the Admin Panel.
3. **Admin Panel → Security & Hardening → turn off password login.**

Do step 3 last. If you turn off password login before a Microsoft account is admin, nobody can open the admin panel.

## Documents

| Agent | Folder on the server | Contents |
|---|---|---|
| Policy Assistant | `data/knowledge/policies/` | YK Pao policies: Behaviour Policy, Dress Code, Technology Use Policy |
| Behaviour Assistant | `data/knowledge/behaviour/` | Behaviour best-practice guidance: DfE, Ofsted, EEF |

The folders can start empty. The agents exist from the first start and get their documents when you add files. The folders are the source of truth. On each start, the API server compares each folder with the agent's documents. It adds new or changed files, and removes files that are no longer in the folder. To apply a change without a full restart:

```bash
docker compose restart api_server
```

New files need a short time to process after the restart. The log shows what was synced: `docker compose logs api_server | grep PaoTeacherAgent`.

**Replace an outdated policy**, so that the agent never cites old consequences:

1. Delete the old file from `data/knowledge/policies/` and copy in the new one.
2. Run `docker compose restart api_server`.
3. Ask a question about the change. Make sure the answer cites the new file.

**File rules:**

- Use PDF, DOCX or PPTX. The sync skips `.doc` files, so convert them to `.docx` first.
- Do not add images (PNG or JPG). The sync skips them. The model would see them as if the teacher sent them. Add the document that contains the image.
- Scanned PDFs have no text. Add a text version.

Admins can also attach more files to an agent in the agent editor (**⋯ → Edit → Knowledge → Your Files**). The folder sync keeps these files. It manages only the files that came from the folders.

## Editing the agents

The agents are defined in the backend:

- Prompts: `backend/onyx/seeding/pao_prompts/policy_assistant.md` and `behaviour_assistant.md`.
- Names, descriptions, starter questions and folders: `AGENTS` in `backend/onyx/seeding/pao_agents.py`.

Merge the edit into `main`, then [update the deployment](#deploy-with-docker-compose). The backend build takes about 1 min. To test the edit locally first:

```bash
docker compose build api_server
docker compose up -d
```

Start a new chat to see a prompt change. The next start overwrites edits to these fields that you make in the agent editor.

## Admins

**Admin Panel → Users →** change the person's role to **Admin**. The person must sign in one time first. On a new, empty database, the first person to sign in becomes admin automatically.

## Chat retention and privacy

- **Where chats are stored:** in the Postgres database on our server (`data/postgres/`), with the users, agents and uploaded files.
- **Who can read them:** each teacher sees only their own chats in the app. Community Edition has no admin screen to see other people's chats (query history is a paid Onyx feature). But anyone with access to the server or database can read all chats.
- **Retention:** chats are kept forever. Automatic deletion after N days is a paid (Enterprise) Onyx feature. Teachers can delete their own chats.
- **Memory:** Onyx can remember facts about a teacher (role, year groups) across chats. The prompts tell it never to store information about students. Teachers can see, delete or turn off memory in **Settings → Personalization**.
- **What leaves the server:** chat content goes only to DeepSeek. Telemetry is off (`DISABLE_TELEMETRY=true`). Onyx also gets public model lists from GitHub, which contain no chat content. The code sandbox and the MCP server are off.
- **Student data:** the agents never ask for student names and do not repeat them. But the app stores everything a teacher types with the chat, and sends it to DeepSeek.

## Backups

In Lite mode, all data is in Postgres: chats, users, agents, settings and the uploaded documents. Postgres keeps its files in `data/postgres/`. One dump contains all of it. Do not copy `data/postgres/` while the stack runs; use `pg_dump`.

Also back up `data/knowledge/`. They are the source of truth for the agents' documents.

```bash
# Backup. Also keep a copy of .env: without ENCRYPTION_KEY_SECRET,
# Onyx cannot decrypt the stored DeepSeek key and SSO secret.
docker exec onyx-relational_db-1 pg_dump -U postgres -Fc postgres > paoteacheragent-$(date +%F).dump

# Restore into a new deployment that uses the same .env
docker compose up -d relational_db
docker exec -i onyx-relational_db-1 pg_restore -U postgres -d postgres --clean --if-exists < paoteacheragent-YYYY-MM-DD.dump
docker compose up -d
```

Run the backup on a schedule (for example, a nightly cron job) and keep copies off the server.

## Upgrading Onyx

This repo is a fork of Onyx at a fixed release tag (see `IMAGE_TAG` in `Dockerfile`). To move to a new release:

```bash
# 0. Make a backup first (see Backups)
git fetch upstream tag vX.Y.Z --no-tags
git merge vX.Y.Z
#    Conflicts can occur only in the files in CUSTOMIZATIONS.md. Apply each change
#    again. For README.md, keep ours. Delete again the upstream files we removed.
# 1. Set IMAGE_TAG=vX.Y.Z in Dockerfile
# 2. Test locally
docker compose build
docker compose up -d   # database migrations run automatically
# 3. Merge into main, wait for the Build images workflow, then update the
#    deployment (see Update the deployment)
```

Read the upstream release notes first. Test the upgrade locally before production. After a migration, you need the database backup to go back to the old version.

## Troubleshooting

| Problem | Fix |
|---|---|
| `docker compose pull` fails with `denied` or `unauthorized` for a `ghcr.io` image | The image is private. Make the package public (**GitHub → PaoDevelopers → Packages → the package → Package settings → Change visibility**), or run `docker login ghcr.io` with a GitHub token that has `read:packages`. |
| A Docker Hub pull fails with `EOF` | This occurs on some networks. Run the command again, or `docker pull` the image until it works. |
| A document does not appear in an agent | Look for `skipping knowledge file` in `docker compose logs api_server`. Check the [file rules](#documents). |
| A chat waits a long time and then fails | Make sure the server can reach `api.deepseek.com`, and that the DeepSeek key is valid (**Admin Panel → Language Models**). |

## Not done yet

- **Evaluation:** a question set and a runner script to test answers.
- **Built-in HTTPS:** the stack serves HTTP only. Use a reverse proxy (see [Add HTTPS](#5-add-https)).
- **Safeguarding policy:** not uploaded yet. The agents can only refer teachers to the designated safeguarding lead. They cannot cite the procedure.
- **Hiding agent creation from teachers:** not done. Any teacher can create their own agents.
- **Checks on pull requests:** GitHub Actions only builds images. It does not run tests or linters. Run `pre-commit` locally.
