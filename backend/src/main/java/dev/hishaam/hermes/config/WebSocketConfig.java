package dev.hishaam.hermes.config;

import dev.hishaam.hermes.ws.StompChannelInterceptor;
import io.netty.channel.ChannelOption;
import io.netty.channel.socket.nio.NioChannelOption;
import java.net.InetSocketAddress;
import jdk.net.ExtendedSocketOptions;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompReactorNettyCodec;
import org.springframework.messaging.tcp.reactor.ReactorNettyTcpClient;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.web.socket.config.annotation.*;

/**
 * Configures STOMP over WebSocket, backed by either Spring's in-memory simple broker or a full
 * relay to an external STOMP broker such as RabbitMQ.
 *
 * <p>The mode is set by {@code app.stomp.broker.mode} ({@code STOMP_BROKER_MODE}) and defaults to
 * {@code simple}, which needs no broker service at all. A single-instance deployment behaves
 * identically either way; the relay only becomes necessary to fan messages out across replicas,
 * since the simple broker keeps subscriptions in the process that owns the WebSocket. Switching is
 * a pure configuration change — set the mode to {@code relay} and supply the relay properties.
 *
 * <p>The simple broker sends and expects STOMP heartbeats every {@value #HEARTBEAT_MS} ms, as the
 * relay's broker does. Without them a socket that dies quietly (a phone that slept, a tab the
 * browser suspended, an idle proxy) is never noticed by either end, and the client sits on a dead
 * connection believing it is live.
 *
 * <p>In relay mode the Reactor Netty TCP client is tuned with TCP keepalive to survive Railway's
 * idle-connection proxy timeout (~60 s) and a dynamic {@code remoteAddress} supplier so DNS is
 * re-resolved on each reconnect attempt (works around stale IPs after broker container restarts —
 * SPR-13702).
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

  /** Value of {@code app.stomp.broker.mode} that selects the external relay. */
  private static final String MODE_RELAY = "relay";

  /** Heartbeat interval each way; the frontend client uses the same. */
  private static final long HEARTBEAT_MS = 10_000;

  private final StompChannelInterceptor stompChannelInterceptor;
  private final TaskScheduler heartbeatScheduler;

  @Value("${app.cors.allowed-origin}")
  private String allowedOrigin;

  @Value("${app.stomp.broker.mode:simple}")
  private String brokerMode;

  @Value("${app.stomp.broker-relay.host}")
  private String brokerRelayHost;

  @Value("${app.stomp.broker-relay.port}")
  private int brokerRelayPort;

  @Value("${app.stomp.broker-relay.virtual-host}")
  private String brokerRelayVirtualHost;

  @Value("${app.stomp.broker-relay.client-login}")
  private String brokerRelayClientLogin;

  @Value("${app.stomp.broker-relay.client-passcode}")
  private String brokerRelayClientPasscode;

  @Value("${app.stomp.broker-relay.system-login}")
  private String brokerRelaySystemLogin;

  @Value("${app.stomp.broker-relay.system-passcode}")
  private String brokerRelaySystemPasscode;

  /**
   * The scheduler is the broker's own, defined by the configuration this class customises; it is
   * lazy because that configuration is still being built when this one is created.
   */
  public WebSocketConfig(
      StompChannelInterceptor stompChannelInterceptor,
      @Lazy @Qualifier("messageBrokerTaskScheduler") TaskScheduler heartbeatScheduler) {
    this.stompChannelInterceptor = stompChannelInterceptor;
    this.heartbeatScheduler = heartbeatScheduler;
  }

  @Override
  public void registerStompEndpoints(StompEndpointRegistry registry) {
    registry.addEndpoint("/ws-hermes").setAllowedOrigins(allowedOrigin);
  }

  @Override
  public void configureMessageBroker(MessageBrokerRegistry config) {
    config.setApplicationDestinationPrefixes("/app");

    if (!MODE_RELAY.equalsIgnoreCase(brokerMode)) {
      // In-process broker: same destinations and the same /user/** routing, no broker service.
      config
          .enableSimpleBroker("/topic", "/queue")
          .setHeartbeatValue(new long[] {HEARTBEAT_MS, HEARTBEAT_MS})
          .setTaskScheduler(heartbeatScheduler);
      return;
    }

    // Custom TCP client: aggressive keepalive to survive Railway's idle-connection
    // proxy (~60s timeout), connect timeout to bound reconnect resource usage, and
    // a remoteAddress supplier so DNS is re-resolved on each reconnect attempt
    // (fixes stale-IP after RabbitMQ container restart on Railway — SPR-13702).
    ReactorNettyTcpClient<byte[]> tcpClient =
        new ReactorNettyTcpClient<>(
            client ->
                client
                    .remoteAddress(() -> new InetSocketAddress(brokerRelayHost, brokerRelayPort))
                    .option(ChannelOption.SO_KEEPALIVE, true)
                    .option(NioChannelOption.of(ExtendedSocketOptions.TCP_KEEPIDLE), 30)
                    .option(NioChannelOption.of(ExtendedSocketOptions.TCP_KEEPINTERVAL), 10)
                    .option(NioChannelOption.of(ExtendedSocketOptions.TCP_KEEPCOUNT), 3)
                    .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000),
            new StompReactorNettyCodec());

    config
        .enableStompBrokerRelay("/topic", "/queue")
        .setTcpClient(tcpClient)
        .setRelayHost(brokerRelayHost)
        .setRelayPort(brokerRelayPort)
        .setVirtualHost(brokerRelayVirtualHost)
        .setClientLogin(brokerRelayClientLogin)
        .setClientPasscode(brokerRelayClientPasscode)
        .setSystemLogin(brokerRelaySystemLogin)
        .setSystemPasscode(brokerRelaySystemPasscode)
        .setSystemHeartbeatSendInterval(10000)
        .setSystemHeartbeatReceiveInterval(10000);
  }

  @Override
  public void configureClientInboundChannel(ChannelRegistration registration) {
    registration.interceptors(stompChannelInterceptor);
  }
}
