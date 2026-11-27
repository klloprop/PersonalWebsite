import type { APIRoute } from 'astro';
import reference from '../../../../../NimbleApp/Nimble-Spellbook-Offline.html?raw';
import accountScript from '../../../lib/nimble-frame.js?raw';
import tavernStyle from '../../../styles/nimble-frame.css?raw';

export const prerender = false;

const hostedReference = reference
	.replace(/(<meta http-equiv="Content-Security-Policy" content="[^"]*)"/, "$1; connect-src 'self'\"")
	.replace('</head>', () => `<style>${tavernStyle}</style>\n</head>`);

export const GET: APIRoute = ({ locals }) => {
	if (!locals.user) return new Response(null, { status: 401 });
	const profileScope = encodeURIComponent(locals.user.username);
	const html = hostedReference.replace('</head>', () =>
		`<script data-profile-scope="${profileScope}">${accountScript}</script>\n</head>`);
	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'private, no-store',
			'Content-Security-Policy': "frame-ancestors 'self'",
			'X-Frame-Options': 'SAMEORIGIN',
		},
	});
};
