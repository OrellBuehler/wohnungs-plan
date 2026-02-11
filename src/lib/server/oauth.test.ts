import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
	generateToken,
	hashToken,
	verifyToken,
	verifyPKCE,
	isValidCodeVerifier,
	isValidCodeChallengeS256
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
