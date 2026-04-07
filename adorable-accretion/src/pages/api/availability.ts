export const prerender = false;

import type { APIRoute } from 'astro';
import { Redis } from '@upstash/redis';

function getRedis() {
	return new Redis({
		url: import.meta.env.UPSTASH_REDIS_REST_URL,
		token: import.meta.env.UPSTASH_REDIS_REST_TOKEN,
	});
}

type AvailabilityStatus =
	| 'can-make-it'
	| 'low-energy'
	| 'cannot-play-without'
	| 'cannot-do-not-play';

interface VoteRecord {
	status: AvailabilityStatus;
	timestamp: number;
}

function redisKey(eventId: string) {
	return `availability:${eventId}`;
}

// GET /api/availability?eventId=session-42
// Returns: { votes: { "can-make-it": 2, "low-energy": 1, ... }, myVote: "can-make-it" | null }
export const GET: APIRoute = async ({ request, cookies }) => {
	const url = new URL(request.url);
	const eventId = url.searchParams.get('eventId');

	if (!eventId) {
		return new Response(JSON.stringify({ error: 'eventId is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const redis = getRedis();
		const data = await redis.hgetall(redisKey(eventId));

		// Tally votes by status
		const tally: Record<string, number> = {
			'can-make-it': 0,
			'low-energy': 0,
			'cannot-play-without': 0,
			'cannot-do-not-play': 0,
		};

		if (data) {
			for (const [, record] of Object.entries(data)) {
				const vote = record as unknown as VoteRecord;
				if (vote.status && tally[vote.status] !== undefined) {
					tally[vote.status]++;
				}
			}
		}

		// Check if this browser has voted (via cookie)
		const visitorId = cookies.get('avail_visitor')?.value || null;
		let myVote: string | null = null;
		if (visitorId && data) {
			const myRecord = data[visitorId] as unknown as VoteRecord | undefined;
			if (myRecord?.status) {
				myVote = myRecord.status;
			}
		}

		return new Response(JSON.stringify({ votes: tally, myVote }), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (e) {
		console.error('Redis GET error:', e);
		return new Response(JSON.stringify({ error: 'Failed to fetch availability' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

// POST /api/availability
// Body: { eventId: "session-42", status: "can-make-it" }
export const POST: APIRoute = async ({ request, cookies }) => {
	let body: { eventId?: string; status?: string };
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const { eventId, status } = body;
	const validStatuses: AvailabilityStatus[] = [
		'can-make-it',
		'low-energy',
		'cannot-play-without',
		'cannot-do-not-play',
	];

	if (!eventId || !status || !validStatuses.includes(status as AvailabilityStatus)) {
		return new Response(JSON.stringify({ error: 'Invalid eventId or status' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	// Get or create visitor ID from cookie
	let visitorId = cookies.get('avail_visitor')?.value;
	if (!visitorId) {
		visitorId = crypto.randomUUID();
		cookies.set('avail_visitor', visitorId, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365, // 1 year
		});
	}

	try {
		const redis = getRedis();
		const record: VoteRecord = {
			status: status as AvailabilityStatus,
			timestamp: Date.now(),
		};

		await redis.hset(redisKey(eventId), { [visitorId]: record });

		// Return updated tally
		const data = await redis.hgetall(redisKey(eventId));
		const tally: Record<string, number> = {
			'can-make-it': 0,
			'low-energy': 0,
			'cannot-play-without': 0,
			'cannot-do-not-play': 0,
		};

		if (data) {
			for (const [, record] of Object.entries(data)) {
				const vote = record as unknown as VoteRecord;
				if (vote.status && tally[vote.status] !== undefined) {
					tally[vote.status]++;
				}
			}
		}

		return new Response(JSON.stringify({ votes: tally, myVote: status }), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (e) {
		console.error('Redis POST error:', e);
		return new Response(JSON.stringify({ error: 'Failed to save vote' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
