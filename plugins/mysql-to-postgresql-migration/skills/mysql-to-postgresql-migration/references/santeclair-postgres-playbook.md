# Santeclair PostgreSQL Migration Playbook

## Procedure Sources

Use these Confluence procedures as the source of truth when the latest internal guidance matters:

- INIT: `https://santeclair.atlassian.net/wiki/spaces/DOCDEVOPS/pages/125436046/INIT+-+Migrations+PostgreSQL`
- Preable: `https://santeclair.atlassian.net/wiki/spaces/DOCDEVOPS/pages/125437214/PROC+-+Migration+PostgreSQL.+Pr+ambule`
- Main procedure: `https://santeclair.atlassian.net/wiki/spaces/DOCDEVOPS/pages/125436339/PROC+-+Migration+PostgreSQL`
- UTF-8: `https://santeclair.atlassian.net/wiki/spaces/DOCDEVOPS/pages/125439851/PROC+-+Migration+UTF-8`
- Tests Java 11: `https://santeclair.atlassian.net/wiki/spaces/DOCDEVOPS/pages/125443397/PROC+-+Migration+des+tests+H2+vers+PostgreSQL+avec+Testcontainers.+Java11`
- Tests Java 8: `https://santeclair.atlassian.net/wiki/spaces/DOCDEVOPS/pages/125443421/PROC+-+Migration+des+tests+H2+vers+PostgreSQL+avec+Testcontainers.+Java+8`
- Tests Quarkus 3: `https://santeclair.atlassian.net/wiki/spaces/DOCDEVOPS/pages/125444861/PROC+-+Migration+des+tests+H2+vers+PostgreSQL+avec+Testcontainers.+Quarkus+3`

Always refresh them with atlassian mcp if available instead of relying on stale memory.

## Migration Intent

Convert internal procedures into repo-specific actions that reduce friction for developers:

- tell them what applies to their repo,
- avoid sending them back to raw documentation,
- automate the safe parts,
- surface manual actions early.

## Quick Classification

During the first pass, classify findings into:

- `applicable`: clear and actionable in this repo,
- `not_applicable`: not present in this repo,
- `blocked`: requires infra, Jira, local setup, or missing artifact,
- `risky`: requires explicit validation because behavior can change.

When the user is already stuck, also classify the blockage itself:

- `missing_signal`: not enough evidence yet,
- `local_breakage`: command, dependency, or environment issue,
- `repo_breakage`: code, config, or test issue inside the repository,
- `process_breakage`: Jira, infra, branch, or environment dependency,
- `semantic_breakage`: behavior changed because PostgreSQL semantics differ from MySQL.

## Unblock First

When a user says they are blocked, do not start by replaying the full migration procedure.

Do this instead:

1. Find the precise failing step.
2. Ask for or locate the smallest relevant artifact.
3. Map the failure to one migration category.
4. Propose one next action.
5. Verify whether that action would remove the block.

Prefer:

- "Your block is in Hibernate schema validation, not in pgloader."
- "The next action is to replace `catalog` with `schema` on PostgreSQL entities."
- "The next useful artifact is the failing test name and stacktrace."

Avoid:

- "Read the whole PROC."
- "First migrate UTF-8, Liquibase, tests, and batch."
- large speculative refactors before the failure is localized.

## Minimal Triage Protocol

If the repository alone does not explain the block, ask for the smallest missing artifact.

Ask in this order and stop early:

1. failing step,
2. exact error or failing command,
3. file, test, changelog, or SQL artifact currently being changed.

Preferred prompts:

- "Which step is failing: `pgloader`, Liquibase, app startup, tests, UTF-8 conversion, or batch SQL?"
- "Paste the exact error message or failing command."
- "Which file or test are you editing right now?"

Avoid generic prompts that produce low-signal answers.

## Category Triage Shortcuts

Use one of these when the category is already visible:

- Liquibase: ask for the exact error and changelog path.
- JPA/Hibernate: ask for the startup or schema validation error and the entity involved.
- H2/Testcontainers: ask for the failing test class or test config file and whether the failure is container, datasource, or Liquibase related.
- pgloader: ask for the error output and `.load` file name.
- UTF-8: ask which file or command started failing after conversion.
- batch SQL: ask for the failing SQL or exact database error and whether it is DAO, job, or synchro related.

## High-Value Checks

### UTF-8

Look for:

- XML or source files still in ISO-8859-15 or Latin-1,
- test or Liquibase files with non-UTF-8 headers,
- build issues caused by binary resource filtering after encoding conversion.

Important rule:

- UTF-8 migration is expected before PostgreSQL migration.

### Test Stack

Look for:

- `jdbc:h2`,
- `org.h2.Driver`,
- H2 dialects,
- `db.changelog-H2-master.xml`,
- test property sets that still target H2.

Preferred outcome:

- switch tests to PostgreSQL via Testcontainers,
- keep Spring test classes as stable as possible,
- migrate test changelog loading from `dbms="h2"` to `dbms="postgresql"`,
- keep test data files in UTF-8.

### JPA and Schema Semantics

Look for:

- `catalog = ...` where PostgreSQL expects `schema = ...`,
- `varchar` case-insensitive assumptions,
- enums, blobs, booleans, and auto-increment semantics,
- queries relying on MySQL implicit coercions.

Important reminders:

- PostgreSQL is case sensitive on text unless mitigated.
- Existing varchar columns may be migrated to `citext` to reduce regressions.
- New columns must not use `citext` as an easy default.
- Boolean inserts must use `true` or `false`, not `0` or `1`.

### Liquibase and Schema Bootstrapping

Look for:

- PostgreSQL changelog master files,
- schema creation timing issues,
- technical tables `databasechangelog` and `databasechangeloglock`,
- test and main changelog divergence,
- SQL files that assume MySQL syntax.

Important reminders:

- exclude Liquibase technical tables from `pgloader` structure generation,
- verify schema creation order,
- verify foreign keys recreated after data loading.

### Pgloader and Type Mapping

Watch for:

- explicit `CAST` rules needed to align SQL types with JPA entities,
- `bit(1)` default values that must be restored manually,
- identifier or constraint names longer than PostgreSQL limits,
- missing schema creation in `.load` files.

### Batch and SQL Migration

Look for:

- MySQL session variables `@...`,
- implicit casts between strings, numbers, booleans, and enums,
- cross-database SQL assumptions,
- timestamps with timezone crossing MySQL/PostgreSQL boundaries.

Batch migration often needs repo changes plus data updates in batch tables, so mark these cases as `risky` or `blocked` early.

## Suggested Repo Workflow

1. Build a short diagnosis.
2. Propose the first migration slice.
3. Apply focused edits.
4. Verify with the cheapest relevant command or test.
5. Summarize remaining manual actions.

## Good Output Shape

Prefer output like:

- `Detected`: H2 test stack, PostgreSQL Liquibase files absent, 3 probable case-insensitive query risks.
- `Next step`: migrate tests to Testcontainers first.
- `Changed`: test dependencies, test datasource properties, test bootstrap wiring.
- `Still manual`: create or verify local PostgreSQL 15, pgloader, Jira attachments for `.load` files.

If the user is blocked, prefer output like:

- `Blockage`: H2 test configuration still active in the test profile.
- `Why`: PostgreSQL-only changelog and datasource properties are not wired yet.
- `Next action`: switch the test datasource properties and `dbms` values from H2 to PostgreSQL.
- `Need from user`: nothing, or one failing test/log excerpt if the repo signal is insufficient.

## Avoid

- dumping the full procedure back to the user,
- doing a broad repo rewrite before diagnosis,
- assuming every repo uses batch, `citext`, or Testcontainers already,
- reading forbidden config files in full when targeted search is enough.
