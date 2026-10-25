package dev.hishaam.hermes.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.*;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.ColumnDefault;

@Entity
@Table(
    name = "events",
    indexes = {@Index(name = "idx_events_user_id", columnList = "user_id")})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Event {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @Column(nullable = false)
  private String title;

  @Column(columnDefinition = "TEXT")
  private String description;

  /**
   * The organiser's catch-all event, made the first time they create a quiz without choosing one.
   * Quizzes don't need an event; this is where the ones without one live. It never shows as an
   * event of its own.
   */
  @Column(name = "default_event", nullable = false)
  @ColumnDefault("false")
  @Builder.Default
  private boolean defaultEvent = false;

  @Column(name = "created_at")
  private OffsetDateTime createdAt;

  @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("orderIndex ASC")
  @BatchSize(size = 50)
  @Builder.Default
  private List<Quiz> quizzes = new ArrayList<>();

  @PrePersist
  protected void onCreate() {
    if (createdAt == null) createdAt = OffsetDateTime.now();
  }
}
