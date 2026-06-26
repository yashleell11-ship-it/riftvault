/** Allow only same-origin relative paths (blocks open redirects). */
export function getSafeRedirectPath(
  path: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!path || typeof path !== "string") return fallback;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("\\") || trimmed.includes(":")) return fallback;
  if (!/^\/[a-zA-Z0-9/_\-.?=&%]*$/.test(trimmed)) return fallback;
  return trimmed;
}
