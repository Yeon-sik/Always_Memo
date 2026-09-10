// Supabase uuid 컬럼과 호환되도록 가능하면 Web Crypto UUID를 사용한다.
export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  // Keep the fallback compatible with Supabase uuid columns when Web Crypto
  // is unavailable (older WebViews and restricted test environments).
  const bytes = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256),
  );
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return [
    bytes.slice(0, 4),
    bytes.slice(4, 6),
    bytes.slice(6, 8),
    bytes.slice(8, 10),
    bytes.slice(10),
  ]
    .map((part) => part.map((byte) => byte.toString(16).padStart(2, "0")).join(""))
    .join("-");
}
