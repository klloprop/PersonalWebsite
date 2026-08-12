export const prerender = false;

import type { APIRoute } from 'astro';
import {
	clearWikiCollectionVisibilityOverride,
	computeEffectiveCollectionVisibility,
	getWikiCollectionVisibilityOverrides,
	listWikiCollectionInfos,
	setWikiCollectionVisibilityOverride,
	type CollectionVisibility,
} from '../../../lib/wiki-collection-visibility';

const VALID_VISIBILITY = new Set<CollectionVisibility>(['user', 'admin']);

export const GET: APIRoute = async () => {
	try {
		const [collections, overrides] = await Promise.all([
			listWikiCollectionInfos(),
			getWikiCollectionVisibilityOverrides(),
		]);
		const effective = computeEffectiveCollectionVisibility(collections, overrides);

		const result = collections
			.map((col) => ({
				id: col.id,
				name: col.name,
				parentId: col.parentId ?? null,
				parentName: col.parentId ? (collections.find((c) => c.id === col.parentId)?.name ?? null) : null,
				defaultVisibility: col.defaultVisibility,
				overrideVisibility: overrides[col.id] ?? null,
				effectiveVisibility: effective.get(col.id) ?? col.defaultVisibility,
			}))
			.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

		return new Response(JSON.stringify({ collections: result }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch {
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const POST: APIRoute = async ({ request }) => {
	try {
		const { id, visibility, mode } = await request.json();

		if (!id || typeof id !== 'string') {
			return new Response(JSON.stringify({ error: 'Collection id is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const collections = await listWikiCollectionInfos();
		const knownCollection = collections.some((col) => col.id === id);
		if (!knownCollection) {
			return new Response(JSON.stringify({ error: 'Unknown collection' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		if (mode === 'default') {
			await clearWikiCollectionVisibilityOverride(id);
			return new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		if (!VALID_VISIBILITY.has(visibility)) {
			return new Response(JSON.stringify({ error: 'visibility must be "user" or "admin"' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		await setWikiCollectionVisibilityOverride(id, visibility);
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch {
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
