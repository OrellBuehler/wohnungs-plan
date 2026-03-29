# CLAUDE.md

## Commands

```bash
bun dev          # Start development server
bun build        # Build for production
bun check        # Type-check with svelte-check
bun test         # Run tests (vitest)
bun test:watch   # Run tests in watch mode
```

### Database (Drizzle)

```bash
bun db:generate  # Generate migrations
bun db:migrate   # Run migrations
bun db:studio    # Open Drizzle Studio
```

- **Never use `drizzle-kit push`** — migrations run automatically on dev server startup. Using push applies schema changes without recording them in the migrations table, causing migration failures on next startup.

## Package Manager

- Use `bun` instead of npm/pnpm/yarn for all package operations
- Use `bunx` instead of npx for executing packages
- **Never use `npm`, `npx`, `pnpm`, or `yarn`** — always `bun` / `bunx`

## i18n (Paraglide JS)

- Locales: `en` (base), `de` — message files in `messages/{locale}.json`
- Config: `project.inlang/settings.json`; generated runtime in `src/lib/paraglide/` (do not edit)
- Import messages: `import * as m from '$lib/paraglide/messages'`, then `m.key_name()`
- Import locale: `import { getLocale } from '$lib/paraglide/runtime'`
- Locale-aware formatting: use `formatDecimal`, `formatDimension`, `formatRelativeTime` from `$lib/utils/format.ts` and `formatPrice` from `$lib/utils/currency.ts` — never use `.toFixed()` or `toLocaleDateString()` without passing `getLocale()`
- Locale detection: cookie → browser preference → `en`

## UI Components

- Always use shadcn-svelte components from `$lib/components/ui/`
- Available: Badge, Button, Card, Checkbox, Context Menu, Data Table, Dialog, Dropdown Menu, Input, Label, Select, Separator, Sheet, Slider, Sonner (toast), Switch, Table, Tabs, Tooltip
- Add new components via: `bunx shadcn-svelte@latest add <component>`

## Mobile Experience

- Mobile viewport detected at <768px width (Tailwind `md:` breakpoint)
- Components accept `readonly` prop to disable editing on mobile
- ItemBottomSheet displays tapped item details on mobile
- Canvas controls hidden on mobile
- ItemForm hides position fields when `hidePositionFields={true}`

## PWA (Progressive Web App)

- App installable via "Add to Home Screen" on iOS/Android
- Works offline for local projects (service worker caching)
- Browser zoom disabled - use pinch-to-zoom on canvas instead
- Fixed header (top) and bottom tabs (mobile) with safe area insets
- Layout uses `100dvh` to handle mobile browser chrome

### Service Worker

- Built with @vite-pwa/sveltekit and Workbox
- Cache-first for app shell (HTML, CSS, JS, fonts, icons)
- Network-first for API routes
- Cache-first for images with 30-day expiration

## Testing

- Framework: Vitest with jsdom environment
- Test files: `src/**/*.test.ts` and `src/**/*.svelte.test.ts`
- Helpers: `src/lib/test-utils/` (factories, mock stores, request event builders)

## Architecture Patterns

- **Stores**: Svelte 5 rune stores in `src/lib/stores/*.svelte.ts` (e.g., `project.svelte.ts`, `collaboration.svelte.ts`)
- **Server**: `src/lib/server/` — DB schema, sessions, OAuth, rate limiting, WebSocket handlers
- **Adapter**: `svelte-adapter-bun` (not Node)

## Version Tracking

- Git hash + build timestamp embedded via `GIT_HASH` and `BUILD_TIMESTAMP` Docker build args
- Check in container: `docker exec <container> cat /app/version.txt`
- Dev mode shows "dev" for both values

## SvelteKit Navigation

- Avoid `history.pushState()` and `history.replaceState()` as they conflict with SvelteKit's router
- Use `pushState` and `replaceState` from `$app/navigation` instead

## OAuth/MCP Integration

- OAuth endpoints: `/api/oauth/authorize`, `/api/oauth/token`
- MCP endpoint: `/api/mcp` (JSON-RPC 2.0 with Bearer token)
- PKCE: S256 only, no plain method
- **CSRF Protection**: SvelteKit's built-in check disabled (`csrf.trustedOrigins: ['*']`)
  - Manual origin checking in `hooks.server.ts` protects non-exempt routes
  - OAuth/MCP endpoints are exempt (use PKCE/Bearer tokens, not cookies)

## Git Commits

- Always commit changes when work is complete
- Never add "Co-Authored-By" lines to commit messages

## Design Context

See `.impeccable.md` for full design spec. Key principles:

- **"The Digital Drafting Table"** — clean, functional, precision without complexity
- **No 1px borders for sectioning** — use background color shifts (tonal layering)
- **Typography:** Manrope (display), Inter (body), Space Grotesk (dimensions/numbers)
- **Surface hierarchy:** #f7f9fb (base) → #f2f4f6 (panels) → #e0e3e5 (cards) → #ffffff (popovers)
- **Floating elements:** glassmorphism (80% opacity + 12px backdrop-blur)
- **Spacing:** strict 4px/8px grid. Layout margins: 2rem. No dividers — use spacing
- **Icons:** line-art style, 1.5px stroke weight
- **No pure black text** — use #191c1e (`on_surface`)
- **Inputs:** bottom-line or filled style, never 4-sided box
- **Buttons:** rounded-lg (8px), no drop shadows, color contrast for pressability
