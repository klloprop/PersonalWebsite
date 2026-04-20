export const prerender = false;

/**
 * GET /api/wiki-preview/[slug]
 *
 * Public endpoint — no auth required.
 * Returns { title, html } for use by the wiki popout preview.
 * Uses the same entry lookup and renderFromGitHub path as the full wiki page.
 */

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { renderFromGitHub } from '../../../lib/content-renderer';

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store',
		},
	});
}

function projectRelativePath(absPath: string): string {
	const normalized = absPath.replace(/\\/g, '/');
	const idx = normalized.indexOf('src/content/wiki/');
	return idx >= 0 ? normalized.slice(idx) : '';
}

export const GET: APIRoute = async ({ params }) => {
	const slug = params.slug;
	if (!slug) return json({ error: 'Missing slug' }, 400);

	// Case-insensitive slug lookup (mirrors [slug].astro)
	const entries = await getCollection('wiki');
	const entry = entries.find((e) => {
		const normalized = (e.id.split('/').pop() ?? '').toLowerCase().replace(/\s+/g, '-');
		return normalized === slug.toLowerCase();
	});

	if (!entry) return json({ error: 'Not found' }, 404);

	const filePath = entry.filePath
		? projectRelativePath(entry.filePath)
		: `src/content/wiki/${entry.id}.md`;

	if (!filePath) return json({ error: 'Could not resolve file path' }, 500);

	try {
		const rendered = await renderFromGitHub('wiki', filePath, slug);
		if (!rendered) return json({ error: 'Content not found on branch' }, 404);
		return json({
			title: rendered.frontmatter.title || entry.data.title,
			html: rendered.html,
		});
	} catch (err) {
		return json({ error: String(err) }, 502);
	}
};
