# uday.sh

Terminal-style personal website / digital garden built with Astro + React. Content is surfaced as a “virtual filesystem” you can navigate via an interactive shell, with deep-linkable URLs for directories and files.

## What’s inside

- **Terminal UI**: command prompt, command history (↑/↓), tab completion, fuzzy suggestions for typos.
- **Library sidebar**: a browsable tree view that highlights what you’ve opened.
- **Content-backed filesystem**: Markdown in `src/content/books` becomes directories + files via `src/lib/fs_builder.ts`.
- **Static routing**: `src/pages/[...slug].astro` pre-generates routes for every node so `/books/<book>/<note>` links work.

## Tech stack

- **Astro 4** with `@astrojs/react`
- **React 18** for the terminal + sidebar UI
- **TypeScript**, ESLint, Prettier

## Local development

### Prerequisites

- Node.js **20+** recommended (any modern Node version supported by Astro 4 should work)
- npm (the repo includes a `package-lock.json`)

### Commands

```bash
npm ci
npm run dev
```

Then open `http://localhost:4321`.

Other useful scripts:

- `npm run build` — production build (outputs `dist/`)
- `npm run preview` — serve the built site locally
- `npm run check` — `astro check` + `tsc --noEmit`
- `npm run lint` — ESLint over `src/`

## Terminal commands (in-app)

The shell accepts a small set of commands designed for reading and navigation:

- `help` (alias `?`) — show command categories / onboarding wizard
- `ls` (alias `dir`) — list directory contents
- `cd <dir>` (alias `goto`) — change directory (`..` and `/` supported)
- `pwd` — print current directory
- `home` — return to `/`
- `back` — jump back to the previous directory in-session
- `tree [-L depth] [path]` — show a directory tree (default depth `4`)
- `open <file|dir>` — open a file (prints content) or enter a directory (updates URL)
- `cat <file>` (alias `read`) — print file content without changing the URL
- `search <term>` — search by name/title/tags
- `summary` (alias `tldr`) — quick start sheet
- `clear` — clear terminal history

Quality-of-life:

- **Autocomplete**: press `Tab` for the best suggestion; file/dir completion is path-aware.
- **Fuzzy fixes**: mistyped commands and paths suggest close matches.
- **Deep links**: opening a directory/file updates the URL so pages can be shared/bookmarked.

## Content authoring

Content lives in `src/content/books` and is managed via Astro Content Collections (`src/content/config.ts`).

### Add a new book

Create a folder with an `index.md` (or `index.mdx`) that declares the book metadata:

`src/content/books/<book-slug>/index.md`

```md
---
title: "Book Title"
author: "Author Name"
publishedDate: 2025-01-01
tags: ["tag-a", "tag-b"]
type: "book"
status: "published"
---
Optional intro/summary…
```

### Add annotations / chapters

Add additional Markdown files under the same folder:

`src/content/books/<book-slug>/<note-slug>.md`

```md
---
title: "Chapter 1 — Notes"
addedDate: 2025-12-15
tags: ["theme", "quote"]
type: "annotation"
status: "published"
---
Your content…
```

### Frontmatter fields

Defined in `src/content/config.ts`:

- `title` (required)
- `author`, `publishedDate`, `addedDate` (optional)
- `tags` (optional, defaults to `[]`)
- `order` (optional, defaults to `9999`)
- `status` (`draft` | `published`, default `published`)
- `type` (`book` | `annotation` | `file` | `chapter`, default `annotation`)

If you want different navigation rules or a different library structure, update the VirtualFS builder at `src/lib/fs_builder.ts`.

## Project structure

- `src/pages/index.astro` — main app shell (sidebar + terminal)
- `src/pages/[...slug].astro` — static routing for every virtual path
- `src/components/Terminal/*` — terminal UI, command parsing/execution
- `src/components/Sidebar/Sidebar.tsx` — library sidebar tree
- `src/lib/fs_builder.ts` — converts content collection entries into a VirtualFS
- `src/content/books/**` — Markdown library content

## License

No license file is included in this repository. If you intend this to be open-source, add a `LICENSE` and update this section accordingly.

