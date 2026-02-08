/**
 * Post-build validation: ensures test/mock credentials never leak into production builds.
 * Runs automatically as part of `bun build`.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const BUILD_SERVER_DIR = "build/server";

const FORBIDDEN_PATTERNS = [
	{ pattern: /test:test@localhost/, label: "test database URL (test:test@localhost)" },
	{ pattern: /DATABASE_URL:\s*"postgresql:\/\/test/, label: 'hardcoded mock DATABASE_URL' },
];

async function getFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true, recursive: true });
	return entries
		.filter((e) => e.isFile() && e.name.endsWith(".js"))
		.map((e) => join(e.parentPath ?? e.path, e.name));
}

const files = await getFiles(BUILD_SERVER_DIR);
const violations: string[] = [];

for (const file of files) {
	const content = await readFile(file, "utf-8");
	for (const { pattern, label } of FORBIDDEN_PATTERNS) {
		if (pattern.test(content)) {
			violations.push(`  ${file}: contains ${label}`);
		}
	}
}

if (violations.length > 0) {
	console.error("\n❌ Build validation FAILED — test credentials found in production build:\n");
	console.error(violations.join("\n"));
	console.error(
		"\nThis likely means a test env mock alias leaked into the production vite config.",
	);
	console.error("Check that resolve.alias for $env/dynamic/private is inside test config only.\n");
	process.exit(1);
}

console.log("✅ Build validation passed — no test credentials in server output.");
