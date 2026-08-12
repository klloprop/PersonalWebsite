import { getCollection } from 'astro:content';
import { Redis } from '@upstash/redis';

export type CollectionVisibility = 'user' | 'admin';
export type ViewerRole = 'user' | 'admin';

const VISIBILITY_KEY = 'tavern:wiki-collection-visibility';


export interface CollectionInfo {
	id: string;
	name: string;
	parentId?: string;
	defaultVisibility: CollectionVisibility;
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

function sanitizeVisibility(value: unknown): CollectionVisibility {
	return value === 'admin' ? 'admin' : 'user';
}

export async function getWikiCollectionVisibilityOverrides(): Promise<Record<string, CollectionVisibility>> {
	if (!hasRedisConfig()) return {};
	try {
		const redis = getRedis();
		const raw = await redis.hgetall<Record<string, unknown>>(VISIBILITY_KEY);
		const normalized: Record<string, CollectionVisibility> = {};
		for (const [id, value] of Object.entries(raw ?? {})) {
			normalized[id] = sanitizeVisibility(value);
		}
		return normalized;
	} catch {
		return {};
	}
}

export async function setWikiCollectionVisibilityOverride(
	id: string,
	visibility: CollectionVisibility,
): Promise<void> {
	if (!hasRedisConfig()) throw new Error('Redis is not configured');
	const redis = getRedis();
	await redis.hset(VISIBILITY_KEY, { [id]: visibility });
}

export async function clearWikiCollectionVisibilityOverride(id: string): Promise<void> {
	if (!hasRedisConfig()) throw new Error('Redis is not configured');
	const redis = getRedis();
	await redis.hdel(VISIBILITY_KEY, id);
}

export async function listWikiCollectionInfos(): Promise<CollectionInfo[]> {
	const entries = await getCollection('wikiCollections');
	const byId = new Map(entries.map((entry) => [entry.id, entry] as const));
	const byIdLower = new Map(entries.map((entry) => [entry.id.toLowerCase(), entry.id] as const));
	const byNameLower = new Map<string, string[]>();

	for (const entry of entries) {
		const key = entry.data.name.toLowerCase();
		const ids = byNameLower.get(key) ?? [];
		ids.push(entry.id);
		byNameLower.set(key, ids);
	}

	function commonPrefixScore(a: string, b: string): number {
		const pa = a.toLowerCase().split('/');
		const pb = b.toLowerCase().split('/');
		const limit = Math.min(pa.length, pb.length);
		let score = 0;
		for (let i = 0; i < limit; i++) {
			if (pa[i] !== pb[i]) break;
			score++;
		}
		return score;
	}

	function resolveParentId(currentId: string, parentName?: string, parentId?: string): string | undefined {
		if (parentId) {
			if (byId.has(parentId)) return parentId;
			const normalized = byIdLower.get(parentId.toLowerCase());
			if (normalized) return normalized;
		}
		if (!parentName) return undefined;
		const ids = byNameLower.get(parentName.toLowerCase()) ?? [];
		if (ids.length === 0) return undefined;
		if (ids.length === 1) return ids[0];

		const currentFolder = currentId.includes('/') ? currentId.slice(0, currentId.lastIndexOf('/')) : '';
		const sameFolder = ids.filter((id) => {
			const folder = id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '';
			return folder.toLowerCase() === currentFolder.toLowerCase();
		});
		if (sameFolder.length === 1) return sameFolder[0];

		const scored = ids
			.map((id) => ({ id, score: commonPrefixScore(currentId, id) }))
			.sort((a, b) => b.score - a.score);
		if (scored.length > 0 && scored[0].score > 0) {
			if (scored.length === 1 || scored[0].score > scored[1].score) {
				return scored[0].id;
			}
		}

		return undefined;
	}

	return entries.map((entry) => ({
		id: entry.id,
		name: entry.data.name,
		parentId: resolveParentId(
			entry.id,
			entry.data.parent,
			(entry.data as Record<string, unknown>).parentId as string | undefined,
		),
		defaultVisibility: sanitizeVisibility(entry.data.visibility),
	}));
}

export function resolveCollectionId(
	collectionRef: string | undefined,
	collections: CollectionInfo[],
): string | undefined {
	if (!collectionRef) return undefined;
	const byId = new Map(collections.map((col) => [col.id, col] as const));
	if (byId.has(collectionRef)) return collectionRef;

	const byIdLower = new Map(collections.map((col) => [col.id.toLowerCase(), col.id] as const));
	const byLowerHit = byIdLower.get(collectionRef.toLowerCase());
	if (byLowerHit) return byLowerHit;

	const normalizeSegment = (segment: string) =>
		segment.toLowerCase().replace(/[^a-z0-9]/g, '');
	const normalizeIdLike = (value: string) =>
		value
			.split('/')
			.map((part) => normalizeSegment(part))
			.join('/');

	const normalizedRef = normalizeIdLike(collectionRef);
	const normalizedIdMatches = collections.filter(
		(col) => normalizeIdLike(col.id) === normalizedRef,
	);
	if (normalizedIdMatches.length === 1) return normalizedIdMatches[0].id;

	const matches = collections.filter((col) => col.name.toLowerCase() === collectionRef.toLowerCase());
	if (matches.length === 1) return matches[0].id;
	return undefined;
}

export function computeEffectiveCollectionVisibility(
	collections: CollectionInfo[],
	overrides: Record<string, CollectionVisibility>,
): Map<string, CollectionVisibility> {
	const byId = new Map<string, CollectionInfo>();
	for (const col of collections) {
		byId.set(col.id, col);
	}

	const memo = new Map<string, CollectionVisibility>();
	const resolving = new Set<string>();

	function resolve(id: string): CollectionVisibility {
		const cached = memo.get(id);
		if (cached) return cached;
		const current = byId.get(id);
		if (!current) return 'user';

		if (resolving.has(id)) {
			const fallback = sanitizeVisibility(overrides[id] ?? current.defaultVisibility);
			memo.set(id, fallback);
			return fallback;
		}

		resolving.add(id);

		let visibility = sanitizeVisibility(overrides[id] ?? current.defaultVisibility);
		if (current.parentId && byId.has(current.parentId)) {
			const parentVisibility = resolve(current.parentId);
			if (parentVisibility === 'admin') {
				visibility = 'admin';
			}
		}

		resolving.delete(id);
		memo.set(id, visibility);
		return visibility;
	}

	for (const col of collections) {
		resolve(col.id);
	}

	return memo;
}

export function canRoleViewCollection(
	collectionRef: string | undefined,
	role: ViewerRole,
	effectiveVisibility: Map<string, CollectionVisibility>,
	collections: CollectionInfo[],
): boolean {
	if (!collectionRef) return true;
	const collectionId = resolveCollectionId(collectionRef, collections);
	if (!collectionId) return true;
	const required = effectiveVisibility.get(collectionId) ?? 'user';
	if (required === 'user') return true;
	return role === 'admin';
}
