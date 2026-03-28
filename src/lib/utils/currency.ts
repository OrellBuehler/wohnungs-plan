import { getLocale } from '$lib/paraglide/runtime';

export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'PLN' | 'SEK' | 'NOK' | 'DKK';

export interface Currency {
	code: CurrencyCode;
	symbol: string;
	name: string;
}

export const CURRENCIES: Currency[] = [
	{ code: 'EUR', symbol: '€', name: 'Euro' },
	{ code: 'USD', symbol: '$', name: 'US Dollar' },
	{ code: 'GBP', symbol: '£', name: 'British Pound' },
	{ code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
	{ code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
	{ code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
	{ code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
	{ code: 'DKK', symbol: 'kr', name: 'Danish Krone' }
];

export const DEFAULT_CURRENCY: CurrencyCode = 'EUR';

export function getCurrencySymbol(code: CurrencyCode): string {
	return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

export function formatPrice(amount: number, currencyCode: CurrencyCode): string {
	const symbol = getCurrencySymbol(currencyCode);
	const formatted = new Intl.NumberFormat(getLocale(), {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount);
	return `${symbol}${formatted}`;
}
