export const prerender = false;

import type { APIRoute } from 'astro';
import { createResetToken } from '../../../lib/auth';

// POST /api/admin/reset-link — generate a password-reset link for a user
export const POST: APIRoute = async ({ request, url }) => {
	try {
		const { username } = await request.json();

		if (!username) {
			return new Response(
				JSON.stringify({ error: 'Username is required' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } },
			);
		}

		const token = await createResetToken(username);
		const resetUrl = `${url.origin}/tavern/set-password?token=${token}`;

		return new Response(
			JSON.stringify({ ok: true, resetUrl }),
			{ status: 200, headers: { 'Content-Type': 'application/json' } },
		);
	} catch (err) {
		const message =
			err instanceof Error ? err.message : 'Internal server error';
		const status = message === 'User not found' ? 404 : 500;
		return new Response(JSON.stringify({ error: message }), {
			status,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
