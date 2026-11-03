// Vercel forwards unused catch-all rewrite parameters as query fields. They
// describe routing, not a mobile table filter. Normalize only at the edge entry.
export function createVercelHandler(app) {
  return (req, res) => {
    const url = new URL(req.url, 'https://vercel.internal');
    url.searchParams.delete('path');
    req.url = url.pathname + url.search;
    if (req.query && typeof req.query === 'object') {
      const query = { ...req.query };
      delete query.path;
      req.query = query;
    }
    return app(req, res);
  };
}
