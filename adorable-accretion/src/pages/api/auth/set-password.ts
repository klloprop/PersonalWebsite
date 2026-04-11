export const prerender = false;

import type { APIRoute } from 'astro';
import { getSetupToken, consumeToken, setUserPassword } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
	try {
		const { token, password } = await request.json();

		if (!token || !password) {
			return new Response(
				JSON.stringify({ error: 'Token and password are required' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } },
			);
		}

		if (password.length < 8) {
			return new Response(
				JSON.stringify({ error: 'Password must be at least 8 characters' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } },
			);
		}

		const setupToken = await getSetupToken(token);
		if (!setupToken) {
			return new Response(
				JSON.stringify({ error: 'Invalid or expired token' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } },
			);
		}

		await setUserPassword(setupToken.username, password);
		await consumeToken(token);

		return new Response(
			JSON.stringify({ ok: true, message: 'Password set successfully' }),
			{ status: 200, headers: { 'Content-Type': 'application/json' } },
		);
	} catch {
		return new Response(
			JSON.stringify({ error: 'Internal server error' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } },
		);
	}
};
