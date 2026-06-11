package dev.hishaam.hermes.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.jspecify.annotations.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * HTTP request filter that extracts a Bearer JWT from the {@code Authorization} header, validates
 * it, and populates the Spring Security context with the organizer's {@link AuthenticatedUser}. A
 * missing or invalid token leaves the context unauthenticated so Spring Security can enforce
 * endpoint-level access control downstream.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

  private final JwtUtil jwtUtil;
  private final CustomUserDetailsService userDetailsService;

  public JwtAuthFilter(JwtUtil jwtUtil, CustomUserDetailsService userDetailsService) {
    this.jwtUtil = jwtUtil;
    this.userDetailsService = userDetailsService;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      @NonNull HttpServletResponse response,
      @NonNull FilterChain filterChain)
      throws ServletException, IOException {

    String header = request.getHeader("Authorization");
    if (header != null && header.startsWith("Bearer ")) {
      String token = header.substring(7);
      if (jwtUtil.isValid(token)) {
        String email = jwtUtil.extractEmail(token);
        try {
          UserDetails userDetails = userDetailsService.loadUserByUsername(email);
          var auth =
              new UsernamePasswordAuthenticationToken(
                  userDetails, null, userDetails.getAuthorities());
          auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
          SecurityContextHolder.getContext().setAuthentication(auth);
        } catch (UsernameNotFoundException ignored) {
          // Token valid but user deleted — treat as unauthenticated
        }
      }
    }

    filterChain.doFilter(request, response);
  }
}
