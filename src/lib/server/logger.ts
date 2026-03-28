type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level: LogLevel): boolean {
	const configured: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'warn';
	return levels[level] >= levels[configured];
}

export const logger = {
	debug: (...args: unknown[]) => shouldLog('debug') && console.debug('[debug]', ...args),
	info: (...args: unknown[]) => shouldLog('info') && console.info('[info]', ...args),
	warn: (...args: unknown[]) => shouldLog('warn') && console.warn('[warn]', ...args),
	error: (...args: unknown[]) => shouldLog('error') && console.error('[error]', ...args),
};
