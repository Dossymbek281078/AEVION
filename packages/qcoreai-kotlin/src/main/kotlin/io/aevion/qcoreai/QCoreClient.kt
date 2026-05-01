package io.aevion.qcoreai

import kotlinx.coroutines.delay
import kotlinx.serialization.*
import kotlinx.serialization.json.*
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

/**
 * AEVION QCoreAI multi-agent client for Kotlin / Android / JVM.
 *
 * Single-file SDK; only deps are kotlinx-coroutines + kotlinx-serialization-json.
 * Mirrors the TypeScript SDK (`@aevion/qcoreai-client`) — runSync, refine,
 * search, eval suites, prompts library.
 *
 * Streaming (SSE / WebSocket) is not in v0.1 — apps that need it can build
 * it on top of the same endpoints with OkHttp / Ktor manually.
 */
class QCoreClient(
    private val baseUrl: String,
    var token: String? = null,
    private val httpClient: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(15))
        .build(),
) {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = false
    }

    init {
        require(baseUrl.startsWith("http")) { "baseUrl must start with http(s)://" }
    }

    private val cleanBase = baseUrl.trimEnd('/')

    /* ─── Run (sync) ───────────────────────────────────────────────────── */

    @Serializable
    data class RunOptions(
        val input: String,
        val strategy: String? = null,
        val maxCostUsd: Double? = null,
        val tags: List<String>? = null,
    )

    @Serializable
    data class RunResult(
        val runId: String,
        val sessionId: String,
        val finalContent: String,
        val status: String,
        val totalCostUsd: Double,
        val totalDurationMs: Int,
    )

    @Serializable
    private data class RunBody(
        val input: String,
        val strategy: String? = null,
        val maxCostUsd: Double? = null,
        val tags: List<String>? = null,
        val stream: Boolean = false,
    )

    suspend fun runSync(opts: RunOptions): RunResult {
        val body = RunBody(opts.input, opts.strategy, opts.maxCostUsd, opts.tags, false)
        return request("POST", "/api/qcoreai/multi-agent", body)
    }

    /* ─── Refine ───────────────────────────────────────────────────────── */

    @Serializable
    data class RefineResult(val runId: String, val finalContent: String)

    @Serializable
    private data class RefineBody(
        val instruction: String,
        val provider: String? = null,
        val model: String? = null,
    )

    suspend fun refine(runId: String, instruction: String, provider: String? = null, model: String? = null): RefineResult {
        return request("POST", "/api/qcoreai/runs/${escape(runId)}/refine", RefineBody(instruction, provider, model))
    }

    /* ─── Tags + search ────────────────────────────────────────────────── */

    @Serializable
    data class SearchHit(
        val runId: String,
        val sessionId: String,
        val sessionTitle: String,
        val preview: String,
        val matched: String,
    )

    @Serializable
    private data class SearchWrap(val items: List<SearchHit> = emptyList())

    @Serializable
    private data class TagsBody(val tags: List<String>)

    @Serializable
    private data class OkResponse(val ok: Boolean = true)

    suspend fun setTags(runId: String, tags: List<String>) {
        request<OkResponse>("PATCH", "/api/qcoreai/runs/${escape(runId)}/tags", TagsBody(tags))
    }

    suspend fun search(query: String, limit: Int = 30): List<SearchHit> {
        val q = "q=${escape(query)}&limit=$limit"
        return request<SearchWrap>("GET", "/api/qcoreai/search?$q", null).items
    }

    /* ─── Eval harness ─────────────────────────────────────────────────── */

    @Serializable
    data class EvalCase(
        val id: String,
        val name: String? = null,
        val input: String,
        val judge: JsonObject,
        val weight: Double? = null,
    )

    @Serializable
    data class EvalSuite(
        val id: String,
        val ownerUserId: String? = null,
        val name: String,
        val description: String? = null,
        val strategy: String,
    )

    @Serializable
    data class EvalCaseResult(
        val caseId: String,
        val caseName: String,
        val passed: Boolean,
        val judgeKind: String,
        val reason: String,
        val output: String,
        val costUsd: Double,
        val durationMs: Int,
    )

    @Serializable
    data class EvalRun(
        val id: String,
        val suiteId: String,
        val ownerUserId: String? = null,
        val status: String,
        val score: Double? = null,
        val totalCases: Int,
        val passedCases: Int,
        val totalCostUsd: Double,
        val results: List<EvalCaseResult> = emptyList(),
        val errorMessage: String? = null,
    )

    @Serializable
    private data class CreateSuiteBody(
        val name: String,
        val description: String? = null,
        val strategy: String? = null,
        val cases: List<EvalCase> = emptyList(),
    )

    @Serializable
    private data class SuiteWrap(val suite: EvalSuite)

    @Serializable
    private data class RunWrap(val run: EvalRun)

    @Serializable
    private data class RunBodyEval(val concurrency: Int = 3)

    suspend fun createEvalSuite(
        name: String,
        cases: List<EvalCase>,
        strategy: String? = null,
        description: String? = null,
    ): EvalSuite {
        val body = CreateSuiteBody(name, description, strategy, cases)
        return request<SuiteWrap>("POST", "/api/qcoreai/eval/suites", body).suite
    }

    suspend fun runEvalSuite(suiteId: String, concurrency: Int = 3): EvalRun {
        val body = RunBodyEval(concurrency)
        return request<RunWrap>("POST", "/api/qcoreai/eval/suites/${escape(suiteId)}/run", body).run
    }

    suspend fun getEvalRun(runId: String): EvalRun {
        return request<RunWrap>("GET", "/api/qcoreai/eval/runs/${escape(runId)}", null).run
    }

    /** Convenience: run + poll until done. Throws QCoreException on error / timeout. */
    suspend fun runEvalSuiteAndWait(
        suiteId: String,
        pollMs: Long = 1500L,
        timeoutMs: Long = 300_000L,
    ): EvalRun {
        var run = runEvalSuite(suiteId)
        val deadline = System.currentTimeMillis() + timeoutMs
        while (run.status == "running") {
            if (System.currentTimeMillis() > deadline) {
                throw QCoreException("eval run timed out after ${timeoutMs}ms")
            }
            delay(pollMs)
            run = getEvalRun(run.id)
        }
        if (run.status == "error") {
            throw QCoreException("eval run failed: ${run.errorMessage ?: "unknown"}")
        }
        return run
    }

    /* ─── Prompts ──────────────────────────────────────────────────────── */

    @Serializable
    data class Prompt(
        val id: String,
        val name: String,
        val role: String,
        val content: String,
        val version: Int,
        val isPublic: Boolean,
        val description: String? = null,
        val parentPromptId: String? = null,
    )

    @Serializable
    private data class PromptWrap(val prompt: Prompt)

    @Serializable
    private data class PromptListWrap(val items: List<Prompt> = emptyList())

    @Serializable
    private data class CreatePromptBody(
        val name: String,
        val content: String,
        val role: String = "writer",
        val description: String? = null,
    )

    @Serializable
    private data class ForkPromptBody(
        val content: String? = null,
        val name: String? = null,
    )

    suspend fun createPrompt(
        name: String,
        content: String,
        role: String = "writer",
        description: String? = null,
    ): Prompt {
        val body = CreatePromptBody(name, content, role, description)
        return request<PromptWrap>("POST", "/api/qcoreai/prompts", body).prompt
    }

    suspend fun listPrompts(limit: Int = 100): List<Prompt> {
        return request<PromptListWrap>("GET", "/api/qcoreai/prompts?limit=$limit", null).items
    }

    suspend fun forkPrompt(parentId: String, content: String? = null, name: String? = null): Prompt {
        val body = ForkPromptBody(content, name)
        return request<PromptWrap>("POST", "/api/qcoreai/prompts/${escape(parentId)}/fork", body).prompt
    }

    /* ─── Internals ────────────────────────────────────────────────────── */

    private suspend inline fun <reified R> request(method: String, path: String, body: Any?): R {
        val url = URI(cleanBase + path)
        val builder = HttpRequest.newBuilder().uri(url).timeout(Duration.ofSeconds(60))
        builder.header("Content-Type", "application/json")
        token?.let { builder.header("Authorization", "Bearer $it") }
        val pub = if (body == null) {
            HttpRequest.BodyPublishers.noBody()
        } else {
            val text = encodeAny(body)
            HttpRequest.BodyPublishers.ofString(text)
        }
        builder.method(method, pub)

        val resp: HttpResponse<String> = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString())
        if (resp.statusCode() >= 400) {
            throw QCoreException("HTTP ${resp.statusCode()}: ${resp.body().take(400)}")
        }
        if (R::class == Unit::class) {
            @Suppress("UNCHECKED_CAST")
            return Unit as R
        }
        return json.decodeFromString(resp.body())
    }

    private fun encodeAny(value: Any): String {
        return when (value) {
            is RunBody -> json.encodeToString(value)
            is RefineBody -> json.encodeToString(value)
            is TagsBody -> json.encodeToString(value)
            is CreateSuiteBody -> json.encodeToString(value)
            is RunBodyEval -> json.encodeToString(value)
            is CreatePromptBody -> json.encodeToString(value)
            is ForkPromptBody -> json.encodeToString(value)
            is JsonElement -> value.toString()
            else -> {
                // Fallback: serialize via reflection-free Map encode if possible; else throw.
                throw IllegalArgumentException("encodeAny: unsupported body type ${value::class}")
            }
        }
    }

    private fun escape(s: String): String =
        java.net.URLEncoder.encode(s, "UTF-8").replace("+", "%20")
}

class QCoreException(message: String) : RuntimeException(message)
