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
bun db:push      # Push schema changes
bun db:studio    # Open Drizzle Studio
```

## Package Manager

- Use `bun` instead of npm/pnpm/yarn for all package operations

## UI Components

- Always use shadcn-svelte components from `$lib/components/ui/`
- Available: Button, Card, Dialog, Sheet, Tabs, Select, Dropdown Menu, Input, Label, Checkbox, Slider, Separator, Tooltip
- Add new components via: `bunx shadcn-svelte@latest add <component>`

## SvelteKit Navigation

- Avoid `history.pushState()` and `history.replaceState()` as they conflict with SvelteKit's router
- Use `pushState` and `replaceState` from `$app/navigation` instead

## Git Commits

- Always commit changes when work is complete
- Never add "Co-Authored-By" lines to commit messages
