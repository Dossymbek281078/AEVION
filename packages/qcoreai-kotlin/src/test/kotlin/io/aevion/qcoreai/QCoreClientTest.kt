package io.aevion.qcoreai

import kotlinx.serialization.json.*
import kotlin.test.*

class QCoreClientTest {
    @Test
    fun rejectsMissingProtocol() {
        val ex = assertFailsWith<IllegalArgumentException> {
            QCoreClient(baseUrl = "api.aevion.io")
        }
        assertTrue(ex.message!!.contains("http"))
    }

    @Test
    fun trimTrailingSlash() {
        val c = QCoreClient(baseUrl = "https://api.aevion.io/")
        // No accessor for cleanBase, but constructor is happy — proves trailing
        // slash doesn't blow up. (We rely on `init` to validate.)
        assertNull(c.token)
    }

    @Test
    fun evalCaseSerializes() {
        val judge = buildJsonObject {
            put("type", "contains")
            put("needle", "TL;DR")
            put("caseSensitive", false)
        }
        val c = QCoreClient.EvalCase(
            id = "c1",
            name = "Has TL;DR",
            input = "Plan a 30-day onboarding",
            judge = judge,
            weight = 1.0,
        )
        val j = Json.encodeToString(QCoreClient.EvalCase.serializer(), c)
        assertTrue(j.contains("\"id\":\"c1\""))
        assertTrue(j.contains("\"type\":\"contains\""))
        assertTrue(j.contains("\"needle\":\"TL;DR\""))
    }

    @Test
    fun promptDecodesWithDefaults() {
        val raw = """
            {
              "id":"p1","name":"Onboarding writer","role":"writer",
              "content":"Be a friendly senior PM.","version":1,"isPublic":false
            }
        """.trimIndent()
        val p = Json.decodeFromString(QCoreClient.Prompt.serializer(), raw)
        assertEquals("p1", p.id)
        assertEquals(1, p.version)
        assertNull(p.parentPromptId)
        assertNull(p.description)
    }

    @Test
    fun runResultParses() {
        val raw = """
            {"runId":"r1","sessionId":"s1","finalContent":"hi","status":"done","totalCostUsd":0.012,"totalDurationMs":4321}
        """.trimIndent()
        val r = Json.decodeFromString(QCoreClient.RunResult.serializer(), raw)
        assertEquals("r1", r.runId)
        assertEquals("done", r.status)
        assertEquals(0.012, r.totalCostUsd)
    }

    @Test
    fun evalRunDefaults() {
        val raw = """{"id":"x","suiteId":"s","status":"running","totalCases":3,"passedCases":0,"totalCostUsd":0}"""
        val r = Json.decodeFromString(QCoreClient.EvalRun.serializer(), raw)
        assertEquals("running", r.status)
        assertEquals(0, r.passedCases)
        assertNull(r.score)
        assertTrue(r.results.isEmpty())
    }

    @Test
    fun qCoreExceptionMessageReadable() {
        val e = QCoreException("HTTP 401: auth required")
        assertTrue(e.message!!.contains("401"))
    }
}
