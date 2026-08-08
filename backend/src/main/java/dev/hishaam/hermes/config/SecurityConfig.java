package dev.hishaam.hermes.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.hishaam.hermes.dto.ApiResponse;
import dev.hishaam.hermes.security.CustomUserDetailsService;
import dev.hishaam.hermes.security.JwtAuthFilter;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
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

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

  private final JwtAuthFilter jwtAuthFilter;
  private final CustomUserDetailsService userDetailsService;
  private final ObjectMapper objectMapper;

  @Value("${app.cors.allowed-origin}")
  private String allowedOrigin;

  public SecurityConfig(
      JwtAuthFilter jwtAuthFilter,
      CustomUserDetailsService userDetailsService,
      ObjectMapper objectMapper) {
    this.jwtAuthFilter = jwtAuthFilter;
    this.userDetailsService = userDetailsService;
    this.objectMapper = objectMapper;
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
      objectMapper.writeValue(
          response.getWriter(),
          ApiResponse.error("UNAUTHORIZED", "Authentication is required to access this resource"));
    };
  }

  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }

  @Bean
  public AuthenticationManager authenticationManager() {
    DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
    provider.setPasswordEncoder(passwordEncoder());
    return new ProviderManager(provider);
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
                        // Only registration and login are public. /api/auth/me dereferences the
                        // authenticated principal, so leaving it open here made an anonymous call
                        // NPE into a 500 instead of a clean 401.
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
