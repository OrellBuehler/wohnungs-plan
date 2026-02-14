# MCP Server Integration Design

**Date:** 2026-02-04
**Status:** Design Complete

## Overview

Integration of a Model Context Protocol (MCP) server into the wohnungs-plan application to enable AI assistants (like claude.ai) to add furniture items to projects. The MCP server will be embedded within the existing SvelteKit application and expose OAuth-authenticated tools for managing furniture items.

## Use Case

Users can interact with their AI assistants to discover furniture items (with dimensions, price, and product links) and automatically add them to their projects. Items are added to a project's item list but not placed on the canvas (x/y coordinates null), allowing users to review and position them later.

Example interaction:
> User: "Add a 200x90cm IKEA Malm desk to my Living Room project, it costs €179"
> AI: *calls `add_furniture_item` tool*
> Result: Item added to project's unplaced items list

## Architecture Decisions

### 1. Deployment Model: Embedded in SvelteKit App
The MCP server will be implemented as additional API routes within the existing SvelteKit application (`/api/mcp`, `/api/oauth/*`), rather than as a standalone service. This allows reuse of existing infrastructure, authentication, and database connections.

### 2. Authentication: Built-in OAuth Provider
The application will become an OAuth 2.0 provider specifically for MCP clients. This is necessary because:
- Claude.ai remote connectors only support OAuth authentication (not API tokens)
- The Infomaniak OAuth credentials are private to the app admin and cannot be shared with users
- Each user needs their own OAuth credentials to configure their AI assistant

### 3. OAuth Client Management: Auto-generated per User
Each user automatically gets one OAuth client (ID + secret) generated on first access to MCP settings. This is simpler than requiring users to "create clients" and sufficient for most use cases (one AI assistant per user).

### 4. Project Selection: Explicit Parameter
The `add_furniture_item` tool requires a `projectId` parameter. This is more explicit and flexible than implicit approaches (default project, active project tracking, etc.). A companion `list_projects` tool allows AIs to discover available projects.

### 5. Required Item Fields: Name, Width, Height
MCP-added items require only essential fields:
- **Required:** name, width, height
- **Optional:** price, priceCurrency, productUrl

This keeps the tool simple while capturing the core information an AI can gather from product pages.

### 6. OAuth Consent Flow: Show Once, Then Remember
First-time OAuth authorization shows a consent screen ("Claude.ai wants to access your furniture projects"), then remembers the approval for subsequent connections from the same client. This balances security awareness with convenience.

## Component Architecture

### OAuth Provider Layer

**Endpoints:**
- `/api/oauth/authorize` - Authorization endpoint (user approval)
- `/api/oauth/token` - Token exchange endpoint
- `/api/oauth/revoke` - Token revocation endpoint

**Database Schema:**

```sql
-- oauth_clients: one per user
CREATE TABLE oauth_clients (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  client_id TEXT UNIQUE NOT NULL,
  client_secret_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- oauth_authorizations: tracks approved clients
CREATE TABLE oauth_authorizations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id),
  approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- oauth_tokens: access and refresh tokens
CREATE TABLE oauth_tokens (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id),
  user_id TEXT NOT NULL REFERENCES users(id),
  access_token_hash TEXT NOT NULL,
  refresh_token_hash TEXT,
  expires_at TIMESTAMP NOT NULL,
  scopes TEXT[] DEFAULT ARRAY['mcp:access'],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- oauth_authorization_codes: short-lived codes for PKCE flow
CREATE TABLE oauth_authorization_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id),
  user_id TEXT NOT NULL REFERENCES users(id),
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Authorization Code Flow:**
1. AI assistant redirects user to `/api/oauth/authorize?client_id=...&redirect_uri=...&state=...&code_challenge=...&code_challenge_method=S256`
2. App validates `client_id` and `redirect_uri`
3. If not logged in via Infomaniak OAuth, redirect to login
4. Check `oauth_authorizations` table for existing approval
5. If not previously approved, show consent screen
6. Generate authorization code (10-minute expiration), store with PKCE challenge
7. Redirect to `redirect_uri?code=...&state=...`
8. AI assistant POSTs to `/api/oauth/token` with code + code_verifier
9. App validates PKCE, issues access token (7-day expiration) and optional refresh token

### MCP Server Layer

**Implementation:** `@modelcontextprotocol/sdk` TypeScript SDK
**Transport:** `StreamableHTTPServerTransport` (HTTP-based)
**Endpoint:** `/api/mcp`

**Authentication Middleware:**
```typescript
// Extract and validate OAuth Bearer token
const token = req.headers.authorization?.replace('Bearer ', '');
const validation = await validateOAuthToken(token);
if (!validation) {
  return res.status(401).json({ error: 'Invalid token' });
}
// Attach userId to request context for tools
req.userId = validation.userId;
```

**MCP Tools:**

**1. `list_projects`**
- **Description:** Get all projects the user has access to
- **Input:** None
- **Output:** Array of `{ id, name, role }`
- **Implementation:** Query user's project memberships, return with roles

**2. `add_furniture_item`**
- **Description:** Add furniture item to a project (not placed on canvas)
- **Input:**
  - `projectId` (string, required)
  - `name` (string, required)
  - `width` (number, required, >0, in cm)
  - `height` (number, required, >0, in cm)
  - `price` (number, optional, >0)
  - `priceCurrency` (string, optional, default 'EUR')
  - `productUrl` (string, optional, URL format)
- **Output:** Created item object `{ id, name, width, height }`
- **Validation:**
  - User has 'editor' or 'owner' role on project
  - Project exists
  - Dimensions are positive numbers
- **Implementation:** Call existing `createItem()` with `x: null, y: null`

### Settings UI

**New Section:** Settings → MCP Integration

**Components:**
1. **Credentials Display**
   - OAuth Client ID (always visible, copy button)
   - OAuth Client Secret (show once or regenerate)
   - Server URL: `https://wohnungs-plan.app/api/mcp`

2. **Setup Instructions**
   - Step-by-step guide for configuring claude.ai connector
   - Screenshots/diagrams

3. **Active Sessions**
   - List of active OAuth tokens (show creation date, last used)
   - Revoke button per token
   - "Regenerate Secret" button (invalidates all tokens for this client)

### UI Enhancement: Unplaced Items

**Item List Changes:**
- Visually distinguish items with `x === null && y === null`
- Show as "Unplaced Items" section or badge
- Optional: "Added via AI" indicator
- User can drag from list onto canvas to place

## User Experience Flow

### Setup Flow

1. **Generate Credentials**
   - User visits Settings → MCP Integration
   - App auto-generates OAuth client ID and secret (first visit)
   - User copies credentials

2. **Configure claude.ai**
   - User goes to claude.ai → Settings → Connectors
   - Clicks "Add custom connector"
   - Enters server URL and OAuth credentials
   - Clicks "Add"

3. **Authorize Access**
   - Claude.ai redirects to `/api/oauth/authorize`
   - User logs in (if needed) via Infomaniak
   - Consent screen shows: "Claude.ai wants to access your furniture projects"
   - User clicks "Approve"
   - Redirected back to claude.ai with authorization code
   - Claude.ai exchanges code for access token (transparent to user)

### Usage Flow

1. **Discover Projects**
   - User: "What projects do I have?"
   - AI calls `list_projects` tool
   - Displays project names and roles

2. **Add Furniture**
   - User: "Add a 200x90cm IKEA Malm desk to my Living Room project, it costs €179"
   - AI calls `add_furniture_item` with parsed parameters
   - Item added to project with `x/y = null`
   - User sees item in "Unplaced Items" section

3. **Place Item**
   - User drags item from list onto canvas
   - Position (x/y) and rotation can be adjusted
   - Item now fully placed

## Implementation Considerations

### Security

- **Secret Storage:** Hash OAuth client secrets and access tokens before storing (use bcrypt/argon2)
- **PKCE Required:** All authorization code flows must use PKCE (code_challenge/code_verifier)
- **Redirect URI Validation:** Only allow HTTPS URLs (localhost allowed for dev/testing)
- **Rate Limiting:** Apply rate limits to OAuth endpoints (prevent brute force)
- **Token Lifetimes:**
  - Authorization codes: 10 minutes
  - Access tokens: 7 days
  - Refresh tokens: 30 days (optional for v1)

### Token Management

- **Revocation:** When user clicks "Regenerate Secret", invalidate all tokens for that client
- **Cleanup:** Periodic job to delete expired tokens and authorization codes
- **Rotation:** Optionally rotate refresh tokens on use (can defer to v2)

### Error Handling

**MCP Tool Errors:**
- "Project not found" → 404 with clear message
- "Access denied" → 403 when user lacks editor/owner role
- "Invalid dimensions" → 400 when width/height <= 0
- Include error codes for programmatic handling

**OAuth Errors:**
- Follow RFC 6749 standard error codes
- `invalid_client`, `invalid_grant`, `invalid_request`, etc.
- Return `401 Unauthorized` with `WWW-Authenticate` header for invalid tokens

### Testing Strategy

1. **OAuth Flow Testing**
   - Manual: Configure test OAuth client, walk through authorization flow
   - Automated: Unit tests for token generation, validation, PKCE verification

2. **MCP Tool Testing**
   - Unit tests for each tool (mock database)
   - Integration tests with real MCP SDK client
   - Test permission checks (viewer cannot add items)

3. **End-to-End Testing**
   - Use MCP Inspector or custom test client
   - Verify full flow: authorize → call tools → verify database changes

## Future Enhancements

- **Multiple OAuth Clients:** Allow users to create multiple clients (for different AI assistants)
- **Additional Tools:** `update_item`, `delete_item`, `place_item` (set x/y coordinates)
- **Scopes:** Granular permissions (read-only vs. read-write)
- **Webhooks:** Notify AI when items are placed/modified in web UI
- **Bulk Operations:** `add_furniture_items` (plural) for batch imports
- **Product Catalog Integration:** Tools to search IKEA/other catalogs directly

## Dependencies

- `@modelcontextprotocol/sdk` - MCP TypeScript SDK
- Drizzle ORM migrations for new tables
- Existing auth infrastructure (Infomaniak OAuth, session management)

## Rollout Plan

1. **Phase 1: OAuth Provider**
   - Implement database schema
   - Build OAuth endpoints (authorize, token, revoke)
   - Add Settings UI for credentials

2. **Phase 2: MCP Server**
   - Implement MCP endpoint with SDK
   - Register `list_projects` and `add_furniture_item` tools
   - Add authentication middleware

3. **Phase 3: UI Polish**
   - Enhance item list to show unplaced items
   - Add setup instructions and documentation
   - Test with claude.ai connector

4. **Phase 4: Documentation & Launch**
   - Write user guide
   - Create demo video
   - Announce feature
