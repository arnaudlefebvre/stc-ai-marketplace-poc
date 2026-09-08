---
name: refinement
description: Refine and challenge a user story, Jira ticket, feature request, or development requirement before implementation. Use when asked to prepare a refinement, improve a story, identify missing information, clarify acceptance criteria, expose edge cases and dependencies, assess readiness, or turn an ambiguous requirement into a testable implementation-ready specification.
---

# Refinement

## Goal

Turn the supplied requirement into a development-ready understanding without inventing business decisions that have not been made.

## Workflow

1. Read the complete requirement and any available surrounding context.
2. Separate facts from assumptions. Never silently turn an assumption into a requirement.
3. Identify the user/business objective and the expected observable outcome.
4. Challenge the story on:
   - missing functional rules;
   - unclear actors, permissions, states, inputs, outputs, and lifecycle;
   - error and fallback behavior;
   - edge cases and boundary conditions;
   - data, privacy, security, accessibility, performance, observability, and compatibility concerns when relevant;
   - dependencies on APIs, applications, teams, migrations, feature flags, or external systems;
   - backward compatibility and rollout concerns.
5. Convert confirmed behavior into testable acceptance criteria. Prefer concise Given/When/Then criteria when that improves precision.
6. List unresolved questions separately and prioritize questions that block implementation or testing.
7. Suggest implementation considerations only when they help expose constraints or dependencies. Do not turn refinement into a speculative technical design unless requested.
8. Assess readiness using three states:
   - `READY`: enough information exists to start implementation and testing.
   - `READY WITH ASSUMPTIONS`: implementation can start if listed assumptions are explicitly accepted.
   - `NOT READY`: unresolved decisions materially change implementation or expected behavior.

## Output

Produce a compact refinement containing:

- Objective / expected outcome.
- Confirmed functional rules.
- Acceptance criteria.
- Edge cases and error cases.
- Dependencies and impacts.
- Open questions, ordered by blocking severity.
- Suggested test scenarios.
- Readiness status with a one-sentence rationale.

Preserve the wording and identifiers from the source ticket when useful. Do not fabricate Jira fields, stakeholder decisions, API contracts, dates, or estimates.
