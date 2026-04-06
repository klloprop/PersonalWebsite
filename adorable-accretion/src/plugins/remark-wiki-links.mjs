import { visit } from 'unist-util-visit';

/** Remark plugin: transforms [[slug]] and [[slug|text]] into wiki-link anchors. */
export function remarkWikiLinks() {
	return (tree) => {
		visit(tree, 'text', (node, index, parent) => {
			const regex = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;
			const value = node.value;
			let match;
			const children = [];
			let lastIndex = 0;

			while ((match = regex.exec(value)) !== null) {
				const [full, rawSlug, displayText] = match;
				const slug = rawSlug.trim().toLowerCase().replace(/\s+/g, '-');
				const text = displayText?.trim() || rawSlug.trim();

				// Text before this match
				if (match.index > lastIndex) {
					children.push({ type: 'text', value: value.slice(lastIndex, match.index) });
				}

				// Wiki link node
				children.push({
					type: 'link',
					url: `/tavern/wiki/${slug}/`,
					data: {
						hProperties: {
							class: 'wiki-link',
							'data-wiki-slug': slug,
						},
					},
					children: [{ type: 'text', value: text }],
				});

				lastIndex = match.index + full.length;
			}

			if (children.length > 0) {
				// Remaining text after last match
				if (lastIndex < value.length) {
					children.push({ type: 'text', value: value.slice(lastIndex) });
				}
				parent.children.splice(index, 1, ...children);
				return index + children.length;
			}
		});
	};
}
