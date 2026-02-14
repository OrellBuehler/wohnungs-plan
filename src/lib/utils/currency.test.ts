import { describe, it, expect } from 'vitest';
import { getCurrencySymbol, formatPrice, CURRENCIES } from './currency';

describe('getCurrencySymbol', () => {
	it('returns € for EUR', () => {
		expect(getCurrencySymbol('EUR')).toBe('€');
	});

	it('returns $ for USD', () => {
		expect(getCurrencySymbol('USD')).toBe('$');
	});

	it('returns £ for GBP', () => {
		expect(getCurrencySymbol('GBP')).toBe('£');
	});

	it('returns CHF for CHF', () => {
		expect(getCurrencySymbol('CHF')).toBe('CHF');
	});

	it('returns zł for PLN', () => {
		expect(getCurrencySymbol('PLN')).toBe('zł');
	});

	it('returns kr for SEK', () => {
		expect(getCurrencySymbol('SEK')).toBe('kr');
	});

	it('returns kr for NOK', () => {
		expect(getCurrencySymbol('NOK')).toBe('kr');
	});

	it('returns kr for DKK', () => {
		expect(getCurrencySymbol('DKK')).toBe('kr');
	});

	it('returns the code itself for unknown currency', () => {
		expect(getCurrencySymbol('XYZ' as any)).toBe('XYZ');
	});

	it('covers all defined currencies', () => {
		for (const currency of CURRENCIES) {
			expect(getCurrencySymbol(currency.code)).toBe(currency.symbol);
		}
	});
});

describe('formatPrice', () => {
	it('formats with EUR symbol', () => {
		expect(formatPrice(19.99, 'EUR')).toBe('€19.99');
	});

	it('formats with USD symbol', () => {
		expect(formatPrice(100, 'USD')).toBe('$100.00');
	});

	it('formats with two decimal places', () => {
		expect(formatPrice(5, 'GBP')).toBe('£5.00');
	});

	it('rounds to two decimal places', () => {
		expect(formatPrice(9.999, 'EUR')).toBe('€10.00');
	});

	it('handles zero', () => {
		expect(formatPrice(0, 'CHF')).toBe('CHF0.00');
	});

	it('handles negative amounts', () => {
		expect(formatPrice(-15.5, 'PLN')).toBe('zł-15.50');
	});
});
