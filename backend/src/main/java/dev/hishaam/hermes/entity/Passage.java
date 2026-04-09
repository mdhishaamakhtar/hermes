package dev.hishaam.hermes.entity;

import dev.hishaam.hermes.entity.enums.PassageTimerMode;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.*;
import org.hibernate.annotations.BatchSize;

@Entity
@Table(
    name = "passages",
    indexes = {@Index(name = "idx_passages_quiz_id", columnList = "quiz_id")})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Passage {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "quiz_id", nullable = false)
  private Quiz quiz;

  @Column(columnDefinition = "TEXT", nullable = false)
  private String text;

  @Column(name = "order_index", nullable = false)
  private int orderIndex;

  @Enumerated(EnumType.STRING)
  @Column(name = "timer_mode", nullable = false)
  @Builder.Default
  private PassageTimerMode timerMode = PassageTimerMode.PER_SUB_QUESTION;

  @Column(name = "time_limit_seconds")
  private Integer timeLimitSeconds;

  @Column(name = "created_at")
  private OffsetDateTime createdAt;

  @OneToMany(mappedBy = "passage", cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("orderIndex ASC")
  @BatchSize(size = 50)
  @Builder.Default
  private List<Question> subQuestions = new ArrayList<>();

  @PrePersist
  protected void onCreate() {
    if (createdAt == null) createdAt = OffsetDateTime.now();
    if (timerMode == null) timerMode = PassageTimerMode.PER_SUB_QUESTION;
  }
}
