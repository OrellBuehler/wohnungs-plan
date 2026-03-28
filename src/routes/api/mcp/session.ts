import { randomUUID } from 'crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

export type SessionState = {
	transport: WebStandardStreamableHTTPServerTransport;
	userId: string;
	lastAccess: number;
};

export const sessionTransports = new Map<string, SessionState>();

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const MAX_SESSIONS_PER_USER = 5;

// Periodically evict sessions that have been idle longer than SESSION_TIMEOUT_MS.
setInterval(() => {
	const now = Date.now();
	for (const [sessionId, state] of sessionTransports) {
		if (now - state.lastAccess > SESSION_TIMEOUT_MS) {
			sessionTransports.delete(sessionId);
			if (typeof state.transport.close === 'function') {
				try {
					state.transport.close();
				} catch {
					// ignore close errors so remaining sessions are still cleaned up
				}
			}
		}
	}
}, 5 * 60 * 1000).unref();

export async function createSessionTransport(
	userId: string,
	createServer: (userId: string) => import('@modelcontextprotocol/sdk/server/mcp.js').McpServer
): Promise<WebStandardStreamableHTTPServerTransport> {
	// Evict oldest sessions for this user if the per-user limit is reached.
	const userSessions = [...sessionTransports.entries()]
		.filter(([, s]) => s.userId === userId)
		.sort(([, a], [, b]) => a.lastAccess - b.lastAccess);
	if (userSessions.length >= MAX_SESSIONS_PER_USER) {
		const toEvict = userSessions.slice(0, userSessions.length - MAX_SESSIONS_PER_USER + 1);
		for (const [sessionId, state] of toEvict) {
			sessionTransports.delete(sessionId);
			if (typeof state.transport.close === 'function') {
				try {
					state.transport.close();
				} catch {
					// ignore
				}
			}
		}
	}

	let transport!: WebStandardStreamableHTTPServerTransport;
	transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: () => randomUUID(),
		onsessioninitialized: (sessionId) => {
			sessionTransports.set(sessionId, { transport, userId, lastAccess: Date.now() });
		},
		onsessionclosed: (sessionId) => {
			sessionTransports.delete(sessionId);
		}
	});

	transport.onclose = () => {
		if (transport.sessionId) {
			sessionTransports.delete(transport.sessionId);
		}
	};

	const server = createServer(userId);
	await server.connect(transport);
	return transport;
}

export function getSessionTransport(
	sessionId: string,
	userId: string
): WebStandardStreamableHTTPServerTransport | null {
	const session = sessionTransports.get(sessionId);
	if (!session || session.userId !== userId) {
		return null;
	}
	session.lastAccess = Date.now();
	return session.transport;
}
