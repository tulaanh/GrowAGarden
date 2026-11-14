export function wateringDeadline(expiresAt: string, serverNow: string, localNow: number): number | null {
  const expires = Date.parse(expiresAt);
  const server = Date.parse(serverNow);
  if (!Number.isFinite(expires) || !Number.isFinite(server)) return null;
  const remaining = expires - server;
  if (remaining <= 0) return null;
  return localNow + remaining;
}
