package dev.hishaam.hermes.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.*;
import org.hibernate.annotations.BatchSize;

@Entity
@Table(
    name = "quizzes",
    indexes = {@Index(name = "idx_quizzes_event_id", columnList = "event_id")})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Quiz {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "event_id", nullable = false)
  private Event event;

  @Column(nullable = false)
  private String title;

  @Column(name = "order_index", nullable = false)
  private int orderIndex;

  @Column(name = "created_at")
  private OffsetDateTime createdAt;

  @OneToMany(mappedBy = "quiz", cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("orderIndex ASC")
  @BatchSize(size = 50)
  @Builder.Default
  private List<Question> questions = new ArrayList<>();

  @OneToMany(mappedBy = "quiz", cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("orderIndex ASC")
  @BatchSize(size = 50)
  @Builder.Default
  private List<Passage> passages = new ArrayList<>();

  @PrePersist
  protected void onCreate() {
    if (createdAt == null) createdAt = OffsetDateTime.now();
  }
}
