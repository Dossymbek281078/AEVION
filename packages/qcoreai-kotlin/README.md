# QCoreAI for Kotlin / Android

Native Kotlin client for [AEVION QCoreAI](https://aevion.io/qcoreai) — a multi-agent LLM pipeline with sequential / parallel / debate strategies, eval harness, and a prompts library.

Single-file SDK (~310 LOC). Only deps are `kotlinx-coroutines` + `kotlinx-serialization-json` + the JDK 11 `HttpClient`. Works on Android (API 24+ via desugar) and any JVM 11+.

## Install (Gradle)

```kotlin
// settings.gradle.kts
includeBuild("../qcoreai-kotlin") // or publish to a Maven repo

// build.gradle.kts
dependencies {
    implementation("io.aevion:qcoreai-client:0.1.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")
}
```

## Quick start

```kotlin
import io.aevion.qcoreai.QCoreClient
import kotlinx.coroutines.runBlocking

val client = QCoreClient(
    baseUrl = "https://api.aevion.io",
    token = System.getenv("AEVION_TOKEN")
)

runBlocking {
    val result = client.runSync(
        QCoreClient.RunOptions(
            input = "Compare Postgres vs DynamoDB for an event-sourced ledger.",
            strategy = "sequential",
            maxCostUsd = 0.10,
        )
    )
    println("Final: ${result.finalContent}")
    println("Cost: ${result.totalCostUsd} Run: ${result.runId}")
}
```

## Refining a run

```kotlin
val refined = client.refine(
    runId = result.runId,
    instruction = "Add a TL;DR section at the top.",
)
```

## Tags + search

```kotlin
client.setTags(result.runId, listOf("investor-deck", "ledger-research"))
val hits = client.search("ledger")
hits.forEach { println(it.preview) }
```

## Eval harness

```kotlin
import kotlinx.serialization.json.*

val suite = client.createEvalSuite(
    name = "Onboarding writer regression",
    cases = listOf(
        QCoreClient.EvalCase(
            id = "c1",
            name = "Has TL;DR",
            input = "Plan a 30-day onboarding for a B2B SaaS",
            judge = buildJsonObject {
                put("type", "contains")
                put("needle", "TL;DR")
                put("caseSensitive", false)
            },
        ),
        QCoreClient.EvalCase(
            id = "c2",
            name = "Min length",
            input = "Plan a 30-day onboarding for a B2B SaaS",
            judge = buildJsonObject {
                put("type", "min_length")
                put("chars", 800)
            },
        ),
    ),
    strategy = "sequential",
)

val run = client.runEvalSuiteAndWait(suite.id)
println("Score: ${(run.score ?: 0.0) * 100}%")
println("Passed: ${run.passedCases}/${run.totalCases}")
```

## Prompts library

```kotlin
val prompt = client.createPrompt(
    name = "Friendly onboarding writer",
    content = "You are a senior PM. Tone: warm, concrete. Always include a TL;DR.",
    role = "writer",
)

val v2 = client.forkPrompt(
    parentId = prompt.id,
    content = "You are a senior PM. Tone: warm, concrete. Always include a TL;DR + a 30-day plan.",
)
println("Forked v${v2.version}")
```

## Android-specific notes

- All `suspend` calls run on whatever dispatcher you call them from. For UI code, wrap in `lifecycleScope.launch(Dispatchers.IO) { … }`.
- `INTERNET` permission required in `AndroidManifest.xml`.
- For API 24-25, set `coreLibraryDesugaringEnabled = true` so `java.net.http.HttpClient` (JDK 11) is available.

## Auth

Owner-scoped endpoints (eval suites, tags, prompts) require a JWT in `Authorization: Bearer <token>`. Pass it at construction time, or assign `client.token = …` later.

`runSync` works without auth — useful for unauthenticated demo screens.

## What's not in v0.1

- Streaming (SSE / WebSocket): use OkHttp's `EventSource` against the same endpoints if you need token-by-token output. The TS SDK has it; the Kotlin one will land it in a follow-up.
- Webhook HMAC verification: Android apps don't host webhook receivers. If you need it server-side in Kotlin, the algorithm is HMAC-SHA256 with constant-time compare — `javax.crypto.Mac` does it.

## License

Apache-2.0 © AEVION
