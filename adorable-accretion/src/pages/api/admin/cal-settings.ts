export const prerender = false;

import type { APIRoute } from 'astro';
import { Redis } from '@upstash/redis';

const REDIS_KEY = 'tavern:cal-settings';

type CalSettings = { dowOverride: number | null; dow2: number | null; extrapolate: boolean };
const DEFAULTS: CalSettings = { dowOverride: null, dow2: null, extrapolate: true };

function getRedis() {
	return new Redis({
		url: import.meta.env.UPSTASH_REDIS_REST_URL,
		token: import.meta.env.UPSTASH_REDIS_REST_TOKEN,
	});
}

export const GET: APIRoute = async () => {
	try {
		const redis = getRedis();
		const raw = await redis.get<CalSettings>(REDIS_KEY);
		return new Response(JSON.stringify({ ...DEFAULTS, ...(raw ?? {}) }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch {
		return new Response(JSON.stringify(DEFAULTS), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const POST: APIRoute = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return new Response(JSON.stringify({ error: 'Forbidden' }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const body = await request.json();
		const settings: CalSettings = {
			dowOverride: typeof body.dowOverride === 'number' ? body.dowOverride : null,
			dow2: typeof body.dow2 === 'number' ? body.dow2 : null,
			extrapolate: body.extrapolate !== false,
		};
		const redis = getRedis();
		await redis.set(REDIS_KEY, settings);
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
