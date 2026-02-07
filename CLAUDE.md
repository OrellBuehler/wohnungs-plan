# CLAUDE.md

## Commands

```bash
bun dev          # Start development server
bun build        # Build for production
bun check        # Type-check with svelte-check
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

## UI Components

- Always use shadcn-svelte components from `$lib/components/ui/`
- Available: Button, Card, Dialog, Sheet, Tabs, Select, Dropdown Menu, Input, Label, Checkbox, Slider, Separator, Tooltip
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

## Version Tracking

- Git hash and build timestamp embedded in HTML comment during Docker build
- View in browser: View Source → `<head>` → `<!-- version: abc1234 | built: 2026-02-03T10:30:00Z -->`
- View in container: `docker exec <container> cat /app/version.txt`
- Build with version: `docker build --build-arg GIT_HASH=$(git rev-parse --short HEAD) --build-arg BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ") .`
- Development mode shows "dev" for both values

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
