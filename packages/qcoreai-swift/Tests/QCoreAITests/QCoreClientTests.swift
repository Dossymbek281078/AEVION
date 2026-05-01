import XCTest
@testable import QCoreAI

final class QCoreClientTests: XCTestCase {
    func testInitWithStringBaseUrl() {
        let client = QCoreClient(baseUrl: "https://api.aevion.io", token: "abc")
        XCTAssertEqual(client.baseUrl.absoluteString, "https://api.aevion.io")
        XCTAssertEqual(client.token, "abc")
    }

    func testAnyCodableRoundtripDictionary() throws {
        let dict: [String: Any] = [
            "type": "contains",
            "needle": "TL;DR",
            "caseSensitive": false
        ]
        let coded = AnyCodable(dict)
        let data = try JSONEncoder().encode(coded)
        let decoded = try JSONDecoder().decode(AnyCodable.self, from: data)
        guard let out = decoded.value as? [String: Any] else {
            return XCTFail("expected dict")
        }
        XCTAssertEqual(out["type"] as? String, "contains")
        XCTAssertEqual(out["needle"] as? String, "TL;DR")
        XCTAssertEqual(out["caseSensitive"] as? Bool, false)
    }

    func testAnyCodableArray() throws {
        let arr: [Any] = [1, "two", true, NSNull()]
        let coded = AnyCodable(arr)
        let data = try JSONEncoder().encode(coded)
        let decoded = try JSONDecoder().decode(AnyCodable.self, from: data)
        guard let out = decoded.value as? [Any] else {
            return XCTFail("expected array")
        }
        XCTAssertEqual(out.count, 4)
        XCTAssertEqual(out[0] as? Int, 1)
        XCTAssertEqual(out[1] as? String, "two")
        XCTAssertEqual(out[2] as? Bool, true)
    }

    func testEvalCaseEncodes() throws {
        let c = QCoreClient.EvalCase(
            id: "c1",
            name: "Has TL;DR",
            input: "Plan a 30-day onboarding",
            judge: ["type": "contains", "needle": "TL;DR"],
            weight: 1
        )
        let data = try JSONEncoder().encode(c)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertEqual(json["id"] as? String, "c1")
        XCTAssertEqual(json["input"] as? String, "Plan a 30-day onboarding")
        let judge = json["judge"] as! [String: Any]
        XCTAssertEqual(judge["type"] as? String, "contains")
    }

    func testQCoreErrorDescription() {
        let err = QCoreError.http(status: 401, message: "auth required")
        XCTAssertTrue(String(describing: err).contains("401"))
    }
}
