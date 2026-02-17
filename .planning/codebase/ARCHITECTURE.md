# Architecture

**Analysis Date:** 2026-02-17

## Pattern Overview

**Overall:** Full-stack SvelteKit application with dual storage (PostgreSQL + IndexedDB), real-time collaboration via WebSockets, and OAuth 2.0 with MCP (Model Context Protocol) support.

**Key Characteristics:**
- Progressive Web App (PWA) with offline support via IndexedDB
- Hybrid authentication: cookie-based sessions + bearer tokens for MCP/OAuth
- Real-time collaboration with WebSocket support
- Headless canvas rendering for floorplan visualization
- Modular component-based UI with shared business logic in Svelte stores
- Server-side persistence with Drizzle ORM + PostgreSQL

## Layers

**Presentation (Client-side Components):**
- Purpose: Render UI and handle user interactions
- Location: `src/lib/components/`, `src/routes/`
- Contains: Svelte components organized by feature (canvas, items, sharing, collaboration, comments)
- Depends on: Stores, utils, UI library (shadcn-svelte)
- Used by: Routes and page layouts

**State Management (Svelte Stores):**
- Purpose: Manage reactive state and sync data between client and server
- Location: `src/lib/stores/`
- Contains: `.svelte.ts` files using Svelte 5 runes (`$state`, `$derived`)
  - `auth.svelte.ts`: Authentication state (login, session, user)
  - `project.svelte.ts`: Project/item/branch state with dual storage sync
  - `sync.svelte.ts`: Offline queue and sync status
  - `comments.svelte.ts`: Comment placement and state
  - `collaboration.svelte.ts`: Real-time cursor/user presence
  - `sidebar.svelte.ts`: UI sidebar context
- Depends on: IndexedDB (`$lib/db`), server APIs, auth layer
- Used by: Components and routes

**Local Storage (IndexedDB):**
- Purpose: Cache projects and thumbnails for offline access
- Location: `src/lib/db/index.ts`
- Contains: Projects, thumbnails stored in IndexedDB with versioning
- Depends on: `idb` npm package
- Used by: Project store for syncing local/cloud projects

**Business Logic (Server):**
- Purpose: Core domain logic, auth, data persistence, MCP server
- Location: `src/lib/server/`
- Contains: Service modules handling specific domains:
  - `db.ts`: Database singleton and migrations
  - `schema.ts`: Drizzle ORM table definitions
  - `session.ts`: Session creation, validation, cookie management
  - `oauth.ts`: OAuth token validation, PKCE verification, token generation
  - `oidc.ts`: OIDC flow with Infomaniak provider
  - `projects.ts`: Project CRUD with role-based access
  - `items.ts`: Item CRUD with change tracking
  - `branches.ts`: Git-like branch management
  - `comments.ts`: Comment threads and replies
  - `floorplans.ts`: Floorplan upload and metadata
  - `item-images.ts`: Item image gallery with thumbnail generation
  - `collaboration.ts`: WebSocket message handling
  - `ws-handler.ts`: WebSocket upgrade and routing
  - `rate-limit.ts`: Request rate limiting
  - `spatial-queries.ts`: Room-level queries (items in room, placement suggestions)
  - `floorplan-analyses.ts`: AI-based floorplan analysis storage
- Depends on: Drizzle ORM, PostgreSQL, external APIs (Infomaniak OAuth, image processing)
- Used by: API routes and MCP server

**API Routes:**
- Purpose: HTTP endpoints for client-server communication
- Location: `src/routes/api/` (SvelteKit `+server.ts` files)
- Contains: RESTful endpoints:
  - `/api/projects`: List, create, duplicate, delete projects
  - `/api/projects/[id]/items`: CRUD items in project
  - `/api/projects/[id]/branches`: Branch management
  - `/api/projects/[id]/floorplan`: Upload and manage floorplans
  - `/api/projects/[id]/comments`: Comment threads
  - `/api/projects/[id]/members`: Project members and sharing
  - `/api/projects/[id]/share-links`: Anonymous share links
  - `/api/mcp`: MCP server endpoint (WebSocket/HTTP transport)
  - `/api/thumbnails`: Thumbnail generation
- Depends on: Server business logic, authentication, SvelteKit request handlers
- Used by: Client-side code via `authFetch` (which adds auth headers and handles CORS)

**Authentication & OAuth:**
- Purpose: User identity and access control
- Location: `src/lib/server/oauth.ts`, `src/lib/server/oidc.ts`, `src/lib/server/session.ts`, `src/routes/authorize/`, `src/routes/token/`
- Contains:
  - OAuth 2.0 server: Authorization code + PKCE flow, token validation
  - OIDC: Infomaniak provider integration
  - Session: Cookie-based sessions with refresh tokens
  - MCP bearer token validation
- Entry points: `/api/oauth/authorize`, `/api/oauth/token`, `/authorize` (redirect), `/token` (proxy)
- Depends on: `bcrypt` for token hashing, Drizzle ORM for persistence
- Used by: All protected routes and MCP server

**MCP Server:**
- Purpose: Provide Claude/AI-powered tools for project manipulation via JSON-RPC
- Location: `src/routes/api/mcp/+server.ts`
- Contains: 20+ tools for reading/modifying projects, items, floorplans, suggestions via OAuth bearer tokens
- Depends on: All server business logic modules, `@modelcontextprotocol/sdk`
- Used by: External MCP clients (Claude Desktop, etc.)

**Service Worker & Caching:**
- Purpose: PWA offline support and smart caching
- Location: `src/service-worker.ts`
- Strategy:
  - Precache: App shell (HTML, CSS, JS, fonts, icons)
  - Network-first: `/api/*` routes (prefer fresh, fallback to cache)
  - Cache-first: Images (cache, update in background, 30-day expiry)
- Used by: All HTTP requests from client

## Data Flow

**Creating an Item (Authenticated):**

1. User fills ItemForm (component: `src/lib/components/items/ItemForm.svelte`)
2. Form submission triggers `addItem()` from project store
3. Store action (`src/lib/stores/project.svelte.ts`):
   - Updates local state immediately (optimistic update)
   - If authenticated: calls POST `/api/projects/[id]/items`
   - If offline: queues change in sync store
4. API endpoint (`src/routes/api/projects/[id]/items/+server.ts`):
   - Validates auth via `event.locals.user`
   - Checks project access via `getProjectRole()`
   - Inserts item via `createItem()` server function
   - Inserts itemChange record for history
   - Touches project updatedAt
   - Returns new item with id
5. Store updates local state with returned item
6. Components re-render via Svelte reactivity
7. If offline: Sync store queues change, processes when online

**Viewing a Project (with branches):**

1. Route loads: `src/routes/projects/[id]/+page.svelte`
2. Component calls `loadProjectById()` from store
3. If authenticated:
   - Fetches from `/api/projects/[id]` (returns full project with items, branches, floorplan)
   - Fetches from `/api/projects/[id]/branches` for branch list
4. If local:
   - Loads from IndexedDB via `getProject()`
5. Store sets active branch (from URL or default)
6. Canvas component (`FloorplanCanvas.svelte`) renders floorplan + items
7. Sidebar displays branch list and item list
8. Comments load for active branch via `loadComments()` store

**Real-time Collaboration:**

1. User opens project in browser
2. Route establishes WebSocket via `ws-handler.ts`
3. On item change (any user), WebSocket message arrives
4. Handler calls `collaboration.ts` to process message
5. Updates local store state
6. All connected clients see update in real-time
7. Change logged to itemChanges table for history
8. Comment placement syncs via WebSocket + store state

**State Management (Sync):**

- Offline changes queued in `sync.svelte.ts` memory queue
- When online, `processPendingChanges()` re-attempts failed requests
- Projects synced to IndexedDB immediately (local fallback)
- Cloud projects merged with local via `loadProjectById()` fetch

## Key Abstractions

**Project (Data Model):**
- Purpose: Represents a floorplan with items, branches, metadata
- Examples: `src/lib/types/index.ts` (Project, ProjectBranch interfaces)
- Pattern: Synced between IndexedDB (local), PostgreSQL (cloud), and in-memory store
- Structure: Contains floorplan (image data, scale), items array, branches, active branch id, currency, grid size

**Item (Data Model):**
- Purpose: Individual furniture/object in floorplan with position, dimensions, price, images
- Examples: `src/lib/types/index.ts` (Item interface), `src/lib/server/items.ts` (DB operations)
- Pattern: Stored per-branch, change tracking via itemChanges table
- Structure: Id, name, dimensions (width/height), position (x/y), rotation, color, price, currency, product URL, shape (rectangle/l-shape), images gallery

**Branch (Git-like Concept):**
- Purpose: Allows multiple layout variants of same project (main, alternative1, etc.)
- Examples: `src/lib/server/branches.ts`, `src/lib/stores/project.svelte.ts`
- Pattern: Each branch can fork from another, contains its own items, change history tracked per branch
- Structure: Id, projectId, name, forkedFromId, createdBy, createdAt

**Store (Svelte Reactive State):**
- Purpose: Centralized state management with derived values and async actions
- Examples: `src/lib/stores/project.svelte.ts`, `src/lib/stores/auth.svelte.ts`
- Pattern: Svelte 5 runes ($state, $derived), functions export getters/setters, async actions handle API calls
- Structure: State variable + action functions that mutate state + derived values via $derived

**MCP Tool:**
- Purpose: Single action in MCP protocol (read/write floorplan, items, etc.)
- Pattern: Defined as JSON-RPC method in MCP server, validated with Zod schemas
- Security: Requires OAuth token, project access check, rate limiting
- Examples: `create_item`, `update_item`, `suggest_item_placement`, `analyze_floorplan`

## Entry Points

**Web Application:**
- Location: `src/routes/+page.svelte` (projects list), `src/routes/projects/[id]/+page.svelte` (project editor)
- Triggers: User navigates to `/` or `/projects/[id]`
- Responsibilities: Render page, load project state, display canvas and UI components

**API Endpoints:**
- Location: `src/routes/api/` subdirectories
- Triggers: Client-side fetch calls from stores/components
- Responsibilities: Auth validation, business logic, database operations, response formatting

**OAuth Flow:**
- Location: `src/routes/authorize/+server.ts` (redirect), `/api/oauth/authorize` (OAuth server), `/api/oauth/token` (token endpoint)
- Triggers: User clicks login
- Responsibilities: OIDC dance with Infomaniak, session creation, redirect with session cookie

**MCP Server:**
- Location: `src/routes/api/mcp/+server.ts`
- Triggers: External MCP client connects with Bearer token
- Responsibilities: JSON-RPC message handling, tool execution, permission checks, response formatting

**Hooks (Middleware):**
- Location: `src/hooks.server.ts`
- Triggers: Every server request
- Responsibilities: Run migrations on startup, parse session cookie, attach user to event.locals, CSRF validation, CORS headers

## Error Handling

**Strategy:** Layered error handling with specific error types and user feedback.

**Patterns:**

- **API Routes:** Try-catch with status codes (400 bad request, 401 unauthorized, 403 forbidden, 500 server error)
  - Example: `src/routes/api/projects/[id]/items/+server.ts` validates auth, checks project access, returns 403 if denied

- **Store Actions:** Wrap async operations with error state, expose to components
  - Example: `src/lib/stores/project.svelte.ts` sets `error` state on fetch failure

- **Database:** Drizzle ORM throws errors on constraint violations, caught in route handlers
  - Example: Duplicate branch name throws, caught and returned as 400 with message

- **MCP Server:** Custom error responses with WWW-Authenticate header on auth failure
  - Example: Invalid token returns 401 with resource metadata URL

- **Client Components:** Error boundaries and local error states
  - Example: ItemForm catches submission errors, displays toast

- **Validation:** Zod schemas in MCP tools and API routes
  - Example: `parseItemCreateBody()` validates shape, dimensions, etc.

## Cross-Cutting Concerns

**Logging:** Console logging in development, error logs in production. Key points:
- Database migration status (success/failure)
- OAuth token validation failures (debug level)
- MCP request/response errors
- Sync errors in offline queue processing

**Validation:** Applied at multiple layers:
- Client: HTML5 form validation + custom checks
- API: Zod schemas for request bodies
- Server: Business logic validates item dimensions, price values, etc.
- MCP: Detailed Zod schemas for all tool parameters

**Authentication:** Multi-layered:
- Session cookies for web app (httpOnly, SameSite)
- Bearer tokens for MCP (OAuth access tokens)
- Infomaniak OIDC for user identity
- Rate limiting per user (not implemented yet but in rate-limit.ts)

**Authorization:** Role-based (owner, editor, viewer):
- Project owner: full control
- Editor: add/edit/delete items and comments
- Viewer: read-only
- Checked via `getProjectRole()` in every operation

**Image Processing:** Async thumbnail generation:
- On item image upload: `generateThumbnail()` creates small preview
- Cache in `/uploads/thumbnails/`
- Served as separate URL path

**Real-time Updates:** WebSocket + state sync:
- User changes broadcasted to all connected clients
- Message format: `{ type: 'item_updated', data: {...} }`
- Store listens to messages and updates state
- FallbackPolling if WebSocket unavailable

---

*Architecture analysis: 2026-02-17*
