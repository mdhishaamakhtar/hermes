package dev.hishaam.hermes.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import lombok.*;

@Entity
@Table(
    name = "participants",
    indexes = {@Index(name = "idx_participants_session_id", columnList = "session_id")})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Participant {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "session_id", nullable = false)
  private QuizSession session;

  @Column(name = "display_name", nullable = false)
  private String displayName;

  @Column(name = "rejoin_token", unique = true, nullable = false)
  private String rejoinToken;

  @Column(name = "joined_at")
  private OffsetDateTime joinedAt;

  @PrePersist
  protected void onCreate() {
    if (joinedAt == null) joinedAt = OffsetDateTime.now();
  }
}
