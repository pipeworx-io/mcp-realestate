# mcp-realestate

Real Estate Japan MCP — actual residential/commercial transaction prices and

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1476+ live data sources.

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

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/realestate/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1476+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Realestate data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
