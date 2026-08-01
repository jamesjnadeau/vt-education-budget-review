import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { sortExplanations } from '../../lib/explanations';

export async function GET(context: APIContext) {
  const base = import.meta.env.BASE_URL; // has a trailing slash
  const articles = sortExplanations(await getCollection('explanations'));

  return rss({
    title: 'Vermont School Budgets — Explanations',
    description:
      'Plain-language explanations of how Vermont pays for schools, how your tax rate is set, and what changes by 2028.',
    site: context.site ?? 'https://example.invalid',
    items: articles.map((a) => ({
      title: a.data.title,
      description: a.data.description,
      pubDate: a.data.pubDate,
      link: `${base}explanations/${a.id}/`,
    })),
  });
}
