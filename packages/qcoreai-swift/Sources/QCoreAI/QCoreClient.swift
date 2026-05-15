import Foundation

#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// AEVION QCoreAI multi-agent client for Swift / iOS / macOS.
///
/// Single-file SDK, no third-party deps. Mirrors the TypeScript SDK
/// (`@aevion/qcoreai-client`) — runSync, refine, search, eval suites,
/// prompts library.
///
/// Streaming (SSE / WebSocket) is intentionally not in v0.1 — apps that
/// need it can construct a `URLSessionDataDelegate` manually against the
/// same endpoints.
public struct QCoreClient {
    public let baseUrl: URL
    public var token: String?
    public var session: URLSession

    public init(baseUrl: URL, token: String? = nil, session: URLSession = .shared) {
        self.baseUrl = baseUrl
        self.token = token
        self.session = session
    }

    public init(baseUrl: String, token: String? = nil, session: URLSession = .shared) {
        guard let url = URL(string: baseUrl) else {
            fatalError("QCoreClient: invalid baseUrl \(baseUrl)")
        }
        self.init(baseUrl: url, token: token, session: session)
    }

    // MARK: - Run (sync)

    public struct RunOptions: Encodable {
        public let input: String
        public let strategy: String?
        public let maxCostUsd: Double?
        public let tags: [String]?
        public init(input: String, strategy: String? = nil, maxCostUsd: Double? = nil, tags: [String]? = nil) {
            self.input = input
            self.strategy = strategy
            self.maxCostUsd = maxCostUsd
            self.tags = tags
        }
    }

    public struct RunResult: Decodable {
        public let runId: String
        public let sessionId: String
        public let finalContent: String
        public let status: String
        public let totalCostUsd: Double
        public let totalDurationMs: Int
    }

    /// POST /api/qcoreai/multi-agent — buffers the entire SSE stream.
    /// We collect the stream synchronously by setting `stream: false` in the
    /// body so the server returns one JSON object instead of SSE.
    public func runSync(_ opts: RunOptions) async throws -> RunResult {
        struct Body: Encodable {
            let input: String
            let strategy: String?
            let maxCostUsd: Double?
            let tags: [String]?
            let stream: Bool
        }
        let body = Body(input: opts.input, strategy: opts.strategy, maxCostUsd: opts.maxCostUsd, tags: opts.tags, stream: false)
        return try await self.request("POST", path: "/api/qcoreai/multi-agent", body: body)
    }

    // MARK: - Refine

    public struct RefineResult: Decodable {
        public let runId: String
        public let finalContent: String
    }

    public func refine(runId: String, instruction: String, model: String? = nil, provider: String? = nil) async throws -> RefineResult {
        struct Body: Encodable {
            let instruction: String
            let model: String?
            let provider: String?
        }
        let body = Body(instruction: instruction, model: model, provider: provider)
        return try await self.request("POST", path: "/api/qcoreai/runs/\(escape(runId))/refine", body: body)
    }

    // MARK: - Tags + search

    public struct SearchHit: Decodable {
        public let runId: String
        public let sessionId: String
        public let sessionTitle: String
        public let preview: String
        public let matched: String
    }

    public func setTags(runId: String, tags: [String]) async throws {
        struct Body: Encodable { let tags: [String] }
        let _: EmptyResponse = try await self.request("PATCH", path: "/api/qcoreai/runs/\(escape(runId))/tags", body: Body(tags: tags))
    }

    public func search(_ query: String, limit: Int = 30) async throws -> [SearchHit] {
        struct Wrap: Decodable { let items: [SearchHit] }
        var comps = URLComponents()
        comps.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "limit", value: String(limit))
        ]
        let path = "/api/qcoreai/search?\(comps.query ?? "")"
        let wrap: Wrap = try await self.request("GET", path: path, body: Optional<EmptyResponse>.none)
        return wrap.items
    }

    // MARK: - Eval harness

    public struct EvalCase: Codable {
        public let id: String
        public var name: String?
        public let input: String
        public var judge: AnyCodable
        public var weight: Double?
        public init(id: String, name: String? = nil, input: String, judge: [String: Any], weight: Double? = nil) {
            self.id = id
            self.name = name
            self.input = input
            self.judge = AnyCodable(judge)
            self.weight = weight
        }
    }

    public struct EvalSuite: Decodable {
        public let id: String
        public let name: String
        public let strategy: String
    }

    public struct EvalRun: Decodable {
        public let id: String
        public let suiteId: String
        public let status: String
        public let score: Double?
        public let totalCases: Int
        public let passedCases: Int
        public let totalCostUsd: Double
    }

    public func createEvalSuite(name: String, cases: [EvalCase], strategy: String? = nil, description: String? = nil) async throws -> EvalSuite {
        struct Wrap: Decodable { let suite: EvalSuite }
        struct Body: Encodable {
            let name: String
            let cases: [EvalCase]
            let strategy: String?
            let description: String?
        }
        let wrap: Wrap = try await self.request("POST", path: "/api/qcoreai/eval/suites", body: Body(name: name, cases: cases, strategy: strategy, description: description))
        return wrap.suite
    }

    public func runEvalSuite(_ suiteId: String, concurrency: Int = 3) async throws -> EvalRun {
        struct Wrap: Decodable { let run: EvalRun }
        struct Body: Encodable { let concurrency: Int }
        let wrap: Wrap = try await self.request("POST", path: "/api/qcoreai/eval/suites/\(escape(suiteId))/run", body: Body(concurrency: concurrency))
        return wrap.run
    }

    public func getEvalRun(_ runId: String) async throws -> EvalRun {
        struct Wrap: Decodable { let run: EvalRun }
        let wrap: Wrap = try await self.request("GET", path: "/api/qcoreai/eval/runs/\(escape(runId))", body: Optional<EmptyResponse>.none)
        return wrap.run
    }

    /// Convenience: run + poll until done. Throws on error / timeout.
    public func runEvalSuiteAndWait(_ suiteId: String, pollInterval: TimeInterval = 1.5, timeout: TimeInterval = 300) async throws -> EvalRun {
        var run = try await runEvalSuite(suiteId)
        let deadline = Date().addingTimeInterval(timeout)
        while run.status == "running" {
            if Date() > deadline {
                throw QCoreError.timeout("eval run timed out")
            }
            try await Task.sleep(nanoseconds: UInt64(pollInterval * 1_000_000_000))
            run = try await getEvalRun(run.id)
        }
        if run.status == "error" {
            throw QCoreError.runFailed("eval run failed")
        }
        return run
    }

    // MARK: - Prompts

    public struct Prompt: Decodable {
        public let id: String
        public let name: String
        public let role: String
        public let content: String
        public let version: Int
        public let isPublic: Bool
    }

    public func createPrompt(name: String, content: String, role: String = "writer", description: String? = nil) async throws -> Prompt {
        struct Wrap: Decodable { let prompt: Prompt }
        struct Body: Encodable {
            let name: String
            let content: String
            let role: String
            let description: String?
        }
        let wrap: Wrap = try await self.request("POST", path: "/api/qcoreai/prompts", body: Body(name: name, content: content, role: role, description: description))
        return wrap.prompt
    }

    public func listPrompts(limit: Int = 100) async throws -> [Prompt] {
        struct Wrap: Decodable { let items: [Prompt] }
        let wrap: Wrap = try await self.request("GET", path: "/api/qcoreai/prompts?limit=\(limit)", body: Optional<EmptyResponse>.none)
        return wrap.items
    }

    public func forkPrompt(_ id: String, content: String? = nil, name: String? = nil) async throws -> Prompt {
        struct Wrap: Decodable { let prompt: Prompt }
        struct Body: Encodable {
            let content: String?
            let name: String?
        }
        let wrap: Wrap = try await self.request("POST", path: "/api/qcoreai/prompts/\(escape(id))/fork", body: Body(content: content, name: name))
        return wrap.prompt
    }

    // MARK: - Internals

    private func request<B: Encodable, R: Decodable>(_ method: String, path: String, body: B?) async throws -> R {
        let url = baseUrl.appendingPathComponent(path)
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.addValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = token {
            req.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body = body, !(body is EmptyResponse) {
            let encoder = JSONEncoder()
            req.httpBody = try encoder.encode(body)
        }
        let (data, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse else {
            throw QCoreError.network("no HTTP response")
        }
        if http.statusCode >= 400 {
            let msg = String(data: data, encoding: .utf8) ?? ""
            throw QCoreError.http(status: http.statusCode, message: msg)
        }
        if R.self == EmptyResponse.self {
            return EmptyResponse() as! R
        }
        return try JSONDecoder().decode(R.self, from: data)
    }

    private func escape(_ s: String) -> String {
        return s.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? s
    }
}

// MARK: - Errors

public enum QCoreError: Error, CustomStringConvertible {
    case network(String)
    case http(status: Int, message: String)
    case timeout(String)
    case runFailed(String)
    case decodeFailed(String)

    public var description: String {
        switch self {
        case .network(let m): return "QCore network error: \(m)"
        case .http(let s, let m): return "QCore HTTP \(s): \(m)"
        case .timeout(let m): return "QCore timeout: \(m)"
        case .runFailed(let m): return "QCore run failed: \(m)"
        case .decodeFailed(let m): return "QCore decode failed: \(m)"
        }
    }
}

// MARK: - Helpers

public struct EmptyResponse: Codable {
    public init() {}
}

/// Minimal AnyCodable for arbitrary JSON dictionaries (e.g. eval judge config).
public struct AnyCodable: Codable {
    public let value: Any
    public init(_ value: Any) { self.value = value }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self.value = NSNull()
        } else if let b = try? container.decode(Bool.self) {
            self.value = b
        } else if let i = try? container.decode(Int.self) {
            self.value = i
        } else if let d = try? container.decode(Double.self) {
            self.value = d
        } else if let s = try? container.decode(String.self) {
            self.value = s
        } else if let arr = try? container.decode([AnyCodable].self) {
            self.value = arr.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            self.value = dict.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "AnyCodable: unsupported value")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if value is NSNull {
            try container.encodeNil()
        } else if let b = value as? Bool {
            try container.encode(b)
        } else if let i = value as? Int {
            try container.encode(i)
        } else if let d = value as? Double {
            try container.encode(d)
        } else if let s = value as? String {
            try container.encode(s)
        } else if let arr = value as? [Any] {
            try container.encode(arr.map { AnyCodable($0) })
        } else if let dict = value as? [String: Any] {
            try container.encode(dict.mapValues { AnyCodable($0) })
        } else {
            throw EncodingError.invalidValue(value, EncodingError.Context(codingPath: encoder.codingPath, debugDescription: "AnyCodable: unsupported value"))
        }
    }
}
