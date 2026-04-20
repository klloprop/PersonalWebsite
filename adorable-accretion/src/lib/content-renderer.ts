/**
 * content-renderer.ts — Runtime markdown rendering for wiki/blog pages.
 *
 * Fetches raw markdown from GitHub and renders it to HTML using `marked`,
 * bypassing Astro's build-time content collections for instant updates.
 *
 * Wiki links ([[slug]], [[slug|text]]) and auto-linking of wiki titles
 * are handled via a custom marked extension that mirrors the remark plugin.
 *
 * Image paths are resolved from relative `../../assets/` references to their
 * Astro-optimized URLs (built at deploy time via import.meta.glob).
 *
 * In dev mode, reads files from the local filesystem instead of GitHub.
 */
import { Marked } from 'marked';
import { getCollection } from 'astro:content';
import { readFile as readGitHubFile } from './github';
import fs from 'node:fs/promises';
import nodePath from 'node:path';

// ── Build-time image map (baked into the bundle by Vite) ──

const imageModules = import.meta.glob<{ default: ImageMetadata }>(
	'/src/assets/WikiImages/**/*.{png,jpg,jpeg,gif,webp,svg}',
	{ eager: true },
);

const imageUrlMap = new Map<string, string>();
for (const [path, mod] of Object.entries(imageModules)) {
	// path: "/src/assets/WikiImages/Hexapod.png" → key: "WikiImages/Hexapod.png"
	const key = path.replace('/src/assets/', '');
	imageUrlMap.set(key.toLowerCase(), mod.default.src);
}

/** Resolve a relative image src (from markdown) to an optimized asset URL. */
function resolveImageSrc(src: string): string {
	// Match any relative path ending in assets/WikiImages/...
	const match = src.match(/assets\/WikiImages\/(.+)$/);
	if (match) {
		const key = `WikiImages/${match[1]}`.toLowerCase();
		return imageUrlMap.get(key) ?? src;
	}
	return src;
}

// ── File reading (dev: filesystem, prod: GitHub API) ──

async function readContentFile(
	filePath: string,
): Promise<{ content: string; sha: string } | null> {
	if (import.meta.env.DEV) {
		try {
			const fullPath = nodePath.join(process.cwd(), filePath);
			const content = await fs.readFile(fullPath, 'utf-8');
			return { content, sha: 'local' };
		} catch {
			// Fall through to GitHub in case dev has a token
		}
	}
	return readGitHubFile(filePath);
}

// ── Frontmatter parsing ──

export interface ParsedContent {
	frontmatter: Record<string, string>;
	body: string;
}

export function parseFrontmatter(raw: string): ParsedContent {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) return { frontmatter: {}, body: raw };

	const fm: Record<string, string> = {};
	for (const line of match[1].split('\n')) {
		const idx = line.indexOf(':');
		if (idx < 0) continue;
		const key = line.slice(0, idx).trim();
		let val = line.slice(idx + 1).trim();
		// Strip surrounding quotes
		if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
			val = val.slice(1, -1);
		}
		fm[key] = val;
	}

	return { frontmatter: fm, body: match[2] };
}

// ── Wiki title map (built from content collection, cached per request) ──

interface WikiEntry {
	title: string;
	slug: string;
}

let titleMapPromise: Promise<Map<string, WikiEntry>> | null = null;

async function getTitleMap(): Promise<Map<string, WikiEntry>> {
	if (titleMapPromise) return titleMapPromise;

	titleMapPromise = (async () => {
		const map = new Map<string, WikiEntry>();
		try {
			const entries = await getCollection('wiki');
			for (const entry of entries) {
				const title = entry.data.title;
				const slug = entry.id.split('/').pop()!;
				map.set(title.toLowerCase(), { title, slug });

				// Also index tags as aliases
				const tags = (entry.data as Record<string, unknown>).tags;
				if (Array.isArray(tags)) {
					for (const tag of tags) {
						if (typeof tag === 'string' && !map.has(tag.toLowerCase())) {
							map.set(tag.toLowerCase(), { title: tag, slug });
						}
					}
				}
			}
		} catch {
			// Content collection may not be available
		}
		return map;
	})();

	return titleMapPromise;
}

// ── Marked extension for wiki links ──

function wikiLinkExtension(titleMap: Map<string, WikiEntry>, currentSlug?: string) {
	return {
		extensions: [
			{
				name: 'wikiLink',
				level: 'inline' as const,
				start(src: string) {
					return src.indexOf('[[');
				},
				tokenizer(src: string) {
					const match = src.match(/^\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/);
					if (!match) return undefined;
						// Preserve original casing — the [slug].astro lookup is case-insensitive.
						// Spaces are still replaced with hyphens to keep URLs valid.
						const rawSlug = match[1].trim().replace(/\s+/g, '-');
					const text = match[2]?.trim() || match[1].trim();
					return {
						type: 'wikiLink',
						raw: match[0],
						slug: rawSlug,
						text,
					};
				},
				renderer(token: { slug: string; text: string }) {
					return `<a class="wiki-link" data-wiki-slug="${token.slug}" href="/tavern/wiki/${token.slug}/">${escapeHtml(token.text)}</a>`;
				},
			},
		],
	};
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Auto-link wiki titles in rendered HTML.
 * Scans text content (outside of existing tags) and wraps matching titles
 * in wiki-link anchors. Only links each title once.
 */
function autoLinkTitles(
	html: string,
	titleMap: Map<string, WikiEntry>,
	currentSlug?: string,
): string {
	if (titleMap.size === 0) return html;

	const titles = [...titleMap.values()]
		.map((v) => v.title)
		.sort((a, b) => b.length - a.length);
	const unique = [...new Set(titles)];
	const escaped = unique.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	const titleRegex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');

	const linked = new Set<string>();

	// Split HTML into tags and text segments, only process text
	return html.replace(/(<[^>]+>)|([^<]+)/g, (_, tag, text) => {
		if (tag) return tag;
		if (!text) return '';

		return text.replace(titleRegex, (match: string) => {
			const entry = titleMap.get(match.toLowerCase());
			if (!entry) return match;
			if (entry.slug === currentSlug) return match;
			if (linked.has(entry.slug)) return match;
			linked.add(entry.slug);
			return `<a class="wiki-link" data-wiki-slug="${entry.slug}" href="/tavern/wiki/${entry.slug}/">${escapeHtml(match)}</a>`;
		});
	});
}

// ── Main render function ──

export interface RenderedContent {
	html: string;
	frontmatter: Record<string, string>;
	sha: string;
}

/**
 * Fetch a content file and render it to HTML.
 *
 * In dev mode reads from the local filesystem; in production from GitHub.
 *
 * @param type - 'wiki' or 'blog'
 * @param filePath - Original-cased file path relative to project root
 *                   e.g. "src/content/wiki/Characters/CoreNPCs/vhaeraun.md"
 * @param currentSlug - The current page slug (to avoid self-linking)
 */
export async function renderFromGitHub(
	type: string,
	filePath: string,
	currentSlug?: string,
): Promise<RenderedContent | null> {
	const file = await readContentFile(filePath);
	if (!file) return null;

	const { frontmatter, body } = parseFrontmatter(file.content);

	const titleMap = type === 'wiki' ? await getTitleMap() : new Map<string, WikiEntry>();

	const marked = new Marked();
	marked.use(wikiLinkExtension(titleMap, currentSlug));

	// Custom image renderer to resolve relative asset paths
	marked.use({
		renderer: {
			image({ href, title, text }) {
				const src = resolveImageSrc(href);
				const alt = text ? ` alt="${escapeHtml(text)}"` : '';
				const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
				return `<img src="${escapeHtml(src)}"${alt}${titleAttr} />`;
			},
		},
	});

	let html = await marked.parse(body);

	// Auto-link wiki titles in the rendered HTML (only for wiki pages)
	if (type === 'wiki') {
		html = autoLinkTitles(html, titleMap, currentSlug);
	}

	return { html, frontmatter, sha: file.sha };
}
