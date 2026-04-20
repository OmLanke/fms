// Generic proxy function using Bun's native fetch
export async function proxyRequest(
  targetUrl: string,
  request: Request,
  additionalHeaders: Record<string, string> = {}
): Promise<Response> {
  const headers = new Headers(request.headers);

  for (const [key, value] of Object.entries(additionalHeaders)) {
    headers.set(key, value);
  }

  // Remove host header to prevent issues
  headers.delete("host");

  let body: BodyInit | null = null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });

    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (err) {
    console.error(`[Proxy] Failed to reach ${targetUrl}:`, err);
    return new Response(
      JSON.stringify({
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Upstream service is unavailable",
        },
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
