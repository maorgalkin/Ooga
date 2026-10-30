/**
 * The in-app path to return to after signing in, or '/' when there's none or it isn't safe.
 * Only same-site paths pass, so a crafted link can't bounce someone to another site.
 */
export function safeReturnPath(from: unknown): string {
  if (typeof from !== 'string' || !from.startsWith('/')) return '/';
  // Parse the way the browser will, so "//host", "/\host" and "/\t/host" all show their real origin
  try {
    const url = new URL(from, window.location.origin);
    if (url.origin !== window.location.origin) return '/';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}
