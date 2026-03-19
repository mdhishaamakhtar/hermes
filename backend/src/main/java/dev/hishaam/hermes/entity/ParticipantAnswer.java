package dev.hishaam.hermes.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import lombok.*;

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

  @Column(name = "option_id", nullable = false)
  private Long optionId;

  @Column(name = "is_correct", nullable = false)
  private boolean isCorrect;

  @Column(name = "answered_at")
  private OffsetDateTime answeredAt;
}
