/**
 * content.config.ts — Content collection definitions.
 *
 * Collections:
 *  - blog            — Studio blog posts (Markdown/MDX) with optional gallery images.
 *  - blogCollections  — Blog category metadata with display order and cover images.
 *  - wiki            — Tavern wiki entries with optional tags and hero image positioning.
 *  - wikiCollections  — Wiki categories with parent-child hierarchy for tree navigation.
 *  - events          — Tavern session events with Berlin timezone dates.
 *
 * All collections use glob loaders pointed at src/content/ subdirectories.
 * Schemas are validated with Zod at build time.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			collection: z.string().optional(),
			galleryImages: z
				.array(
					z.object({
						src: image(),
						alt: z.string().optional().default(''),
						caption: z.string().optional(),
					})
				)
				.optional(),
		}),
});

const blogCollections = defineCollection({
	loader: glob({ base: './src/content/collections', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			name: z.string(),
			image: image(),
			description: z.string().optional(),
			order: z.number().optional().default(0),
		}),
});

const wiki = defineCollection({
	loader: glob({ base: './src/content/wiki', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			heroImagePosition: z.string().optional().default('center'),
			collection: z.string().optional(),
			tags: z.array(z.string()).optional(),
		}),
});

const wikiCollections = defineCollection({
	loader: glob({ base: './src/content/wiki-collections', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			name: z.string(),
			image: image(),
			description: z.string().optional(),
			order: z.number().optional().default(0),
			parent: z.string().optional(),
		}),
});

const events = defineCollection({
	loader: glob({ base: './src/content/events', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		// Date in YYYY-MM-DD format
		date: z.string(),
		// Time in HH:MM format (Berlin timezone, Europe/Berlin)
		time: z.string(),
		// Optional duration in minutes
		duration: z.number().optional(),
		// "main" or "optional" — defaults to "main"
		sessionType: z.enum(['main', 'optional']).optional().default('main'),
		// Whether the session has been cancelled
		cancelled: z.boolean().optional().default(false),
	}),
});

export const collections = { blog, blogCollections, wiki, wikiCollections, events };
