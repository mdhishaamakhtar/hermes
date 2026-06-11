package dev.hishaam.hermes.config;

import dev.hishaam.hermes.ws.StompChannelInterceptor;
import io.netty.channel.ChannelOption;
import io.netty.channel.socket.nio.NioChannelOption;
import java.net.InetSocketAddress;
import jdk.net.ExtendedSocketOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompReactorNettyCodec;
import org.springframework.messaging.tcp.reactor.ReactorNettyTcpClient;
import org.springframework.web.socket.config.annotation.*;

/**
 * Configures STOMP over WebSocket with a full broker relay to RabbitMQ. The Reactor Netty TCP
 * client is tuned with TCP keepalive to survive Railway's idle-connection proxy timeout (~60 s) and
 * a dynamic {@code remoteAddress} supplier so DNS is re-resolved on each reconnect attempt (works
 * around stale IPs after broker container restarts — SPR-13702).
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

  private final StompChannelInterceptor stompChannelInterceptor;

  @Value("${app.cors.allowed-origin}")
  private String allowedOrigin;

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

  public WebSocketConfig(StompChannelInterceptor stompChannelInterceptor) {
    this.stompChannelInterceptor = stompChannelInterceptor;
  }

  @Override
  public void registerStompEndpoints(StompEndpointRegistry registry) {
    registry.addEndpoint("/ws-hermes").setAllowedOrigins(allowedOrigin);
  }

  @Override
  public void configureMessageBroker(MessageBrokerRegistry config) {
    config.setApplicationDestinationPrefixes("/app");

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
