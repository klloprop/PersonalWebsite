import type { APIRoute } from 'astro';
import reference from '../../../../../NimbleApp/Nimble-Spellbook-Offline.html?raw';
import accountScript from '../../../lib/nimble-frame.js?raw';
import tavernStyle from '../../../styles/nimble-frame.css?raw';

export const prerender = false;

const hostedReference = reference
	.replace("style-src 'unsafe-inline'\"", "style-src 'unsafe-inline'; connect-src 'self'\"")
	.replace('</head>', () => `<style>${tavernStyle}</style>\n<script>${accountScript}</script>\n</head>`);

export const GET: APIRoute = ({ locals }) => {
	if (!locals.user) return new Response(null, { status: 401 });
	return new Response(hostedReference, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'private, no-store',
			'Content-Security-Policy': "frame-ancestors 'self'",
			'X-Frame-Options': 'SAMEORIGIN',
		},
	});
};
