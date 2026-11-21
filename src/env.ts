import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	INFOMANIAK_CLIENT_ID: { schema: (input) => input },
	INFOMANIAK_CLIENT_SECRET: { schema: (input) => input },
	INFOMANIAK_REDIRECT_URI: { schema: (input) => input },
	DATABASE_URL: { schema: (input) => input },
	SESSION_SECRET: { schema: (input) => input },
	UPLOAD_DIR: { schema: (input) => input },
	MAX_IMAGE_SIZE_BYTES: { schema: (input) => input },
	PUBLIC_URL: { schema: (input) => input }
});
