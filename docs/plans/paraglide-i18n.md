# Add ParaglideJS i18n (English + German)

## Context

The Floorplanner app has ~127 Svelte files with hardcoded English strings. Adding i18n with ParaglideJS enables German translation (and future languages) using a compiler-based approach with tree-shakable message functions and full type-safety. No URL prefixes — locale is detected via cookie/browser preference.

---

## Phase 1: Infrastructure Setup

### 1.1 Install
```bash
bun add -d @inlang/paraglide-js
```

### 1.2 Create `project.inlang/settings.json`
```json
{
  "baseLocale": "en",
  "locales": ["en", "de"],
  "modules": ["https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@latest/dist/index.js"]
}
```

### 1.3 Add plugin to `vite.config.ts`
```typescript
import { paraglideVitePlugin } from '@inlang/paraglide-js';
// Add before sveltekit() in plugins array:
paraglideVitePlugin({
  project: './project.inlang',
  outdir: './src/lib/paraglide',
  strategy: ['cookie', 'preferredLanguage', 'baseLocale']
})
```

### 1.4 Update `src/app.html`
Change `lang="en"` → `lang="%lang%"`

### 1.5 Add paraglide middleware to `src/hooks.server.ts`
Compose with existing handle using `sequence()`:
```typescript
import { sequence } from '@sveltejs/kit/hooks';
import { paraglideMiddleware } from '$lib/paraglide/server';

const paraglideHandle: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
    event.request = localizedRequest;
    return resolve(event, {
      transformPageChunk: ({ html }) => html.replace('%lang%', locale)
    });
  });

// Rename existing handle → appHandle, then:
export const handle = sequence(paraglideHandle, appHandle);
```

### 1.6 Create message files
- `messages/en.json` — all English strings
- `messages/de.json` — German translations

### 1.7 Add `src/lib/paraglide/` to `.gitignore`

### 1.8 Verify: `bun dev` starts, app loads in English

---

## Phase 2: Message Key Convention

Flat keys, dot-free, `snake_case` with area prefix:

| Prefix | Example |
|--------|---------|
| `common_` | `common_cancel`, `common_save` |
| `nav_` | `nav_projects`, `nav_settings` |
| `home_` | `home_title`, `home_empty_title` |
| `project_` | `project_share`, `project_history` |
| `item_` | `item_form_title_edit` |
| `canvas_` | `canvas_upload_title` |
| `comments_` | `comments_panel_title` |
| `sharing_` | `sharing_dialog_title` |
| `settings_` | `settings_general_title` |
| `auth_` | `auth_sign_in` |
| `branch_` | `branch_create_title` |
| `oauth_` | `oauth_consent_title` |
| `time_` | `time_just_now` |

Parameters use `{name}` syntax: `"home_delete_description": "Are you sure you want to delete \"{name}\"?"`

---

## Phase 3: Full String Extraction (by group)

### Group A: Layout & Navigation (do first)
- `src/routes/+layout.svelte` — SEO title/description
- `src/lib/components/layout/AppSidebar.svelte` — nav labels, auth, branch controls
- `src/lib/components/layout/MobileNav.svelte` — tab labels

### Group B: Home Page
- `src/routes/+page.svelte` — project list, empty states, dialogs

### Group C: Language Switcher (new component)
- Create `src/lib/components/layout/LanguageSwitcher.svelte` using shadcn Select
- Add to AppSidebar and settings/general page

### Group D: Items Components
- `src/lib/components/items/ItemForm.svelte`
- `src/lib/components/items/ItemList.svelte`
- `src/lib/components/items/ItemCard.svelte`
- `src/lib/components/items/ItemBottomSheet.svelte`

### Group E: Canvas Components
- `src/lib/components/canvas/FloorplanUpload.svelte`
- `src/lib/components/canvas/ScaleCalibration.svelte`
- `src/lib/components/canvas/CanvasControls.svelte`

### Group F: Comments Components
- `src/lib/components/comments/CommentPanel.svelte`
- `src/lib/components/comments/CommentThread.svelte`
- `src/lib/components/comments/PlacementOverlay.svelte`

### Group G: Project Page (largest file, after sub-components done)
- `src/routes/projects/[id]/+page.svelte` — ~50+ strings

### Group H: Sharing Components
- `src/lib/components/sharing/ShareDialog.svelte`
- `src/lib/components/sharing/InviteForm.svelte`
- `src/lib/components/sharing/MemberList.svelte`
- `src/lib/components/sharing/ShareLinkList.svelte`

### Group I: Project Components
- `src/lib/components/projects/ProjectCard.svelte`
- `src/lib/components/projects/HistoryDialog.svelte`
- `src/lib/components/projects/McpToolsDialog.svelte`
- `src/lib/components/projects/ProjectListDialog.svelte`

### Group J: Settings Pages
- `src/routes/settings/+layout.svelte`
- `src/routes/settings/general/+page.svelte`
- `src/routes/settings/mcp/+page.svelte`

### Group K: OAuth/Invite/Share Pages
- `src/routes/oauth/consent/+page.svelte`
- `src/routes/oauth/error/+page.svelte`
- `src/routes/invite/[token]/+page.svelte`
- `src/routes/share/[token]/+page.svelte`

### Group L: Auth Components
- `src/lib/components/auth/ImportLocalProjectsModal.svelte`

### Group M: Relative Time Utility
- Consolidate duplicated `formatRelativeTime` into `src/lib/utils/relative-time.ts` using message functions

### Group N: Complete German Translations
- Fill out all keys in `messages/de.json`

---

## Phase 4: Service Worker / PWA

- No changes to `src/service-worker.ts` (no user-facing strings)
- Cookie strategy sets `PARAGLIDE_LOCALE` — persists across navigations
- Vite hash-based filenames handle cache invalidation for translated bundles
- `static/manifest.json` stays English (PWA manifest can't be dynamically translated)

---

## Verification

1. `bun dev` — app loads, English by default
2. `bun check` — no type errors from paraglide imports
3. Language switcher toggles all visible strings to German
4. Cookie persists across refresh
5. `bun build` — production build succeeds
6. SSR: view-source shows correct language strings
7. Mobile: language switcher accessible in sidebar
