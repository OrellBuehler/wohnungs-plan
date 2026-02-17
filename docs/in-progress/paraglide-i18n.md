# Paraglide i18n — In Progress

## Status

Phase 1 (Infrastructure Setup) is complete. Phase 3 (String Extraction) not yet started.

### Completed

- [x] 1.1 Install `@inlang/paraglide-js` (v2.11.0)
- [x] 1.2 Create `project.inlang/settings.json` (en + de, plugin-message-format)
- [x] 1.3 Add `paraglideVitePlugin` to `vite.config.ts` (cookie strategy)
- [x] 1.4 Update `src/app.html` — `lang="%lang%"`
- [x] 1.5 Add paraglide middleware to `src/hooks.server.ts` via `sequence()`
- [x] 1.6 Create `messages/en.json` and `messages/de.json` (with test keys `common_save`, `common_cancel`)
- [x] 1.7 Add `src/lib/paraglide/` to `.gitignore`
- [x] 1.8 Verify: `bun dev` starts, paraglide compiles (`✔ Compilation complete`)

### Not Yet Started

- [ ] Phase 3 Groups A–N: String extraction (see `docs/plans/paraglide-i18n.md`)
- [ ] Language switcher component
- [ ] Full German translations

## Known Issue

`bun check` shows 2 errors: paraglide generates `messages/_index.js` which svelte-check reports as "not a module". This may resolve once real message imports are used in components, or may need a `paraglide-js compile` step before `bun check`. Needs investigation.

## WHERE TO CONTINUE

1. **Investigate the `bun check` error** — run `bunx paraglide-js compile` then `bun check` to see if pre-compiling fixes it. If not, check if the issue only manifests when no messages are imported yet.
2. **Start Phase 3 Group A** — extract strings from layout/navigation components (`+layout.svelte`, `AppSidebar.svelte`, `MobileNav.svelte`).
3. Follow the plan at `docs/plans/paraglide-i18n.md` for the full extraction order.

## Branch

`feature/paraglide-i18n` — worktree at `.worktrees/paraglide-i18n`
