# Java TU/TI conventions

## Naming and location

- Place tests in `src/test/java` with the same package as the class under test.
- Follow the module naming convention. Common names are `*UnitTest` for TU and `*IntegrationTest` for TI.
- Extend an existing test class rather than creating a competing one.

## Java 11 / JUnit 5 common pattern

TU:

```java
@ExtendWith(MockitoExtension.class)
class MyServiceUnitTest {
    @Mock
    private Dependency dependency;

    private MyService service;

    @BeforeEach
    void setUp() {
        service = new MyService(dependency);
    }

    @Test
    void methodOk() {
        // arrange / act / assert
    }
}
```

Spring Boot TI:

```java
@SpringBootTest(classes = TestMainApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("tests")
class MyWebServiceIntegrationTest {
    @LocalServerPort
    private int port;

    @Test
    void callOk() {
        // call local application and assert
    }
}
```

Common repository patterns:

- JUnit Jupiter for Java 11 TU/TI.
- `MockitoExtension` for mock injection.
- `@Sql` for setup/cleanup of integration-test data when already used by the module.
- JAX-RS clients, MockMvc, or the module's existing HTTP client for web tests.
- WireMock for HTTP dependencies when already available.

## Java 8 legacy pattern

Java 8 modules may mix JUnit 4 and JUnit 5. Preserve the module's established choice.

Typical JUnit 4 / Mockito style:

```java
@RunWith(MockitoJUnitRunner.class)
public class MyServiceUnitTest {
    @Mock
    private Dependency dependency;

    @InjectMocks
    private MyService service;

    @Test
    public void methodOk() {
        // arrange / act / assert
    }
}
```

Legacy Spring integration tests can use `SpringJUnit4ClassRunner`, XML application contexts, `@SpringApplicationConfiguration`, or `@WebIntegrationTest`. Do not modernize these conventions only for aesthetic reasons.

## Verification

Prefer a narrow Maven command first:

```text
mvn -pl <module> -Dtest=<TestClass> test
```

If the project uses a parent/reactor build and dependencies require it:

```text
mvn -pl <module> -am -Dtest=<TestClass> test
```

Adapt flags to the project's existing Maven configuration.
