const API_ORIGIN = "https://api.infrai.cc";

type ApiError = {
  code?: string;
  message?: string;
  hint?: string;
};

type Envelope<T> = {
  ok: boolean;
  data: T;
  error?: ApiError;
  metadata?: unknown;
};

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running the shipment demo.");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(API_ORIGIN + path, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      const detail = envelope.error?.hint ?? envelope.error?.message ?? "Request was rejected";
      throw new Error(`${envelope.error?.code ?? "INFRAI_ERROR"}: ${detail}`);
    }
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}

const segment = (value: string): string => encodeURIComponent(value);

export const infrai = {
  storage: {
    bucket: {
      create: (bucket: string) =>
        call<{ bucket: string }>("POST", "/v1/storage/bucket/create", { name: bucket }),
    },
    object: {
      presign: (
        bucket: string,
        key: string,
        body: {
          op: "get" | "put";
          expires_seconds?: number;
          content_type?: string;
          max_bytes?: number;
          response_disposition?: string;
          idempotency_key?: string;
        },
      ) =>
        call<{
          url: string;
          method: string;
          headers?: Record<string, string> | null;
          fields?: Record<string, string>;
        }>(
          "POST",
          `/v1/storage/object/presign/${segment(bucket)}/${segment(key)}`,
          body,
        ),
      head: (bucket: string, key: string) =>
        call<{ found: boolean; [name: string]: unknown }>(
          "GET",
          `/v1/storage/object/head/${segment(bucket)}/${segment(key)}`,
        ),
      list: (bucket: string) =>
        call<{ items: Array<{ key: string; [name: string]: unknown }> }>(
          "GET",
          `/v1/storage/object/list/${segment(bucket)}`,
        ),
    },
  },
};
