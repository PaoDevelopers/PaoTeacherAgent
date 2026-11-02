# PaoTeacherAgent customizations to upstream Onyx

Base: upstream Onyx **v5.0.1** (tag `v5.0.1`). We build the backend and web images from this
fork (`ONYX_BACKEND_IMAGE`, `ONYX_WEB_SERVER_IMAGE`); other images are upstream's.

No file under `backend/ee`, `web/src/app/ee` or `web/src/ee` is changed.

Our own files (no merge conflicts possible): `deploy/`, `eval/`, `CUSTOMIZATIONS.md`,
`backend/onyx/seeding/pao_agents.py`, `backend/onyx/seeding/pao_prompts/`, `backend/onyx/db/pao.py`,
`web/public/paoteacheragent.svg`, `web/public/yk-pao-logo.png`, `web/src/app/app/components/OnboardingCard.tsx` (and its test), `web/src/app/app/plugins/layout.tsx` (redirects users without admin-panel access to `/app`), `web/src/app/css/paoteacheragent.css`, `web/src/app/fonts/` (woff2 files for Google Sans and DM Mono, with their OFL license texts).

## Upstream files changed

| File | Change | Reason |
|------|--------|--------|
| `README.md` | Replaced with the PaoTeacherAgent README | Our documentation. On merge conflicts, keep ours. |
| `backend/onyx/setup.py` | Calls `seed_pao_agents` after `setup_postgres` (single tenant) | Built-in agents, their knowledge sync and the DeepSeek provider on every start |
| `web/lib/opal/src/logos/onyx-logo.tsx` | Onyx mark replaced by an `<image>` of `/yk-pao-logo.png` (the YK Pao School logo, 512px with a transparent background; replace that file to change it) | Branding; whitelabeling is Business-tier in Onyx. Every app surface renders this component. |
| `web/src/sections/sidebar/AppSidebar.tsx` | Removed the Projects section, its folded popover and new-project modal; the Craft entry shows only when Craft is available (no Business upsell); the Plugins entry shows only to users with admin-panel access | Teachers do not use Projects or plugins; Business and Enterprise features are hidden, not shown locked |
| `web/src/refresh-components/avatars/CustomAgentAvatar.tsx` | An `icon_name` that is an emoji is drawn as text, without the octagon frame | The built-in agents use 📘 and 🌱; Onyx has no emoji icons |
| `web/src/lib/tools/components/ToolsPopover.tsx` | The chat Actions menu lists the Plugins row only for users with admin-panel access | Plugins are limited to admins |
| `web/src/app/layout.tsx` | UI font is SF Pro via `-apple-system` on Apple devices and Google Sans (OFL; Arial as its fallback) elsewhere, instead of Hanken Grotesk. Google Sans and DM Mono load from files in `web/src/app/fonts/` through `next/font/local`; the `--font-hanken-grotesk` variable keeps its name so every consumer works | School brand; no Google download at build or run time |
| `web/src/sections/sidebar/ChatButton.tsx` | Removed the "Move to project" menu item | Projects are hidden |
| `web/src/sections/sidebar/ChatSearchCommandMenu.tsx` | Removed the Projects filter, project results, "New project" actions and the project modal | Projects are hidden |
| `web/src/sections/sidebar/AdminSidebar.tsx` | Admin entries above the workspace tier are dropped, not listed greyed out under an upsell tooltip | Business and Enterprise features are hidden |
| `web/src/lib/tiers/hooks.ts` | `useTierLockedOptions` returns no options below the tier (was an "Upgrade Plan" row plus disabled options) | Business and Enterprise options are hidden |
| `web/src/views/admin/connectors/AddConnectorPage/sections/ConnectorSettingsSection.tsx` | Document access and manage-access fields render only on Business or higher; the form keeps its `access_type: "public"` default | Business features are hidden |
| `web/lib/opal/src/logos/onyx-typed.tsx` | "Onyx" wordmark replaced by "PaoTeacherAgent" | Branding (sidebar, login page) |
| `web/src/lib/settings/hooks.ts` | Default app name `"Onyx"` → `"PaoTeacherAgent"` | Branding (client-side name) |
| `web/src/lib/settings/svcSS.ts` | Same default | Branding (server-rendered name) |
| `web/src/lib/settings/types.ts` | Same default, in a doc comment | Keep comment accurate |
| `web/src/lib/app/svcSS.ts` | Same default; favicon `/onyx.ico` → `/yk-pao-logo.png` | Browser tab title and icon |
| `web/src/app/globals.css` | One `@import "./css/paoteacheragent.css"` line | Brand colour override for `--theme-primary-04/05/06` |
| `web/src/lib/app/hooks.ts` | Chat footer "Onyx vX – Open Source AI Platform" → app name | Branding |
| `web/src/sections/sidebar/AccountPopover.tsx` | Removed "Help & FAQ" (docs.onyx.app); version row shows "PaoTeacherAgent vX" with no Onyx link | Branding; Onyx admin docs are not teacher help |
| `web/lib/opal/src/components/buttons/attachment-item-button/styles.css` | Title text takes the remaining row width; center slot never shrinks below its content | Bug fix: long file names ran under the "1 hour ago" timestamp in Recent Files. Worth upstreaming. |
| `web/src/refresh-components/popovers/FilePickerPopover.tsx` | `titleMaxLines={1}` on file rows | Bug fix: long file names wrapped over several lines and ran into the PDF/PPTX label |
| `web/src/sections/knowledge/agent-knowledge/KnowledgeAddView.tsx` | `self-center` on the 3 count badges | Bug fix: counts sat at the top of two-line rows instead of centred |
| `web/src/sections/knowledge/agent-knowledge/KnowledgeTableContent.tsx` | `titleMaxLines={1}` on file names | Bug fix: long names wrapped and left the file icon floating above the checkbox line; full name shows on hover |
| `web/src/i18n/messages/{en,zh}.json` | `auth.login.welcomeSubtitle.text` "Your open source AI platform for work" → "AI assistant for YK Pao School teachers" (translated); new `chat.welcome.onboarding.*` keys for the welcome card | Login page tagline; welcome card text |
| `web/src/i18n/messages/{es,pt,fr,de,ja,ko,ar}.json` | **Deleted** | The school ships English and Simplified Chinese only. After an upstream merge, `git rm` these files again if upstream edited them. |
| `web/src/i18n/config.ts` | `SUPPORTED_LOCALES` is `["en", "zh"]`; no right-to-left or Arabic-digit locales; two endonyms | Language picker shows two languages. The backend `SupportedLanguage` enum is unchanged and still accepts the removed ones. |
| `web/src/i18n/**` and `web/tests/e2e/settings/language_switch.spec.ts`, `searchStateUtils.test.ts`, `GroupsPage/__tests__/utils.test.ts`, `ChatTaskModelSettings.test.tsx` | Tests that named removed languages now use `zh`; the Arabic number and right-to-left tests are gone | Keeps the test suite green |
| `web/src/views/AppPage.tsx` | Mounts `<OnboardingCard />` under the agent heading on the chat home | Welcome card for new teachers (our file: `web/src/app/app/components/OnboardingCard.tsx`) |

Admin-only translation strings that mention "Onyx" (connectors, licensing, Onyx Lite notices)
are left as upstream: they describe the platform, and editing the locale files would make every
merge conflict.

## Re-applying after an upstream merge

1. `git merge v<new tag>`; conflicts can only be in the files above.
2. If upstream renamed or moved a logo component, re-point the change to the new component.
3. Bump `IMAGE_TAG` and the tags in `ONYX_BACKEND_IMAGE` and `ONYX_WEB_SERVER_IMAGE` in
   `deploy/.env(.example)`, rebuild with `deploy/compose.sh build api_server web_server`.
4. Check `pao_agents.py` still matches the Onyx functions it calls (`upsert_persona`,
   `create_user_files`, `upsert_llm_provider`); the startup log shows a seeding error if not.
