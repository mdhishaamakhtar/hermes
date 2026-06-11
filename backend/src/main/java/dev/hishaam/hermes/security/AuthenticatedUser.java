package dev.hishaam.hermes.security;

import java.util.Collection;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

/**
 * Spring Security {@link org.springframework.security.core.userdetails.UserDetails} implementation
 * that carries the organizer's database {@code id} alongside the standard username/password/roles.
 * Injected into controller methods via {@code @AuthenticationPrincipal}.
 */
public class AuthenticatedUser extends User {

  private final Long id;

  public AuthenticatedUser(
      Long id,
      String username,
      String password,
      Collection<? extends GrantedAuthority> authorities) {
    super(username, password, authorities);
    this.id = id;
  }

  public Long getId() {
    return id;
  }
}
