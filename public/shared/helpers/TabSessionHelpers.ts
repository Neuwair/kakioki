"use client";

const TAB_SESSION_KEY = "kakioki:tab_session_id";

export function getTabSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(TAB_SESSION_KEY);
  if (!id) {
    if (typeof crypto.randomUUID === "function") {
      id = crypto.randomUUID();
    } else {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      id = [...bytes]
        .map(
          (b, i) =>
            ([4, 6, 8, 10].includes(i) ? "-" : "") +
            b.toString(16).padStart(2, "0"),
        )
        .join("");
    }
    sessionStorage.setItem(TAB_SESSION_KEY, id);
  }
  return id;
}

export function sessionKey(suffix: string): string {
  return `kakioki:session:${getTabSessionId()}:${suffix}`;
}
