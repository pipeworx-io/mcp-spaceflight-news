# mcp-spaceflight-news

Spaceflight News MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_articles` | Full-text search spaceflight news articles aggregated from dozens of sources (Spaceflight Now, NASASpaceflight, NASA, SpaceX, Blue Origin, ESA, and more). Filter by source, publish date, and featured status. Newest first. Keyless. |
| `get_article` | Get a single spaceflight news article by its numeric id, with the full untruncated summary plus any associated launches and events. Keyless. |
| `latest_reports` | Latest long-form spaceflight mission reports (longer than standard news articles), newest first. Keyless. |
| `list_sources` | List every news source the Spaceflight News API aggregates, plus the API version. Use the names to filter search_articles by news_site. Keyless. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "spaceflight-news": {
      "url": "https://gateway.pipeworx.io/spaceflight-news/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Spaceflight News data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
