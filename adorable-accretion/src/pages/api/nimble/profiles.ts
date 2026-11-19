import type { APIRoute } from 'astro';
import { getRedis, getUser, nimbleProfilesKey } from '../../../lib/auth';

export const prerender = false;

const maxBytes = 64 * 1024;
const textFields = ['subclass', 'ancestry', 'background', 'secondBackground', 'backgroundSpell'];
const profileFields = new Set([
	...textFields, 'className', 'level', 'notePages', 'extraAbilities', 'picks', 'featurePicks', 'manaStats',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validProfile(profile: unknown): boolean {
	if (!isRecord(profile)) return false;
	const { className, level, notePages, extraAbilities, picks, featurePicks, manaStats } = profile;
	return Object.keys(profile).every((key) => profileFields.has(key)) &&
		typeof className === 'string' && className !== '' &&
		typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 20 &&
		textFields.every((key) => typeof profile[key] === 'string') &&
		Array.isArray(notePages) && notePages.length > 0 &&
		notePages.every((page) => isRecord(page) && typeof page.title === 'string' && typeof page.text === 'string') &&
		Array.isArray(extraAbilities) && extraAbilities.every((entry) => isRecord(entry) &&
			typeof entry.kind === 'string' && typeof entry.name === 'string' && typeof entry.description === 'string') &&
		isRecord(picks) && Object.values(picks).every((value) => typeof value === 'boolean') &&
		[featurePicks, manaStats].every((map) => isRecord(map) &&
			Object.values(map).every((value) => typeof value === 'string'));
}

async function accountKey(locals: App.Locals) {
	if (!locals.user) return null;
	const account = await getUser(locals.user.username);
	return account && locals.user.sessionStartedAt >= account.createdAt ? nimbleProfilesKey(account) : null;
}

function json(body: unknown, status = 200) {
	return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

const unauthorized = () => json({ error: 'Your Tavern session has expired. Sign in again to access your characters.' }, 401);

export const GET: APIRoute = async ({ locals }) => {
	try {
		const key = await accountKey(locals);
		if (!key) return unauthorized();
		const profiles = await getRedis().hgetall(key);
		return json({ profiles: Object.fromEntries(
			Object.entries(profiles ?? {}).map(([field, value]) => [field.slice(1), value]),
		) });
	} catch (error) {
		console.error('Failed to load Nimble profiles:', error instanceof Error ? error.name : 'Unknown error');
		return json({ error: 'Could not load your Tavern characters. Reload the Library to try again.' }, 503);
	}
};

// Check the account and write only the affected character in one operation.
const saveProfile = `
	local account = redis.call('GET', KEYS[1])
	if not account or cjson.decode(account).createdAt ~= tonumber(ARGV[4]) then return -1 end
	local exists = redis.call('HEXISTS', KEYS[2], ARGV[1])
	if exists ~= tonumber(ARGV[3]) then return 0 end
	redis.call('HSET', KEYS[2], ARGV[1], ARGV[2])
	return 1
`;

export const PUT: APIRoute = async ({ request, url, locals }) => {
	if (!locals.user) return unauthorized();
	if (request.headers.get('Origin') !== url.origin) {
		return json({ error: 'Save characters from the Tavern Library.' }, 403);
	}
	if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') {
		return json({ error: 'Expected a JSON character profile.' }, 415);
	}
	const tooLarge = () => json({ error: 'This character is too large to save. Shorten its notes and try again.' }, 413);
	if (Number(request.headers.get('Content-Length')) > maxBytes) return tooLarge();

	let data: unknown;
	try {
		const body = await request.arrayBuffer();
		if (body.byteLength > maxBytes) return tooLarge();
		data = JSON.parse(new TextDecoder().decode(body));
	} catch {
		return json({ error: 'Could not read the character profile.' }, 400);
	}
	if (!isRecord(data) || typeof data.name !== 'string' || !data.name ||
		data.name !== data.name.trim() || data.name.length > 120 || typeof data.overwrite !== 'boolean' ||
		!validProfile(data.profile)) {
		return json({ error: 'Invalid character profile. Check that the name is 1–120 characters and a class is selected.' }, 400);
	}

	try {
		const account = await getUser(locals.user.username);
		if (!account || locals.user.sessionStartedAt < account.createdAt) return unauthorized();
		const result = await getRedis().eval<[string, string, number, number], number>(
			saveProfile,
			[`user:${account.username}`, nimbleProfilesKey(account)],
			[`:${data.name}`, JSON.stringify(data.profile), data.overwrite ? 1 : 0, account.createdAt],
		);
		if (result === -1) return unauthorized();
		if (result === 0) return json({ error: 'Your saved characters have changed. Use a different name or reload the Library to see the latest list.' }, 409);
		return json({ saved: true });
	} catch (error) {
		console.error('Failed to save a Nimble profile:', error instanceof Error ? error.name : 'Unknown error');
		return json({ error: 'Could not save your character. Your changes are still on screen; try again.' }, 503);
	}
};
