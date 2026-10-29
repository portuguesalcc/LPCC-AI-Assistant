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
