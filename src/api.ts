import { Console, Data, Effect, Schedule } from "effect";
import {
  PUBLIC_API_AGENT_HEADER,
  PUBLIC_API_CLIENT_HEADER,
  PUBLIC_API_ORIGIN,
  publicApiToolPath,
  publicToolResultSchema,
  type PublicToolName,
} from "shared/public-api/tools";
import pkg from "../package.json";
import {
  CliFailure,
  EXIT,
  exitCodeFor,
  jsonValueSchema,
  localErrorBody,
  stopQuietly,
  type JsonValue,
} from "./failure";
import type { DetectedAgent } from "./agent";

export const VERSION: string = pkg.version;
const TIMEOUT_MS = 30_000;
const RETRY_PAUSE = "400 millis";
const RATE_LIMIT_PER_MINUTE = 120;

/** The origin requests go to; `PODBENCHMARK_API_URL` points the CLI elsewhere. */
export const apiOrigin = (env: Readonly<Record<string, string | undefined>>) =>
  (env["PODBENCHMARK_API_URL"]?.trim() || PUBLIC_API_ORIGIN).replace(
    /\/+$/,
    ""
  );

interface Reply {
  status: number;
  retryAfter: string | null;
  text: string;
}

/** A failure worth one more try: the network dropped or the service had a hiccup. */
class Transient extends Data.TaggedError("Transient")<{
  readonly reason: string;
  readonly reply?: Reply;
}> {}

export interface ApiClient {
  origin: string;
  /** Calls one tool; resolves to the service's JSON, ready to print as-is. */
  call: (
    name: PublicToolName,
    input: object
  ) => Effect.Effect<JsonValue, CliFailure>;
}

export interface ApiOptions {
  origin: string;
  agent: DetectedAgent | null;
  dryRun: boolean;
  /** Machine mode prints the dry run as JSON. */
  machine: boolean;
}

/** The caller's signal plus a timeout, without AbortSignal.any (Node 20.3+). */
function withTimeout(signal: AbortSignal, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("Timed out", "TimeoutError")),
    ms
  );
  const stop = () => {
    clearTimeout(timer);
    controller.abort(signal.reason);
  };
  if (signal.aborted) stop();
  else signal.addEventListener("abort", stop, { once: true });
  return controller.signal;
}

async function send(
  url: string,
  body: string,
  headers: Record<string, string>,
  signal: AbortSignal
): Promise<Reply> {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
    signal: withTimeout(signal, TIMEOUT_MS),
  });
  return {
    status: response.status,
    retryAfter: response.headers.get("retry-after"),
    text: await response.text(),
  };
}

const describeNetworkError = (origin: string, error: Error) =>
  error.name === "TimeoutError" || error.name === "AbortError"
    ? `${origin} did not answer within ${TIMEOUT_MS / 1000} seconds.`
    : `Could not reach ${origin}${error.cause instanceof Error ? ` (${error.cause.message})` : ""}.`;

const serviceFailure = (message: string, hint?: string) =>
  new CliFailure({
    exitCode: EXIT.service,
    message,
    hint,
    body: localErrorBody("network", message),
  });

/** The service names its own tools; the CLI names its commands. */
const TOOL_WORDS: ReadonlyArray<readonly [string, string]> = [
  ["get_product_options", "`podbenchmark options`"],
  ["search_products", "`podbenchmark search`"],
  ["compare_product", "`podbenchmark compare`"],
  ["resolve_supplier_link", "`podbenchmark compare <link>`"],
  ["canonicalProductId", "product id"],
  ["optionKey", "--option"],
];
const inCliWords = (message: string) =>
  TOOL_WORDS.reduce(
    (text, [tool, word]) => text.replaceAll(tool, word),
    message
  );

function interpret(reply: Reply, origin: string): CliFailure | JsonValue {
  let json: JsonValue;
  try {
    json = jsonValueSchema.parse(JSON.parse(reply.text));
  } catch {
    return serviceFailure(
      `${origin} answered with something unexpected (HTTP ${reply.status}).`,
      "Try again in a moment."
    );
  }
  const envelope = publicToolResultSchema.safeParse(json);
  if (!envelope.success) {
    return serviceFailure(
      `${origin} answered with something unexpected (HTTP ${reply.status}).`,
      "This version of the CLI may be out of date: npm i -g podbenchmark@latest."
    );
  }
  if (envelope.data.ok) return json;
  const { code, message } = envelope.data.error;
  if (code === "rate_limited") {
    const seconds = Number.parseInt(reply.retryAfter ?? "", 10);
    const wait = Number.isFinite(seconds) && seconds > 0 ? seconds : 60;
    return new CliFailure({
      exitCode: EXIT.service,
      message: `Rate limit reached (${RATE_LIMIT_PER_MINUTE} requests per minute). Try again in ${wait} seconds.`,
      body: json,
    });
  }
  return new CliFailure({
    exitCode: exitCodeFor(code),
    message: inCliWords(message),
    hint:
      code === "product_not_found"
        ? "Find a product id with: npx podbenchmark search <words>"
        : undefined,
    body: json,
  });
}

export function makeApi(options: ApiOptions): ApiClient {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    "user-agent": `podbenchmark-cli/${VERSION}`,
    [PUBLIC_API_CLIENT_HEADER]: `cli/${VERSION}`,
    ...(options.agent ? { [PUBLIC_API_AGENT_HEADER]: options.agent.id } : {}),
  };
  const call = Effect.fn("api.call")(function* (
    name: PublicToolName,
    input: object
  ) {
    const url = `${options.origin}${publicApiToolPath(name)}`;
    const body = JSON.stringify(input);
    if (options.dryRun) {
      yield* Console.log(
        options.machine
          ? JSON.stringify({ method: "POST", url, body: input }, null, 2)
          : `POST ${url}\ncontent-type: application/json\n\n${JSON.stringify(input, null, 2)}`
      );
      return yield* stopQuietly();
    }
    const attempt = Effect.tryPromise({
      try: signal => send(url, body, headers, signal),
      catch: error =>
        new Transient({
          reason: describeNetworkError(
            options.origin,
            error instanceof Error ? error : new Error(String(error))
          ),
        }),
    }).pipe(
      Effect.flatMap(reply =>
        reply.status >= 500
          ? Effect.fail(
              new Transient({ reason: `HTTP ${reply.status}`, reply })
            )
          : Effect.succeed(reply)
      )
    );
    const reply = yield* attempt.pipe(
      Effect.retry({ times: 1, schedule: Schedule.spaced(RETRY_PAUSE) }),
      Effect.catchTag("Transient", failure =>
        failure.reply
          ? Effect.succeed(failure.reply)
          : Effect.fail(
              serviceFailure(
                failure.reason,
                "Check your connection and try again."
              )
            )
      )
    );
    const result = interpret(reply, options.origin);
    return result instanceof CliFailure ? yield* result : result;
  });
  return { origin: options.origin, call };
}
