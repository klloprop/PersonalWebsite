export const prerender = false;

import type { APIRoute } from 'astro';
import {
	clearWikiEntryVisibilityOverride,
	computeEffectiveWikiEntryVisibility,
	getWikiEntryVisibilityOverrides,
	listWikiEntryInfos,
	setWikiEntryVisibilityOverride,
	type EntryVisibility,
} from '../../../lib/wiki-entry-visibility';
import {
	computeEffectiveCollectionVisibility,
	getWikiCollectionVisibilityOverrides,
	listWikiCollectionInfos,
} from '../../../lib/wiki-collection-visibility';

const VALID_VISIBILITY = new Set<EntryVisibility>(['user', 'admin']);

export const GET: APIRoute = async () => {
	try {
		const [entries, entryOverrides, collections, collectionOverrides] = await Promise.all([
			listWikiEntryInfos(),
			getWikiEntryVisibilityOverrides(),
			listWikiCollectionInfos(),
			getWikiCollectionVisibilityOverrides(),
		]);
		const collectionVisibility = computeEffectiveCollectionVisibility(collections, collectionOverrides);
		const effective = computeEffectiveWikiEntryVisibility(entries, entryOverrides, collectionVisibility, collections);

		const result = entries
			.map((entry) => ({
				id: entry.id,
				title: entry.title,
				collectionRef: entry.collectionRef ?? null,
				defaultVisibility: entry.defaultVisibility,
				overrideVisibility: entryOverrides[entry.id] ?? null,
				effectiveVisibility: effective.get(entry.id) ?? entry.defaultVisibility,
			}))
			.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

		return new Response(JSON.stringify({ entries: result }), {
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
			return new Response(JSON.stringify({ error: 'Entry id is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const entries = await listWikiEntryInfos();
		const knownEntry = entries.some((entry) => entry.id === id);
		if (!knownEntry) {
			return new Response(JSON.stringify({ error: 'Unknown entry id' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		if (mode === 'default') {
			await clearWikiEntryVisibilityOverride(id);
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

		await setWikiEntryVisibilityOverride(id, visibility);
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
