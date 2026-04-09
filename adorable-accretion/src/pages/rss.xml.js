/**
 * rss.xml.js — RSS feed endpoint for blog posts.
 * Generates a standard RSS 2.0 feed from the blog content collection.
 */
import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function GET(context) {
	const posts = await getCollection('blog');
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => ({
			...post.data,
			link: `/studio/blog/${post.id}/`,
		})),
	});
}
