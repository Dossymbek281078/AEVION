/**
 * agentRuntime — the function-calling loop (pure core).
 *
 * This is our OWN agent runtime, cloned in spirit from the QCoreAI provider work
 * but living in its own namespace so the other work stream keeps moving on
 * qcoreai untouched. Unlike the frontend Agent's rule/JSON planner, this drives
 * a REAL provider tool-use loop: the model is given tool specs, may emit tool
 * calls, we execute them, feed results back, and repeat until it answers.
 *
 * The loop itself is pure and dependency-injected (`callModel`, `execTool`), so
 * it is exercised by scripts/agent-runtime-smoke.js with fakes — no network, no
 * keys, deterministic. The real provider I/O lives in anthropicClient.ts and the
 * tool executors in tools.ts; both are injected here.
 */

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the tool input (Anthropic `input_schema` shape). */
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** One model turn: some text and/or a set of tool calls to run. */
export interface ModelStep {
  text: string;
  toolCalls: ToolCall[];
}

export interface ToolResult {
  callId: string;
  name: string;
  ok: boolean;
  content: unknown;
}

export type LoopRole = "user" | "assistant" | "tool";

export interface LoopMessage {
  role: LoopRole;
  text?: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export type CallModel = (messages: LoopMessage[], tools: ToolSpec[]) => Promise<ModelStep>;
export type ExecTool = (call: ToolCall) => Promise<{ ok: boolean; content: unknown }>;

export interface RunResult {
  finalText: string;
  steps: number;
  hitMaxSteps: boolean;
  transcript: LoopMessage[];
}

export interface RunOptions {
  messages: LoopMessage[];
  tools: ToolSpec[];
  callModel: CallModel;
  execTool: ExecTool;
  /** Safety cap on model↔tool round-trips. */
  maxSteps?: number;
}

/**
 * Run the tool-use loop until the model answers without requesting a tool, or
 * until `maxSteps` round-trips are spent (returned honestly via `hitMaxSteps`).
 */
export async function runAgentLoop(opts: RunOptions): Promise<RunResult> {
  const maxSteps = Math.max(1, opts.maxSteps ?? 5);
  const transcript: LoopMessage[] = [...opts.messages];

  for (let step = 1; step <= maxSteps; step++) {
    const model = await opts.callModel(transcript, opts.tools);

    // No tool requested → the model has produced its final answer.
    if (!model.toolCalls || model.toolCalls.length === 0) {
      transcript.push({ role: "assistant", text: model.text });
      return { finalText: model.text, steps: step, hitMaxSteps: false, transcript };
    }

    // Record the assistant's tool-use turn.
    transcript.push({ role: "assistant", text: model.text, toolCalls: model.toolCalls });

    // Execute every requested tool and feed the results back.
    const results: ToolResult[] = [];
    for (const call of model.toolCalls) {
      try {
        const r = await opts.execTool(call);
        results.push({ callId: call.id, name: call.name, ok: r.ok, content: r.content });
      } catch (e) {
        results.push({ callId: call.id, name: call.name, ok: false, content: (e as Error).message });
      }
    }
    transcript.push({ role: "tool", toolResults: results });
  }

  return {
    finalText: "Stopped after the maximum number of tool steps without a final answer.",
    steps: maxSteps,
    hitMaxSteps: true,
    transcript,
  };
}
