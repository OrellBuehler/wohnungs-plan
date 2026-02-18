import { getLocale } from '$lib/paraglide/runtime';
import * as m from '$lib/paraglide/messages';

export function getInitials(name: string | null): string {
	if (!name) return '?';
	return name
		.split(' ')
		.map((n) => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);
}

export function formatDecimal(value: number, decimals: number = 2): string {
	return new Intl.NumberFormat(getLocale(), {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	}).format(value);
}

export function formatDimension(width: number, height: number): string {
	const w = Number.isInteger(width) ? String(width) : formatDecimal(width, 1);
	const h = Number.isInteger(height) ? String(height) : formatDecimal(height, 1);
	return `${w} \u00d7 ${h} cm`;
}

export function formatRelativeTime(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) return m.time_just_now();
	if (minutes < 60) return m.time_minutes_ago({ count: minutes });
	if (hours < 24) return m.time_hours_ago({ count: hours });
	return m.time_days_ago({ count: days });
}
