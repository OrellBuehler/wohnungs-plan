import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	outputDir: './e2e/results',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: 1,
	reporter: 'list',
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'off',
		screenshot: 'off',
		serviceWorkers: 'block'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		command: 'bun dev',
		port: 5173,
		reuseExistingServer: !process.env.CI,
		timeout: 30_000
	}
});
