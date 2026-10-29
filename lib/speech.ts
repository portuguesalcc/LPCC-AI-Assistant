/**
 * Text helpers shared by the page (display and device voice) and the server (AI voice).
 */

/**
 * Turns Markdown links and code marks into plain text, so links show as the
 * address itself: "[aqui](https://x.pt)" → "https://x.pt", "`a@b.pt`" → "a@b.pt".
 */
export function plainLinks(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\((mailto:|tel:)?([^)\s]+)\)/g, (_, label: string, scheme, target: string) =>
      scheme === "tel:" ? label : target,
    )
    .replace(/`([^`]*)`/g, "$1");
}

/**
 * Rewrites Portuguese phone numbers so speech synthesis reads them digit by
 * digit ("2 1 7, 2 6 4, 0 9 9") instead of as one big number
 * ("duzentos e dezassete milhões…"). Other numbers are left as they are.
 */
export function speakablePhoneNumbers(text: string): string {
  return text.replace(/(\+?\b351[\s.-]?)?\b\d{2,3}(?:[\s.-]?\d{2,4}){1,3}\b/g, (match) => {
    const digits = match.replace(/\D/g, "");
    const hasCountryCode = digits.length === 12 && digits.startsWith("351");
    const local = hasCountryCode ? digits.slice(3) : digits;
    if (local.length !== 9) return match;

    const groups = [local.slice(0, 3), local.slice(3, 6), local.slice(6)];
    const spoken = groups.map((g) => g.split("").join(" ")).join(", ");
    return hasCountryCode ? `mais 3 5 1, ${spoken}` : spoken;
  });
}

/** Prepares an answer to be read aloud: no Markdown, links named, phones digit by digit. */
export function toSpeakableText(text: string): string {
  return speakablePhoneNumbers(
    plainLinks(text)
      .replace(/[*#•]/g, "")
      .replace(/https?:\/\/\S+/g, "o link indicado")
      // Keep Portuguese contractions correct: "em o link" → "no link", etc.
      .replace(/\bem o link/g, "no link")
      .replace(/\bde o link/g, "do link")
      .replace(/\ba o link/g, "ao link")
      .replace(/\bpor o link/g, "pelo link"),
  );
}
