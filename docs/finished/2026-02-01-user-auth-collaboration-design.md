# User Authentication & Collaboration Design

## Overview

Add user authentication via Infomaniak OpenID Connect, server-side data persistence with PostgreSQL, and real-time collaboration features to the Floorplanner app.

## Goals

1. **Sync across devices** - Users can access projects from any browser/device
2. **Collaboration** - Share projects with others, real-time multi-user editing
3. **Future: Premium features** - Gate certain features behind authentication
4. **Preserve offline-first** - App works fully without login using IndexedDB

## Technology Stack

- **Auth**: Infomaniak OpenID Connect
- **Backend**: SvelteKit API routes running on Bun
- **Database**: PostgreSQL via Bun's native SQL driver
- **Real-time**: WebSockets for collaboration
- **Storage**: Dual - IndexedDB (local) + PostgreSQL (server)

## Authentication Flow

### Infomaniak OIDC Endpoints

- Authorization: `https://login.infomaniak.com/authorize`
- Token: `https://login.infomaniak.com/token`
- Userinfo: `https://login.infomaniak.com/oauth2/userinfo`

### Login Flow

1. User clicks "Sign in" → redirect to Infomaniak login page
2. User authenticates → redirected back with auth code
3. SvelteKit backend exchanges code for tokens (server-side, keeps client_secret safe)
4. Backend fetches user info (email, name, sub/user ID)
5. Creates or updates user in PostgreSQL
6. Sets secure HTTP-only session cookie
7. Frontend receives user profile, updates UI

### Session Management

- HTTP-only cookie with session ID
- Session stored in PostgreSQL (user_id, expires_at, created_at)
- Auto-refresh before expiry using refresh token
- Logout clears cookie + invalidates session server-side

### First Login Migration

- After successful login, check IndexedDB for existing projects
- If found, show modal: "Import local projects to your account?"
- User selects which projects to import
- Selected projects uploaded to PostgreSQL, linked to user ID

## Database Schema

```sql
-- Users (from Infomaniak OIDC)
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    infomaniak_sub  TEXT UNIQUE NOT NULL,
    email           TEXT,
    name            TEXT,
    avatar_url      TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Sessions
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token   TEXT,
    expires_at      TIMESTAMP NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Floorplans
CREATE TABLE floorplans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,
    original_name   TEXT,
    mime_type       TEXT NOT NULL,
    size_bytes      INTEGER NOT NULL,
    pixels_per_cm   FLOAT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Items (furniture)
CREATE TABLE items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    width           FLOAT NOT NULL,
    length          FLOAT NOT NULL,
    x               FLOAT DEFAULT 0,
    y               FLOAT DEFAULT 0,
    rotation        FLOAT DEFAULT 0,
    color           TEXT,
    price           FLOAT,
    currency        TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Project members (sharing)
CREATE TABLE project_members (
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    invited_at      TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

-- Project invites
CREATE TABLE project_invites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
    token           TEXT UNIQUE NOT NULL,
    expires_at      TIMESTAMP NOT NULL,
    accepted_at     TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_floorplans_project_id ON floorplans(project_id);
CREATE INDEX idx_items_project_id ON items(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
CREATE INDEX idx_project_invites_token ON project_invites(token);
CREATE INDEX idx_project_invites_email ON project_invites(email);
```

## Image Storage

- Stored on filesystem: `./uploads/floorplans/{project_id}/{uuid}.{ext}`
- **5MB limit** enforced on upload (reject larger files with 413 error)
- Served via SvelteKit endpoint: `GET /api/images/floorplans/[project_id]/[filename]`
- Browser caching headers:
  ```
  Cache-Control: public, max-age=31536000, immutable
  ETag: {file-hash}
  ```
- Images are immutable (new upload = new UUID), so aggressive caching is safe

## Data Synchronization

### Storage Modes

| State | Primary Storage | Behavior |
|-------|-----------------|----------|
| Not logged in | IndexedDB | Current behavior, no network |
| Logged in + online | PostgreSQL | Server-first, IndexedDB as cache |
| Logged in + offline | IndexedDB | Queue writes, sync when online |

### Sync Flow

```
User Action → Online?
  ├─ Yes → POST to server → Update IndexedDB cache
  └─ No  → Write to IndexedDB with pending flag
           → On reconnect: POST queued changes → Update cache
```

### Offline Detection

- `navigator.onLine` + periodic heartbeat to `/api/health`
- Visual indicator when offline: "Working offline - changes will sync"

### Conflict Resolution

- Server timestamp wins for same-field edits
- Queued offline changes include local timestamp for ordering

## Real-Time Collaboration

### WebSocket Connection

When user opens a project:
1. Connect to `wss://host/ws/projects/[project_id]`
2. Server validates session cookie + project access
3. Connection added to project's "room"

### Message Types (Server → Client)

```typescript
{ type: "user_joined", user: { id, name, avatar, color } }
{ type: "user_left", userId: string }
{ type: "cursor_move", userId: string, x: number, y: number }
{ type: "item_locked", itemId: string, userId: string }
{ type: "item_unlocked", itemId: string }
{ type: "item_updated", item: Item }
{ type: "item_created", item: Item }
{ type: "item_deleted", itemId: string }
{ type: "floorplan_updated", floorplan: Floorplan }
```

### Message Types (Client → Server)

```typescript
{ type: "cursor_move", x: number, y: number }
{ type: "lock_item", itemId: string }
{ type: "unlock_item", itemId: string }
{ type: "update_item", item: Item }
{ type: "create_item", item: Item }
{ type: "delete_item", itemId: string }
```

### Item Locking

- Client sends `lock_item` when user starts dragging
- Server broadcasts lock to all other clients
- Locked items show overlay with editing user's name
- Lock auto-expires after 30s (handles disconnects)
- Client sends `unlock_item` on drag end

### Cursor Throttling

- Cursor positions sent max 20 times/second (50ms throttle)

## Presence & Collaboration UI

### Online Users Display

- Top-right corner: avatar stack of users in project
- Max 4 visible, "+N" for overflow
- Tooltip shows full name
- Click opens panel with all users + roles

### Remote Cursors

- Arrow/pointer in user's assigned color
- Name label (fades after 2s of no movement)
- Smooth interpolation between updates
- Fade out after 5s inactivity

### Selection Highlights

- Remote user selects item: colored border + avatar badge
- Remote user dragging (locked): thick border + "Being edited by [Name]" tooltip + disabled

### Color Assignment

- 8-10 distinct colors in palette
- Assigned on join, recycled when user leaves
- Consistent per session

## Permissions & Sharing

### Role Capabilities

| Action | Owner | Editor | Viewer |
|--------|-------|--------|--------|
| View project | Yes | Yes | Yes |
| Move/edit items | Yes | Yes | No |
| Add/delete items | Yes | Yes | No |
| Upload floorplan | Yes | Yes | No |
| Invite users | Yes | No | No |
| Change roles | Yes | No | No |
| Remove users | Yes | No | No |
| Delete project | Yes | No | No |

### Invite Flow

1. Owner enters email + selects role (editor/viewer)
2. Server creates `project_invites` record with unique token
3. Email sent with invite link
4. Recipient clicks link → logs in → auto-added to project
5. Invites expire after 7 days

## API Endpoints

```
src/routes/
├── api/
│   ├── auth/
│   │   ├── login/+server.ts         GET  → Redirect to Infomaniak
│   │   ├── callback/+server.ts      GET  → Handle OIDC callback
│   │   ├── logout/+server.ts        POST → Clear session
│   │   └── me/+server.ts            GET  → Current user or null
│   │
│   ├── projects/
│   │   ├── +server.ts               GET  → List my projects
│   │   │                            POST → Create project
│   │   ├── [id]/
│   │   │   ├── +server.ts           GET, PATCH, DELETE
│   │   │   ├── floorplan/+server.ts POST → Upload (5MB limit)
│   │   │   ├── items/+server.ts     GET, POST
│   │   │   ├── items/[itemId]/+server.ts  PATCH, DELETE
│   │   │   ├── members/+server.ts   GET, POST
│   │   │   └── members/[userId]/+server.ts  PATCH, DELETE
│   │
│   ├── invites/
│   │   └── [token]/+server.ts       GET  → Accept invite
│   │
│   ├── images/
│   │   └── floorplans/[...path]/+server.ts  GET → Serve image
│   │
│   └── health/+server.ts            GET  → Health check
│
├── ws/
│   └── projects/[id]/               WebSocket endpoint
│
└── hooks.server.ts                  Auth middleware
```

## Frontend Changes

### New Stores

```typescript
// Auth state
auth.svelte.ts
├── user: User | null
├── isAuthenticated: boolean
├── isLoading: boolean
└── login(), logout()

// Collaboration state (per-project)
collaboration.svelte.ts
├── connectedUsers: User[]
├── cursors: Map<userId, {x, y}>
├── lockedItems: Map<itemId, userId>
├── wsConnection: WebSocket | null
└── connect(), disconnect(), sendCursor(), lockItem()

// Sync state
sync.svelte.ts
├── isOnline: boolean
├── pendingChanges: number
├── lastSynced: Date | null
└── syncNow(), queueChange()
```

### New Components

- `LoginButton.svelte` - Sign in / User menu dropdown
- `ShareDialog.svelte` - Manage project members
- `ImportLocalProjectsModal.svelte` - First-login migration
- `OnlineUsers.svelte` - Avatar stack in canvas header
- `RemoteCursor.svelte` - Other users' cursors on canvas
- `OfflineIndicator.svelte` - "Working offline" banner
- `LockedItemOverlay.svelte` - "Being edited by..." overlay

### Modified Components

- `Header.svelte` - Add login button, share button
- `Canvas.svelte` - Render remote cursors, handle locking
- `Item.svelte` - Show selection/lock states, check permissions
- `ProjectList.svelte` - Fetch from server when logged in, show shared projects

## Configuration

### Environment Variables

```env
# Infomaniak OIDC
INFOMANIAK_CLIENT_ID=2d167264-f93f-4c79-ba7b-5b8df4812189
INFOMANIAK_CLIENT_SECRET=<secret>
INFOMANIAK_REDIRECT_URI=https://yourapp.com/api/auth/callback

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/floorplanner

# Session
SESSION_SECRET=<random-32-bytes>

# Uploads
UPLOAD_DIR=./uploads
MAX_IMAGE_SIZE=5242880
```

## Implementation Order

1. **Database setup** - PostgreSQL schema, Bun SQL connection
2. **Auth flow** - Infomaniak OIDC integration, sessions
3. **API endpoints** - Projects, items, floorplans CRUD
4. **Data sync** - Dual storage logic, offline queue
5. **Image handling** - Upload, serve, caching
6. **WebSocket server** - Connection management, rooms
7. **Real-time collaboration** - Locking, broadcasts
8. **Presence UI** - Cursors, selections, user list
9. **Sharing** - Invites, permissions, roles
10. **Migration flow** - Import local projects dialog
