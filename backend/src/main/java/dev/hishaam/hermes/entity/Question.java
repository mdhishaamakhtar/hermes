package dev.hishaam.hermes.entity;

import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.entity.enums.QuestionType;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.*;
import org.hibernate.annotations.BatchSize;

@Entity
@Table(
    name = "questions",
    indexes = {
      @Index(name = "idx_questions_quiz_id", columnList = "quiz_id"),
      @Index(name = "idx_questions_passage_id", columnList = "passage_id")
    })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Question {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "quiz_id", nullable = false)
  private Quiz quiz;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "passage_id")
  private Passage passage;

  @Column(columnDefinition = "TEXT", nullable = false)
  private String text;

  @Column(name = "order_index", nullable = false)
  private int orderIndex;

  @Enumerated(EnumType.STRING)
  @Column(name = "question_type", nullable = false)
  @Builder.Default
  private QuestionType questionType = QuestionType.SINGLE_SELECT;

  @Enumerated(EnumType.STRING)
  @Column(name = "display_mode_override")
  private DisplayMode displayModeOverride;

  @Column(name = "time_limit_seconds", nullable = false)
  private int timeLimitSeconds;

  @Column(name = "created_at")
  private OffsetDateTime createdAt;

  @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("orderIndex ASC")
  @BatchSize(size = 50)
  @Builder.Default
  private List<AnswerOption> options = new ArrayList<>();

  @PrePersist
  protected void onCreate() {
    if (createdAt == null) createdAt = OffsetDateTime.now();
    if (questionType == null) questionType = QuestionType.SINGLE_SELECT;
  }
}
