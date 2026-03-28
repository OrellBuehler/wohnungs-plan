import type { CurrencyCode } from './currency';

export interface ExchangeRates {
	base: CurrencyCode;
	date: string;
	rates: Partial<Record<CurrencyCode, number>>;
}

// Cache for exchange rates (in-memory)
let cachedRates: ExchangeRates | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

/**
 * Fetch exchange rates from frankfurter.app
 * Free API, no key required
 */
export async function fetchExchangeRates(baseCurrency: CurrencyCode): Promise<ExchangeRates> {
	// Check cache
	if (
		cachedRates &&
		cachedRates.base === baseCurrency &&
		Date.now() - cacheTimestamp < CACHE_DURATION
	) {
		return cachedRates;
	}

	try {
		const symbols = ['EUR', 'USD', 'GBP', 'CHF', 'PLN', 'SEK', 'NOK', 'DKK'].filter(
			(s) => s !== baseCurrency
		);
		const response = await fetch(
			`https://api.frankfurter.app/latest?from=${baseCurrency}&to=${symbols.join(',')}`
		);

		if (!response.ok) {
			throw new Error('Failed to fetch exchange rates');
		}

		const data = await response.json();

		const rates: ExchangeRates = {
			base: baseCurrency,
			date: data.date,
			rates: {
				[baseCurrency]: 1, // Base currency rate is always 1
				...data.rates
			}
		};

		// Update cache
		cachedRates = rates;
		cacheTimestamp = Date.now();

		return rates;
	} catch {
		// Return fallback rates (all 1:1, will show unconverted)
		return {
			base: baseCurrency,
			date: new Date().toISOString().split('T')[0],
			rates: {
				EUR: 1,
				USD: 1,
				GBP: 1,
				CHF: 1,
				PLN: 1,
				SEK: 1,
				NOK: 1,
				DKK: 1
			}
		};
	}
}

/**
 * Convert an amount from one currency to another
 */
export function convertCurrency(
	amount: number,
	fromCurrency: CurrencyCode,
	toCurrency: CurrencyCode,
	rates: ExchangeRates
): number {
	if (fromCurrency === toCurrency) return amount;

	// If rates are based on the target currency
	if (rates.base === toCurrency) {
		const rate = rates.rates[fromCurrency];
		if (rate) {
			return amount / rate;
		}
	}

	// If rates are based on the source currency
	if (rates.base === fromCurrency) {
		const rate = rates.rates[toCurrency];
		if (rate) {
			return amount * rate;
		}
	}

	// Cross-rate conversion (through base currency)
	const fromRate = rates.rates[fromCurrency];
	const toRate = rates.rates[toCurrency];

	if (fromRate && toRate) {
		// Convert to base, then to target
		const inBase = amount / fromRate;
		return inBase * toRate;
	}

	// Fallback: return original amount
	return amount;
}

/**
 * Clear the exchange rate cache
 */
export function clearRateCache() {
	cachedRates = null;
	cacheTimestamp = 0;
}
