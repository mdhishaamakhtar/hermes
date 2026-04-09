package dev.hishaam.hermes.security;

import dev.hishaam.hermes.repository.UserRepository;
import java.util.Collections;
import org.jspecify.annotations.NullMarked;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class CustomUserDetailsService implements UserDetailsService {

  private final UserRepository userRepository;

  public CustomUserDetailsService(UserRepository userRepository) {
    this.userRepository = userRepository;
  }

  @Override
  @NullMarked
  public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
    var entity =
        userRepository
            .findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    return new AuthenticatedUser(
        entity.getId(),
        entity.getEmail(),
        entity.getPasswordHash(),
        Collections.singletonList(new SimpleGrantedAuthority("ROLE_ORGANISER")));
  }
}
