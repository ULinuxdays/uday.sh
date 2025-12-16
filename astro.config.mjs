import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
    output: 'static',
    // For GitHub Pages / subpath hosting. Example: "/uday.sh"
    base: process.env.ASTRO_BASE ?? '/',
    // Optional but recommended when deploying (improves URL generation).
    site: process.env.ASTRO_SITE,
    integrations: [react()],
});
