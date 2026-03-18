import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

export const config = {
	infomaniak: {
		clientId: env.INFOMANIAK_CLIENT_ID ?? '',
		clientSecret: env.INFOMANIAK_CLIENT_SECRET ?? '',
		redirectUri: env.INFOMANIAK_REDIRECT_URI ?? 'http://localhost:5173/api/auth/callback',
		authorizationEndpoint: 'https://login.infomaniak.com/authorize',
		tokenEndpoint: 'https://login.infomaniak.com/token',
		userinfoEndpoint: 'https://login.infomaniak.com/oauth2/userinfo'
	},
	database: {
		url: env.DATABASE_URL ?? ''
	},
	session: {
		secret: env.SESSION_SECRET || (dev ? 'dev-secret-do-not-use-in-production' : (() => { throw new Error('SESSION_SECRET environment variable is required in production'); })())
	},
	uploads: {
		dir: env.UPLOAD_DIR ?? './uploads',
		maxImageSize: Number.parseInt(env.MAX_IMAGE_SIZE_BYTES ?? '5242880', 10)
	},
	publicUrl: env.PUBLIC_URL ?? ''
};
