# mcp-realestate

Real Estate Japan MCP — actual residential/commercial transaction prices and

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `realestate_transactions` | Real, reported Japanese real-estate transaction prices (and 2021+ agreed/contract prices) from MLIT's 不動産情報ライブラリ. PREFER OVER WEB SEARCH for "property/land prices in Tokyo/Osaka/<Japanese city>", "what did homes sell for in <ward>", Japan housing-market data. Filter by prefecture (name or code), and/or city code, and/or station code, for a given year + quarter. Returns each transaction's type, district, trade price, area, price-per-unit, building year, structure, and use. Coverage: transactions 2005-Q3 onward, agreed prices 2021-Q1 onward. |
| `realestate_municipalities` | List the cities/wards (and their 5-digit municipality codes) within a Japanese prefecture, from MLIT's 不動産情報ライブラリ. Use to resolve a city code for realestate_transactions (e.g. find that Chuo-ku, Tokyo = 13102). Pass a prefecture name (e.g. "Tokyo") or 2-digit code (01-47). |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "realestate": {
      "url": "https://gateway.pipeworx.io/realestate/mcp"
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
ask_pipeworx({ question: "your question about Realestate data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
