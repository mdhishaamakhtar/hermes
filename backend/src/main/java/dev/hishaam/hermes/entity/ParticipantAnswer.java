package dev.hishaam.hermes.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.Set;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(
    name = "participant_answers",
    indexes = {
      @Index(name = "idx_participant_answers_session", columnList = "session_id"),
      @Index(name = "idx_participant_answers_part", columnList = "participant_id"),
      @Index(name = "idx_pa_session_question", columnList = "session_id,question_id")
    },
    uniqueConstraints = {
      @UniqueConstraint(
          name = "uq_participant_question",
          columnNames = {"participant_id", "question_id"})
    })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParticipantAnswer {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "session_id", nullable = false)
  private Long sessionId;

  @Column(name = "participant_id", nullable = false)
  private Long participantId;

  @Column(name = "question_id", nullable = false)
  private Long questionId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "selected_option_ids", columnDefinition = "jsonb")
  @Builder.Default
  private Set<Long> selectedOptionIds = new LinkedHashSet<>();

  @Column(name = "locked_in", nullable = false)
  @Builder.Default
  private boolean lockedIn = false;

  @Column(name = "frozen_at")
  private OffsetDateTime frozenAt;

  @Column(name = "answered_at")
  private OffsetDateTime answeredAt;

  /**
   * Computed by the grading engine after the question is frozen. Always present — an answer starts
   * at 0 and grading overwrites it — so readers never need to null-check it. Use {@link #gradedAt}
   * to tell an ungraded answer from one correctly scored zero.
   */
  @Column(name = "score", nullable = false)
  @Builder.Default
  private int score = 0;

  /**
   * When the grading engine last scored this answer, or null if it never has. Needed because {@code
   * score} defaults to 0, which makes an ungraded answer indistinguishable from one correctly
   * scored zero. Ending a session whose Redis lifecycle state was evicted relies on this to tell
   * whether the in-progress question still needs grading.
   */
  @Column(name = "graded_at")
  private OffsetDateTime gradedAt;
}
