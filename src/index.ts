interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Spaceflight News MCP.
 *
 * Keyless aggregator of spaceflight news articles, blogs, and reports from
 * dozens of sources (Spaceflight Now, NASASpaceflight, Arstechnica, SpaceX,
 * Blue Origin, NASA, ESA, and more) via the Spaceflight News API v4. Full-text
 * search, source filtering, and date ranges. Keyless.
 */


const BASE = 'https://api.spaceflightnewsapi.net/v4';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'search_articles',
    description:
      'Full-text search spaceflight news articles aggregated from dozens of sources (Spaceflight Now, NASASpaceflight, NASA, SpaceX, Blue Origin, ESA, and more). Filter by source, publish date, and featured status. Newest first. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Full-text query, e.g. "starship", "artemis", "mars sample return". Optional — omit to list recent articles.',
        },
        news_site: {
          type: 'string',
          description: 'Filter to a single source name, e.g. "Spaceflight Now", "NASASpaceflight". Use list_sources to discover names.',
        },
        published_after: {
          type: 'string',
          description: 'Only articles published on/after this ISO date or datetime, e.g. "2026-01-01" or "2026-01-01T00:00:00Z".',
        },
        limit: {
          type: 'number',
          description: 'Max articles to return (default 10, max 25).',
        },
        featured_only: {
          type: 'boolean',
          description: 'If true, return only editorially featured articles.',
        },
      },
    },
  },
  {
    name: 'get_article',
    description:
      'Get a single spaceflight news article by its numeric id, with the full untruncated summary plus any associated launches and events. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Numeric article id (from search_articles results).' },
      },
      required: ['id'],
    },
  },
  {
    name: 'latest_reports',
    description:
      'Latest long-form spaceflight mission reports (longer than standard news articles), newest first. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max reports to return (default 10, max 25).' },
      },
    },
  },
  {
    name: 'list_sources',
    description:
      'List every news source the Spaceflight News API aggregates, plus the API version. Use the names to filter search_articles by news_site. Keyless.',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'search_articles':
        return searchArticles(args);
      case 'get_article':
        return getArticle(args);
      case 'latest_reports':
        return latestReports(args);
      case 'list_sources':
        return listSources();
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

function clampLimit(raw: unknown, def: number, max: number): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : def;
  return Math.max(1, Math.min(max, n));
}

function compactArticle(raw: Record<string, unknown>): Record<string, unknown> {
  const summary = typeof raw.summary === 'string' ? raw.summary : '';
  return {
    id: raw.id,
    title: raw.title,
    news_site: raw.news_site,
    summary: summary.length > 300 ? `${summary.slice(0, 300)}…` : summary,
    url: raw.url,
    image_url: raw.image_url,
    published_at: raw.published_at,
    featured: raw.featured,
  };
}

async function fetchJson(url: string): Promise<{ ok: true; data: unknown } | { ok: false; error: unknown }> {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) {
    return { ok: false, error: { error: `spaceflightnewsapi: ${res.status} ${(await res.text()).slice(0, 200)}` } };
  }
  return { ok: true, data: await res.json() };
}

async function searchArticles(args: Record<string, unknown>): Promise<unknown> {
  const limit = clampLimit(args.limit, 10, 25);
  const params = new URLSearchParams({ limit: String(limit), ordering: '-published_at' });

  const search = typeof args.search === 'string' ? args.search.trim() : '';
  if (search) params.set('search', search);
  const newsSite = typeof args.news_site === 'string' ? args.news_site.trim() : '';
  if (newsSite) params.set('news_site', newsSite);
  const publishedAfter = typeof args.published_after === 'string' ? args.published_after.trim() : '';
  if (publishedAfter) params.set('published_at_gte', publishedAfter);
  if (args.featured_only === true) params.set('is_featured', 'true');

  const r = await fetchJson(`${BASE}/articles/?${params.toString()}`);
  if (!r.ok) return r.error;

  const d = r.data as { count?: number; results?: Array<Record<string, unknown>> };
  const results = Array.isArray(d.results) ? d.results : [];
  return {
    total: d.count ?? results.length,
    count: results.length,
    articles: results.map(compactArticle),
  };
}

async function getArticle(args: Record<string, unknown>): Promise<unknown> {
  const id = typeof args.id === 'number' && Number.isFinite(args.id) ? Math.floor(args.id) : null;
  if (id === null) return { error: 'provide a numeric article id', id: args.id ?? null };

  const res = await fetch(`${BASE}/articles/${id}/`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (res.status === 404) return { error: 'article not found', id };
  if (!res.ok) return { error: `spaceflightnewsapi: ${res.status} ${(await res.text()).slice(0, 200)}` };

  const a = (await res.json()) as Record<string, unknown>;
  const launches = Array.isArray(a.launches) ? a.launches : [];
  return {
    id: a.id,
    title: a.title,
    news_site: a.news_site,
    summary: a.summary,
    url: a.url,
    image_url: a.image_url,
    published_at: a.published_at,
    updated_at: a.updated_at,
    featured: a.featured,
    launches: launches.map((l) => ({
      launch_id: (l as Record<string, unknown>).launch_id,
      provider: (l as Record<string, unknown>).provider,
    })),
    events: a.events ?? [],
  };
}

async function latestReports(args: Record<string, unknown>): Promise<unknown> {
  const limit = clampLimit(args.limit, 10, 25);
  const r = await fetchJson(`${BASE}/reports/?limit=${limit}&ordering=-published_at`);
  if (!r.ok) return r.error;

  const d = r.data as { count?: number; results?: Array<Record<string, unknown>> };
  const results = Array.isArray(d.results) ? d.results : [];
  return {
    total: d.count ?? results.length,
    count: results.length,
    reports: results.map(compactArticle),
  };
}

async function listSources(): Promise<unknown> {
  const r = await fetchJson(`${BASE}/info/`);
  if (!r.ok) return r.error;

  const d = r.data as { version?: unknown; news_sites?: unknown };
  const sites = Array.isArray(d.news_sites) ? d.news_sites : [];
  return {
    version: d.version,
    count: sites.length,
    news_sites: sites,
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
