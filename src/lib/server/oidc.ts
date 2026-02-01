import { config } from './env';

export interface OIDCTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token?: string;
	id_token?: string;
}

export interface OIDCUserInfo {
	sub: string;
	email?: string;
	name?: string;
	picture?: string;
}

export function getAuthorizationUrl(state: string): string {
	const params = new URLSearchParams({
		client_id: config.infomaniak.clientId,
		redirect_uri: config.infomaniak.redirectUri,
		response_type: 'code',
		scope: 'openid profile email',
		state
	});

	return `${config.infomaniak.authorizationEndpoint}?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<OIDCTokenResponse> {
	const response = await fetch(config.infomaniak.tokenEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			client_id: config.infomaniak.clientId,
			client_secret: config.infomaniak.clientSecret,
			redirect_uri: config.infomaniak.redirectUri,
			code
		})
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Token exchange failed: ${error}`);
	}

	return response.json();
}

export async function getUserInfo(accessToken: string): Promise<OIDCUserInfo> {
	const response = await fetch(config.infomaniak.userinfoEndpoint, {
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Userinfo request failed: ${error}`);
	}

	return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<OIDCTokenResponse> {
	const response = await fetch(config.infomaniak.tokenEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			client_id: config.infomaniak.clientId,
			client_secret: config.infomaniak.clientSecret,
			refresh_token: refreshToken
		})
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Token refresh failed: ${error}`);
	}

	return response.json();
}
