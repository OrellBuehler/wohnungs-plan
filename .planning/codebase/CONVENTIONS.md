# Coding Conventions

**Analysis Date:** 2026-02-17

## Naming Patterns

**Files:**

- Lowercase with hyphens for multi-word names: `rate-limit.ts`, `item-images.ts`, `share-links.ts`
- Server modules in `src/lib/server/`: verb-noun pattern like `url-download.ts`, `ws-handler.ts`
- No filename prefixes (avoid `_private.ts`, etc.)

**Functions:**

- Exported functions use camelCase: `getUserProjects()`, `createFloorplan()`, `generateSessionId()`
- Prefixes for related operations: `get`, `create`, `update`, `delete`, `find`, `upsert`, `check`, `verify`, `parse`, `to`, `from`, `is`
- Accessor functions with `get` prefix: `getDB()`, `getFloorplanDir()`, `getThumbnailPath()`
- Conversion functions with `to`/`from` prefix: `toUserProfile()`, `fromJsonValue()`, `toJsonValue()`
- Predicate functions with `is`/`check`/`verify` prefix: `isSecureRequest()`, `isValidCodeVerifier()`, `checkRateLimit()`
- Private helper functions (not exported) use same camelCase: `normalizeItemForHistory()`, `itemUpdateDataFromInput()`

**Variables:**

- camelCase for all variables: `projectId`, `failedAvatars`, `floorplanMap`, `memberCounts`
- SCREAMING_SNAKE_CASE for constants: `ITEM_UPDATE_FIELDS`, `MAIN_BRANCH_NAME`, `SALT_ROUNDS`, `ALLOWED_MIME_TYPES`

**Types:**

- PascalCase for interfaces: `Member`, `ItemChangeWithUser`, `CommentWithReplies`, `ProjectMemberInfo`
- PascalCase for type aliases: `ItemCreateInput`, `ItemUpdateInput`, `ProjectRole`, `AllowedMimeType`
- Suffixes for semantically grouped types: `*Input`, `*Output`, `*Response`, `*Info`, `*Data`

## Code Style

**Formatting:**

- No explicit formatter configured (no .eslintrc, .prettierrc found)
- Code is cleanly formatted with consistent indentation (appears to be 2 spaces or tabs)

**Linting:**

- TypeScript strict mode enabled in `tsconfig.json`: `"strict": true`
- Compiler options: `forceConsistentCasingInFileNames`, `esModuleInterop`, `skipLibCheck`
- Allow JS and checkJs enabled for gradual typing

## Import Organization

**Order:**

1. External libraries/npm packages (Drizzle ORM, Node built-ins)
2. Local database imports (`./db`)
3. Other local utility imports (`./types`, `./env`, `./utils`)
4. Type imports kept inline with regular imports

**Path Aliases:**

- `$lib/` - Points to `src/lib/`
- `$env/dynamic/private` - Environment variables
- `$app/navigation` - SvelteKit navigation utilities
- No custom import aliases beyond SvelteKit defaults

**Example from `src/lib/server/items.ts`:**

```typescript
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
	getDB,
	itemChanges,
	items,
	users,
	type Item,
	type NewItem,
	type NewItemChange
} from './db';
import { touchProject } from './projects';
```

## Error Handling

**Patterns:**

- `throw new Error('descriptive message')` for validation/logic errors
- `throw error(statusCode, 'message')` for HTTP responses (SvelteKit)
- Try-catch blocks for operations that may fail (file I/O, API calls, DB operations)
- Silent failures with `console.warn()` for non-critical issues
- Error re-throwing with context: detect specific error types and decide to handle or propagate

**Examples:**

```typescript
// Database constraint errors
try {
	const [link] = await db.insert(shareLinks)...
} catch (err) {
	if (err instanceof Error && err.message.includes('share_links_token_unique')) {
		continue; // Retry with new token
	}
	throw err; // Propagate unexpected errors
}

// File I/O errors
try {
	const floorplanData = await readFile(floorplanPath);
	// process...
} catch (err) {
	console.warn(`[Thumbnail] Could not load floorplan for ${projectId}:`, err);
	// Continue with fallback
}

// HTTP errors
throw error(404, 'Project not found');
```

## Logging

**Framework:** Console only (no logger library)

**Patterns:**

- `console.log()` for informational messages (migrations, startup)
- `console.warn()` for non-critical failures: `console.warn('[Category] Message:', err)`
- `console.error()` for critical errors and exceptions
- Messages prefixed with context: `[Thumbnail]`, `[Category]` format

**Example:**

```typescript
console.log(`Running database migrations from ${migrationsPath}...`);
console.warn(`[Thumbnail] Could not load floorplan for ${projectId}:`, err);
console.error('WebSocket message error:', err);
```

## Comments

**When to Comment:**

- JSDoc comments above exported functions and types
- Inline comments for non-obvious logic (database queries, complex algorithms)
- No comments on obvious code like variable assignments

**JSDoc/TSDoc:**

- Sparse usage; primary code is self-documenting
- Used for factory functions in tests: `/** Creates a test Project with sensible defaults */`
- No @param/@returns decorators observed in codebase

## Function Design

**Size:** Functions are focused and single-responsibility

- Database queries wrapped in `export async function` pattern
- Helpers keep transformation logic separate from side effects
- Server functions 20-50 lines typical, rarely exceed 100

**Parameters:**

- Prefer explicit parameters over context objects
- Input objects use interface pattern with optional fields: `{ email?: string; name?: string; avatarUrl?: string }`
- Type-safe parameters with type imports: `projectId: string`, `userId: string` (not `any`)

**Return Values:**

- Async functions return typed promises: `Promise<User>`, `Promise<Floorplan | null>`
- Array-returning functions use simple spread: `[user]` destructure with `?? null` fallback
- Explicit null for "not found" cases (not undefined)

## Module Design

**Exports:**

- All public functions are explicitly exported
- Type exports included with function exports: `export type { UserProfile }`
- Private helpers remain unexported
- One responsibility per file (items.ts has item operations, users.ts has user operations)

**Barrel Files:**

- `src/lib/index.ts` exists but minimal
- No barrel files in subdirectories (no `src/lib/server/index.ts`)
- Direct imports preferred: `import { getDB } from './db'` not from barrel

**Svelte Components:**

- Script-only setup with `<script lang="ts">` declaration
- Props using rune pattern: `let { prop1, prop2 }: Props = $props()`
- State with runes: `let state = $state(initialValue)`
- Reactive bindings on event handlers: `onerror={() => (failedAvatars = new Set(...))}`

---

_Convention analysis: 2026-02-17_
