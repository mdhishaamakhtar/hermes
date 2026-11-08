package dev.hishaam.hermes.entity;

import dev.hishaam.hermes.entity.enums.SessionStatus;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(
    name = "quiz_sessions",
    indexes = {
      @Index(name = "idx_quiz_sessions_quiz_id", columnList = "quiz_id"),
      @Index(name = "idx_quiz_sessions_join_code", columnList = "join_code")
    })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuizSession {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "quiz_id", nullable = false)
  private Quiz quiz;

  @Column(name = "join_code", unique = true, nullable = false)
  private String joinCode;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private SessionStatus status;

  @Column(name = "current_question_id")
  private Long currentQuestionId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(columnDefinition = "jsonb", nullable = false)
  private String snapshot;

  @Column(name = "started_at")
  private OffsetDateTime startedAt;

  @Column(name = "ended_at")
  private OffsetDateTime endedAt;

  /**
   * How far into the running order answers have been opened: the position of the last question
   * whose timer started. Questions past it were never asked, so results can say so instead of
   * showing them as unanswered. Null on sessions from before this was recorded, which count every
   * question as asked.
   */
  @Column(name = "opened_question_count")
  private Integer openedQuestionCount;

  @Column(name = "created_at")
  private OffsetDateTime createdAt;

  @PrePersist
  protected void onCreate() {
    if (createdAt == null) createdAt = OffsetDateTime.now();
    if (openedQuestionCount == null) openedQuestionCount = 0;
  }
}
