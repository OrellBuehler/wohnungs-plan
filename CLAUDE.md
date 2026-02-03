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

## Mobile Experience

- Mobile viewport detected at <768px width (Tailwind `md:` breakpoint)
- Components accept `readonly` prop to disable editing on mobile
- ItemBottomSheet displays tapped item details on mobile
- Canvas controls hidden on mobile
- ItemForm hides position fields when `hidePositionFields={true}`

## SvelteKit Navigation

- Avoid `history.pushState()` and `history.replaceState()` as they conflict with SvelteKit's router
- Use `pushState` and `replaceState` from `$app/navigation` instead

## Git Commits

- Always commit changes when work is complete
- Never add "Co-Authored-By" lines to commit messages
