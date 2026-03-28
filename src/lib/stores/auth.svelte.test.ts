import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	isAuthenticated,
	isLoading,
	getUser,
	fetchUser,
	waitForAuth,
	setUser,
	logout
} from './auth.svelte';

describe('auth store', () => {
	beforeEach(() => {
		// Reset fetch mock
		vi.clearAllMocks();
		// Reset state by setting to null
		setUser(null);
	});

	describe('initial state after reset', () => {
		it('should be unauthenticated after setUser(null)', () => {
			setUser(null);
			expect(isAuthenticated()).toBe(false);
		});

		it('should have no user after setUser(null)', () => {
			setUser(null);
			expect(getUser()).toBeNull();
		});
	});

	describe('fetchUser', () => {
		it('should set authenticated to true when API returns user', async () => {
			const mockUser = {
				id: 'user-1',
				email: 'test@example.com',
				name: 'Test User',
				avatarUrl: null
			};
			(globalThis.fetch as any).mockResolvedValueOnce({
				json: async () => ({ user: mockUser })
			});

			await fetchUser();

			expect(isAuthenticated()).toBe(true);
			expect(getUser()).toEqual(mockUser);
			expect(isLoading()).toBe(false);
		});

		it('should set authenticated to false when API returns null user', async () => {
			(globalThis.fetch as any).mockResolvedValueOnce({
				json: async () => ({ user: null })
			});

			await fetchUser();

			expect(isAuthenticated()).toBe(false);
			expect(getUser()).toBeNull();
			expect(isLoading()).toBe(false);
		});

		it('should set authenticated to false on network error', async () => {
			(globalThis.fetch as any).mockRejectedValueOnce(new Error('Network error'));

			await fetchUser();

			expect(isAuthenticated()).toBe(false);
			expect(getUser()).toBeNull();
			expect(isLoading()).toBe(false);
		});

		it('should set loading to false after fetch completes', async () => {
			(globalThis.fetch as any).mockResolvedValueOnce({
				json: async () => ({ user: null })
			});

			await fetchUser();
			expect(isLoading()).toBe(false);
		});
	});

	describe('waitForAuth', () => {
		it('should resolve after fetchUser completes successfully', async () => {
			const mockUser = {
				id: 'user-1',
				email: 'test@example.com',
				name: 'Test User',
				avatarUrl: null
			};
			(globalThis.fetch as any).mockResolvedValueOnce({
				json: async () => ({ user: mockUser })
			});

			const waitPromise = waitForAuth();
			const fetchPromise = fetchUser();

			await Promise.all([waitPromise, fetchPromise]);

			expect(isAuthenticated()).toBe(true);
		});

		it('should resolve after fetchUser completes with error', async () => {
			(globalThis.fetch as any).mockRejectedValueOnce(new Error('Network error'));

			const waitPromise = waitForAuth();
			const fetchPromise = fetchUser();

			await Promise.all([waitPromise, fetchPromise]);

			expect(isAuthenticated()).toBe(false);
		});
	});

	describe('setUser', () => {
		it('should set user and authenticated state', () => {
			const mockUser = {
				id: 'user-1',
				email: 'test@example.com',
				name: 'Test User',
				avatarUrl: null
			};

			setUser(mockUser);

			expect(getUser()).toEqual(mockUser);
			expect(isAuthenticated()).toBe(true);
			expect(isLoading()).toBe(false);
		});

		it('should clear user when set to null', () => {
			const mockUser = {
				id: 'user-1',
				email: 'test@example.com',
				name: 'Test User',
				avatarUrl: null
			};
			setUser(mockUser);
			expect(isAuthenticated()).toBe(true);

			setUser(null);

			expect(getUser()).toBeNull();
			expect(isAuthenticated()).toBe(false);
			expect(isLoading()).toBe(false);
		});
	});

	describe('logout', () => {
		it('should clear user state on successful logout', async () => {
			const mockUser = {
				id: 'user-1',
				email: 'test@example.com',
				name: 'Test User',
				avatarUrl: null
			};
			setUser(mockUser);
			expect(isAuthenticated()).toBe(true);

			(globalThis.fetch as any).mockResolvedValueOnce({
				ok: true
			});

			await logout();

			expect(getUser()).toBeNull();
			expect(isAuthenticated()).toBe(false);
		});

		it('should clear user state even if logout API fails', async () => {
			const mockUser = {
				id: 'user-1',
				email: 'test@example.com',
				name: 'Test User',
				avatarUrl: null
			};
			setUser(mockUser);

			(globalThis.fetch as any).mockRejectedValueOnce(new Error('Network error'));

			await logout();

			expect(getUser()).toBeNull();
			expect(isAuthenticated()).toBe(false);
		});
	});
});
