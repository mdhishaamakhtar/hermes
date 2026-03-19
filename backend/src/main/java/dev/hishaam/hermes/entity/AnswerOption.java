package dev.hishaam.hermes.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
    name = "options",
    indexes = {@Index(name = "idx_options_question_id", columnList = "question_id")})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnswerOption {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "question_id", nullable = false)
  private Question question;

  @Column(columnDefinition = "TEXT", nullable = false)
  private String text;

  @Column(name = "order_index", nullable = false)
  private int orderIndex;

  @Column(name = "is_correct", nullable = false)
  private boolean isCorrect;
}
