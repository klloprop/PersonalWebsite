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
	adapter: vercel(),
	integrations: [mdx(), sitemap()],
	markdown: {
		remarkPlugins: [remarkWikiLinks],
	},
});
