package dev.hishaam.hermes.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
    name = "answer_options",
    indexes = {@Index(name = "idx_answer_options_question_id", columnList = "question_id")})
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

  @Column(name = "point_value", nullable = false)
  @Builder.Default
  private int pointValue = 0;
}
