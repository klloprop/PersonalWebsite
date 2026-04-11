export const prerender = false;

import type { APIRoute } from 'astro';
import { listResources, addResource, deleteResource } from '../../../lib/auth';

// GET /api/library/resources — list all library resources
export const GET: APIRoute = async () => {
	try {
		const resources = await listResources();
		return new Response(JSON.stringify({ resources }), {
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

// POST /api/library/resources — add a resource (admin only)
export const POST: APIRoute = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return new Response(JSON.stringify({ error: 'Forbidden' }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const { title, description, url, category } = await request.json();

		if (!title || !url) {
			return new Response(
				JSON.stringify({ error: 'Title and URL are required' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } },
			);
		}

		const resource = await addResource({
			title,
			description: description || '',
			url,
			category: category || 'General',
			addedBy: locals.user.username,
		});

		return new Response(JSON.stringify({ ok: true, resource }), {
			status: 201,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch {
		return new Response(
			JSON.stringify({ error: 'Internal server error' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } },
		);
	}
};

// DELETE /api/library/resources — remove a resource (admin only)
export const DELETE: APIRoute = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return new Response(JSON.stringify({ error: 'Forbidden' }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const { id } = await request.json();
		if (!id) {
			return new Response(
				JSON.stringify({ error: 'Resource ID is required' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } },
			);
		}
		await deleteResource(id);
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
