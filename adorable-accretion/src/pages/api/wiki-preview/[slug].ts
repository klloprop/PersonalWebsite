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
import {
	canRoleViewCollection,
	computeEffectiveCollectionVisibility,
	getWikiCollectionVisibilityOverrides,
	listWikiCollectionInfos,
	type ViewerRole,
} from '../../../lib/wiki-collection-visibility';
import {
	canRoleViewWikiEntry,
	computeEffectiveWikiEntryVisibility,
	getWikiEntryVisibilityOverrides,
	type WikiEntryInfo,
} from '../../../lib/wiki-entry-visibility';

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
	const match = normalized.match(/src\/content\/wiki_[^/]+\/.+$/);
	return match ? match[0] : '';
}

export const GET: APIRoute = async ({ params, locals }) => {
	const slug = params.slug;
	if (!slug) return json({ error: 'Missing slug' }, 400);

	// Case-insensitive slug lookup (mirrors [slug].astro)
	const entries = await getCollection('wiki');
	const entry = entries.find((e) => {
		const normalized = (e.id.split('/').pop() ?? '').toLowerCase().replace(/\s+/g, '-');
		return normalized === slug.toLowerCase();
	});

	if (!entry) return json({ error: 'Not found' }, 404);

	const viewerRole: ViewerRole = locals.user?.role === 'admin' ? 'admin' : 'user';
	const [collectionInfos, collectionOverrides, entryOverrides] = await Promise.all([
		listWikiCollectionInfos(),
		getWikiCollectionVisibilityOverrides(),
		getWikiEntryVisibilityOverrides(),
	]);

	function sanitizeEntryVisibility(value: unknown): 'user' | 'admin' {
		return value === 'admin' ? 'admin' : 'user';
	}
const entryInfos: WikiEntryInfo[] = entries.map((e) => ({
	id: e.id,
	title: e.data.title,
	collectionRef: (e.data.collectionId as string | undefined) ?? e.data.collection,
	defaultVisibility: sanitizeEntryVisibility((e.data as Record<string, unknown>).visibility),
}));

	const collectionVisibility = computeEffectiveCollectionVisibility(collectionInfos, collectionOverrides);
	const entryVisibility = computeEffectiveWikiEntryVisibility(entryInfos, entryOverrides, collectionVisibility, collectionInfos);
	const entryCollectionRef = (entry.data.collectionId as string | undefined) ?? entry.data.collection;

	if (!canRoleViewCollection(entryCollectionRef, viewerRole, collectionVisibility, collectionInfos)) {
		return json({ error: 'Not found' }, 404);
	}
	if (!canRoleViewWikiEntry(entry.id, viewerRole, entryVisibility)) {
		return json({ error: 'Not found' }, 404);
	}

	const filePath = entry.filePath
		? projectRelativePath(entry.filePath)
		: `src/content/${entry.id}.md`;

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
