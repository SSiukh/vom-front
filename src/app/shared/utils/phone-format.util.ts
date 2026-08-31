const UA_NATIONAL_NUMBER_LENGTH = 9;

export function normalizeUaPhone(raw: string): string {
  const digitsOnly = raw.replace(/\D/g, '');
  if (!digitsOnly) {
    return '';
  }

  let national: string;
  if (digitsOnly.startsWith('380') && digitsOnly.length === 3 + UA_NATIONAL_NUMBER_LENGTH) {
    national = digitsOnly.slice(3);
  } else if (digitsOnly.startsWith('0') && digitsOnly.length === 1 + UA_NATIONAL_NUMBER_LENGTH) {
    national = digitsOnly.slice(1);
  } else if (digitsOnly.length === UA_NATIONAL_NUMBER_LENGTH) {
    national = digitsOnly;
  } else {
    return digitsOnly;
  }

  return `+380${national}`;
}
