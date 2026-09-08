---
name: java-tu-ti-generator
description: Generate or update Java 8/11 unit tests (TU) and integration tests (TI) for a full class or a specific method in the current repository. Use when asked to create, complete, repair, or improve Java tests while matching the existing JUnit, Mockito, Spring Boot, Maven, naming, profile, database setup, and module conventions.
---

# Java TU/TI Generator

## Workflow

1. Clarify the requested scope from the task context: class path, method name(s), TU vs TI, create vs update, and target module. Ask only when the missing information cannot be inferred from the repository.
2. Inspect the current module before writing tests. Scan nearby existing tests and build files to identify Java version, JUnit version, Mockito style, naming, base test classes, Spring profiles, test resources, Maven configuration, and integration-test conventions.
3. Prefer the module's existing conventions over the defaults below.
4. Choose the test stack:
   - Java 11 or a module already using JUnit 5: prefer JUnit 5 and `MockitoExtension` for TU.
   - Spring Boot TI: follow the module; a common pattern is `@SpringBootTest` with `WebEnvironment.RANDOM_PORT` and `@ActiveProfiles("tests")`.
   - Java 8 legacy modules: preserve the existing JUnit 4/5 mix and Spring legacy annotations where present.
5. Implement tests:
   - Full-class scope: cover public methods and meaningful nominal, edge, and error paths.
   - Method scope: add focused cases to the existing test class when one exists.
   - Mock remote/external dependencies in TU. Do not make real network calls.
   - Reuse existing fixtures/builders/test data before creating new ones.
   - Use the module's established database setup strategy for TI, such as `@Sql`, transactions, or test containers when already present.
6. Keep production-code changes out of scope unless the tests expose a real defect and the user asked for the implementation to be fixed too.
7. Run the narrowest relevant test command when tool access permits. Otherwise provide the exact Maven command to run.
8. Report what was added, what scenarios are covered, and any behavior that remains ambiguous or untestable.

## Defaults and examples

Read `references/java-tu-ti-conventions.md` when choosing between JUnit/Mockito/Spring patterns or when the module does not make its conventions obvious.
