export const prerender = false;

import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
	if (!locals.user) {
		return new Response(JSON.stringify({ user: null }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	return new Response(
		JSON.stringify({ username: locals.user.username, role: locals.user.role }),
		{ status: 200, headers: { 'Content-Type': 'application/json' } },
	);
};
