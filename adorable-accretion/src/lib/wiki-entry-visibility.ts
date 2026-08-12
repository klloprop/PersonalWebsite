import { getCollection } from 'astro:content';
import { Redis } from '@upstash/redis';
import {
	resolveCollectionId,
	type CollectionInfo,
	type CollectionVisibility,
	type ViewerRole,
} from './wiki-collection-visibility';

export type EntryVisibility = 'user' | 'admin';

const ENTRY_VISIBILITY_KEY = 'tavern:wiki-entry-visibility';

export interface WikiEntryInfo {
	id: string;
	title: string;
	collectionRef?: string;
	defaultVisibility: EntryVisibility;
}

function getRedis() {
	return new Redis({
		url: import.meta.env.UPSTASH_REDIS_REST_URL,
		token: import.meta.env.UPSTASH_REDIS_REST_TOKEN,
	});
}

function hasRedisConfig(): boolean {
	return Boolean(import.meta.env.UPSTASH_REDIS_REST_URL && import.meta.env.UPSTASH_REDIS_REST_TOKEN);
}

function sanitizeVisibility(value: unknown): EntryVisibility {
	return value === 'admin' ? 'admin' : 'user';
}

export async function getWikiEntryVisibilityOverrides(): Promise<Record<string, EntryVisibility>> {
	if (!hasRedisConfig()) return {};
	try {
		const redis = getRedis();
		const raw = await redis.hgetall<Record<string, unknown>>(ENTRY_VISIBILITY_KEY);
		const normalized: Record<string, EntryVisibility> = {};
		for (const [id, value] of Object.entries(raw ?? {})) {
			normalized[id] = sanitizeVisibility(value);
		}
		return normalized;
	} catch {
		return {};
	}
}

export async function setWikiEntryVisibilityOverride(id: string, visibility: EntryVisibility): Promise<void> {
	if (!hasRedisConfig()) throw new Error('Redis is not configured');
	const redis = getRedis();
	await redis.hset(ENTRY_VISIBILITY_KEY, { [id]: visibility });
}

export async function clearWikiEntryVisibilityOverride(id: string): Promise<void> {
	if (!hasRedisConfig()) throw new Error('Redis is not configured');
	const redis = getRedis();
	await redis.hdel(ENTRY_VISIBILITY_KEY, id);
}

export async function listWikiEntryInfos(): Promise<WikiEntryInfo[]> {
	const entries = await getCollection('wiki');
	return entries.map((entry) => ({
		id: entry.id,
		title: entry.data.title,
		collectionRef: (entry.data as Record<string, unknown>).collectionId as string | undefined ?? entry.data.collection,
		defaultVisibility: sanitizeVisibility((entry.data as Record<string, unknown>).visibility),
	}));
}

export function computeEffectiveWikiEntryVisibility(
	entries: WikiEntryInfo[],
	overrides: Record<string, EntryVisibility>,
	collectionVisibility: Map<string, CollectionVisibility>,
	collections: CollectionInfo[],
): Map<string, EntryVisibility> {
	const map = new Map<string, EntryVisibility>();
	for (const entry of entries) {
		let required: EntryVisibility = sanitizeVisibility(overrides[entry.id] ?? entry.defaultVisibility);
		const collectionId = resolveCollectionId(entry.collectionRef, collections);
		if (collectionId) {
			const collectionRequired = collectionVisibility.get(collectionId) ?? 'user';
			if (collectionRequired === 'admin') {
				required = 'admin';
			}
		}
		map.set(entry.id, required);
	}
	return map;
}

export function canRoleViewWikiEntry(
	entryId: string,
	role: ViewerRole,
	effectiveVisibility: Map<string, EntryVisibility>,
): boolean {
	const required = effectiveVisibility.get(entryId) ?? 'user';
	if (required === 'user') return true;
	return role === 'admin';
}
