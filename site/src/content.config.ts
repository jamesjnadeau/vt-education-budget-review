import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const explanations = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/explanations' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    order: z.number().int().positive(),
  }),
});

export const collections = { explanations };
