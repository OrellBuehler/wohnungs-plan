---
phase: 01-i18n-infrastructure
plan: 01
subsystem: i18n
tags: [paraglide-js, inlang, svelte-sonner, i18n, localization]

# Dependency graph
requires: []
provides:
  - "Paraglide i18n infrastructure with cookie-based locale strategy"
  - "LanguageSwitcher component in sidebar"
  - "Sonner toast system mounted in root layout"
  - "English and German message files with 400+ translated keys"
affects: [02-i18n-message-extraction]

# Tech tracking
tech-stack:
  added: ["@inlang/paraglide-js@2.11.0", "svelte-sonner@1.0.7", "mode-watcher@1.1.0"]
  patterns: ["cookie-based locale detection via paraglide middleware", "flat snake_case i18n keys with area prefix", "shadcn-svelte wrapped toast component"]

key-files:
  created:
    - "src/lib/components/layout/LanguageSwitcher.svelte"
    - "src/lib/components/ui/sonner/index.ts"
    - "src/lib/components/ui/sonner/sonner.svelte"
    - "messages/en.json"
    - "messages/de.json"
    - "project.inlang/settings.json"
  modified:
    - "vite.config.ts"
    - "src/app.html"
    - "src/hooks.server.ts"
    - "src/routes/+layout.svelte"
    - "src/lib/components/layout/AppSidebar.svelte"

key-decisions:
  - "sequence(appHandle, paraglideHandle) order: appHandle first so session data is available to downstream handlers"
  - "Committed all worktree string extraction work (Groups C-H) alongside infrastructure to avoid losing work"
  - "Added duplicate message keys as aliases rather than renaming component references to preserve worktree work"

patterns-established:
  - "i18n key naming: flat snake_case with area prefix (e.g., item_form_name_label, sharing_dialog_title)"
  - "Locale strategy: cookie > preferredLanguage > baseLocale (en)"
  - "Toast usage: import { toast } from svelte-sonner anywhere, Toaster mounted once in root layout"

requirements-completed: [I18N-01, I18N-03, I18N-07, I18N-08, I18N-09]

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 1 Plan 01: i18n Infrastructure Summary

**Paraglide i18n with cookie-based locale, LanguageSwitcher in sidebar, Sonner toast in root layout, and 400+ en/de message keys**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T22:25:24Z
- **Completed:** 2026-02-17T22:29:37Z
- **Tasks:** 3
- **Files modified:** 40+

## Accomplishments
- Merged complete Paraglide infrastructure from worktree branch including all string extractions
- Fixed hooks.server.ts sequence order so session data is available before locale middleware
- Installed Sonner toast system and mounted Toaster in root layout
- Fixed 6 missing i18n message keys that caused build warnings

## Task Commits

Each task was committed atomically:

1. **Task 1: Merge worktree and fix sequence** - `6abae58` (feat: merge), `b616eed` (fix: sequence order)
2. **Task 2: Install Sonner and mount Toaster** - `d373fa3` (feat)
3. **Task 3: Build verification and missing keys fix** - `08f436c` (fix)

## Files Created/Modified
- `vite.config.ts` - Paraglide Vite plugin with cookie+preferredLanguage+baseLocale strategy
- `project.inlang/settings.json` - Inlang project config: baseLocale en, locales [en, de]
- `src/app.html` - HTML lang placeholder `%lang%` for server-side locale injection
- `src/hooks.server.ts` - Paraglide middleware wired via sequence(appHandle, paraglideHandle)
- `src/lib/components/layout/LanguageSwitcher.svelte` - Locale selector using getLocale/setLocale/locales
- `src/lib/components/layout/AppSidebar.svelte` - Sidebar with LanguageSwitcher integrated
- `src/routes/+layout.svelte` - Root layout with Toaster mounted and paraglide messages for SEO
- `src/lib/components/ui/sonner/` - shadcn-svelte wrapped Toaster component
- `messages/en.json` - 410+ English message keys
- `messages/de.json` - 410+ German message keys

## Decisions Made
- **sequence(appHandle, paraglideHandle)**: appHandle runs first so `event.locals.user` is populated before paraglide middleware processes locale
- **Committed all worktree changes**: The worktree had extensive uncommitted string extraction work (Groups C-H, 27 files) beyond what the plan anticipated. Committed all of it before merging to avoid losing work.
- **Added duplicate message keys as aliases**: Components referenced `invite_error_email_mismatch_title` but message files had `invite_error_email_title`. Added aliases rather than modifying component code to keep the merge clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Committed additional worktree string extraction work**
- **Found during:** Task 1 (worktree merge)
- **Issue:** Plan only mentioned committing LanguageSwitcher.svelte and AppSidebar.svelte, but the worktree had 27 additional modified files with i18n string extractions and 700+ new message keys
- **Fix:** Committed all uncommitted worktree changes in a separate commit before merging
- **Files modified:** 27 component files + messages/en.json + messages/de.json
- **Verification:** All files present after merge
- **Committed in:** `62f77b8` (worktree commit, then merged via `6abae58`)

**2. [Rule 1 - Bug] Fixed missing i18n message keys causing build warnings**
- **Found during:** Task 3 (build verification)
- **Issue:** Components referenced 6 message keys that didn't exist in message files (invite_error_email_mismatch_title/message, invite_error_signin_required_title/message, share_error_wrong_password, share_password_prompt)
- **Fix:** Added the missing keys to both en.json and de.json as aliases of existing similar keys
- **Files modified:** messages/en.json, messages/de.json
- **Verification:** `bun run build` succeeds without missing export warnings
- **Committed in:** `08f436c`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both fixes necessary for completeness and build correctness. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Paraglide infrastructure is in place on the `features` branch
- 400+ message keys already extracted for en/de
- Sonner toast ready for use across all components
- Plan 02 can proceed with any remaining message extraction or verification

---
*Phase: 01-i18n-infrastructure*
*Completed: 2026-02-17*
