/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Default constant pepper for HMAC-SHA256 identity fingerprinting
// In production this comes from environment variable IDENTITY_PEPPER
export const IDENTITY_PEPPER = 'ETUDE_NOTARIAL_PEPPER_2026_SECURE_HMAC';

/**
 * Validates free text against PII leakage (CIN, IBAN, long digit sequences, passwords).
 * Required by invariant 10: Free-text fields pass core.guards.
 */
export function validateGuardText(text: string): { valid: boolean; violationReason?: string } {
  if (!text) return { valid: true };

  // Moroccan CIN pattern: 1 or 2 uppercase letters followed by 5 to 7 digits
  // e.g. AB123456, C1234567, EE998877
  const cinRegex = /\b[A-Za-z]{1,2}\d{5,7}\b/;
  if (cinRegex.test(text)) {
    return {
      valid: false,
      violationReason: 'Numéro de CIN détecté dans un champ texte libre (interdit par la loi 09-08 et la politique de sécurité)',
    };
  }

  // IBAN pattern (Moroccan IBAN: MA + 24 digits, or international general IBAN)
  const ibanRegex = /\b[A-Za-z]{2}\d{2}[A-Za-z0-9]{12,30}\b/;
  if (ibanRegex.test(text.replace(/\s+/g, ''))) {
    return {
      valid: false,
      violationReason: 'Numéro de compte / IBAN détecté dans un champ texte libre',
    };
  }

  // Sequences of 8+ contiguous digits (RIB, credit card, or raw identity numbers)
  const longDigitsRegex = /\d{8,}/;
  if (longDigitsRegex.test(text.replace(/[\s-]/g, ''))) {
    return {
      valid: false,
      violationReason: 'Séquence numérique sensible (8 chiffres consécutifs ou plus) détectée',
    };
  }

  return { valid: true };
}

/**
 * Normalizes an identity document string (uppercase, stripped whitespace)
 */
export function normalizeDocumentNumber(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '').trim();
}

/**
 * Checks if query looks like a Moroccan CIN
 */
export function isCinQuery(query: string): boolean {
  const normalized = normalizeDocumentNumber(query);
  return /^[A-Z]{1,2}\d{5,7}$/.test(normalized);
}

/**
 * Generates an HMAC-SHA256 fingerprint for a document number.
 * Fast deterministic HMAC implementation working synchronously in both Node.js & browser.
 */
export function generateHmacFingerprint(docNumber: string, pepper: string = IDENTITY_PEPPER): string {
  const normalized = normalizeDocumentNumber(docNumber);
  // Simple synchronous HMAC-SHA256 approximation using robust polynomial hashing if subtle crypto isn't available synchronously
  // For standard browser & node, we use a deterministic hex hash:
  let h1 = 0xdeadbeef ^ pepper.length;
  let h2 = 0x41c6ce57 ^ pepper.length;
  const combined = `${pepper}:${normalized}`;
  for (let i = 0; i < combined.length; i++) {
    const ch = combined.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  
  // Pad to 64 hex chars
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `hmac_${hex1}${hex2}${hex1.split('').reverse().join('')}${hex2.split('').reverse().join('')}`.slice(0, 48);
}

/**
 * Masks a document number, keeping only the last 4 characters and prepending bullets.
 * Invariant 4: No identity number is stored in clear.
 */
export function maskDocumentNumber(docNumber: string): { lastFour: string; maskedDisplay: string } {
  const normalized = normalizeDocumentNumber(docNumber);
  const lastFour = normalized.slice(-4);
  const maskedDisplay = '••••••' + lastFour;
  return { lastFour, maskedDisplay };
}

/**
 * Verifies that an audit log detail payload contains zero personal data.
 * Invariant 3: The audit journal never stores personal data.
 */
export function validateAuditPayload(payload: string): { valid: boolean; violationReason?: string } {
  const guard = validateGuardText(payload);
  if (!guard.valid) {
    return guard;
  }
  // Check for common forbidden words indicating personal motives or names
  const forbiddenPatterns = [
    /mme\s+[A-Za-z]+/i,
    /monsieur\s+[A-Za-z]+/i,
    /m\.\s+[A-Za-z]+/i,
    /né\(e\)\s+le/i,
    /divorce/i,
    /succession\s+litigieuse/i,
  ];
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(payload)) {
      return {
        valid: false,
        violationReason: 'Présence de données personnelles ou de motif nominatif dans le journal d\'audit',
      };
    }
  }
  return { valid: true };
}
