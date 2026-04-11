export const prerender = false;

import type { APIRoute } from 'astro';
import { authenticate, createSession } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		const body = await request.json();
		const { username, password } = body;

		if (!username || !password) {
			return new Response(
				JSON.stringify({ error: 'Username and password are required' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } },
			);
		}

		const user = await authenticate(username, password);
		if (!user) {
			return new Response(
				JSON.stringify({ error: 'Invalid username or password' }),
				{ status: 401, headers: { 'Content-Type': 'application/json' } },
			);
		}

		const token = await createSession(user.username, user.role);
		cookies.set('session', token, {
			httpOnly: true,
			sameSite: 'lax',
			secure: import.meta.env.PROD,
			path: '/',
			maxAge: 604_800, // 7 days
		});

		return new Response(
			JSON.stringify({ ok: true, role: user.role }),
			{ status: 200, headers: { 'Content-Type': 'application/json' } },
		);
	} catch {
		return new Response(
			JSON.stringify({ error: 'Internal server error' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } },
		);
	}
};
