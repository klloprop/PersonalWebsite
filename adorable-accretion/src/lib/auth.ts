/**
 * auth.ts — Core authentication utilities.
 *
 * Uses Upstash Redis for storage and Web Crypto PBKDF2 for password hashing.
 * No additional dependencies required.
 */

import { Redis } from '@upstash/redis';

// ---------------------------------------------------------------------------
// Redis
// ---------------------------------------------------------------------------

function getRedis() {
	return new Redis({
		url: import.meta.env.UPSTASH_REDIS_REST_URL,
		token: import.meta.env.UPSTASH_REDIS_REST_TOKEN,
	});
}

// ---------------------------------------------------------------------------
// Password hashing (PBKDF2 via Web Crypto)
// ---------------------------------------------------------------------------

async function hashPassword(
	password: string,
	existingSalt?: Uint8Array,
): Promise<{ hash: string; salt: string }> {
	const salt = existingSalt ?? crypto.getRandomValues(new Uint8Array(16));
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits'],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
		keyMaterial,
		256,
	);
	return {
		hash: Buffer.from(bits).toString('hex'),
		salt: Buffer.from(salt).toString('hex'),
	};
}

function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

async function verifyPassword(
	password: string,
	storedHash: string,
	storedSalt: string,
): Promise<boolean> {
	const saltBytes = new Uint8Array(Buffer.from(storedSalt, 'hex'));
	const result = await hashPassword(password, saltBytes);
	return constantTimeEqual(result.hash, storedHash);
}

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

export interface User {
	username: string;
	passwordHash: string | null;
	salt: string | null;
	role: 'admin' | 'user';
	createdAt: number;
}

export async function createUser(
	username: string,
	role: 'admin' | 'user' = 'user',
): Promise<{ setupToken: string }> {
	const redis = getRedis();
	const existing = await redis.get(`user:${username}`);
	if (existing) throw new Error('User already exists');

	const user: User = {
		username,
		passwordHash: null,
		salt: null,
		role,
		createdAt: Date.now(),
	};

	await redis.set(`user:${username}`, user);
	await redis.sadd('users:index', username);

	// One-time setup token, valid 24 h
	const token = crypto.randomUUID();
	await redis.set(
		`token:${token}`,
		{ username, type: 'setup', createdAt: Date.now() },
		{ ex: 86_400 },
	);
	return { setupToken: token };
}

export async function getUser(username: string): Promise<User | null> {
	return getRedis().get<User>(`user:${username}`);
}

export async function listUsers(): Promise<string[]> {
	return getRedis().smembers('users:index');
}

export async function deleteUser(username: string): Promise<void> {
	const redis = getRedis();
	await redis.del(`user:${username}`);
	await redis.srem('users:index', username);
}

export async function setUserPassword(
	username: string,
	password: string,
): Promise<void> {
	const redis = getRedis();
	const user = await getUser(username);
	if (!user) throw new Error('User not found');
	const { hash, salt } = await hashPassword(password);
	await redis.set(`user:${username}`, { ...user, passwordHash: hash, salt });
}

export async function authenticate(
	username: string,
	password: string,
): Promise<User | null> {
	const user = await getUser(username);
	if (!user?.passwordHash || !user.salt) return null;
	const valid = await verifyPassword(password, user.passwordHash, user.salt);
	return valid ? user : null;
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export interface Session {
	username: string;
	role: string;
	createdAt: number;
}

const SESSION_TTL = 604_800; // 7 days

export async function createSession(
	username: string,
	role: string,
): Promise<string> {
	const token = crypto.randomUUID();
	await getRedis().set(
		`session:${token}`,
		{ username, role, createdAt: Date.now() } satisfies Session,
		{ ex: SESSION_TTL },
	);
	return token;
}

export async function getSession(token: string): Promise<Session | null> {
	return getRedis().get<Session>(`session:${token}`);
}

export async function deleteSession(token: string): Promise<void> {
	await getRedis().del(`session:${token}`);
}

// ---------------------------------------------------------------------------
// Setup / reset tokens
// ---------------------------------------------------------------------------

export interface SetupToken {
	username: string;
	type: 'setup' | 'reset';
	createdAt: number;
}

export async function createResetToken(username: string): Promise<string> {
	const redis = getRedis();
	const user = await getUser(username);
	if (!user) throw new Error('User not found');
	const token = crypto.randomUUID();
	await redis.set(
		`token:${token}`,
		{ username, type: 'reset', createdAt: Date.now() } satisfies SetupToken,
		{ ex: 3_600 }, // 1 h
	);
	return token;
}

export async function getSetupToken(
	token: string,
): Promise<SetupToken | null> {
	return getRedis().get<SetupToken>(`token:${token}`);
}

export async function consumeToken(token: string): Promise<void> {
	await getRedis().del(`token:${token}`);
}

// ---------------------------------------------------------------------------
// Library resources (stored as Redis hash)
// ---------------------------------------------------------------------------

export interface LibraryResource {
	id: string;
	title: string;
	description: string;
	url: string;
	category: string;
	addedAt: number;
	addedBy: string;
}

export async function addResource(
	resource: Omit<LibraryResource, 'id' | 'addedAt'>,
): Promise<LibraryResource> {
	const id = crypto.randomUUID();
	const full: LibraryResource = { ...resource, id, addedAt: Date.now() };
	await getRedis().hset('library:resources', { [id]: JSON.stringify(full) });
	return full;
}

export async function listResources(): Promise<LibraryResource[]> {
	const data = await getRedis().hgetall<Record<string, string>>(
		'library:resources',
	);
	if (!data) return [];
	return Object.values(data).map((v) =>
		typeof v === 'string' ? JSON.parse(v) : v,
	);
}

export async function deleteResource(id: string): Promise<void> {
	await getRedis().hdel('library:resources', id);
}
