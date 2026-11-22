import {
	INFOMANIAK_CLIENT_ID,
	INFOMANIAK_CLIENT_SECRET,
	INFOMANIAK_REDIRECT_URI,
	DATABASE_URL,
	SESSION_SECRET,
	UPLOAD_DIR,
	MAX_IMAGE_SIZE_BYTES,
	PUBLIC_URL
} from '$app/env/private';

import { dev } from '$app/env';

export const config = {
	infomaniak: {
		clientId: INFOMANIAK_CLIENT_ID ?? '',
		clientSecret: INFOMANIAK_CLIENT_SECRET ?? '',
		redirectUri: INFOMANIAK_REDIRECT_URI ?? 'http://localhost:5173/api/auth/callback',
		authorizationEndpoint: 'https://login.infomaniak.com/authorize',
		tokenEndpoint: 'https://login.infomaniak.com/token',
		userinfoEndpoint: 'https://login.infomaniak.com/oauth2/userinfo'
	},
	database: { url: DATABASE_URL ?? '' },
	session: {
		secret:
			SESSION_SECRET ||
			(dev
				? 'dev-secret-do-not-use-in-production'
				: (() => {
						throw new Error('SESSION_SECRET environment variable is required in production');
					})())
	},
	uploads: {
		dir: UPLOAD_DIR ?? './uploads',
		maxImageSize: Number.parseInt(MAX_IMAGE_SIZE_BYTES ?? '5242880', 10)
	},
	publicUrl: PUBLIC_URL ?? ''
};
