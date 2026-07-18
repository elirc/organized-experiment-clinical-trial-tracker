const DEMO_USER_ID = "user-data-manager";

export async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-demo-user-id": DEMO_USER_ID,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    throw new Error(body.error ?? "Request failed.");
  }

  return (await response.json()) as T;
}
