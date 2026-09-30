package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import dev.hishaam.hermes.support.BaseIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;

/**
 * Integration tests for requests the framework rejects before any controller runs.
 *
 * <p>The player-facing endpoints are public, so they see every malformed request the internet
 * sends. Those are the caller's mistakes and must come back as 4xx in the API's usual envelope —
 * not as a 500 that logs a stack trace and tells the client the server is broken.
 */
class RequestErrorsIntegrationTest extends BaseIntegrationTest {

  /** Verifies that a body that is not valid JSON is a 400. */
  @Test
  void aMalformedJsonBodyIsABadRequest() throws Exception {
    JsonNode error =
        errorOf(
            post("/api/sessions/join").contentType(MediaType.APPLICATION_JSON).content("{not json"),
            400);
    assertThat(error.path("code").asText()).isEqualTo("BAD_REQUEST");
  }

  /** Verifies that leaving out the rejoin-token header is a 400. */
  @Test
  void aMissingRequiredHeaderIsABadRequest() throws Exception {
    JsonNode error = errorOf(get("/api/sessions/1/my-results"), 400);
    assertThat(error.path("code").asText()).isEqualTo("BAD_REQUEST");
    assertThat(error.path("message").asText()).contains("X-Rejoin-Token");
  }

  /** Verifies that a session id that is not a number is a 400. */
  @Test
  void aNonNumericPathIdIsABadRequest() throws Exception {
    JsonNode error =
        errorOf(
            post("/api/sessions/abc/answers").contentType(MediaType.APPLICATION_JSON).content("{}"),
            400);
    assertThat(error.path("code").asText()).isEqualTo("BAD_REQUEST");
  }

  /** Verifies that the wrong HTTP method is a 405. */
  @Test
  void anUnsupportedHttpMethodIsMethodNotAllowed() throws Exception {
    JsonNode error = errorOf(get("/api/sessions/join"), 405);
    assertThat(error.path("code").asText()).isEqualTo("METHOD_NOT_ALLOWED");
  }

  /** Verifies that a body sent without a JSON content type is a 415. */
  @Test
  void anUnsupportedContentTypeIsRejectedAsSuch() throws Exception {
    JsonNode error =
        errorOf(post("/api/sessions/join").contentType(MediaType.TEXT_PLAIN).content("hello"), 415);
    assertThat(error.path("code").asText()).isEqualTo("UNSUPPORTED_MEDIA_TYPE");
  }

  private JsonNode errorOf(MockHttpServletRequestBuilder request, int expectedStatus)
      throws Exception {
    MvcResult result = mockMvc.perform(request).andReturn();
    assertThat(result.getResponse().getStatus()).isEqualTo(expectedStatus);
    JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
    assertThat(body.path("success").asBoolean()).isFalse();
    return body.path("error");
  }
}
