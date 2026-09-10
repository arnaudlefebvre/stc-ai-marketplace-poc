---
name: mysql-to-postgresql-migration
description: Guide Codex through Santeclair MySQL to PostgreSQL migrations. Use when a user asks to prepare, guide, review, troubleshoot, unblock, or execute migration work involving UTF-8 conversion, Liquibase, pgloader, citext, H2 to Testcontainers migration, PostgreSQL compatibility fixes, migration checklists, Jira follow-up, or when the user says they are blocked or unsure how to continue a Java application migration.
---

# Mysql To Postgresql Migration

Guide the migration as an assisted workflow, not as generic documentation recall.

Turn the Confluence procedures into a repo-specific action plan, apply safe changes when requested, and explain only the next useful step to the developer.

## Workflow

1. Retrieve procedure context with atlassian mcp when the user references an INIT/PROC page or when the latest internal guidance matters.
2. Inspect the repository with targeted search commands such as `rg`, `fd`, or focused file reads.
3. Build a personalized migration checklist: applicable, not applicable, blocked, and risky items.
4. If the user is blocked, switch to a troubleshooting flow before proposing broad edits.
5. Apply one coherent migration slice at a time.
6. Verify the slice with focused checks or tests.
7. Report what changed, what remains, and which points require lead tech or infra validation.

## Operating Rules

- Prefer repo diagnosis over abstract advice.
- Translate procedure text into concrete repo actions.
- Keep the user focused on the next safe increment.
- When the user is blocked, optimize for the smallest next action that restores momentum.
- Flag uncertainty explicitly instead of guessing.
- Prefer targeted edits over broad rewrites.
- Use targeted search in configuration files instead of reading the full file when working in Santeclair repositories that prohibit full reads of `pom.xml`, `*.properties`, `*.cfg`, `web.xml`, and `context.xml`.

## Initial Diagnosis

Start by checking only the minimum needed signals:

- Java version and build conventions
- Presence of H2, PostgreSQL, Testcontainers, Liquibase, batch SQL, and JPA entities
- Encoding migration signs
- MySQL-specific SQL or ORM patterns likely to break on PostgreSQL
- Existing migration files, helper scripts, or previous PostgreSQL branches

Useful search patterns include:

```text
rg -n "h2|testcontainers|postgres|postgresql|citext|liquibase|schema=|catalog=|bytea|enum" .
rg -n "jdbc:h2|org\\.h2|MODE=PostgreSQL" .
rg -n "lower\\(|ILIKE|varchar|character varying|bit\\(1\\)|tinyint\\(1\\)|auto_increment" .
rg -n "databasechangelog|databasechangeloglock|change-log|sqlFile dbms=" .
rg -n "batch\\.t_sql_job|JdbcTemplate|dao\\.sql|synchro" .
```

## Blocked User Flow

When the user says they are blocked, stuck, or unsure how to continue:

1. Identify the exact stopping point.
2. Ask for or locate the smallest useful artifact: error message, failing command, changed file, test name, or migration step.
3. Classify the blockage before editing anything.
4. Explain the next step in repo terms, not procedure terms.
5. Prefer one narrow fix or one narrow verification over a broad migration plan.

Use these blockage categories:

- local setup and prerequisites
- UTF-8 conversion
- pgloader structure or data load
- Liquibase or schema bootstrap
- JPA or Hibernate validation
- `citext`, enum, blob, or boolean compatibility
- H2 to Testcontainers migration
- batch SQL or synchronization logic
- Jira, infra, or environment dependency

If the artifact is missing, ask only for the minimum missing signal.

Good examples:

- exact error text,
- last command run,
- failing test class,
- file path being edited,
- current migration step from the checklist.

## Minimal Triage Questions

When the repository context is insufficient, ask for the minimum missing signal only.

Ask in this order and stop as soon as one answer is enough:

1. What is the exact failing step?
2. What is the exact error output or failing command?
3. Which file, test, changelog, or SQL artifact is currently being changed?

Prefer short, concrete questions such as:

- Which step is failing: `pgloader`, app startup, Liquibase, tests, UTF-8 conversion, or batch SQL?
- Paste the exact error message or the failing command.
- Which file or test are you editing right now?

Avoid broad prompts such as:

- "Can you give me more context?"
- "Where are you blocked?" when a more specific category question is possible.
- multiple open-ended questions in the same message.

## Category-Specific Triage

Use a tighter question when the category is already visible.

### Liquibase

Ask:

- Paste the exact Liquibase error.
- Which changelog file is involved?

### JPA Or Hibernate

Ask:

- Paste the schema validation or startup error.
- Which entity or repository seems involved?

### H2 To Testcontainers

Ask:

- Which test class or test configuration file is failing?
- Is the failure during container startup, datasource wiring, or Liquibase execution?

### Pgloader

Ask:

- Paste the pgloader error output.
- Which `.load` file are you using?

### UTF-8

Ask:

- Which file or command started failing after UTF-8 conversion?
- Is the issue at build time, runtime, or in tests?

### Batch SQL

Ask:

- Paste the failing SQL or the exact database error.
- Is the issue in a DAO, a batch SQL job, or a synchronization query?

## Preferred Migration Slices

Choose one slice at a time:

- UTF-8 preparation
- PostgreSQL local prerequisites and pgloader preparation
- JPA and Liquibase compatibility fixes
- `citext` and case-insensitive search handling
- H2 to Testcontainers migration
- Batch SQL or synchronization fixes
- Data-load and validation support

When several slices are mixed, stabilize them in this order unless the repo context suggests otherwise:

1. UTF-8
2. schema/bootstrap/Liquibase alignment
3. JPA/PostgreSQL type compatibility
4. tests with Testcontainers
5. batch-specific SQL

## What To Produce

- A repo-specific checklist
- A blockage diagnosis when the user is stuck
- The smallest next action to unblock progress
- Safe code or config patches when requested
- Verification notes
- Remaining manual actions for infra, Jira, or data loading

## Reference

Read [references/santeclair-postgres-playbook.md](references/santeclair-postgres-playbook.md) when you need the decision rules, common incompatibilities, or procedure mapping.
