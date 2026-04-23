package dev.hishaam.hermes.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public abstract class BaseIntegrationTest {

  private static final DockerImageName REDIS_IMAGE = DockerImageName.parse("redis:7-alpine");
  private static final DockerImageName RABBIT_IMAGE =
      DockerImageName.parse("rabbitmq:4-management-alpine");

  static final PostgreSQLContainer POSTGRES = postgresContainer();

  static final GenericContainer<?> REDIS = redisContainer();

  static final GenericContainer<?> RABBIT = rabbitContainer();

  @SuppressWarnings("resource")
  private static PostgreSQLContainer postgresContainer() {
    return new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"))
        .withDatabaseName("hermes_it")
        .withUsername("hermes")
        .withPassword("hermes");
  }

  @SuppressWarnings("resource")
  private static GenericContainer<?> redisContainer() {
    return new GenericContainer<>(REDIS_IMAGE).withExposedPorts(6379);
  }

  @SuppressWarnings("resource")
  private static GenericContainer<?> rabbitContainer() {
    return new GenericContainer<>(RABBIT_IMAGE)
        .withEnv("RABBITMQ_DEFAULT_USER", "hermes")
        .withEnv("RABBITMQ_DEFAULT_PASS", "hermes")
        .withEnv("RABBITMQ_DEFAULT_VHOST", "/")
        .withCommand(
            "sh", "-c", "rabbitmq-plugins enable --offline rabbitmq_stomp && rabbitmq-server")
        .withExposedPorts(61613, 15672)
        .waitingFor(Wait.forListeningPort())
        .withStartupTimeout(Duration.ofSeconds(90));
  }

  static {
    POSTGRES.start();
    REDIS.start();
    RABBIT.start();
  }

  @DynamicPropertySource
  static void registerProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
    registry.add("spring.data.redis.host", REDIS::getHost);
    registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
    registry.add("spring.quartz.jdbc.initialize-schema", () -> "always");
    registry.add("spring.quartz.auto-startup", () -> "true");
    registry.add("app.cors.allowed-origin", () -> "http://localhost:3000");
    registry.add("app.stomp.broker-relay.host", RABBIT::getHost);
    registry.add("app.stomp.broker-relay.port", () -> RABBIT.getMappedPort(61613));
    registry.add("app.stomp.broker-relay.virtual-host", () -> "/");
    registry.add("app.stomp.broker-relay.client-login", () -> "hermes");
    registry.add("app.stomp.broker-relay.client-passcode", () -> "hermes");
    registry.add("app.stomp.broker-relay.system-login", () -> "hermes");
    registry.add("app.stomp.broker-relay.system-passcode", () -> "hermes");
  }

  @Autowired protected MockMvc mockMvc;

  @Autowired protected ObjectMapper objectMapper;

  @Autowired private JdbcTemplate jdbcTemplate;

  @Autowired private StringRedisTemplate redisTemplate;

  @LocalServerPort protected int port;

  @BeforeEach
  void cleanState() {
    try (RedisConnection connection = redisTemplate.getConnectionFactory().getConnection()) {
      connection.serverCommands().flushDb();
    }
    jdbcTemplate.execute(
        "TRUNCATE TABLE participant_answers, participants, quiz_sessions, answer_options, "
            + "questions, passages, quizzes, events, users RESTART IDENTITY CASCADE");
  }

  protected Auth organiser() throws Exception {
    String suffix = UUID.randomUUID().toString().substring(0, 8);
    String email = "organiser-" + suffix + "@example.test";
    String password = "correct-horse-25";
    JsonNode user =
        postJson(
                "/api/auth/register",
                null,
                Map.of("email", email, "password", password, "displayName", "Organiser " + suffix),
                201)
            .path("data");
    JsonNode login =
        postJson("/api/auth/login", null, Map.of("email", email, "password", password), 200)
            .path("data");
    return new Auth(login.path("token").asText(), user.path("id").asLong(), email);
  }

  protected JsonNode postJson(String url, Auth auth, Object body, int statusCode) throws Exception {
    return json(performWithBody(post(url), auth, body).andExpect(status().is(statusCode)));
  }

  protected JsonNode putJson(String url, Auth auth, Object body, int statusCode) throws Exception {
    return json(performWithBody(put(url), auth, body).andExpect(status().is(statusCode)));
  }

  protected JsonNode patchJson(String url, Auth auth, Object body, int statusCode)
      throws Exception {
    return json(performWithBody(patch(url), auth, body).andExpect(status().is(statusCode)));
  }

  protected JsonNode getJson(String url, Auth auth, int statusCode) throws Exception {
    return json(perform(get(url), auth).andExpect(status().is(statusCode)));
  }

  protected JsonNode getJson(String url, Auth auth, Map<String, String> headers, int statusCode)
      throws Exception {
    MockHttpServletRequestBuilder request = get(url);
    headers.forEach(request::header);
    return json(perform(request, auth).andExpect(status().is(statusCode)));
  }

  protected JsonNode deleteJson(String url, Auth auth, int statusCode) throws Exception {
    return json(perform(delete(url), auth).andExpect(status().is(statusCode)));
  }

  protected long createEvent(Auth auth, String title) throws Exception {
    return postJson(
            "/api/events",
            auth,
            Map.of("title", title, "description", "Integration test event"),
            201)
        .path("data")
        .path("id")
        .asLong();
  }

  protected long createQuiz(Auth auth, long eventId, String title) throws Exception {
    return postJson(
            "/api/events/" + eventId + "/quizzes",
            auth,
            Map.of("title", title, "orderIndex", 1, "displayMode", "BLIND"),
            201)
        .path("data")
        .path("id")
        .asLong();
  }

  protected JsonNode createSingleSelectQuestion(
      Auth auth, long quizId, String text, int orderIndex, int seconds) throws Exception {
    return postJson(
            "/api/quizzes/" + quizId + "/questions",
            auth,
            Map.of(
                "text",
                text,
                "orderIndex",
                orderIndex,
                "timeLimitSeconds",
                seconds,
                "questionType",
                "SINGLE_SELECT",
                "displayModeOverride",
                "LIVE",
                "options",
                options("Correct", 0, 10, "Wrong", 1, 0)),
            201)
        .path("data");
  }

  protected JsonNode createMultiSelectQuestion(
      Auth auth, long quizId, String text, int orderIndex, int seconds) throws Exception {
    return postJson(
            "/api/quizzes/" + quizId + "/questions",
            auth,
            Map.of(
                "text",
                text,
                "orderIndex",
                orderIndex,
                "timeLimitSeconds",
                seconds,
                "questionType",
                "MULTI_SELECT",
                "displayModeOverride",
                "BLIND",
                "options",
                options("First correct", 0, 5, "Second correct", 1, 5, "Penalty", 2, -3)),
            201)
        .path("data");
  }

  protected static Object options(
      String a, int aOrder, int aPoints, String b, int bOrder, int bPoints) {
    return new Object[] {
      Map.of("text", a, "orderIndex", aOrder, "pointValue", aPoints),
      Map.of("text", b, "orderIndex", bOrder, "pointValue", bPoints)
    };
  }

  protected static Object options(
      String a,
      int aOrder,
      int aPoints,
      String b,
      int bOrder,
      int bPoints,
      String c,
      int cOrder,
      int cPoints) {
    return new Object[] {
      Map.of("text", a, "orderIndex", aOrder, "pointValue", aPoints),
      Map.of("text", b, "orderIndex", bOrder, "pointValue", bPoints),
      Map.of("text", c, "orderIndex", cOrder, "pointValue", cPoints)
    };
  }

  protected String wsUrl() {
    return "ws://localhost:" + port + "/ws-hermes";
  }

  protected ResultActions perform(MockHttpServletRequestBuilder request, Auth auth)
      throws Exception {
    if (auth != null) {
      request.header("Authorization", "Bearer " + auth.token());
    }
    return mockMvc.perform(request);
  }

  private ResultActions performWithBody(
      MockHttpServletRequestBuilder request, Auth auth, Object body) throws Exception {
    request.contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body));
    return perform(request, auth);
  }

  private JsonNode json(ResultActions action) throws Exception {
    String content = action.andReturn().getResponse().getContentAsString();
    return objectMapper.readTree(content);
  }

  protected record Auth(String token, Long userId, String email) {}
}
