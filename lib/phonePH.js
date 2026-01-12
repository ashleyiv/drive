// driveash/lib/phonePH.js
export const DEFAULT_COUNTRY_CODE = '+63';

/**
 * Normalize ANY PH input into E.164: +63 + 10 digits (must start with 9)
 * Returns null if cannot normalize.
 */
export function normalizePHToE164(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  // Keep only digits and plus
  const hasPlus = raw.startsWith('+');
  const digitsOnly = raw.replace(/\D/g, '');

  // If user typed +63XXXXXXXXXX
  if (hasPlus && digitsOnly.startsWith('63')) {
    const rest = digitsOnly.slice(2); // remove "63"
    if (rest.length === 10 && rest.startsWith('9')) return `+63${rest}`;
    return null;
  }

  // If user typed 63XXXXXXXXXX
  if (digitsOnly.startsWith('63')) {
    const rest = digitsOnly.slice(2);
    if (rest.length === 10 && rest.startsWith('9')) return `+63${rest}`;
    return null;
  }

  // If user typed 09XXXXXXXXX (11 digits)
  if (digitsOnly.startsWith('09') && digitsOnly.length === 11) {
    const rest = digitsOnly.slice(1); // drop leading 0 -> 9XXXXXXXXX
    if (rest.length === 10 && rest.startsWith('9')) return `+63${rest}`;
    return null;
  }

  // If user typed 9XXXXXXXXX (10 digits)
  if (digitsOnly.length === 10 && digitsOnly.startsWith('9')) {
    return `+63${digitsOnly}`;
  }

  // If user typed 0995... but wrong length, invalid
  return null;
}

/**
 * For controlled input where UI shows "+63" fixed, we store only 10 digits (9XXXXXXXXX).
 * Allows paste of 09XXXXXXXXX or +63XXXXXXXXXX and returns digits-only (max 10).
 */
export function normalizePHToDigits10(input) {
  const raw = String(input ?? '');
  const digits = raw.replace(/\D/g, '');

  // Paste cases
  if (digits.startsWith('63')) {
    const rest = digits.slice(2);
    return rest.slice(0, 10);
  }

  if (digits.startsWith('09')) {
    const rest = digits.slice(1); // drop 0
    return rest.slice(0, 10);
  }

  // Normal typing: user enters 9XXXXXXXXX
  return digits.slice(0, 10);
}

export function formatPHPretty(e164) {
  const p = String(e164 ?? '').trim();
  if (!p) return '';

  const digits = p.replace(/\D/g, '');

  // Expect 63 + 10 digits
  if (digits.startsWith('63') && digits.length === 12) {
    const rest = digits.slice(2); // 10 digits
    const a = rest.slice(0, 3);
    const b = rest.slice(3, 6);
    const c = rest.slice(6, 10);
    return `+63 ${a} ${b} ${c}`;
  }

  // fallback
  return p;
}

/** For tel:, sms:, whatsapp: — remove spaces only */
export function cleanDialNumber(input) {
  return String(input ?? '').replace(/\s+/g, '').trim();
}
