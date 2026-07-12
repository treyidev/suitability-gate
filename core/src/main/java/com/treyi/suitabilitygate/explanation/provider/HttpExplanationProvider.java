package com.treyi.suitabilitygate.explanation.provider;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.treyi.suitabilitygate.explanation.ExplanationProvider;
import com.treyi.suitabilitygate.suitability.Verdict;

/**
 * {@link ExplanationProvider} backed by the external explanation service over HTTP — the single
 * Java→Python call in the system (locked D3/D18: exactly one, and this is it).
 *
 * <p>Speaks the service's {@code POST /explain} contract (camelCase JSON, PII-free). Failures —
 * connect refused, timeout, non-2xx, malformed body — surface as {@code RestClientException} to the
 * handler, whose policy is mark-FAILED-and-move-on; nothing here retries, because a slow or dead
 * explanation service must never accumulate pressure near the verdict path.
 *
 * <p>Timeouts are generous on read (a future real LLM renders in seconds) but tight on connect (a
 * dead container should fail fast).
 */
@Component
class HttpExplanationProvider implements ExplanationProvider {

    private static final Logger log = LoggerFactory.getLogger(HttpExplanationProvider.class);
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(2);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(15);

    private final RestClient restClient;

    HttpExplanationProvider(@Value("${suitabilitygate.explanation.url}") String baseUrl) {
        // Pin HTTP/1.1: the JDK HttpClient defaults to HTTP/2 and, over cleartext, sends an h2c
        // upgrade (Connection: Upgrade, HTTP2-Settings, Transfer-Encoding: chunked). The Python
        // explanation service (uvicorn/h11) is HTTP/1.1-only and mishandles that upgrade — it drops
        // the request body, so FastAPI rejects it as "body missing" (422). Forcing HTTP/1.1 removes
        // the upgrade and sends a clean Content-Length body. (Verified against a raw wire capture,
        // 2026-07-11.)
        HttpClient jdkClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(CONNECT_TIMEOUT)
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(jdkClient);
        requestFactory.setReadTimeout(READ_TIMEOUT);
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
        log.info("Explanation service endpoint: {}", baseUrl);
    }

    @Override
    public Explanation explain(String certificateNumber, Verdict verdict, List<String> failedRuleIds) {
        ExplainResponse response = restClient.post()
                .uri("/explain")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(new ExplainRequest(certificateNumber, verdict.name(), failedRuleIds))
                .retrieve()
                .body(ExplainResponse.class);
        if (response == null || response.explanationText() == null) {
            throw new IllegalStateException(
                    "Explanation service returned an empty body for " + certificateNumber);
        }
        return new Explanation(response.provider(), response.explanationText());
    }

    /** Wire request for {@code POST /explain} (matches the service's ExplainRequest schema). */
    private record ExplainRequest(String certificateNumber, String verdict, List<String> failedRules) {
    }

    /** Wire response from {@code POST /explain} (matches the service's ExplainResponse schema). */
    private record ExplainResponse(String provider, String explanationText) {
    }
}
