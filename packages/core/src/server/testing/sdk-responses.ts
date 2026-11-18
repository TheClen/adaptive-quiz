/**
 * HTTP responses shaped like the Anthropic API's, for tests that drive the real
 * SDK through a fake `fetch`.
 */

/** Text that must never leave `mapModelError` (AC-8.4). */
export const UPSTREAM_DETAIL = "UPSTREAM-DETAIL sk-ant-api03-not-a-real-key at internal.host:443";

export const REQUEST_ID = "req_test_0001";

export function errorResponse(
  status: number,
  type: string,
  message: string,
  options: { errorCode?: string; headers?: Record<string, string> } = {},
): Response {
  const details =
    options.errorCode === undefined ? {} : { details: { error_code: options.errorCode } };
  return new Response(
    JSON.stringify({ type: "error", error: { type, message, ...details }, request_id: REQUEST_ID }),
    {
      status,
      headers: { "content-type": "application/json", "request-id": REQUEST_ID, ...options.headers },
    },
  );
}

export function messageResponse(options: {
  text: string;
  stopReason?: string;
  model?: string;
}): Response {
  return new Response(
    JSON.stringify({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: options.model ?? "claude-haiku-5-5",
      content: [
        { type: "thinking", thinking: "", signature: "sig_test" },
        { type: "text", text: options.text },
      ],
      stop_reason: options.stopReason ?? "end_turn",
      stop_sequence: null,
      stop_details: null,
      usage: {
        input_tokens: 120,
        output_tokens: 340,
        cache_read_input_tokens: 900,
        cache_creation_input_tokens: null,
      },
    }),
    { status: 200, headers: { "content-type": "application/json", "request-id": REQUEST_ID } },
  );
}
