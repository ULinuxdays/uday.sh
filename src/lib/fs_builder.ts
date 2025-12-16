import { getCollection } from 'astro:content';
import type { VirtualFS, DirectoryNode } from './fs_types';

export async function buildFileSystem(): Promise<VirtualFS> {
    const books = await getCollection('books');

    const root: DirectoryNode = {
        type: 'dir',
        name: '', // Root has empty name
        children: {
            'books': {
                type: 'dir',
                name: 'books',
                children: {},
                meta: { title: 'Book Collection' }
            },
            'about': {
                type: 'file',
                name: 'about',
                slug: 'about',
                meta: { title: 'About Me', description: 'Meta info' },
                content: "# About Me\n\nI am Uday. This is my digital garden."
            }
        }
    };

    // Populate Books & Annotations
    books.forEach((entry) => {
        // Expected slug format: "book-slug" (for book metadata) or "book-slug/note-slug" (for notes)
        // Actually, based on my convention:
        // /books/dune/_index.md -> slug: "dune" (or similar, depending on how Astro handles directory index)
        // /books/dune/analysis.md -> slug: "dune/analysis"

        // We need to parse the slug to determine hierarchy.
        const parts = entry.slug.split('/');

        // Determine parent directory: Hoist 'dune' to root, others stay in 'books'
        const bookName = parts[0];
        let parentDir: DirectoryNode;

        if (bookName === 'dune') {
            parentDir = root;
        } else {
            parentDir = root.children['books'] as DirectoryNode;
        }

        if (parts.length === 1) {
            // Book root definition (e.g. "dune" or "sicp")
            if (!parentDir.children[bookName]) {
                parentDir.children[bookName] = {
                    type: 'dir',
                    name: bookName,
                    children: {},
                    meta: { title: entry.data.title }
                };
            }
            if (entry.data.type === 'book') {
                const dir = parentDir.children[bookName] as DirectoryNode;
                dir.meta = {
                    title: entry.data.title,
                    tags: entry.data.tags,
                    date: entry.data.publishedDate?.toISOString()
                };
            }
        } else if (parts.length === 2) {
            // "dune/chapter-1"
            const [_, noteName] = parts; // parts[0] is bookName

            // Ensure book dir exists
            if (!parentDir.children[bookName]) {
                parentDir.children[bookName] = {
                    type: 'dir',
                    name: bookName,
                    children: {},
                    meta: { title: bookName }
                };
            }
            const bookDir = parentDir.children[bookName] as DirectoryNode;

            if (entry.data.type === 'book') {
                bookDir.meta = {
                    title: entry.data.title,
                    tags: entry.data.tags
                };
            } else {
                bookDir.children[noteName] = {
                    type: 'file',
                    name: noteName,
                    slug: entry.slug,
                    meta: {
                        title: entry.data.title,
                        tags: entry.data.tags,
                        date: entry.data.addedDate?.toISOString()
                    },
                    content: entry.body
                };
            }
        }
    });

    return { root };
}
