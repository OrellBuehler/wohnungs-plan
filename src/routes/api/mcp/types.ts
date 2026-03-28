import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export type ToolHelpers = {
	getUserId: () => string;
	ensureProjectRole: (
		projectId: string,
		requiredRole: 'viewer' | 'editor' | 'owner'
	) => Promise<'owner' | 'editor' | 'viewer'>;
	checkToolEnabled: (toolName: string, projectId: string) => Promise<void>;
	ensureBranch: (projectId: string, branchId: string) => Promise<void>;
	asText: (payload: unknown) => { content: Array<{ type: 'text'; text: string }> };
};

export type { McpServer };
