/**
 * Parse a fetch Response as JSON without ever throwing on empty or
 * non-JSON bodies (proxy HTML, Vercel timeout pages, truncated responses).
 * Returns {} on failure so callers fall back to their default error message
 * instead of surfacing "Unexpected token < in JSON..." to the user.
 */
export async function safeJson(res: Response): Promise<any> {
  try {
    const text = await res.text();
    if (!text.trim()) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}
