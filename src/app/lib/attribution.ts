const cookieName = "bb_nfc_attribution";
const maxAgeSeconds = 30 * 24 * 60 * 60;

export function readAttributionCookie() {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${cookieName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export function writeAttributionCookie(token: string) {
  document.cookie = `${cookieName}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax; Secure`;
}

export function clearAttributionCookie() {
  document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
}
