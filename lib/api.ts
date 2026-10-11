export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options?.headers,
    },
  });
  if (!response.ok) {
    let detail = "The studio could not complete this request.";
    try {
      const result = await response.json();
      detail =
        typeof result.detail === "string"
          ? result.detail
          : Array.isArray(result.detail)
            ? result.detail.map((e: { msg: string }) => e.msg).join(". ")
            : detail;
    } catch {
      detail =
        response.status >= 500
          ? "The local server is unavailable. Start it with npm run studio, then retry."
          : detail;
    }
    throw new ApiError(detail, response.status);
  }
  return response.json() as Promise<T>;
}
export function post<T>(path: string, value: unknown = {}) {
  return api<T>(path, { method: "POST", body: JSON.stringify(value) });
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items;
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}
export function contentSignature(resume: import("./types").Resume) {
  return JSON.stringify({ ...resume, ledger: [] });
}
