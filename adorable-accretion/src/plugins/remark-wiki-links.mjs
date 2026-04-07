import { visit } from 'unist-util-visit';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Scan all wiki markdown files and build a map of title → slug.
 * Cached so it only reads the filesystem once per build.
 */
let titleMapCache = null;
let titleRegexCache = null;

function buildTitleMap() {
	if (titleMapCache) return { titleMap: titleMapCache, titleRegex: titleRegexCache };

	const wikiDir = path.resolve('./src/content/wiki');
	const map = new Map(); // lowercase title → { title, slug }

	if (!fs.existsSync(wikiDir)) return { titleMap: map, titleRegex: null };

	function scanDir(dir) {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				scanDir(path.join(dir, entry.name));
				continue;
			}
			if (!entry.name.endsWith('.md') && !entry.name.endsWith('.mdx')) continue;
			const content = fs.readFileSync(path.join(dir, entry.name), 'utf-8');
			const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
			if (!fmMatch) continue;

			const titleMatch = fmMatch[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
			if (!titleMatch) continue;

			const title = titleMatch[1];
			const slug = entry.name.replace(/\.(md|mdx)$/, '').toLowerCase().replace(/\s+/g, '-');
			map.set(title.toLowerCase(), { title, slug });

			// Parse tags from frontmatter and add as aliases
			const tagsMatch = fmMatch[1].match(/^tags:\s*\[([^\]]+)\]/m)
				|| fmMatch[1].match(/^tags:\s*\n((?:\s*-\s*.+\n?)+)/m);
			if (tagsMatch) {
				let tags = [];
				if (tagsMatch[1].includes(',')) {
					// Inline array: tags: ["dros", "pupil"]
					tags = tagsMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, ''));
				} else if (tagsMatch[1].includes('-')) {
					// YAML list:
					// tags:
					//   - dros
					tags = tagsMatch[1].split('\n').map(t => t.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, '')).filter(Boolean);
				} else {
					// Single item inline: tags: ["dros"]
					tags = [tagsMatch[1].trim().replace(/^["']|["']$/g, '')];
				}
				for (const tag of tags) {
					if (tag && !map.has(tag.toLowerCase())) {
						map.set(tag.toLowerCase(), { title: tag, slug });
					}
				}
			}
		}
	}

	scanDir(wikiDir);

	titleMapCache = map;

	// Build a regex that matches any title/tag (longest first to avoid partial matches)
	if (map.size > 0) {
		const titles = [...map.values()]
			.map((v) => v.title)
			.sort((a, b) => b.length - a.length);
		// Deduplicate (multiple tags can map to the same title text)
		const unique = [...new Set(titles)];
		const escaped = unique.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
		titleRegexCache = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
	}

	return { titleMap: titleMapCache, titleRegex: titleRegexCache };
}

/** Remark plugin: transforms [[slug]] and [[slug|text]] into wiki-link anchors,
 *  and auto-links wiki entry titles found in text. */
export function remarkWikiLinks() {
	// Reset cache when plugin is re-initialized (dev server restart)
	titleMapCache = null;
	titleRegexCache = null;

	return (tree, file) => {
		const { titleMap, titleRegex } = buildTitleMap();

		// Determine the current file's slug so we don't self-link
		let currentSlug = null;
		if (file?.history?.[0]) {
			const basename = path.basename(file.history[0]).replace(/\.(md|mdx)$/, '');
			currentSlug = basename.toLowerCase().replace(/\s+/g, '-');
		}

		// Track which titles have already been auto-linked in this document
		const autoLinked = new Set();

		visit(tree, 'text', (node, index, parent) => {
			// Don't process text inside existing links
			if (parent?.type === 'link') return;

			let value = node.value;
			const children = [];
			let lastIndex = 0;

			// ── Pass 1: Explicit [[slug]] / [[slug|text]] ──
			const bracketRegex = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;
			let match;
			while ((match = bracketRegex.exec(value)) !== null) {
				const [full, rawSlug, displayText] = match;
				const slug = rawSlug.trim().toLowerCase().replace(/\s+/g, '-');
				const text = displayText?.trim() || rawSlug.trim();

				if (match.index > lastIndex) {
					children.push({ type: 'text', value: value.slice(lastIndex, match.index) });
				}

				children.push(makeWikiLink(slug, text));
				autoLinked.add(slug); // Don't auto-link this title again
				lastIndex = match.index + full.length;
			}

			if (children.length > 0) {
				if (lastIndex < value.length) {
					children.push({ type: 'text', value: value.slice(lastIndex) });
				}
				parent.children.splice(index, 1, ...children);
				// Continue processing the remaining text nodes for auto-linking
				// by returning the new count
				return index + children.length;
			}

			// ── Pass 2: Auto-link wiki titles ──
			if (!titleRegex) return;

			// Reset regex state
			titleRegex.lastIndex = 0;
			const parts = [];
			let lastIdx = 0;

			while ((match = titleRegex.exec(value)) !== null) {
				const matchedText = match[0];
				const entry = titleMap.get(matchedText.toLowerCase());
				if (!entry) continue;

				// Skip self-links
				if (entry.slug === currentSlug) continue;

				if (match.index > lastIdx) {
					parts.push({ type: 'text', value: value.slice(lastIdx, match.index) });
				}

				parts.push(makeWikiLink(entry.slug, matchedText));
				lastIdx = match.index + matchedText.length;
			}

			if (parts.length > 0) {
				if (lastIdx < value.length) {
					parts.push({ type: 'text', value: value.slice(lastIdx) });
				}
				parent.children.splice(index, 1, ...parts);
				return index + parts.length;
			}
		});
	};
}

function makeWikiLink(slug, text) {
	return {
		type: 'link',
		url: `/tavern/wiki/${slug}/`,
		data: {
			hProperties: {
				class: 'wiki-link',
				'data-wiki-slug': slug,
			},
		},
		children: [{ type: 'text', value: text }],
	};
}
