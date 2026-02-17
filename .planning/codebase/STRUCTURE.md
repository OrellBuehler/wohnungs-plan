# Codebase Structure

**Analysis Date:** 2026-02-17

## Directory Layout

```
wohnungs-plan/
├── src/
│   ├── routes/                    # SvelteKit page routes and API endpoints
│   ├── lib/
│   │   ├── components/            # Reusable Svelte components (UI, features)
│   │   ├── stores/                # Svelte reactive state management
│   │   ├── server/                # Server-only business logic and ORM
│   │   ├── db/                    # IndexedDB client-side caching
│   │   ├── types/                 # TypeScript interfaces and types
│   │   ├── utils/                 # Shared utilities (currency, export, etc.)
│   │   ├── test-utils/            # Testing helpers and factories
│   │   └── index.ts               # Public lib exports
│   ├── app.d.ts                   # Global type definitions
│   ├── hooks.server.ts            # SvelteKit server hooks (middleware)
│   └── service-worker.ts          # PWA service worker
├── drizzle/                       # Database migrations (auto-generated)
├── static/                        # Public assets (favicon, manifest.json)
├── uploads/                       # User-uploaded files (floorplans, images)
├── docs/                          # Documentation and plans
├── .planning/                     # GSD planning documents
└── [config files]                 # svelte.config.js, tsconfig.json, etc.
```

## Directory Purposes

**`src/routes/`:**
- Purpose: SvelteKit filesystem-based routing - defines pages and API endpoints
- Contains: Page components (+page.svelte), page servers (+page.server.ts), API handlers (+server.ts)
- Key directories:
  - `+page.svelte`: Home page (projects list)
  - `projects/[id]/`: Project editor with dynamic route parameter
  - `projects/[id]/history/`: Project history page
  - `settings/`: User settings (general, MCP permissions)
  - `oauth/`: OAuth flow pages (consent, error)
  - `api/projects/`: REST API endpoints for projects
  - `api/projects/[id]/items/`: Item CRUD endpoints
  - `api/projects/[id]/branches/`: Branch management endpoints
  - `api/projects/[id]/comments/`: Comment endpoints
  - `api/projects/[id]/members/`: Project sharing endpoints
  - `api/projects/[id]/floorplan/`: Floorplan upload
  - `api/mcp/`: MCP server endpoint
  - `.well-known/`: OAuth metadata endpoints

**`src/lib/components/`:**
- Purpose: Reusable Svelte components organized by feature
- Contains: `.svelte` files
- Subdirectories by feature area:
  - `canvas/`: Floorplan rendering and interaction (FloorplanCanvas, CanvasControls, ScaleCalibration)
  - `items/`: Item list, form, gallery (ItemList, ItemForm, ItemCard, ItemBottomSheet)
  - `comments/`: Comment threads and placement (CommentPanel, CommentThread, PlacementOverlay)
  - `collaboration/`: Real-time presence (OnlineUsers, RemoteCursor)
  - `projects/`: Project management (ProjectCard, ProjectListDialog, McpToolsDialog)
  - `sharing/`: Project sharing UI (ShareDialog, MemberList, InviteForm, ShareLinkList)
  - `layout/`: App structure (AppSidebar, MobileNav, SidebarTrigger)
  - `auth/`: Auth-related components (ImportLocalProjectsModal)
  - `ui/`: shadcn-svelte UI components (Button, Dialog, Input, Card, Select, etc.)

**`src/lib/stores/`:**
- Purpose: Svelte 5 reactive state management with centralized logic
- Contains: `.svelte.ts` files exporting state and action functions
- Key stores:
  - `auth.svelte.ts`: User session, login, OIDC integration
  - `project.svelte.ts`: Project CRUD, item management, branch switching (2000+ lines)
  - `sync.svelte.ts`: Offline queue, sync status, pending changes
  - `comments.svelte.ts`: Comment threads, placement mode, replies
  - `collaboration.svelte.ts`: Real-time cursors, online users, presence
  - `sidebar.svelte.ts`: Sidebar UI state, project context
- Patterns: Use `$state` for reactive values, `$derived` for computed values, async functions for side effects

**`src/lib/server/`:**
- Purpose: Server-only modules (never bundled to client)
- Contains: `.ts` files for business logic and database operations
- Key modules:
  - `db.ts`: Drizzle ORM singleton, migration runner
  - `schema.ts`: PostgreSQL table definitions (users, projects, items, branches, comments, etc.)
  - `session.ts`: Session creation, validation, cookie management
  - `oauth.ts`: OAuth 2.0 token handling, PKCE verification, bcrypt hashing
  - `oidc.ts`: Infomaniak OIDC provider integration
  - `projects.ts`: Project CRUD, role-based access, member management
  - `items.ts`: Item CRUD, change tracking, history
  - `branches.ts`: Branch CRUD, fork logic, default branch logic
  - `comments.ts`: Comment creation, replies, query by branch
  - `floorplans.ts`: Floorplan storage, file management
  - `item-images.ts`: Image upload, thumbnail generation, gallery
  - `collaboration.ts`: WebSocket message dispatch
  - `ws-handler.ts`: WebSocket connection upgrade
  - `rate-limit.ts`: User request rate limiting
  - `spatial-queries.ts`: Room-level item queries
  - `floorplan-analyses.ts`: AI analysis storage
  - `url-download.ts`: Download images from URL
  - `image-utils.ts`: Image processing helpers
  - `env.ts`: Environment variable loading
  - `types.ts`: TypeScript types for database entities

**`src/lib/db/`:**
- Purpose: Client-side IndexedDB caching for offline support
- Contains: `index.ts` managing project and thumbnail storage
- Operations: getAllProjects, getProject, saveProject, deleteProject, saveThumbnail, getThumbnail
- Schema: 2 stores (projects, thumbnails) with indexes on updatedAt

**`src/lib/types/`:**
- Purpose: Shared TypeScript interfaces
- Contains: `index.ts` defining:
  - `Position`, `Floorplan`, `Item`, `ItemImage`, `Project`
  - `ProjectBranch`, `ProjectMeta`, `ItemChange`
  - Item types: `ItemShape`, `CutoutCorner`

**`src/lib/utils/`:**
- Purpose: Shared utility functions
- Contains: Helper modules for:
  - `currency.ts`: Currency conversion, exchange rates
  - `export.ts`: Project import/export JSON, file handling
  - `data.ts`: Data URL parsing
  - `branch-sync.ts`: URL-based branch selection logic
  - `exchange.ts`: Currency exchange rate fetching

**`src/lib/test-utils/`:**
- Purpose: Testing infrastructure and fixtures
- Contains:
  - `setup.ts`: Vitest configuration
  - `factories.ts`: Test data generators for projects, items, users
  - `mock-stores.ts`: Mock implementations of stores
  - `request-event.ts`: Mock SvelteKit RequestEvent for route testing

**`drizzle/`:**
- Purpose: Database migration history
- Contains: Auto-generated migration files (001_initial.sql, 002_add_table.sql, etc.)
- Process: Run `bun db:generate` to create, then `bun db:migrate` to apply
- Location: Migrations auto-run on dev server startup

**`uploads/`:**
- Purpose: User-uploaded files organized by type
- Contains:
  - `floorplans/`: Original floorplan images uploaded by users
  - `item-images/`: Item gallery images
  - `thumbnails/`: Generated thumbnail previews
- Note: Not committed to git, generated at runtime

**`static/`:**
- Purpose: Public assets served at root of app
- Contains:
  - `favicon.ico`
  - `manifest.json`: PWA manifest for app icon, theme colors
  - Other static assets

**`docs/`:**
- Purpose: Documentation and project planning
- Subdirectories:
  - `plans/`: Pre-implementation plans for features
  - `in-progress/`: Active work notes with continuation points
  - `finished/`: Completed work documentation

## Key File Locations

**Entry Points:**
- `src/routes/+page.svelte`: Home page (projects overview)
- `src/routes/projects/[id]/+page.svelte`: Project editor main component (1195 lines)
- `src/routes/api/projects/+server.ts`: Projects list/create API
- `src/routes/api/mcp/+server.ts`: MCP server endpoint
- `src/hooks.server.ts`: Server-side middleware

**Configuration:**
- `svelte.config.js`: SvelteKit adapter (bun), PWA setup
- `tsconfig.json`: TypeScript configuration
- `src/app.d.ts`: Global types (App.Locals)

**Core Logic:**
- `src/lib/server/schema.ts`: Database schema with all tables
- `src/lib/server/db.ts`: Database singleton and migrations
- `src/lib/stores/project.svelte.ts`: Main project state management
- `src/lib/stores/auth.svelte.ts`: Authentication state
- `src/lib/components/canvas/FloorplanCanvas.svelte`: Main canvas rendering (46KB)

**Testing:**
- `src/lib/**/*.test.ts`: Co-located unit tests
- `src/lib/test-utils/`: Test setup and factories
- Key tests: `session.test.ts`, `oauth.test.ts`, `http.test.ts`, `rate-limit.test.ts`, `spatial-queries.test.ts`

## Naming Conventions

**Files:**
- Page components: `+page.svelte`
- Server handlers: `+server.ts`
- Page servers: `+page.server.ts`
- Layouts: `+layout.svelte`
- Tests: `*.test.ts` or `*.spec.ts` (co-located with code)
- Stores: `*.svelte.ts` (indicates Svelte reactive)
- Utils: `*.ts` (lowercase, kebab-case)

**Directories:**
- Feature areas (plural): `components/items/`, `stores/` but singular in routes (`src/routes/projects/[id]/`)
- Database: `server/` for all server code
- Tests: alongside source, not separate directory

**TypeScript:**
- Interfaces: PascalCase (User, Project, Item)
- Types: PascalCase (Position, Floorplan)
- Functions: camelCase (createProject, getItem)
- Constants: UPPER_SNAKE_CASE (SESSION_DURATION_MS, REQUIRED_SCOPE)
- Variables: camelCase (userId, projectName)

**Routes:**
- Pages: `/` = home, `/projects/[id]` = project editor, `/settings/general` = settings
- API: `/api/projects` (list), `/api/projects/[id]` (detail), `/api/projects/[id]/items` (items CRUD)
- OAuth: `/authorize` (redirect), `/api/oauth/authorize` (OAuth server), `/token` (proxy)
- Special: `/.well-known/*` for OAuth metadata

## Where to Add New Code

**New Feature (e.g., "add furniture library"):**
- Primary code:
  - Store: `src/lib/stores/furniture.svelte.ts` (state + actions)
  - API: `src/routes/api/projects/[id]/furniture/+server.ts` (CRUD endpoints)
  - Components: `src/lib/components/furniture/FurnitureList.svelte`, `FurnitureItem.svelte`
  - Server: `src/lib/server/furniture.ts` (database operations)
- Database: Add table to `src/lib/server/schema.ts`, generate migration via `bun db:generate`
- Tests: Add `src/lib/server/furniture.test.ts` for database logic

**New Component:**
- Implementation: `src/lib/components/[feature]/ComponentName.svelte`
- Styling: Use Tailwind classes (already configured)
- UI primitives: Import from `$lib/components/ui/` (Button, Dialog, etc.)
- Props: Use runes syntax: `let { prop = default }: Props = $props();`

**New Utility:**
- Shared helpers: `src/lib/utils/new-feature.ts`
- Server-only helpers: `src/lib/server/new-feature.ts`
- Type definitions: `src/lib/types/index.ts` (or separate file if large)

**New API Endpoint:**
- Route file: `src/routes/api/[resource]/+server.ts`
- Export handler: `export const POST: RequestHandler = async ({ request, locals, params }) => {...}`
- Auth: Check `locals.user` and call `getProjectRole()` for authorization
- Error handling: Return JSON with status code and error message
- Permissions: Always verify project access before returning data

**New Page:**
- Route file: `src/routes/[path]/+page.svelte`
- Load data: Use `onMount()` or fetch in component
- Style: Use layout from `src/lib/components/layout/`
- Auth: Check `isAuthenticated()` from auth store if protected

**Database Schema Change:**
1. Edit `src/lib/server/schema.ts` (add/modify table)
2. Run `bun db:generate` (creates migration file in `drizzle/`)
3. Run `bun db:migrate` (applies migration, or auto-run on dev startup)
4. Add types to `src/lib/server/types.ts` if needed
5. Implement server module (e.g., `src/lib/server/new-table.ts`)
6. Create API routes if exposing to client

## Special Directories

**`src/lib/server/`:**
- Purpose: Server-only code (never bundled to client)
- Generated: Database migrations
- Committed: Yes

**`uploads/`:**
- Purpose: User-generated files at runtime
- Generated: Floorplans, item images, thumbnails
- Committed: No (listed in .gitignore)

**`.svelte-kit/`:**
- Purpose: SvelteKit build output (routes, types, manifest)
- Generated: Yes (by build)
- Committed: No

**`build/`:**
- Purpose: Production build output
- Generated: Yes (by `bun build`)
- Committed: No

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (by `bun install`)
- Committed: No

---

*Structure analysis: 2026-02-17*
