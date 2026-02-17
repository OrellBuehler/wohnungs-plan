# Testing Patterns

**Analysis Date:** 2026-02-17

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: `vite.config.ts` (vitest section)

**Assertion Library:**
- Vitest built-in expect() - native assertions

**Run Commands:**
```bash
bun test              # Run all tests once
bun test:watch       # Watch mode for development
bun run test:watch   # Alternative (via package.json scripts)
```

**Coverage:**
```bash
# Coverage is configured but command not in package.json
# Coverage provider: v8
# Include: src/lib/**
# Exclude: src/lib/test-utils/**, src/lib/components/ui/**
```

## Test File Organization

**Location:**
- Co-located with source files in same directory
- Pattern: `module.ts` → `module.test.ts`
- Examples: `src/lib/server/session.test.ts`, `src/lib/server/http.test.ts`, `src/lib/server/oauth.test.ts`

**Naming:**
- `.test.ts` suffix for unit tests
- `.svelte.test.ts` suffix for Svelte component tests (pattern established, not yet used)

**Structure:**
```
src/lib/server/
├── session.ts
├── session.test.ts
├── http.ts
├── http.test.ts
└── oauth.ts
    oauth.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('functionName', () => {
	it('describes what it should do', () => {
		// Arrange
		const input = 'value';

		// Act
		const result = functionToTest(input);

		// Assert
		expect(result).toBe('expected');
	});

	it('handles edge case', () => {
		// Test code
	});
});
```

**Patterns:**
- `describe()` per function/module
- `it()` per behavior or edge case
- Arrange-Act-Assert structure (implicit in test code)
- Clear test descriptions that read as requirements
- One assertion focus per test, though multiple assertions allowed

**Setup/Teardown:**
```typescript
beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});
```

Examples from codebase:
- `src/lib/server/session.test.ts` - Cookie parsing and generation
- `src/lib/server/http.test.ts` - HTTP protocol detection
- `src/lib/server/oauth.test.ts` - Token generation and PKCE validation
- `src/lib/server/rate-limit.test.ts` - Rate limiting with fake timers

## Mocking

**Framework:** Vitest `vi` module (already imported)

**Patterns:**
```typescript
// Module mocking
vi.mock('./env', () => ({
	config: {
		infomaniak: {
			redirectUri: 'http://localhost:5173/api/auth/callback'
		}
	}
}));

// Function mocking
vi.fn()
vi.spyOn()
vi.clearAllMocks() // Reset between tests

// Timer mocking for time-dependent code
vi.useFakeTimers()
vi.advanceTimersByTime(milliseconds)
vi.useRealTimers()
```

**What to Mock:**
- External module dependencies: `./env` configs, OAuth providers
- Time-dependent functions: rate limiting windows, session expiration
- System APIs when needed: fetch can be stubbed globally

**What NOT to Mock:**
- Database queries (test against real schema if needed, or use factories)
- Utility functions (toJsonValue, fromJsonValue should run real)
- Core logic you're testing (unmock the function under test)

**Global Mocks (src/lib/test-utils/setup.ts):**
```typescript
// Pre-configured mocks applied to all tests
globalThis.fetch = vi.fn() // Available in tests
globalThis.crypto.randomUUID() // Polyfilled
navigator.onLine // Mockable property
```

## Fixtures and Factories

**Test Data:**
```typescript
// From src/lib/test-utils/factories.ts

export function createTestProject(overrides?: Partial<Project>): Project {
	const id = overrides?.id ?? crypto.randomUUID();
	const now = new Date().toISOString();

	return {
		id,
		name: 'Test Project',
		createdAt: now,
		updatedAt: now,
		floorplan: null,
		items: [],
		currency: 'USD',
		gridSize: 20,
		isLocal: false,
		...overrides
	};
}

export function createTestItem(overrides?: Partial<Item>): Item {
	return {
		id: crypto.randomUUID(),
		name: 'Test Item',
		width: 100,
		height: 60,
		color: '#3b82f6',
		// ... defaults
		...overrides
	};
}

export function createTestBranch(overrides?: Partial<ProjectBranch>): ProjectBranch {
	// Similar pattern
}
```

**Location:**
- `src/lib/test-utils/factories.ts` - Factory functions for test data
- `src/lib/test-utils/setup.ts` - Global setup and mocks
- `src/lib/test-utils/mocks/` - Subdirectory for mock implementations
- `src/lib/test-utils/request-event.ts` - SvelteKit RequestEvent mocking

**Usage:**
```typescript
const project = createTestProject({ name: 'Custom Name' });
const item = createTestItem({ width: 200 });
```

## Coverage

**Requirements:** Not enforced (no coverage threshold in config)

**View Coverage:**
```bash
# No specific command in package.json, but vitest config supports:
vitest run --coverage
```

**Coverage Configuration (vite.config.ts):**
```typescript
coverage: {
	provider: 'v8',
	include: ['src/lib/**'],
	exclude: ['src/lib/test-utils/**', 'src/lib/components/ui/**']
}
```

- Excludes test utilities and UI component library
- Focuses on business logic coverage

## Test Types

**Unit Tests:**
- Scope: Individual functions and modules
- Approach: Direct function calls, test utility factories for data, mocked dependencies
- Examples: `session.test.ts`, `oauth.test.ts`, `rate-limit.test.ts`
- Typical structure: Import function, create test data with factories, call function, assert result

**Integration Tests:**
- Scope: Not yet present in codebase
- Pattern to follow: Multiple modules together (e.g., items + changes tracking)

**E2E Tests:**
- Framework: Not used
- Alternative: Manual testing or CI-based deployment verification

## Common Patterns

**Async Testing:**
```typescript
// Vitest automatically detects async tests
it('creates a user', async () => {
	const result = await upsertUser({
		infomaniakSub: 'sub-123',
		email: 'user@example.com'
	});
	expect(result.email).toBe('user@example.com');
});
```

**Error Testing:**
```typescript
it('rejects a wrong token', () => {
	const hash = hashToken('correct-token');
	expect(verifyToken('wrong-token', hash)).toBe(false);
});

it('throws on invalid input', () => {
	expect(() => {
		functionThatThrows('invalid');
	}).toThrow('expected message');
});
```

**Mocking Time (Rate Limiting Example):**
```typescript
describe('checkRateLimit', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('resets after window expires', () => {
		const key = 'test-reset-1';
		const windowMs = 1000;

		// Exhaust the limit
		for (let i = 0; i < 3; i++) {
			checkRateLimit(key, 3, windowMs);
		}
		expect(checkRateLimit(key, 3, windowMs)).toBe(false);

		// Advance time past the window
		vi.advanceTimersByTime(windowMs + 1);

		// Should be allowed again
		expect(checkRateLimit(key, 3, windowMs)).toBe(true);
	});
});
```

**Mocking Modules:**
```typescript
// At top of test file
vi.mock('./env', () => ({
	config: {
		infomaniak: {
			redirectUri: 'http://localhost:5173/api/auth/callback'
		}
	}
}));

// Then test uses the mocked config
it('includes Secure flag when explicitly set', () => {
	const cookie = createSessionCookie('sess-123', { secure: true });
	expect(cookie).toContain('Secure');
});
```

## Test Environment

**Environment:** jsdom

**Features:**
- DOM APIs available (document, window, etc.)
- Service Worker simulation available
- jsdom 28.0.0

**Configuration (vite.config.ts):**
```typescript
test: {
	include: ['src/**/*.test.ts', 'src/**/*.svelte.test.ts'],
	setupFiles: ['src/lib/test-utils/setup.ts'],
	globals: true,
	environment: 'jsdom',
	alias: {
		'$env/dynamic/private': new URL(
			'./src/lib/test-utils/mocks/env.ts',
			import.meta.url
		).pathname
	},
	server: {
		deps: {
			inline: ['drizzle-orm'] // Inline Drizzle ORM in tests
		}
	}
}
```

---

*Testing analysis: 2026-02-17*
