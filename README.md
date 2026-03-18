# Wohnungs-Plan

A collaborative apartment and room planning app. Upload floorplans, place furniture with precise dimensions, and share projects with others in real time.

## Tech Stack

- **Frontend**: SvelteKit + Svelte 5 (runes), Tailwind CSS 4, Konva.js (canvas)
- **Backend**: SvelteKit with `svelte-adapter-bun`, WebSockets for real-time collaboration
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Infomaniak OIDC
- **i18n**: Paraglide JS (English + German)
- **PWA**: Installable, offline-capable via Workbox service worker
- **AI Integration**: MCP server with OAuth 2.0 (PKCE), enabling AI agents to manage furniture

## Features

- **Floorplan canvas** -- upload a floorplan image, calibrate its scale, and place furniture items with drag-and-drop positioning
- **Furniture management** -- add items with dimensions, colors, shapes (rectangle, L-shaped), prices, product URLs, and photo galleries
- **Branches** -- create layout variants to compare different arrangements
- **Real-time collaboration** -- live cursors, item locking, and WebSocket sync between users
- **Sharing** -- invite members (editor/viewer roles), public share links with optional password protection
- **Comments** -- pin comments on the canvas or attach them to items, with threaded replies
- **Change history** -- track all item additions, updates, and deletions per branch
- **AI floorplan analysis** -- AI agents analyze uploaded floorplans to extract rooms, walls, and doors via MCP tools
- **Export/import** -- download and import projects as JSON files
- **Offline support** -- local projects stored in IndexedDB, synced to cloud when authenticated

## Prerequisites

- [Bun](https://bun.sh) runtime
- PostgreSQL database
- Infomaniak OIDC credentials (for authentication)

## Setup

```bash
# Install dependencies
bun install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your database URL, OIDC credentials, and session secret

# Generate and run database migrations
bun db:generate
bun db:migrate

# Start development server
bun dev
```

## Development Commands

```bash
bun dev          # Start dev server (port 5173)
bun build        # Production build
bun check        # Type-check with svelte-check
bun test         # Run tests (Vitest)
bun test:watch   # Run tests in watch mode
```

### Database

```bash
bun db:generate  # Generate migrations from schema changes
bun db:migrate   # Run pending migrations
bun db:studio    # Open Drizzle Studio
```

Migrations run automatically on dev server startup. Never use `drizzle-kit push`.

## Project Structure

```
src/
  routes/              # SvelteKit routes and API endpoints
    api/               # REST API (auth, projects, items, images, OAuth, MCP)
    projects/[id]/     # Project editor page with canvas
    settings/          # User settings and MCP client management
    share/[token]/     # Public share view
  lib/
    components/
      canvas/          # Floorplan canvas, controls, scale calibration
      items/           # Furniture item forms, lists, image viewer
      collaboration/   # Online users, remote cursors
      comments/        # Comment threads, canvas pins
      sharing/         # Invite forms, member lists, share links
      ui/              # shadcn-svelte components
    stores/            # Svelte 5 rune stores (project, auth, sync, comments)
    server/            # Database schema, sessions, OAuth, WebSocket handlers
    paraglide/         # Generated i18n runtime (do not edit)
```

## Deployment

The app ships as a Docker container using `svelte-adapter-bun`:

```bash
docker build -t wohnungs-plan .
```

Required environment variables: `DATABASE_URL`, `SESSION_SECRET`, `INFOMANIAK_CLIENT_ID`, `INFOMANIAK_CLIENT_SECRET`, `PUBLIC_APP_URL`. See `.env.example` for the full list.

The container runs on port 3000 with a health check at `/api/auth/me`.
