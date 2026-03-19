package dev.hishaam.hermes.repository;

import dev.hishaam.hermes.entity.AnswerOption;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AnswerOptionRepository extends JpaRepository<AnswerOption, Long> {
  List<AnswerOption> findByQuestionIdOrderByOrderIndexAsc(Long questionId);

  void deleteAllByQuestionId(Long questionId);
}
