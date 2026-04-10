package dev.hishaam.hermes.config;

import dev.hishaam.hermes.ws.StompChannelInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.*;

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
    config
        .enableStompBrokerRelay("/topic", "/queue")
        .setRelayHost(brokerRelayHost)
        .setRelayPort(brokerRelayPort)
        .setVirtualHost(brokerRelayVirtualHost)
        .setClientLogin(brokerRelayClientLogin)
        .setClientPasscode(brokerRelayClientPasscode)
        .setSystemLogin(brokerRelaySystemLogin)
        .setSystemPasscode(brokerRelaySystemPasscode);
  }

  @Override
  public void configureClientInboundChannel(ChannelRegistration registration) {
    registration.interceptors(stompChannelInterceptor);
  }
}
