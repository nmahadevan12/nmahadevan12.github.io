import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { AREA_KEYS, STATUS_KEYS } from './lib/taxonomy';

// Each project lives in its own folder: src/content/projects/<url-slug>/index.md,
// with its images next to it. The folder name becomes the page URL.
const projects = defineCollection({
  loader: glob({
    base: './src/content/projects',
    pattern: '*/index.md',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      // Short name for the home page capture's channel list. Defaults to the title.
      channel: z.string().optional(),
      summary: z.string(),
      status: z.enum(STATUS_KEYS),
      areas: z.array(z.enum(AREA_KEYS)).min(1),
      // Accepts `2026-06` or `2026-06-15`.
      start: z.coerce.date().optional(),
      end: z.coerce.date().optional(),
      course: z.string().optional(),
      role: z.string().optional(),
      platform: z.string().optional(),
      tags: z.array(z.string()).default([]),
      highlights: z.array(z.string()).default([]),
      featured: z.boolean().default(false),
      draft: z.boolean().default(false),
      cover: image().optional(),
      coverAlt: z.string().optional(),
      coverCaption: z.string().optional(),
      // `contain` shows the whole image (plots, screenshots); `cover` crops photos to fill the card.
      coverFit: z.enum(['cover', 'contain']).default('cover'),
      // Percent positions (0–100) on the cover image for hover callouts.
      coverHotspots: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
            detail: z.string(),
            x: z.number().min(0).max(100),
            y: z.number().min(0).max(100),
          }),
        )
        .default([]),
      gallery: z.array(z.object({ src: image(), caption: z.string() })).default([]),
      repo: z.url().optional(),
      video: z.url().optional(),
      demo: z.url().optional(),
      docs: z.url().optional(),
    }),
});

export const collections = { projects };
