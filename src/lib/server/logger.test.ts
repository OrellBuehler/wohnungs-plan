import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
	let originalLogLevel: string | undefined;

	beforeEach(() => {
		originalLogLevel = process.env.LOG_LEVEL;
		vi.spyOn(console, 'debug').mockImplementation(() => {});
		vi.spyOn(console, 'info').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		if (originalLogLevel === undefined) {
			delete process.env.LOG_LEVEL;
		} else {
			process.env.LOG_LEVEL = originalLogLevel;
		}
		vi.restoreAllMocks();
	});

	it('respects LOG_LEVEL=error: only error logs', () => {
		process.env.LOG_LEVEL = 'error';

		logger.debug('d');
		logger.info('i');
		logger.warn('w');
		logger.error('e');

		expect(console.debug).not.toHaveBeenCalled();
		expect(console.info).not.toHaveBeenCalled();
		expect(console.warn).not.toHaveBeenCalled();
		expect(console.error).toHaveBeenCalledWith('[error]', 'e');
	});

	it('respects LOG_LEVEL=warn: logs warn and error', () => {
		process.env.LOG_LEVEL = 'warn';

		logger.debug('d');
		logger.info('i');
		logger.warn('w');
		logger.error('e');

		expect(console.debug).not.toHaveBeenCalled();
		expect(console.info).not.toHaveBeenCalled();
		expect(console.warn).toHaveBeenCalledWith('[warn]', 'w');
		expect(console.error).toHaveBeenCalledWith('[error]', 'e');
	});

	it('respects LOG_LEVEL=info: logs info, warn, error', () => {
		process.env.LOG_LEVEL = 'info';

		logger.debug('d');
		logger.info('i');
		logger.warn('w');
		logger.error('e');

		expect(console.debug).not.toHaveBeenCalled();
		expect(console.info).toHaveBeenCalledWith('[info]', 'i');
		expect(console.warn).toHaveBeenCalledWith('[warn]', 'w');
		expect(console.error).toHaveBeenCalledWith('[error]', 'e');
	});

	it('respects LOG_LEVEL=debug: logs all', () => {
		process.env.LOG_LEVEL = 'debug';

		logger.debug('d');
		logger.info('i');
		logger.warn('w');
		logger.error('e');

		expect(console.debug).toHaveBeenCalledWith('[debug]', 'd');
		expect(console.info).toHaveBeenCalledWith('[info]', 'i');
		expect(console.warn).toHaveBeenCalledWith('[warn]', 'w');
		expect(console.error).toHaveBeenCalledWith('[error]', 'e');
	});

	it('passes multiple arguments to console methods', () => {
		process.env.LOG_LEVEL = 'debug';

		logger.error('msg', { code: 42 }, new Error('oops'));

		expect(console.error).toHaveBeenCalledWith('[error]', 'msg', { code: 42 }, expect.any(Error));
	});
});
