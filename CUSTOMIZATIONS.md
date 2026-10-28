# PaoTeacherAgent customizations to upstream Onyx

Base: upstream Onyx **v5.0.1** (tag `v5.0.1`). Only the web image is built from this fork
(`ONYX_WEB_SERVER_IMAGE=paoteacheragent-web:<tag>`); backend images are upstream's, so the
fork must stay on a release tag that matches `IMAGE_TAG`.

No file under `backend/ee`, `web/src/app/ee` or `web/src/ee` is changed.

Our own files (no merge conflicts possible): `deploy/`, `eval/`, `CUSTOMIZATIONS.md`,
`web/public/paoteacheragent.svg`, `web/src/app/css/paoteacheragent.css`.

## Upstream files changed

| File | Change | Reason |
|------|--------|--------|
| `web/lib/opal/src/logos/onyx-logo.tsx` | Onyx mark replaced by PaoTeacherAgent mark (placeholder "P" until the school logo arrives) | Branding; whitelabeling is Business-tier in Onyx. Every app surface renders this component. |
| `web/lib/opal/src/logos/onyx-typed.tsx` | "Onyx" wordmark replaced by "PaoTeacherAgent" | Branding (sidebar, login page) |
| `web/src/lib/settings/hooks.ts` | Default app name `"Onyx"` → `"PaoTeacherAgent"` | Branding (client-side name) |
| `web/src/lib/settings/svcSS.ts` | Same default | Branding (server-rendered name) |
| `web/src/lib/settings/types.ts` | Same default, in a doc comment | Keep comment accurate |
| `web/src/lib/app/svcSS.ts` | Same default; favicon `/onyx.ico` → `/paoteacheragent.svg` | Browser tab title and icon |
| `web/src/app/globals.css` | One `@import "./css/paoteacheragent.css"` line | Brand colour override for `--theme-primary-04/05/06` |
| `web/src/lib/app/hooks.ts` | Chat footer "Onyx vX – Open Source AI Platform" → app name | Branding |
| `web/src/sections/sidebar/AccountPopover.tsx` | Removed "Help & FAQ" (docs.onyx.app); version row shows "PaoTeacherAgent vX" with no Onyx link | Branding; Onyx admin docs are not teacher help |
| `web/lib/opal/src/components/buttons/attachment-item-button/styles.css` | Title text takes the remaining row width; center slot never shrinks below its content | Bug fix: long file names ran under the "1 hour ago" timestamp in Recent Files. Worth upstreaming. |
| `web/src/refresh-components/popovers/FilePickerPopover.tsx` | `titleMaxLines={1}` on file rows | Bug fix: long file names wrapped over several lines and ran into the PDF/PPTX label |
| `web/src/i18n/messages/*.json` (all 9 locales) | `auth.login.welcomeSubtitle.text` "Your open source AI platform for work" → "AI assistant for YK Pao School teachers" (translated) | Login page tagline |

Admin-only translation strings that mention "Onyx" (connectors, licensing, Onyx Lite notices)
are left as upstream: they describe the platform, and editing 9 locale files would make every
merge conflict.

## Re-applying after an upstream merge

1. `git merge v<new tag>`; conflicts can only be in the files above.
2. If upstream renamed or moved a logo component, re-point the change to the new component.
3. Bump `IMAGE_TAG` and the `ONYX_WEB_SERVER_IMAGE` tag in `deploy/.env(.example)`, rebuild
   with `deploy/compose.sh build web_server`.
