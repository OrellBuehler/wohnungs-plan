import { describe, it, expect, vi } from 'vitest';
import { convertCurrency, clearRateCache, type ExchangeRates } from './exchange';

describe('convertCurrency', () => {
	const ratesFromEUR: ExchangeRates = {
		base: 'EUR',
		date: '2024-01-01',
		rates: { EUR: 1, USD: 1.1, GBP: 0.85, CHF: 0.95 }
	};

	it('returns same amount when currencies match', () => {
		expect(convertCurrency(100, 'EUR', 'EUR', ratesFromEUR)).toBe(100);
	});

	it('converts from base currency to target', () => {
		// EUR -> USD: 100 * 1.1 = 110
		expect(convertCurrency(100, 'EUR', 'USD', ratesFromEUR)).toBeCloseTo(110, 5);
	});

	it('converts to base currency from source', () => {
		// USD -> EUR: 110 / 1.1 = 100
		expect(convertCurrency(110, 'USD', 'EUR', ratesFromEUR)).toBeCloseTo(100, 5);
	});

	it('converts via cross-rate when neither is base', () => {
		// USD -> GBP through EUR base: (100 / 1.1) * 0.85 ≈ 77.27
		const result = convertCurrency(100, 'USD', 'GBP', ratesFromEUR);
		expect(result).toBeCloseTo(77.27, 1);
	});

	it('returns original amount when rate is missing', () => {
		const sparseRates: ExchangeRates = {
			base: 'EUR',
			date: '2024-01-01',
			rates: { EUR: 1 }
		};
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const result = convertCurrency(100, 'USD', 'GBP', sparseRates);
		expect(result).toBe(100);
		consoleSpy.mockRestore();
	});
});

describe('clearRateCache', () => {
	it('clears without error', () => {
		expect(() => clearRateCache()).not.toThrow();
	});
});
