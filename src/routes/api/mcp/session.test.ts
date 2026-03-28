import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store transport instances created by the mock constructor so tests can access them
const createdTransports: any[] = [];

vi.mock('@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js', () => {
	class MockTransport {
		sessionId: string | null = null;
		onclose: (() => void) | null = null;
		close = vi.fn();
		_onsessioninitialized: ((id: string) => void) | undefined;
		_onsessionclosed: ((id: string) => void) | undefined;

		constructor({ onsessioninitialized, onsessionclosed }: any) {
			this._onsessioninitialized = onsessioninitialized;
			this._onsessionclosed = onsessionclosed;
			createdTransports.push(this);
		}
	}

	return { WebStandardStreamableHTTPServerTransport: MockTransport };
});

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
	class MockMcpServer {
		connect = vi.fn().mockResolvedValue(undefined);
		constructor(_options: any) {}
	}
	return { McpServer: MockMcpServer };
});

import {
	sessionTransports,
	createSessionTransport,
	getSessionTransport,
	MAX_SESSIONS_PER_USER
} from './session';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

function makeCreateServer() {
	return vi.fn((_userId: string) => new McpServer({} as any));
}

beforeEach(() => {
	sessionTransports.clear();
	createdTransports.length = 0;
	vi.clearAllMocks();
});

describe('createSessionTransport', () => {
	it('registers the session in sessionTransports after onsessioninitialized fires', async () => {
		await createSessionTransport('user-1', makeCreateServer());

		const transport = createdTransports[0];
		transport._onsessioninitialized('session-abc');

		expect(sessionTransports.has('session-abc')).toBe(true);
		expect(sessionTransports.get('session-abc')?.userId).toBe('user-1');
	});

	it('returns the transport instance', async () => {
		const transport = await createSessionTransport('user-1', makeCreateServer());
		expect(transport).toBeDefined();
	});

	it('calls createServer with the userId', async () => {
		const createServer = makeCreateServer();
		await createSessionTransport('user-42', createServer);
		expect(createServer).toHaveBeenCalledWith('user-42');
	});

	it('connects the McpServer to the transport', async () => {
		const mockServer = { connect: vi.fn().mockResolvedValue(undefined) };
		const createServer = vi.fn(() => mockServer as any);

		await createSessionTransport('user-1', createServer);

		expect(mockServer.connect).toHaveBeenCalledOnce();
	});

	it('removes session from map when onsessionclosed fires', async () => {
		await createSessionTransport('user-1', makeCreateServer());
		const transport = createdTransports[0];

		transport._onsessioninitialized('session-xyz');
		expect(sessionTransports.has('session-xyz')).toBe(true);

		transport._onsessionclosed('session-xyz');
		expect(sessionTransports.has('session-xyz')).toBe(false);
	});

	it('evicts oldest session when MAX_SESSIONS_PER_USER limit is reached', async () => {
		const userId = 'user-limit';

		// Fill up to the limit, each with a known lastAccess
		for (let i = 0; i < MAX_SESSIONS_PER_USER; i++) {
			await createSessionTransport(userId, makeCreateServer());
			const t = createdTransports[i];
			t._onsessioninitialized(`session-${i}`);
			// Spread out lastAccess so oldest is deterministic
			const entry = sessionTransports.get(`session-${i}`);
			if (entry) entry.lastAccess = i;
		}

		expect(sessionTransports.size).toBe(MAX_SESSIONS_PER_USER);

		// Creating one more should evict the oldest (session-0, lastAccess=0)
		await createSessionTransport(userId, makeCreateServer());
		const newTransport = createdTransports[MAX_SESSIONS_PER_USER];
		newTransport._onsessioninitialized('session-new');

		expect(sessionTransports.has('session-0')).toBe(false);
		expect(sessionTransports.has('session-new')).toBe(true);
		expect(sessionTransports.size).toBe(MAX_SESSIONS_PER_USER);
	});
});

describe('getSessionTransport', () => {
	it('returns null for an unknown sessionId', () => {
		const result = getSessionTransport('nonexistent', 'user-1');
		expect(result).toBeNull();
	});

	it('returns null when userId does not match the session owner', async () => {
		await createSessionTransport('user-owner', makeCreateServer());
		createdTransports[0]._onsessioninitialized('session-owned');

		const result = getSessionTransport('session-owned', 'user-other');
		expect(result).toBeNull();
	});

	it('returns the transport when sessionId and userId match', async () => {
		const transport = await createSessionTransport('user-1', makeCreateServer());
		createdTransports[0]._onsessioninitialized('session-match');

		const result = getSessionTransport('session-match', 'user-1');
		expect(result).toBe(transport);
	});

	it('updates lastAccess on successful retrieval', async () => {
		vi.useFakeTimers();

		await createSessionTransport('user-1', makeCreateServer());
		createdTransports[0]._onsessioninitialized('session-ts');

		const entry = sessionTransports.get('session-ts')!;
		const before = entry.lastAccess;

		vi.advanceTimersByTime(100);

		getSessionTransport('session-ts', 'user-1');

		expect(entry.lastAccess).toBeGreaterThan(before);

		vi.useRealTimers();
	});
});
