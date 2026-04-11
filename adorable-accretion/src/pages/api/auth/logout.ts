export const prerender = false;

import type { APIRoute } from 'astro';
import { deleteSession } from '../../../lib/auth';

export const POST: APIRoute = async ({ cookies }) => {
	const token = cookies.get('session')?.value;
	if (token) {
		await deleteSession(token);
	}
	cookies.delete('session', { path: '/' });
	return new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
};
