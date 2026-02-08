import { env } from '$env/dynamic/private';

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
		secret: env.SESSION_SECRET ?? 'dev-secret-change-in-production'
	},
	uploads: {
		dir: env.UPLOAD_DIR ?? './uploads',
		maxImageSize: Number.parseInt(env.MAX_IMAGE_SIZE_BYTES ?? '5242880', 10)
	},
	publicUrl: env.PUBLIC_URL ?? '',
	anthropicApiKey: env.ANTHROPIC_API_KEY ?? ''
};
