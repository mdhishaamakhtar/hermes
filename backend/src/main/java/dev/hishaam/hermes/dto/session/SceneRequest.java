package dev.hishaam.hermes.dto.session;

import dev.hishaam.hermes.entity.enums.StageScene;
import jakarta.validation.constraints.NotNull;

public record SceneRequest(@NotNull StageScene scene) {}
