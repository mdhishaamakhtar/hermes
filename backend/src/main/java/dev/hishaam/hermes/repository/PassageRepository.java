package dev.hishaam.hermes.repository;

import dev.hishaam.hermes.entity.Passage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PassageRepository extends JpaRepository<Passage, Long> {}
