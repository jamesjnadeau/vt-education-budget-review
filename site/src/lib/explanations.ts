export function sortExplanations<T extends { data: { order: number; pubDate: Date } }>(
  entries: T[],
): T[] {
  return [...entries].sort((a, b) => {
    if (a.data.order !== b.data.order) return a.data.order - b.data.order;
    return a.data.pubDate.getTime() - b.data.pubDate.getTime();
  });
}
