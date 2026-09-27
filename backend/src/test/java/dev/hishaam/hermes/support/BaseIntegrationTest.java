package dev.hishaam.hermes.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.hishaam.hermes.Application;
import java.lang.reflect.Type;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.converter.JacksonJsonMessageConverter;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.broker.SimpleBrokerMessageHandler;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.messaging.simp.user.SimpSubscription;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.messaging.simp.user.UserDestinationResolver;
import org.springframework.messaging.simp.user.UserDestinationResult;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.scheduling.concurrent.ConcurrentTaskScheduler;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    classes = Application.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
// Pinned so the default (simple) does not silently stop exercising the relay path. Pinned here, not
// in @DynamicPropertySource: dynamic properties outrank every @TestPropertySource, so a subclass
// could never switch modes, while its own @TestPropertySource does override this one.
@TestPropertySource(properties = "app.stomp.broker.mode=relay")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public abstract class BaseIntegrationTest {

  // ─── Containers ────────────────────────────────────────────────────────────────

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
    // The clustered JDBC job store polls for new triggers every idleWaitTime (default 30s);
    // shorten it so freshly scheduled question timers fire promptly in tests.
    registry.add("spring.quartz.properties.org.quartz.scheduler.idleWaitTime", () -> "1000");
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

  /** Present only when the class runs on Spring's in-process broker rather than the relay. */
  @Autowired private ObjectProvider<SimpleBrokerMessageHandler> simpleBroker;

  @Autowired private SimpUserRegistry userRegistry;

  @Autowired private UserDestinationResolver userDestinationResolver;

  @LocalServerPort protected int port;

  // ─── Per-test state ────────────────────────────────────────────────────────────

  /**
   * Drops every Redis key, simulating the session TTL lapsing or the cache being evicted mid-run.
   * PostgreSQL is left intact, which is exactly the split the live-state fallbacks are built for.
   */
  protected void flushRedis() {
    try (RedisConnection connection = redisTemplate.getConnectionFactory().getConnection()) {
      connection.serverCommands().flushDb();
    }
  }

  @BeforeEach
  void cleanState() {
    flushRedis();
    jdbcTemplate.execute(
        "TRUNCATE TABLE participant_answers, participants, quiz_sessions, answer_options, "
            + "questions, passages, quizzes, events, users RESTART IDENTITY CASCADE");
  }

  /**
   * Counts rows in a table directly, for asserting on data the API deliberately exposes no read
   * endpoint for — chiefly that cascading deletes leave nothing orphaned.
   */
  protected long rowCount(String table) {
    Long count = jdbcTemplate.queryForObject("SELECT count(*) FROM " + table, Long.class);
    return count == null ? 0L : count;
  }

  // ─── Fixtures ──────────────────────────────────────────────────────────────────

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

  // ─── HTTP ──────────────────────────────────────────────────────────────────────

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

  // ─── STOMP ─────────────────────────────────────────────────────────────────────

  protected String wsUrl() {
    return "ws://localhost:" + port + "/ws-hermes";
  }

  protected WebSocketStompClient stompClient() {
    WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
    client.setMessageConverter(new JacksonJsonMessageConverter());
    client.setTaskScheduler(
        new ConcurrentTaskScheduler(
            Executors.newSingleThreadScheduledExecutor(
                task -> {
                  Thread thread = new Thread(task, "stomp-test-receipts");
                  thread.setDaemon(true);
                  return thread;
                })));
    return client;
  }

  /** Connects as the given organiser, or anonymously when {@code token} is null. */
  protected StompSession connect(WebSocketStompClient client, String token) throws Exception {
    StompHeaders headers = new StompHeaders();
    if (token != null) {
      headers.add("Authorization", "Bearer " + token);
    }
    StompSession session =
        client
            .connectAsync(
                wsUrl(), new WebSocketHttpHeaders(), headers, new StompSessionHandlerAdapter() {})
            .get(10, TimeUnit.SECONDS);
    session.setAutoReceipt(true);
    return session;
  }

  /**
   * Connects expecting the session to be rejected later: any ERROR frame, handling exception, or
   * transport close counts down the latch.
   */
  protected StompSession connect(WebSocketStompClient client, String token, CountDownLatch rejected)
      throws Exception {
    StompHeaders headers = new StompHeaders();
    if (token != null) {
      headers.add("Authorization", "Bearer " + token);
    }
    return client
        .connectAsync(
            wsUrl(),
            new WebSocketHttpHeaders(),
            headers,
            new StompSessionHandlerAdapter() {
              @Override
              public void handleFrame(StompHeaders frameHeaders, Object payload) {
                rejected.countDown();
              }

              @Override
              public void handleException(
                  StompSession session,
                  StompCommand command,
                  StompHeaders frameHeaders,
                  byte[] payload,
                  Throwable exception) {
                rejected.countDown();
              }

              @Override
              public void handleTransportError(StompSession session, Throwable exception) {
                rejected.countDown();
              }
            })
        .get(10, TimeUnit.SECONDS);
  }

  /**
   * Subscribes and returns only once the broker has registered the subscription, so a test never
   * triggers an event before anyone is listening for it.
   */
  protected void subscribe(StompSession session, String destination, BlockingQueue<JsonNode> queue)
      throws Exception {
    SimpleBrokerMessageHandler inProcessBroker = simpleBroker.getIfAvailable();
    if (inProcessBroker != null) {
      subscribeInProcess(inProcessBroker, session, destination, queue);
      return;
    }
    CountDownLatch subscribed = new CountDownLatch(1);
    CountDownLatch failed = new CountDownLatch(1);
    StompSession.Subscription subscription = session.subscribe(destination, handler(queue));
    subscription.addReceiptTask(subscribed::countDown);
    subscription.addReceiptLostTask(failed::countDown);
    if (!subscribed.await(10, TimeUnit.SECONDS)) {
      if (failed.getCount() == 0) {
        throw new AssertionError("Lost STOMP receipt for subscription to " + destination);
      }
      throw new AssertionError("Timed out waiting for subscription to " + destination);
    }
  }

  /**
   * Spring's in-process broker never answers a SUBSCRIBE with a RECEIPT, and registers it on the
   * executor-backed inbound channel, so {@code subscribe} returning proves nothing. Instead this
   * polls the broker's own registry until the subscription is in it. The id is unique so that no
   * other session's subscription can satisfy the lookup.
   */
  private void subscribeInProcess(
      SimpleBrokerMessageHandler broker,
      StompSession session,
      String destination,
      BlockingQueue<JsonNode> queue)
      throws InterruptedException {
    String subscriptionId = UUID.randomUUID().toString();
    StompHeaders headers = new StompHeaders();
    headers.setDestination(destination);
    headers.setId(subscriptionId);
    session.subscribe(headers, handler(queue));
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
    while (!isRegistered(broker, destination, subscriptionId)) {
      if (System.nanoTime() > deadline) {
        throw new AssertionError("Timed out waiting for subscription to " + destination);
      }
      Thread.sleep(20);
    }
  }

  private boolean isRegistered(
      SimpleBrokerMessageHandler broker, String destination, String subscriptionId) {
    // The user registry records a SUBSCRIBE as soon as it is dispatched, before the broker has
    // handled it, so it is consulted only to learn which server-side session to look up.
    for (SimpSubscription dispatched :
        userRegistry.findSubscriptions(candidate -> subscriptionId.equals(candidate.getId()))) {
      String sessionId = dispatched.getSession().getId();
      for (String brokerDestination : brokerDestinations(destination, sessionId)) {
        SimpMessageHeaderAccessor lookup =
            SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        lookup.setDestination(brokerDestination);
        List<String> registered =
            broker
                .getSubscriptionRegistry()
                .findSubscriptions(
                    MessageBuilder.createMessage(new byte[0], lookup.getMessageHeaders()))
                .get(sessionId);
        if (registered != null && registered.contains(subscriptionId)) {
          return true;
        }
      }
    }
    return false;
  }

  /** Where the broker files a subscription: {@code /user/**} maps to a per-session destination. */
  private Set<String> brokerDestinations(String destination, String sessionId) {
    SimpMessageHeaderAccessor subscribe =
        SimpMessageHeaderAccessor.create(SimpMessageType.SUBSCRIBE);
    subscribe.setDestination(destination);
    subscribe.setSessionId(sessionId);
    UserDestinationResult resolved =
        userDestinationResolver.resolveDestination(
            MessageBuilder.createMessage(new byte[0], subscribe.getMessageHeaders()));
    return resolved == null ? Set.of(destination) : resolved.getTargetDestinations();
  }

  protected StompFrameHandler handler(BlockingQueue<JsonNode> queue) {
    return new StompFrameHandler() {
      @Override
      public Type getPayloadType(StompHeaders headers) {
        return Map.class;
      }

      @Override
      public void handleFrame(StompHeaders headers, Object payload) {
        queue.add(objectMapper.valueToTree(payload));
      }
    };
  }

  /** Drains {@code queue} until a frame with the given {@code event} field arrives. */
  protected JsonNode waitForEvent(BlockingQueue<JsonNode> queue, String event) throws Exception {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
    JsonNode last = null;
    while (System.nanoTime() < deadline) {
      JsonNode next = queue.poll(250, TimeUnit.MILLISECONDS);
      if (next == null) {
        continue;
      }
      last = next;
      if (event.equals(next.path("event").asText())) {
        return next;
      }
    }
    throw new AssertionError("Timed out waiting for " + event + ", last event was " + last);
  }

  // ─── Plumbing ──────────────────────────────────────────────────────────────────

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
