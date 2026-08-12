# Wiki Root Folders (wiki_*)

This project supports multiple wiki content roots.

Examples:
- src/content/wiki_abaron/
- src/content/wiki_farside/
- src/content/wiki_mynewworld/

Any folder under src/content/ that starts with wiki_ is automatically included in the wiki collection.

## Current Rules

1. Folder naming
- Must start with wiki_
- Use lowercase and underscores (recommended), for example: wiki_farside

2. File format
- Use .md or .mdx files
- Keep normal frontmatter fields (title, description, pubDate, collection/collectionId, visibility, tags)

3. Slugs and edit paths
- Wiki page URLs still resolve by the last filename segment.
- For editing and API calls, include the root prefix in the slug when you want a specific root.
- Example edit path: /tavern/edit/wiki/wiki_farside/Characters/new-entry

4. Creating new entries
- In the editor, for new wiki entries, set Slug to either:
  - wiki_farside/Path/entry-name (explicit root), or
  - Path/entry-name (defaults to wiki_abaron)

## Add A New Wiki Root

1. Create a new folder in src/content:
- src/content/wiki_<name>/

2. Add markdown files inside that folder.

3. If needed, add or update matching collection metadata in src/content/wiki-collections/ so entries show in the sidebar hierarchy.

4. Restart the dev server after structural changes (new root folders) to ensure all tools and caches reload cleanly.

## Important Notes

- Keep entry filenames (last slug segment) unique across roots when possible.
- If two roots contain the same final slug filename, /tavern/wiki/<slug>/ can become ambiguous.
- Existing Abaron content is preserved under wiki_abaron and does not need to be rewritten.
