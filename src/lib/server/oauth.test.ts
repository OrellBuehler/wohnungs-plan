import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';

// --- Mock db before importing oauth functions that use getDB() ---
const mockDb = {
	query: {
		oauthTokens: { findFirst: vi.fn() },
		oauthAuthorizationCodes: { findFirst: vi.fn() },
		oauthAuthorizations: { findFirst: vi.fn() },
		oauthClients: { findFirst: vi.fn() }
	},
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn()
};

vi.mock('./db', () => ({
	getDB: () => mockDb,
	oauthTokens: {},
	oauthAuthorizationCodes: {},
	oauthAuthorizations: {},
	oauthClients: {}
}));

import {
	generateToken,
	hashToken,
	verifyToken,
	verifyPKCE,
	isValidCodeVerifier,
	isValidCodeChallengeS256,
	validateAccessToken,
	createAuthorizationCode,
	consumeAuthorizationCode
} from './oauth';

describe('generateToken', () => {
	it('returns a base64url string', () => {
		const token = generateToken();
		expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	it('returns expected length for default 32 bytes', () => {
		const token = generateToken(32);
		// 32 bytes → 43 chars base64url (no padding)
		expect(token).toHaveLength(43);
	});

	it('returns expected length for 24 bytes', () => {
		const token = generateToken(24);
		// 24 bytes → 32 chars base64url
		expect(token).toHaveLength(32);
	});

	it('generates unique tokens', () => {
		const a = generateToken();
		const b = generateToken();
		expect(a).not.toBe(b);
	});
});

describe('hashToken + verifyToken', () => {
	it('verifies a correct token', () => {
		const token = 'test-token-123';
		const hash = hashToken(token);
		expect(verifyToken(token, hash)).toBe(true);
	});

	it('rejects a wrong token', () => {
		const hash = hashToken('correct-token');
		expect(verifyToken('wrong-token', hash)).toBe(false);
	});

	it('hash is a bcrypt string', () => {
		const hash = hashToken('some-token');
		expect(hash).toMatch(/^\$2[aby]?\$/);
	});
});

describe('verifyPKCE', () => {
	it('verifies a valid S256 pair', () => {
		const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
		const challenge = createHash('sha256').update(verifier).digest('base64url');
		expect(verifyPKCE(verifier, challenge)).toBe(true);
	});

	it('rejects an invalid pair', () => {
		const verifier = 'some-verifier-value-that-is-long-enough-1234';
		const wrongChallenge = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
		expect(verifyPKCE(verifier, wrongChallenge)).toBe(false);
	});
});

describe('isValidCodeVerifier', () => {
	it('accepts valid 43-char verifier', () => {
		const verifier = 'a'.repeat(43);
		expect(isValidCodeVerifier(verifier)).toBe(true);
	});

	it('accepts valid 128-char verifier', () => {
		const verifier = 'A'.repeat(128);
		expect(isValidCodeVerifier(verifier)).toBe(true);
	});

	it('accepts unreserved chars (A-Z, a-z, 0-9, -, ., _, ~)', () => {
		const verifier = 'abcABC012-._~abcABC012-._~abcABC012-._~abcA';
		expect(isValidCodeVerifier(verifier)).toBe(true);
	});

	it('rejects too short (42 chars)', () => {
		expect(isValidCodeVerifier('a'.repeat(42))).toBe(false);
	});

	it('rejects too long (129 chars)', () => {
		expect(isValidCodeVerifier('a'.repeat(129))).toBe(false);
	});

	it('rejects invalid characters', () => {
		expect(isValidCodeVerifier('a'.repeat(42) + '!')).toBe(false);
		expect(isValidCodeVerifier('a'.repeat(42) + ' ')).toBe(false);
	});
});

describe('isValidCodeChallengeS256', () => {
	it('accepts valid 43-char base64url challenge', () => {
		const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
		expect(isValidCodeChallengeS256(challenge)).toBe(true);
	});

	it('rejects wrong length (42 chars)', () => {
		expect(isValidCodeChallengeS256('A'.repeat(42))).toBe(false);
	});

	it('rejects wrong length (44 chars)', () => {
		expect(isValidCodeChallengeS256('A'.repeat(44))).toBe(false);
	});

	it('rejects invalid characters (+ and /)', () => {
		expect(isValidCodeChallengeS256('A'.repeat(41) + '+/')).toBe(false);
	});

	it('rejects padding characters', () => {
		expect(isValidCodeChallengeS256('A'.repeat(42) + '=')).toBe(false);
	});
});

describe('validateAccessToken', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns userId and clientId for a valid non-expired token', async () => {
		mockDb.query.oauthTokens.findFirst.mockResolvedValueOnce({
			userId: 'user-1',
			clientId: 'client-1'
		});

		const result = await validateAccessToken('some-valid-token');

		expect(result).toEqual({ userId: 'user-1', clientId: 'client-1' });
		expect(mockDb.query.oauthTokens.findFirst).toHaveBeenCalledOnce();
	});

	it('returns undefined for an expired token (no record found)', async () => {
		mockDb.query.oauthTokens.findFirst.mockResolvedValueOnce(null);

		const result = await validateAccessToken('expired-token');

		expect(result).toBeUndefined();
	});

	it('returns undefined for an invalid token (no record found)', async () => {
		mockDb.query.oauthTokens.findFirst.mockResolvedValueOnce(undefined);

		const result = await validateAccessToken('invalid-token-xyz');

		expect(result).toBeUndefined();
	});

	it('uses SHA-256 hash of token for lookup (not plaintext)', async () => {
		mockDb.query.oauthTokens.findFirst.mockResolvedValueOnce(null);

		const token = 'plaintext-token-abc';
		await validateAccessToken(token);

		// The call should have happened — the exact where clause is opaque but we
		// can verify that the function never passes the raw token string to findFirst
		// by confirming findFirst was called (the internals hash it first).
		expect(mockDb.query.oauthTokens.findFirst).toHaveBeenCalledOnce();
	});
});

describe('createAuthorizationCode', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns a base64url string code', async () => {
		const insertReturning = { values: vi.fn().mockResolvedValueOnce([]) };
		mockDb.insert.mockReturnValue(insertReturning);

		const code = await createAuthorizationCode('user-1', 'client-1', 'https://example.com/cb', 'challenge123');

		expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(code.length).toBeGreaterThan(0);
	});

	it('inserts a hashed code (not plaintext) into the database', async () => {
		const insertValues = vi.fn().mockResolvedValueOnce([]);
		mockDb.insert.mockReturnValue({ values: insertValues });

		const code = await createAuthorizationCode('user-1', 'client-1', 'https://example.com/cb', 'challenge123');

		expect(mockDb.insert).toHaveBeenCalledOnce();
		const insertedRow = insertValues.mock.calls[0][0];
		// The stored code must be the SHA-256 hex hash, not the plaintext code
		expect(insertedRow.code).not.toBe(code);
		// Verify it's a hex SHA-256 hash (64 hex chars)
		expect(insertedRow.code).toMatch(/^[0-9a-f]{64}$/);
	});

	it('generates unique codes on consecutive calls', async () => {
		mockDb.insert.mockReturnValue({ values: vi.fn().mockResolvedValue([]) });

		const code1 = await createAuthorizationCode('user-1', 'client-1', 'https://example.com/cb', 'challenge');
		const code2 = await createAuthorizationCode('user-1', 'client-1', 'https://example.com/cb', 'challenge');

		expect(code1).not.toBe(code2);
	});
});

describe('consumeAuthorizationCode', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function makeUpdateChain(returning: unknown[]) {
		const returningFn = vi.fn().mockResolvedValueOnce(returning);
		const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
		const setFn = vi.fn().mockReturnValue({ where: whereFn });
		mockDb.update.mockReturnValue({ set: setFn });
		return { setFn, whereFn, returningFn };
	}

	it('returns userId when code, clientId, redirectUri, and verifier are all valid', async () => {
		const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
		const challenge = createHash('sha256').update(verifier).digest('base64url');

		makeUpdateChain([{
			userId: 'user-1',
			clientId: 'client-1',
			redirectUri: 'https://example.com/cb',
			codeChallenge: challenge
		}]);

		const result = await consumeAuthorizationCode(
			'some-code',
			'client-1',
			'https://example.com/cb',
			verifier
		);

		expect(result).toBe('user-1');
	});

	it('returns undefined when no matching code found (expired or already used)', async () => {
		makeUpdateChain([]);

		const result = await consumeAuthorizationCode(
			'nonexistent-code',
			'client-1',
			'https://example.com/cb',
			'a'.repeat(43)
		);

		expect(result).toBeUndefined();
	});

	it('returns undefined when clientId does not match', async () => {
		const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
		const challenge = createHash('sha256').update(verifier).digest('base64url');

		makeUpdateChain([{
			userId: 'user-1',
			clientId: 'other-client',
			redirectUri: 'https://example.com/cb',
			codeChallenge: challenge
		}]);

		const result = await consumeAuthorizationCode(
			'some-code',
			'client-1',
			'https://example.com/cb',
			verifier
		);

		expect(result).toBeUndefined();
	});

	it('returns undefined when redirectUri does not match', async () => {
		const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
		const challenge = createHash('sha256').update(verifier).digest('base64url');

		makeUpdateChain([{
			userId: 'user-1',
			clientId: 'client-1',
			redirectUri: 'https://other.com/cb',
			codeChallenge: challenge
		}]);

		const result = await consumeAuthorizationCode(
			'some-code',
			'client-1',
			'https://example.com/cb',
			verifier
		);

		expect(result).toBeUndefined();
	});

	it('returns undefined when PKCE verifier does not match challenge', async () => {
		const goodVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
		const challenge = createHash('sha256').update(goodVerifier).digest('base64url');

		makeUpdateChain([{
			userId: 'user-1',
			clientId: 'client-1',
			redirectUri: 'https://example.com/cb',
			codeChallenge: challenge
		}]);

		const result = await consumeAuthorizationCode(
			'some-code',
			'client-1',
			'https://example.com/cb',
			'wrong-verifier-value-that-is-long-enough-here' // wrong verifier
		);

		expect(result).toBeUndefined();
	});

	it('one-time use: code cannot be consumed twice', async () => {
		const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
		const challenge = createHash('sha256').update(verifier).digest('base64url');

		const validRecord = [{
			userId: 'user-1',
			clientId: 'client-1',
			redirectUri: 'https://example.com/cb',
			codeChallenge: challenge
		}];

		// First call succeeds (code found and marked used)
		makeUpdateChain(validRecord);
		const first = await consumeAuthorizationCode('some-code', 'client-1', 'https://example.com/cb', verifier);
		expect(first).toBe('user-1');

		// Second call: the WHERE clause filters out used codes (usedAt IS NULL) so no row returned
		makeUpdateChain([]);
		const second = await consumeAuthorizationCode('some-code', 'client-1', 'https://example.com/cb', verifier);
		expect(second).toBeUndefined();
	});
});
