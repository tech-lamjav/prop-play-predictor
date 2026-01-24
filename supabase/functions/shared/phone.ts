// Phone utilities shared across messaging channels
// Normalizes Brazilian phone numbers by removing formatting and the extra 9th digit when present.
export function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')

  // Brazilian format: 55 + area(2) + number(8-9)
  // Two common cases for mobiles with extra 9 after DDD:
  // - 13 digits: 55 AA 9 NNNNNNN (e.g. 55439999022773) => remove cleaned[4]
  // - 12 digits: 55 AA 9 NNNNNN  (some providers drop a digit) => also remove cleaned[4]
  if (cleaned.startsWith('55')) {
    if ((cleaned.length === 13 || cleaned.length === 12) && cleaned[4] === '9') {
      return cleaned.slice(0, 4) + cleaned.slice(5)
    }
  }

  return cleaned
}

// Generate candidate normalizations to be resilient to extra/missing 9th digit in Brazilian mobiles.
// Returns a set of possible normalized strings (without formatting).
export function normalizePhoneCandidates(phone: string): string[] {
  const cleaned = phone.replace(/\D/g, '')
  const candidates = new Set<string>()

  candidates.add(cleaned)

  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    // Extra 9 at position 4 (after country+area)
    if (cleaned[4] === '9' && cleaned.length >= 13) {
      candidates.add(cleaned.slice(0, 4) + cleaned.slice(5))
    }
    // Extra 9 at position 5 (some providers shift)
    if (cleaned[5] === '9' && cleaned.length >= 13) {
      candidates.add(cleaned.slice(0, 5) + cleaned.slice(6))
    }
  }

  return Array.from(candidates)
}

// Utility to mask phone for logs (keeps country and last 4 digits)
export function maskPhone(phone: string): string {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length <= 4) return cleaned
  const prefix = cleaned.slice(0, 2)
  const suffix = cleaned.slice(-4)
  return `${prefix}****${suffix}`
}

