# Lucy's Blog — v1.0.0

A personal website with two themed sections — **Studio** (diary-style blog & photo gallery) and **Tavern** (D&D wiki & session scheduling). Built with [Astro](https://astro.build) and deployed on [Vercel](https://vercel.com).

## Features

- **Two themed sections** with distinct colour palettes (Studio = pink/purple, Tavern = gold/brown)
- **Blog** with collection-based filtering, featured post layout, and MDX support
- **Photo gallery** with EXIF-based sorting, folder-based collections, infinite scroll, and Polaroid-style cards
- **Wiki** with hierarchical collections, `[[wiki-link]]` syntax, hover previews, and draggable pop-out panels
- **Session scheduling** with Berlin→local timezone conversion, countdown timers, and availability polling (Upstash Redis)
- **Dark mode** and **dyslexia-friendly font** toggles, persisted in localStorage
- **Responsive** layouts with fixed sidebars on desktop, collapsible pills on mobile
- RSS feed, sitemap, Open Graph meta, crawler protection (noindex + robots.txt)

## Project Structure

```
src/
├── assets/              # Images (StudioImages/ subfolders for gallery)
├── components/
│   ├── BaseHead.astro   # Shared <head>: meta, fonts, dark mode, section detection
│   ├── Header.astro     # Fixed navbar with section-aware nav, dark/dyslexia toggles
│   ├── Footer.astro     # Copyright footer with section-specific gradients
│   ├── HeaderLink.astro # Nav link with active-state highlighting
│   ├── FormattedDate.astro  # <time> element with human-readable date
│   ├── Polaroid.astro   # Image card with click-to-expand <dialog> modal
│   └── WikiLinks.astro  # Hover preview tooltips and pop-out panels for wiki links
├── content/
│   ├── blog/            # Blog posts (Markdown/MDX)
│   ├── collections/     # Blog collection metadata
│   ├── wiki/            # Wiki entries (Markdown/MDX)
│   ├── wiki-collections/# Wiki collection metadata (supports parent hierarchy)
│   └── events/          # Session events (date/time in Berlin timezone)
├── layouts/
│   └── BlogPost.astro   # Blog post layout with hero image, gallery, breadcrumbs
├── pages/
│   ├── index.astro      # Landing page with Studio/Tavern choice
│   ├── rss.xml.js       # RSS 2.0 feed endpoint
│   ├── api/
│   │   └── availability.ts  # SSR endpoint for session availability voting (Redis)
│   ├── studio/
│   │   ├── blog/
│   │   │   ├── index.astro  # Blog listing with collection sidebar
│   │   │   └── [slug].astro # Individual blog post
│   │   ├── gallery.astro    # Photo gallery with infinite scroll
│   │   └── about.astro      # Studio about page
│   └── tavern/
│       ├── wiki.astro       # Wiki listing with tree-structured sidebar
│       ├── wiki/[slug].astro# Individual wiki entry
│       ├── scheduling.astro # Session scheduling with availability polling
│       └── about.astro      # Tavern about page
├── plugins/
│   └── remark-wiki-links.mjs # Remark plugin: [[slug]] → wiki links + auto-linking
├── styles/
│   └── global.css        # CSS variables, fonts, section themes, dark mode
├── consts.ts             # Site-wide constants (title, description)
└── content.config.ts     # Content collection schemas (Zod validation)
```

## Content Collections

| Collection         | Source                     | Purpose                              |
| :----------------- | :------------------------- | :----------------------------------- |
| `blog`             | `src/content/blog/`        | Studio blog posts                    |
| `blogCollections`  | `src/content/collections/` | Blog category metadata               |
| `wiki`             | `src/content/wiki/`        | Tavern wiki entries                  |
| `wikiCollections`  | `src/content/wiki-collections/` | Wiki categories (tree hierarchy) |
| `events`           | `src/content/events/`      | Session scheduling events            |

## Commands

| Command             | Action                                       |
| :------------------ | :------------------------------------------- |
| `npm install`       | Install dependencies                         |
| `npm run dev`       | Start dev server at `localhost:4321`          |
| `npm run build`     | Build production site to `./dist/`            |
| `npm run preview`   | Preview build locally before deploying        |

## Environment Variables

For the scheduling availability feature (SSR):

| Variable                    | Purpose                        |
| :-------------------------- | :----------------------------- |
| `UPSTASH_REDIS_REST_URL`    | Upstash Redis REST endpoint    |
| `UPSTASH_REDIS_REST_TOKEN`  | Upstash Redis auth token       |

## Tech Stack

- [Astro](https://astro.build) v6 — Static site generator
- [Vercel](https://vercel.com) — Hosting & SSR adapter
- [Sharp](https://sharp.pixelplumbing.com/) + exif-reader — EXIF metadata extraction
- [Upstash Redis](https://upstash.com/) — Serverless key-value store for availability votes
- [MDX](https://mdxjs.com/) — Markdown with components

## Credit

Originally scaffolded from the Astro [Bear Blog](https://github.com/HermanMartinus/bearblog/) template.
# Personal Blog Project

This is a personal blog project to just kinda fool around.
Fool me once, 
shame on you
Fool me twice,
I guess I'll build a website. 

```sh
npm create astro@latest -- --template blog
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

Features:

- ✅ Minimal styling (make it your own!)
- ✅ 100/100 Lighthouse performance
- ✅ SEO-friendly with canonical URLs and Open Graph data
- ✅ Sitemap support
- ✅ RSS Feed support
- ✅ Markdown & MDX support

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
├── public/
├── src/
│   ├── components/
│   ├── content/
│   ├── layouts/
│   └── pages/
├── astro.config.mjs
├── README.md
├── package.json
└── tsconfig.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

The `src/content/` directory contains "collections" of related Markdown and MDX documents. Use `getCollection()` to retrieve posts from `src/content/blog/`, and type-check your frontmatter using an optional schema. See [Astro's Content Collections docs](https://docs.astro.build/en/guides/content-collections/) to learn more.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Check out [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## Credit

This theme is based off of the lovely [Bear Blog](https://github.com/HermanMartinus/bearblog/).
