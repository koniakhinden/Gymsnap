// fetch + parse JSON safely. If the server returns a non-JSON body (a timeout,
// a 502/504 HTML page, a crash before our JSON error handler runs), this throws
// an Error with a readable message instead of the cryptic
// "Unexpected token 'A', "An error o"... is not valid JSON".
//
// Usage:
//   const data = await fetchJson<{ week: FullWeek | null }>("/api/plan");
//   const data = await fetchJson("/api/logs", { method: "POST", body: ... });
// On a non-2xx response it throws with the server's { error } message when
// present, so callers can keep their existing try/catch.
export async function fetchJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);
  const text = await res.text();

  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      // Non-JSON response (HTML error page, plain text, etc.).
      const snippet = text.slice(0, 120).replace(/\s+/g, " ").trim();
      throw new Error(
        res.ok
          ? `Unexpected non-JSON response from the server.`
          : `Server error (${res.status}). ${snippet || res.statusText}`
      );
    }
  }

  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status}).`;
    throw new Error(msg);
  }

  return body as T;
}
