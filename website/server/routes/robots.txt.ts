export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8');
  return 'User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: /sitemap.xml\n';
});
