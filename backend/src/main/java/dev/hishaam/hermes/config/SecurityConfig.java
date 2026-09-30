package dev.hishaam.hermes.config;

import dev.hishaam.hermes.dto.ApiResponse;
import dev.hishaam.hermes.security.JwtAuthFilter;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import tools.jackson.databind.json.JsonMapper;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

  private final JwtAuthFilter jwtAuthFilter;
  private final JsonMapper jsonMapper;

  @Value("${app.cors.allowed-origin}")
  private String allowedOrigin;

  public SecurityConfig(JwtAuthFilter jwtAuthFilter, JsonMapper jsonMapper) {
    this.jwtAuthFilter = jwtAuthFilter;
    this.jsonMapper = jsonMapper;
  }

  /**
   * Answers unauthenticated requests with 401 rather than Spring's default 403. The distinction is
   * load-bearing for the frontend: a 401 is what clears the stored token and redirects to login, so
   * without this an expired token would leave the client retrying forever against a 403.
   * Authenticated requests that fail an ownership check still surface as 403 via {@code
   * AppException.forbidden}.
   */
  @Bean
  public AuthenticationEntryPoint unauthorizedEntryPoint() {
    return (request, response, authException) -> {
      response.setStatus(HttpStatus.UNAUTHORIZED.value());
      response.setContentType(MediaType.APPLICATION_JSON_VALUE);
      response.setCharacterEncoding(StandardCharsets.UTF_8.name());
      jsonMapper.writeValue(
          response.getWriter(),
          ApiResponse.error("UNAUTHORIZED", "Authentication is required to access this resource"));
    };
  }

  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }

  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) {
    return http.csrf(AbstractHttpConfigurer::disable)
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers(
                        // This list is the whole of the API's public surface: everything not
                        // named here needs a valid organiser token, so controllers carry no
                        // authorization annotations of their own.
                        "/api/auth/register",
                        "/api/auth/login",
                        "/api/sessions/join",
                        "/api/sessions/rejoin",
                        "/api/sessions/*/my-results",
                        "/api/sessions/*/answers",
                        "/api/sessions/*/lock-in",
                        "/ws-hermes/**",
                        "/swagger-ui/**",
                        "/swagger-ui.html",
                        "/v3/api-docs/**",
                        "/actuator/health")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .exceptionHandling(handling -> handling.authenticationEntryPoint(unauthorizedEntryPoint()))
        .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
        .build();
  }

  @Bean
  public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of(allowedOrigin));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("*"));
    config.setAllowCredentials(true);
    // Let browsers cache preflight responses; without this every cross-origin
    // request from the deployed frontend pays an extra OPTIONS round-trip.
    config.setMaxAge(3600L);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
  }
}
