/**
 * api/admin/setup.ts — One-time admin bootstrap route.
 *
 * Protected by the ADMIN_SETUP_SECRET env variable.
 * Visit: /api/admin/setup?secret=YOUR_SECRET&username=YOUR_USERNAME
 *
 * Returns a setup link to set the admin password.
 * Remove ADMIN_SETUP_SECRET from your env vars after use to disable this route.
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { createUser, getUser } from '../../../lib/auth';

export const GET: APIRoute = async ({ url }) => {
	const secret = (import.meta.env.ADMIN_SETUP_SECRET ?? '').trim();

	if (!secret) {
		return new Response('Setup is disabled. No ADMIN_SETUP_SECRET configured.', {
			status: 404,
		});
	}

	const providedSecret = (url.searchParams.get('secret') ?? '').trim();
	if (!providedSecret || providedSecret !== secret) {
		return new Response(
			`Forbidden. Secret length expected: ${secret.length}, got: ${providedSecret.length}`,
			{ status: 403 },
		);
	}

	const username = url.searchParams.get('username');
	if (!username || !/^[a-zA-Z0-9_-]{2,30}$/.test(username)) {
		return new Response(
			'Provide a valid username: /api/admin/setup?secret=...&username=yourname',
			{ status: 400 },
		);
	}

	try {
		const existing = await getUser(username);
		if (existing) {
			return new Response(`User "${username}" already exists.`, { status: 409 });
		}

		const { setupToken } = await createUser(username, 'admin');
		const setupUrl = `${url.origin}/tavern/set-password?token=${setupToken}`;

		return new Response(
			[
				`Admin user "${username}" created!`,
				'',
				'Visit this link to set your password (valid for 24 hours):',
				setupUrl,
				'',
				'IMPORTANT: Remove the ADMIN_SETUP_SECRET environment variable',
				'from your Vercel project settings to disable this endpoint.',
			].join('\n'),
			{ status: 200, headers: { 'Content-Type': 'text/plain' } },
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return new Response(`Error: ${message}`, { status: 500 });
	}
};
