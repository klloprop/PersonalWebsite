import type { APIRoute } from 'astro';
import { getRedis, getUser, nimbleProfilesKey } from '../../../lib/auth';

export const prerender = false;

const maxPortraitLength = 24 * 1024;
const maxBytes = 64 * 1024 + maxPortraitLength;
const textFields = ['subclass', 'ancestry', 'background', 'secondBackground', 'backgroundSpell'];
const profileFields = new Set([
	...textFields, 'className', 'level', 'notePages', 'extraAbilities', 'picks', 'featurePicks', 'manaStats', 'sheet', 'portrait',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validName(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= 120 && value === value.trim();
}

function validProfile(profile: unknown): boolean {
	if (!isRecord(profile)) return false;
	const { className, level, notePages, extraAbilities, picks, featurePicks, manaStats, sheet, portrait } = profile;
	return Object.keys(profile).every((key) => profileFields.has(key)) &&
		typeof className === 'string' && className !== '' &&
		typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 20 &&
		textFields.every((key) => typeof profile[key] === 'string') &&
		Array.isArray(notePages) && notePages.length > 0 &&
		notePages.every((page) => isRecord(page) && typeof page.title === 'string' && typeof page.text === 'string') &&
		Array.isArray(extraAbilities) && extraAbilities.every((entry) => isRecord(entry) &&
			typeof entry.kind === 'string' && typeof entry.name === 'string' && typeof entry.description === 'string') &&
		isRecord(picks) && Object.values(picks).every((value) => typeof value === 'boolean') &&
		(portrait === undefined || (typeof portrait === 'string' && portrait.length <= maxPortraitLength &&
			/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(portrait))) &&
		(sheet === undefined || (isRecord(sheet) && Object.keys(sheet).length <= 240 &&
			Object.entries(sheet).every(([key, value]) => key.length <= 512 && typeof value === 'string' && value.length <= 4000))) &&
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

// Validate the account and update, rename, or delete one character atomically.
const mutateProfile = `
	local account = redis.call('GET', KEYS[1])
	if not account or cjson.decode(account).createdAt ~= tonumber(ARGV[1]) then return -1 end
	local source, target = ARGV[2], ARGV[3]
	if source ~= '' and redis.call('HEXISTS', KEYS[2], source) == 0 then return 0 end
	if target == '' then
		return redis.call('HDEL', KEYS[2], source)
	end
	if target ~= source and redis.call('HEXISTS', KEYS[2], target) == 1 then return -2 end
	redis.call('HSET', KEYS[2], target, ARGV[4])
	if source ~= '' and source ~= target then redis.call('HDEL', KEYS[2], source) end
	return 1
`;

const mutate: APIRoute = async ({ request, url, locals }) => {
	if (!locals.user) return unauthorized();
	const deleting = request.method === 'DELETE';
	if (request.headers.get('Origin') !== url.origin) {
		return json({ error: 'Manage characters from the Tavern Library.' }, 403);
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
	if (!isRecord(data) || !validName(data.name) || (!deleting &&
		((data.previousName !== null && !validName(data.previousName)) || !validProfile(data.profile)))) {
		return json({ error: 'Invalid character profile. Check that the name is 1–120 characters and a class is selected.' }, 400);
	}

	try {
		const account = await getUser(locals.user.username);
		if (!account || locals.user.sessionStartedAt < account.createdAt) return unauthorized();
		const source = deleting ? data.name : data.previousName;
		const result = await getRedis().eval<[number, string, string, string], number>(
			mutateProfile,
			[`user:${account.username}`, nimbleProfilesKey(account)],
			[account.createdAt, source === null ? '' : `:${source}`, deleting ? '' : `:${data.name}`,
				deleting ? '' : JSON.stringify(data.profile)],
		);
		if (result === -1) return unauthorized();
		if (result === -2) return json({ error: 'A character with that name already exists. Choose a different name.' }, 409);
		if (result === 0) return json({ error: 'This character no longer exists in your account. Reload the Library to refresh the list.' }, 409);
		return deleting ? json({ deleted: true }) : json({ saved: true });
	} catch (error) {
		console.error(`Failed to ${deleting ? 'delete' : 'save'} a Nimble profile:`, error instanceof Error ? error.name : 'Unknown error');
		return json({ error: deleting ? 'Could not delete your character. Try again.'
			: 'Could not save your character. Your changes are still on screen; try again.' }, 503);
	}
};

export const PUT = mutate;
export const DELETE = mutate;
