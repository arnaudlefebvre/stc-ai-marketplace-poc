# Atlassian Rovo plugin

This plugin registers the official Atlassian Rovo MCP v2 remote server in Codex.

- MCP endpoint: `https://mcp.atlassian.com/v2/mcp`
- Authentication: Atlassian OAuth 2.1, performed per user
- Products: Jira, Confluence and other products exposed by Atlassian Rovo MCP
- Local prerequisites: none beyond Codex connectivity to the remote MCP endpoint

The plugin does not embed credentials or API tokens. Access remains constrained by each user's Atlassian permissions and by the workspace/plugin policies configured by the ChatGPT Enterprise administrator.

Because the plugin declares an MCP server directly, Codex may label it **Desktop only**. This is expected for an imported plugin declaring `mcpServers`.
