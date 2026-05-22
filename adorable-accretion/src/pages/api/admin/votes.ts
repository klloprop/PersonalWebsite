export const prerender = false;

import type { APIRoute } from 'astro';
import { Redis } from '@upstash/redis';

function getRedis() {
	return new Redis({
		url: import.meta.env.UPSTASH_REDIS_REST_URL,
		token: import.meta.env.UPSTASH_REDIS_REST_TOKEN,
	});
}

function redisKey(eventId: string) {
	return `availability:${eventId}`;
}

// DELETE /api/admin/votes — clears all votes for a given eventId
// Body: { eventId: "session-52" }
export const DELETE: APIRoute = async ({ request }) => {
	try {
		const { eventId } = await request.json();

		if (!eventId || typeof eventId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(eventId)) {
			return new Response(JSON.stringify({ error: 'Invalid eventId' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const redis = getRedis();
		await redis.del(redisKey(eventId));

		return new Response(JSON.stringify({ ok: true, cleared: eventId }), {
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
