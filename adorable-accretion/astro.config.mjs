// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { defineConfig } from 'astro/config';
import { remarkWikiLinks } from './src/plugins/remark-wiki-links.mjs';

// https://astro.build/config
export default defineConfig({
	site: 'https://lucieswebsite.vercel.app',
	output: 'static',
	adapter: vercel({
		isr: {
			// Cache SSR pages for 60 seconds; resets on each new deployment
			expiration: 60,
			// On-demand revalidation token (set ISR_BYPASS_TOKEN env var to enable)
			bypassToken: process.env.ISR_BYPASS_TOKEN,
			// Exclude dynamic/auth routes from ISR caching
			exclude: [
				/^\/api\//,
				/^\/tavern\/edit\//,
				/^\/tavern\/login/,
				/^\/tavern\/admin/,
				/^\/tavern\/set-password/,
				/^\/tavern\/scheduling/,
			],
		},
	}),
	integrations: [mdx(), sitemap()],
	markdown: {
		remarkPlugins: [remarkWikiLinks],
	},
});
