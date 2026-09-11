---
name: atlassian-rovo
description: Use Atlassian Jira and Confluence through the Atlassian Rovo MCP server from Codex. Use when the user asks to search, read, summarize, analyze, create, or update Jira issues or Confluence content, or when Jira/Confluence context is needed for a coding task.
---

# Atlassian Rovo

Use the Atlassian MCP tools exposed by this plugin for Jira and Confluence operations.

## Workflow

1. Determine whether the request concerns Jira, Confluence, or both.
2. Prefer reading existing Jira/Confluence context before proposing changes.
3. Preserve the user's existing Atlassian permissions; never assume access to unavailable projects or spaces.
4. For write operations, summarize the intended change before executing it when the action is consequential or ambiguous.
5. When using Jira information for a coding task, extract the acceptance criteria, constraints, linked issues, and relevant comments before modifying code.
6. When using Confluence information, identify the page and space clearly and distinguish documented facts from inferred conclusions.
