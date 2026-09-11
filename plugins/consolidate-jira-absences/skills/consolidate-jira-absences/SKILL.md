---
name: consolidate-jira-absences
description: Consolidate vacation and absence Jira exports from CSV files into a manager-ready report. Use when a user provides a Jira absence CSV or asks to analyze leave coverage, overlapping absences, accepted versus pending requests, the two-consecutive-week rule for internal employees, missing declarations, or product/team continuity.
---

# Consolidate Jira Absences

Use this skill to turn Jira absence data into a date-based staffing analysis. If the user provides a CSV, use it as the primary source. If no CSV is provided, query Jira through the Atlassian MCP and normalize the results before running the same deterministic analysis.

Load the default mapping, JQL, accepted statuses, and Jira field names from `references/default_config.json`. A user-provided mapping or JQL overrides the defaults.

The skill supports the two CSV shapes observed in this project:

- semicolon-separated exports with dates such as `03 août 2026 07:47`;
- comma-separated Jira exports with dates such as `03/sept./26 7:00 AM`.

## Workflow

1. Identify the input CSV and inspect only its header and a few rows first. Detect the delimiter, encoding, date columns, person column, status column, ticket key, summary, and creation date.
2. Confirm or infer the analysis period. If the user says `31 septembre`, interpret the end as `30 septembre` and state this correction.
3. Use the person/team mapping supplied by the user. If none is supplied, load `references/default_config.json` and clearly state the assumption. Keep internal and contractor roles separate.
4. Normalize names and aliases. Prefer the reporter as the leave owner; use the assignee to cross-check when both are available. Do not silently map an unknown person to a team.
5. Parse dates as calendar dates, inclusive of both start and end dates. Clip intervals to the requested period. Treat partial-day tickets as absences on their calendar date, while noting that the calculation is date-based rather than hour-based.
6. Include all declared tickets in the forecast analysis. Distinguish accepted tickets (`Clos`, `Accepté`, equivalent case variants) from pending or incomplete tickets (`A valider`, `A préciser`, and other non-accepted statuses).
7. Use the bundled script for deterministic calculations when possible:

```powershell
python C:\Users\alefebvre\.codex\skills\consolidate-jira-absences\scripts\analyze_absences.py `
  --csv "C:\path\to\absence-export.csv" `
  --output-dir "C:\path\to\outputs" `
  --period-start 2026-06-01 `
  --period-end 2026-09-30
```

Pass `--teams-json` when the user gives a team mapping different from the default. The JSON shape is:

```json
{
  "Team name": {
    "person-or-alias": "Interne",
    "contractor-alias": "Prestataire"
  }
}
```

8. When no CSV is provided, use the Atlassian/Jira MCP as the primary source. Build the JQL from the requested period using the intersection condition `"Date - heure de début" <= "<period-end>" AND "Date - heure de fin" >= "<period-start>"`; never use `now()` for a historical or future reporting period. Use functional Jira field names in JQL because `customfield_*` identifiers can differ by site. Retrieve every page with `nextPageToken` until `isLast=true`, and record page count and total issues. Extract key, summary, reporter, status, start date, end date, and creation date. Write a normalized JSON payload with an `issues` array and `pages`/`total_retrieved` metadata, then invoke the bundled script with `--source Jira --jira-json <payload>`. Do not invent missing values: report issues with missing key, reporter, status, or dates and exclude only what the calculation cannot safely parse. If Jira is unavailable or unauthenticated, explain the blocker and request a CSV.
9. Produce a Markdown report and a JSON summary in the requested output directory. The Markdown report must contain:
   - period and assumptions;
   - counts by Jira status;
   - a person-by-person table with team, role, ticket count, accepted/pending counts, longest continuous absence, two-week compliance, and first declaration date;
   - a Mermaid Gantt calendar grouped by team with different color for each person;
   - overlapping absence intervals, marking internal-coverage and product-coverage risks;
   - days with no internal present across a team;
   - days with no person present for a product;
   - internal employees without a continuous 14-day leave interval (Only if user ask period between 1st of June and End of september of the same year);
   - known team members with no declared leave;
   - unknown reporters outside the supplied team mapping.
10. End with a concise managerial summary. Do not send Jira comments or modify Jira unless the user explicitly requests it.

## Default configuration

The default mapping, Jira JQL, fields, and accepted statuses are maintained in `references/default_config.json`. All unspecified people are internal only if the user explicitly confirms it; otherwise mark them as unknown.

## Rules and interpretation

- The default internal-policy check is at least one continuous absence interval of 14 calendar days within the period. Do not combine separated intervals unless they are contiguous or overlapping.
- Continuity requires at least one internal person present every day and at least one person, internal or contractor, present every day for each product/team.
- Distinguish `person_overlap` (at least two different members absent on the same date) from `duplicate_declaration` (several tickets for the same reporter on the same date). Only `person_overlap` is a team-coverage overlap.
- Treat `Clos` as accepted only when the export or Jira confirms that status. Treat every other status as forecast data and label risks depending on it as unconfirmed unless the user defines another policy.
- A person with no matching ticket in the input is a missing declaration, not proof that they have no planned leave outside Jira.
- Keep unknown people visible in the report and ask for their team assignment only if it affects the requested conclusion. For Jira payloads, reporter is authoritative and assignee is only a cross-check; never silently assign an unknown reporter to a team.
- If an unknown reporter is absent during a coverage interval, mark that interval `inconclusive_due_to_unknown_reporter`: do not report a confirmed coverage risk or a confirmed full coverage conclusion for that date.

## Output conventions

Use ASCII-safe filenames such as `consolidation_conges_YYYY-MM-DD.md` and `.json`. Link the generated files with absolute paths in the final response. Mention any date-format assumption, unknown person, excluded ticket, or data-quality issue.


