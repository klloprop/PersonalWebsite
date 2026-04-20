export const prerender = false;

import type { APIRoute } from 'astro';
import {
	readFile,
	writeFile,
	deleteFile,
	revalidatePath,
} from '../../../lib/github';

const ALLOWED_TYPES = new Set(['wiki', 'blog']);

/** Derive the public page URL for a content entry so we can revalidate its ISR cache. */
function pageUrl(type: string, slug: string): string {
	const lastSegment = slug.split('/').pop()!;
	if (type === 'wiki') return `/tavern/wiki/${lastSegment}`;
	return `/studio/blog/${lastSegment}`;
}

function parsePath(raw: string): {
	type: string;
	slug: string;
	filePath: string;
} | null {
	const segments = raw.split('/');
	const type = segments[0];
	if (!ALLOWED_TYPES.has(type)) return null;

	const slug = segments.slice(1).join('/');
	if (!slug) return null;

	// Prevent directory traversal
	if (slug.includes('..') || slug.startsWith('/')) return null;

	return { type, slug, filePath: `src/content/${type}/${slug}.md` };
}

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

// ---------------------------------------------------------------------------
// GET — Read raw markdown content for editing
// ---------------------------------------------------------------------------
export const GET: APIRoute = async ({ params, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, 401);

	const parsed = parsePath(params.path!);
	if (!parsed) return json({ error: 'Invalid content path' }, 400);

	// Blog editing requires admin role
	if (parsed.type === 'blog' && locals.user.role !== 'admin') {
		return json({ error: 'Forbidden' }, 403);
	}

	try {
		const file = await readFile(parsed.filePath);
		if (!file) return json({ error: 'Not found' }, 404);
		return json({ content: file.content, sha: file.sha, path: parsed.filePath });
	} catch (err) {
		return json({ error: String(err) }, 502);
	}
};

// ---------------------------------------------------------------------------
// PUT — Update existing content
// ---------------------------------------------------------------------------
export const PUT: APIRoute = async ({ params, locals, request }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, 401);

	const parsed = parsePath(params.path!);
	if (!parsed) return json({ error: 'Invalid content path' }, 400);

	// Blog editing requires admin role
	if (parsed.type === 'blog' && locals.user.role !== 'admin') {
		return json({ error: 'Forbidden' }, 403);
	}

	let body: { content?: string; sha?: string; message?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, 400);
	}

	const { content, sha, message } = body;
	if (!content || !sha) {
		return json({ error: 'Missing required fields: content, sha' }, 400);
	}

	const commitMsg =
		message ||
		`Update ${parsed.type}: ${parsed.slug} (by ${locals.user.username})`;

	try {
		const result = await writeFile(parsed.filePath, content, commitMsg, sha);
		// Bust ISR cache so the page shows fresh content (no rebuild needed)
		await revalidatePath(pageUrl(parsed.type, parsed.slug));
		return json({ success: true, sha: result.sha });
	} catch (err) {
		return json({ error: String(err) }, 502);
	}
};

// ---------------------------------------------------------------------------
// POST — Create new content
//   Path must be just the type (e.g. /api/content/wiki or /api/content/blog).
//   Slug is provided in the request body.
// ---------------------------------------------------------------------------
export const POST: APIRoute = async ({ params, locals, request }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, 401);

	const type = params.path!;
	if (!ALLOWED_TYPES.has(type)) {
		return json(
			{ error: 'Invalid type. POST to /api/content/wiki or /api/content/blog' },
			400,
		);
	}

	// Blog creation requires admin role
	if (type === 'blog' && locals.user.role !== 'admin') {
		return json({ error: 'Forbidden' }, 403);
	}

	let body: { slug?: string; content?: string; message?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, 400);
	}

	const { slug, content, message } = body;
	if (!slug || !content) {
		return json({ error: 'Missing required fields: slug, content' }, 400);
	}

	// Sanitize slug
	if (
		slug.includes('..') ||
		slug.startsWith('/') ||
		!/^[a-zA-Z0-9_\-\/]+$/.test(slug)
	) {
		return json({ error: 'Invalid slug' }, 400);
	}

	const filePath = `src/content/${type}/${slug}.md`;

	try {
		// Check if file already exists
		const existing = await readFile(filePath);
		if (existing) return json({ error: 'Entry already exists' }, 409);

		const commitMsg =
			message ||
			`Create ${type}: ${slug} (by ${locals.user.username})`;
		const result = await writeFile(filePath, content, commitMsg);
		// Bust ISR cache so the page shows fresh content (no rebuild needed)
		await revalidatePath(pageUrl(type, slug));
		return json({ success: true, sha: result.sha, path: filePath }, 201);
	} catch (err) {
		return json({ error: String(err) }, 502);
	}
};

// ---------------------------------------------------------------------------
// DELETE — Delete content (admin only)
// ---------------------------------------------------------------------------
export const DELETE: APIRoute = async ({ params, locals, request }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, 401);
	if (locals.user.role !== 'admin') {
		return json({ error: 'Forbidden: admin only' }, 403);
	}

	const parsed = parsePath(params.path!);
	if (!parsed) return json({ error: 'Invalid content path' }, 400);

	let body: { sha?: string; message?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, 400);
	}

	const { sha, message } = body;
	if (!sha) return json({ error: 'Missing required field: sha' }, 400);

	const commitMsg =
		message ||
		`Delete ${parsed.type}: ${parsed.slug} (by ${locals.user.username})`;

	try {
		await deleteFile(parsed.filePath, commitMsg, sha);
		await triggerDeploy();
		return json({ success: true });
	} catch (err) {
		return json({ error: String(err) }, 502);
	}
};
