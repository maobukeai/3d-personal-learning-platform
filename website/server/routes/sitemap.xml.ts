export default defineEventHandler(async (event) => {
  const origin = getRequestURL(event).origin;
  const urls = [`${origin}/`, `${origin}/resources`, `${origin}/mirrors`, `${origin}/search`];
  try {
    const discovery = await $fetch<{
      latest?: Array<{ type: string; id: string; sourceId?: string }>;
    }>(`${origin}/api/website/discovery`);
    for (const item of discovery.latest || []) {
      urls.push(
        item.type === 'mirror'
          ? `${origin}/mirrors/${item.sourceId}/resources/${item.id}`
          : `${origin}/resources/${item.type}/${item.id}`,
      );
    }
  } catch {
    /* sitemap remains valid with static routes */
  }
  setHeader(event, 'content-type', 'application/xml; charset=utf-8');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${url}</loc></url>`).join('')}</urlset>`;
});
