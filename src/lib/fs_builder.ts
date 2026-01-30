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
        // Slug pattern: "book-slug" or "book-slug/note-slug"
        const parts = entry.slug.split('/');

        // All books live under /books/<book-slug>
        const bookName = parts[0];
        const parentDir: DirectoryNode = root.children['books'] as DirectoryNode;

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
