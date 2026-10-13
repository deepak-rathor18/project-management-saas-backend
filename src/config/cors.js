export function isOriginAllowed(origin, allowedOrigins, isProduction) {
  if (!origin || allowedOrigins.includes(origin)) return true;
  if (isProduction) return false;

  try {
    const parsedOrigin = new URL(origin);
    const localHosts = ["localhost", "127.0.0.1", "[::1]"];
    return (
      parsedOrigin.protocol === "http:" &&
      !parsedOrigin.username &&
      !parsedOrigin.password &&
      localHosts.includes(parsedOrigin.hostname)
    );
  } catch {
    return false;
  }
}
