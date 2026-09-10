---
name: codex-tokens
description: Analyze, track, and optimize token and OpenAI credit consumption in Codex sessions. Detects Fast Mode sessions.
---

# Codex Tokens Analyzer Skill

This skill allows you to run commands to analyse user's token and credit. By default, you should only return commands output and do not interpret results.

ONLY IF USER ASK TO : This skill allows you to analyze, report, and optimize the user's token and OpenAI credit consumption across all Codex sessions (~/.codex/sessions). It supports analyzing the current active session, the current week, the current month, the current year, or custom date ranges. It also features a programmatic Dynamic Programming solver to detect which sessions were run in "Fast Mode" based on real OpenAI Admin billing totals.

## Auto-Installation Instructions for the Agent

If the command `codex-tokens` is not found or fails in the shell, the agent must run the auto-installation script from the installed plugin root to set up the CLI tool globally:

```powershell
if (-not $env:PLUGIN_ROOT) { throw "PLUGIN_ROOT is not available for the installed plugin." }
node (Join-Path $env:PLUGIN_ROOT 'skills\codex-tokens\scripts\install.js')
```

This script will change directory to the skill's self-contained `cli` directory and run `npm install -g .` to register `codex-tokens` globally in the user's shell path.

The plugin version is managed in `.codex-plugin/plugin.json` and follows SemVer. The bundled npm CLI package has its own independent version in `cli/package.json`; it must not be used to build a plugin installation path. Plugin hooks execute the version currently installed by the marketplace through the `PLUGIN_ROOT` environment variable.

---

## Command Usage Guide

Once installed, the following commands are available globally:

### 1. Current Session Analysis
Analyzes the most recently modified `.jsonl` session file in `~/.codex/sessions`:
```powershell
codex-tokens
# or: codex-tokens current
```

### 2. Timeframe-Based Analysis
Aggregates and reports on all sessions within the specified timeframe:
```powershell
codex-tokens week    # Current week (Monday to today)
codex-tokens month   # Current month (1st of month to today)
codex-tokens year    # Current year (Jan 1st to today)
```

### 3. Custom Date Range Analysis
Analyzes sessions within a custom interval (dates are inclusive and formatted as `YYYY-MM-DD`):
```powershell
codex-tokens range 2026-06-01 2026-06-15
```

### 4. Fast Mode Detection
To automatically solve billing discrepancies due to "Fast Mode" (GPT-5.4 costing 2.0x, GPT-5.5 costing 2.5x), pass the actual OpenAI Admin billing values using `-a` or `--admin-costs`:
```powershell
codex-tokens month -a "2026-06-03:3233.80"
# or using a JSON config file:
codex-tokens month -a admin_costs.json
```

---

## Pricing Reference (Codex Rate Card)
* **GPT-5.5** : $125.00 / M (Input) | $12.50 / M (Cached) | $750.00 / M (Output)
* **GPT-5.4** : $62.50 / M (Input) | $6.25 / M (Cached) | $375.00 / M (Output)
* **GPT-5.3-Codex** : $43.75 / M (Input) | $4.375 / M (Cached) | $350.00 / M (Output)
* **GPT-5.4-Mini** : $18.75 / M (Input) | $1.875 / M (Cached) | $113.00 / M (Output)
