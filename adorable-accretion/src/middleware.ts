import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;

	// Resolve session from cookie (skipped when no cookie is present,
	// so static/prerendered routes are unaffected at build time).
	const sessionToken = context.cookies.get('session')?.value;
	if (sessionToken) {
		const session = await getSession(sessionToken);
		if (session) {
			context.locals.user = {
				username: session.username,
				role: session.role,
			};
		}
	}

	// ---- Protected: authenticated users only ----
	const needsAuth =
		pathname.startsWith('/tavern/library') ||
		pathname.startsWith('/api/library');

	if (needsAuth && !context.locals.user) {
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			});
		}
		return context.redirect('/tavern/login');
	}

	// ---- Protected: admin only ----
	const needsAdmin =
		pathname.startsWith('/tavern/admin') ||
		pathname.startsWith('/api/admin');

	if (needsAdmin) {
		if (!context.locals.user || context.locals.user.role !== 'admin') {
			if (pathname.startsWith('/api/')) {
				return new Response(JSON.stringify({ error: 'Forbidden' }), {
					status: 403,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			return context.redirect('/tavern/login');
		}
	}

	return next();
});
