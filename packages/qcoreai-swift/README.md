# QCoreAI for Swift

Native Swift / iOS / macOS client for [AEVION QCoreAI](https://aevion.io/qcoreai) — a multi-agent LLM pipeline with sequential / parallel / debate strategies, eval harness, and a prompts library.

Single-file SDK (~280 LOC). No third-party deps. Works on iOS 15+, macOS 12+, tvOS 15+, watchOS 8+.

## Install (Swift Package Manager)

In your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/Dossymbek281078/AEVION", from: "0.1.0")
]
```

Or in Xcode: **File → Add Package Dependencies** and paste the repo URL.

## Quick start

```swift
import QCoreAI

let client = QCoreClient(
    baseUrl: "https://api.aevion.io",
    token: ProcessInfo.processInfo.environment["AEVION_TOKEN"]
)

let result = try await client.runSync(
    QCoreClient.RunOptions(
        input: "Compare Postgres vs DynamoDB for an event-sourced ledger.",
        strategy: "sequential",
        maxCostUsd: 0.10
    )
)
print("Final:", result.finalContent)
print("Cost:", result.totalCostUsd, "Run:", result.runId)
```

## Refining a run

```swift
let refined = try await client.refine(
    runId: result.runId,
    instruction: "Add a TL;DR section at the top."
)
```

## Tags + search

```swift
try await client.setTags(runId: result.runId, tags: ["investor-deck", "ledger-research"])
let hits = try await client.search("ledger")
hits.forEach { print($0.preview) }
```

## Eval harness

```swift
let suite = try await client.createEvalSuite(
    name: "Onboarding writer regression",
    cases: [
        QCoreClient.EvalCase(
            id: "c1",
            name: "Has TL;DR",
            input: "Plan a 30-day onboarding for a B2B SaaS",
            judge: ["type": "contains", "needle": "TL;DR", "caseSensitive": false]
        ),
        QCoreClient.EvalCase(
            id: "c2",
            name: "Min length",
            input: "Plan a 30-day onboarding for a B2B SaaS",
            judge: ["type": "min_length", "chars": 800]
        ),
    ],
    strategy: "sequential"
)

let run = try await client.runEvalSuiteAndWait(suite.id)
print("Score:", (run.score ?? 0) * 100, "%")
print("Passed:", run.passedCases, "/", run.totalCases)
```

## Prompts library

```swift
let prompt = try await client.createPrompt(
    name: "Friendly onboarding writer",
    content: "You are a senior PM. Tone: warm, concrete. Always include a TL;DR.",
    role: "writer"
)

let v2 = try await client.forkPrompt(
    prompt.id,
    content: "You are a senior PM. Tone: warm, concrete. Always include a TL;DR + a 30-day plan."
)
print("Forked v\(v2.version)")
```

## Auth

Owner-scoped endpoints (eval suites, tags, prompts) require a JWT in `Authorization: Bearer <token>`. Pass it at construction time, or assign `client.token = …` later.

`runSync` works without auth — useful for unauthenticated demo screens.

## What's not in v0.1

- Streaming (SSE / WebSocket): use the same endpoints with `URLSessionDataDelegate` directly if you need token-by-token output. The TS SDK has it; the Swift one will land it in a follow-up.
- Webhook HMAC verification: Swift apps usually don't host webhook receivers. If you need it, the algorithm is HMAC-SHA256 — `CryptoKit` does it in 5 lines.

## License

Apache-2.0 © AEVION
