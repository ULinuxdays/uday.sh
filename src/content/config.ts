import { defineCollection, z } from 'astro:content';

const books = defineCollection({
    type: 'content', // v2.5 asset handling
    schema: z.object({
        title: z.string().max(60),
        author: z.string().optional(),
        publishedDate: z.date().optional(),
        addedDate: z.date().optional(),
        tags: z.array(z.string()).default([]),
        order: z.number().default(9999),
        status: z.enum(['draft', 'published']).default('published'),
        // Is this a book container or a note?
        type: z.enum(['book', 'annotation', 'file', 'chapter']).default('annotation'),
    }),
});

export const collections = {
    'books': books,
};
