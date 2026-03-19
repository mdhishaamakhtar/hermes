package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.AuthResponse;
import dev.hishaam.hermes.dto.LoginRequest;
import dev.hishaam.hermes.dto.RegisterRequest;
import dev.hishaam.hermes.dto.UserResponse;
import dev.hishaam.hermes.entity.User;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.UserRepository;
import dev.hishaam.hermes.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;
  private final JwtUtil jwtUtil;

  public AuthService(
      UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
    this.jwtUtil = jwtUtil;
  }

  @Transactional
  public UserResponse register(RegisterRequest request) {
    if (userRepository.existsByEmail(request.email())) {
      throw AppException.conflict("Email already registered");
    }
    User user =
        User.builder()
            .email(request.email())
            .passwordHash(passwordEncoder.encode(request.password()))
            .displayName(request.displayName())
            .build();
    user = userRepository.save(user);
    return toResponse(user);
  }

  public AuthResponse login(LoginRequest request) {
    User user =
        userRepository
            .findByEmail(request.email())
            .orElseThrow(() -> AppException.unauthorized("Invalid credentials"));
    if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
      throw AppException.unauthorized("Invalid credentials");
    }
    String token = jwtUtil.generateToken(user.getEmail());
    return new AuthResponse(token, toResponse(user));
  }

  public UserResponse getMe(String email) {
    User user =
        userRepository
            .findByEmail(email)
            .orElseThrow(() -> AppException.notFound("User not found"));
    return toResponse(user);
  }

  private UserResponse toResponse(User user) {
    return new UserResponse(
        user.getId(), user.getEmail(), user.getDisplayName(), user.getCreatedAt());
  }
}
