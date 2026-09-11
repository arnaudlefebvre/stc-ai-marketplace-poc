# Atlassian Rovo MCP plugin

This plugin installs the Atlassian Rovo MCP configuration in Codex Desktop through the STC plugin marketplace.

The MCP server itself is remote:

`https://mcp.atlassian.com/v2/mcp`

No local Node, Docker, uv/uvx or manual `config.toml` entry is required for this plugin.
Each user still authenticates with Atlassian using their own account and existing Jira/Confluence permissions.

The plugin is expected to be Desktop-only because it declares an MCP server.
