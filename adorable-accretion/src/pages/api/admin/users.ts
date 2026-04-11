export const prerender = false;

import type { APIRoute } from 'astro';
import { createUser, listUsers, deleteUser } from '../../../lib/auth';

// GET /api/admin/users — list all users
export const GET: APIRoute = async () => {
	try {
		const usernames = await listUsers();
		return new Response(JSON.stringify({ users: usernames }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch {
		return new Response(
			JSON.stringify({ error: 'Internal server error' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } },
		);
	}
};

// POST /api/admin/users — create a new user
export const POST: APIRoute = async ({ request, url }) => {
	try {
		const { username, role } = await request.json();

		if (!username || !/^[a-zA-Z0-9_-]{2,30}$/.test(username)) {
			return new Response(
				JSON.stringify({
					error: 'Username must be 2-30 characters (letters, numbers, _ or -)',
				}),
				{ status: 400, headers: { 'Content-Type': 'application/json' } },
			);
		}

		const validRole = role === 'admin' ? 'admin' : 'user';
		const { setupToken } = await createUser(username, validRole);
		const setupUrl = `${url.origin}/tavern/set-password?token=${setupToken}`;

		return new Response(
			JSON.stringify({ ok: true, setupUrl }),
			{ status: 201, headers: { 'Content-Type': 'application/json' } },
		);
	} catch (err) {
		const message =
			err instanceof Error ? err.message : 'Internal server error';
		const status = message === 'User already exists' ? 409 : 500;
		return new Response(JSON.stringify({ error: message }), {
			status,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

// DELETE /api/admin/users — delete a user
export const DELETE: APIRoute = async ({ request }) => {
	try {
		const { username } = await request.json();
		if (!username) {
			return new Response(
				JSON.stringify({ error: 'Username is required' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } },
			);
		}
		await deleteUser(username);
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch {
		return new Response(
			JSON.stringify({ error: 'Internal server error' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } },
		);
	}
};
