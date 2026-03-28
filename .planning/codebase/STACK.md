# Technology Stack

**Analysis Date:** 2026-02-17

## Languages

**Primary:**

- TypeScript 5.9.3 - Full application codebase (server and client)
- Svelte 5.49.1 - UI components with Svelte runes ($state, $derived, $props)

**Secondary:**

- JavaScript - Configuration files
- SQL - Database migrations and queries

## Runtime

**Environment:**

- Bun 1.x - JavaScript runtime and package manager
- Node.js APIs - Used throughout for filesystem, crypto, and standard library functions

**Package Manager:**

- Bun - Primary package manager (bun install, bun run, bun add)
- Lockfile: `bun.lock` (present)

## Frameworks

**Core:**

- SvelteKit 2.50.1 - Full-stack web framework with SSR and adapter for Bun
- svelte-adapter-bun 1.0.1 - Runtime adapter for production deployment on Bun

**Frontend:**

- bits-ui 2.15.5 - Headless component library (foundation for shadcn-svelte)
- Tailwind CSS 4.1.18 - Utility-first CSS framework
- @tailwindcss/vite 4.1.18 - Vite integration for Tailwind
- lucide-svelte 0.563.0 - Icon library

**Canvas & Visualization:**

- Konva 10.2.0 - 2D canvas framework for drawing and interaction
- svelte-konva 1.0.1 - Svelte wrapper for Konva

**Data:**

- Drizzle ORM 0.45.1 - SQL ORM with type safety
- drizzle-kit 0.31.8 - Migration generator and database tools

**Tables & Data Display:**

- @tanstack/table-core 8.21.3 - Headless table library

**Testing:**

- Vitest 4.0.18 - Unit and component test runner
- @vitest/coverage-v8 4.0.18 - Code coverage provider (V8)

**Build & Dev:**

- Vite 7.3.1 - Build tool and dev server
- @sveltejs/vite-plugin-svelte 6.2.4 - SvelteKit Vite plugin
- svelte-check 4.3.6 - Type checking for Svelte components
- jsdom 28.0.0 - DOM implementation for tests

**PWA & Service Workers:**

- @vite-pwa/sveltekit 1.1.0 - PWA support with Workbox integration
- workbox-routing 7.4.0 - Request routing in service workers
- workbox-strategies 7.4.0 - Caching strategies (cache-first, network-first)
- workbox-precaching 7.4.0 - Asset precaching
- workbox-expiration 7.4.0 - Cache expiration management

**Image Processing:**

- sharp 0.34.5 - High-performance image manipulation (thumbnails, resizing)

**Utilities:**

- bcrypt 6.0.0 - Password hashing for OAuth client secrets
- Zod 4.3.6 - Schema validation (MCP tool input schemas)
- clsx 2.1.1 - Conditional CSS class joining
- tailwind-merge 3.4.0 - Merges conflicting Tailwind classes
- tailwind-variants 3.2.2 - Variant management for Tailwind
- idb 8.0.3 - IndexedDB wrapper for client-side storage
- @internationalized/date 3.10.1 - Locale-aware date handling

**Cryptography:**

- crypto (Node.js built-in) - Random token generation, hashing

## Key Dependencies

**Critical:**

- @modelcontextprotocol/sdk 1.25.3 - Model Context Protocol server implementation for AI agent integration
- @anthropic-ai/sdk 0.74.0 - Anthropic API client (currently unused in MCP server, but available for future Claude integrations)

**Infrastructure:**

- drizzle-orm - Database abstraction and query building
- sharp - Image thumbnail generation for project previews

## Configuration

**Environment:**

- Environment variables loaded via `$env/dynamic/private` (SvelteKit)
- Key configs: `INFOMANIAK_CLIENT_ID`, `INFOMANIAK_CLIENT_SECRET`, `DATABASE_URL`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`
- See `.env.example` for complete list
- `.env` file present but never read by code analysis (security)

**Build:**

- `vite.config.ts` - Vite build configuration with SvelteKit, Tailwind, and Vitest
- `svelte.config.js` - SvelteKit configuration with Bun adapter and PWA plugin
- `drizzle.config.ts` - Drizzle ORM migrations configuration (PostgreSQL)
- `tsconfig.json` - TypeScript strict mode enabled, moduleResolution bundler
- `package.json` - Build scripts: `bun dev`, `bun build`, `bun check`, `bun test`

**Database:**

- PostgreSQL connection via Bun SQL driver (native)
- Migrations auto-run on dev server startup via `runMigrations()` in `src/hooks.server.ts`
- Migrations stored in `drizzle/` directory

## Platform Requirements

**Development:**

- Bun 1.x runtime
- PostgreSQL database (local or remote via `DATABASE_URL`)
- Node.js for development tools (though Bun runs most operations)
- Modern browser with IndexedDB support

**Production:**

- Deployment target: Docker containers (Alpine-based)
- Build uses multi-stage Dockerfile with native module compilation (sharp, bcrypt)
- Runtime: Bun in Alpine container
- Database: PostgreSQL
- Environment variables required at runtime (OAuth credentials, database, session secret, API keys)
- Port: 3000 (configurable via `PORT` env var)
- Max upload size: 10M (configurable via `BODY_SIZE_LIMIT`)

---

_Stack analysis: 2026-02-17_
