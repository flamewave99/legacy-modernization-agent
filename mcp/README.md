# mcp: `search_legacy_code` MCP server

Exposes the `rag/` index to Claude Code (and any MCP client) as a single read-only tool.

| | |
|---|---|
| Tool | `search_legacy_code(query, k = 5)` |
| Transport | stdio (`npm --prefix mcp run -s start`) |
| Returns | Text: ranked chunks with `file:line`, symbol, score and the code. Structured: `hits[]` with the same fields, including `code`. |
| Errors | Returned as a tool error that names the likely cause and suggests falling back to grep. |

It is registered for this project in `.mcp.json` (created with `claude mcp add --scope project`) and approved for headless runs in `.claude/settings.json` (`enabledMcpjsonServers`). Inside the dev container, `RAG_DATABASE_URL` and `OLLAMA_URL` point at the compose services `db` and `ollama`, so the agent can use the tool without internet access.

```bash
cd mcp && npm install && npm test        # 4 in-memory tests + 1 stdio end-to-end test against the real index
claude mcp list                          # legacy-code: ... ✔ Connected
```

**Lesson learned.** The first version returned the code only in the text content, and the structured output carried just file, lines and score. Claude Code gives the model the `structuredContent` when a tool declares an `outputSchema`, so in an end-to-end test the agent saw locations without code and said so. The code now goes in the structured hits too, and the in-memory test checks it.
