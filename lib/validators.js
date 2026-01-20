// Common passwords to reject
const COMMON_PASSWORDS = new Set([
  'password', 'password123', 'qwerty', '123456', '12345678', 'abc123', 'letmein',
  'welcome', 'monkey', 'dragon', 'master', 'sunshine', 'princess', 'shadow',
  '123123', 'password1', 'admin', 'pass123', 'test', 'changeme', 'passw0rd',
  'starwars', 'login', 'solo', 'batman', 'superman', 'trustno1', 'password!',
]);

/**
 * Validate email format with + addressing support
 * @param {string} raw - Raw email input
 * @returns {string} - Error message, or empty string if valid
 */
export const validateEmailFormat = (raw) => {
  const v = String(raw || '').trim().toLowerCase();

  if (!v) return 'Email is required.';
  if (v.length > 45) return 'Email must not exceed 45 characters.';

  // must contain exactly one "@"
  const atCount = (v.match(/@/g) || []).length;
  if (atCount !== 1) return 'Email must contain exactly one @.';

  const [local, domainRaw] = v.split('@');
  const domain = String(domainRaw || '').trim().toLowerCase();

  // allow dots before @, but local part must exist and not contain spaces
  if (!local || /\s/.test(local)) return 'Please enter a valid email.';
  if (/\s/.test(domain)) return 'Please enter a valid email.';

  // IMPORTANT: only real providers allowed
  const allowedDomains = ['gmail.com', 'yahoo.com'];
  if (!allowedDomains.includes(domain)) return 'Email must end with @gmail.com or @yahoo.com.';

  // prevents gmail..com etc
  if (domain.includes('..')) return 'Email domain is invalid.';

  // basic local-part format: allow dots, letters, numbers, underscores, hyphens, plus sign (for aliases)
  const localOk = /^[A-Za-z0-9._+-]+$/.test(local);
  if (!localOk) return 'Email contains invalid characters.';

  // must not start or end with dot
  if (local.startsWith('.') || local.endsWith('.')) return 'Please enter a valid email.';

  // no consecutive dots in local
  if (local.includes('..')) return 'Please enter a valid email.';

  return '';
};

/**
 * Check if password is in common passwords list
 * @param {string} password - Password to check
 * @returns {boolean} - True if password is common
 */
export const isCommonPassword = (password) => {
  const p = String(password || '').toLowerCase();
  // Check exact match
  if (COMMON_PASSWORDS.has(p)) return true;
  // Check variations (with numbers appended)
  if (COMMON_PASSWORDS.has(p.replace(/\d+$/, ''))) return true;
  return false;
};

/**
 * Get password validation rules
 * @param {string} password - Password to validate
 * @returns {object} - Object with boolean flags for each rule
 */
export const getPasswordRules = (password) => {
  const p = String(password || '');

  return {
    hasMinLen: p.length >= 8,
    hasUpper: /[A-Z]/.test(p),
    hasLower: /[a-z]/.test(p),
    hasNumber: /\d/.test(p),
    hasSymbol: /\W/.test(p) && !/\s/.test(p), // symbol but not whitespace
    isNotCommon: !isCommonPassword(p),
  };
};

/**
 * Validate password with comprehensive rules
 * @param {string} password - Password to validate
 * @returns {string} - Error message, or empty string if valid
 */
export const validatePassword = (password) => {
  if (!String(password || '')) return 'Password is required.';

  const rules = getPasswordRules(password);

  if (!rules.hasMinLen) return 'Password must be at least 8 characters.';
  if (!rules.hasUpper) return 'Password must contain at least 1 uppercase letter.';
  if (!rules.hasLower) return 'Password must contain at least 1 lowercase letter.';
  
  // Require BOTH number AND symbol (not just one or the other)
  if (!rules.hasNumber || !rules.hasSymbol) {
    return 'Password must contain at least 1 number AND 1 symbol.';
  }

  if (!rules.isNotCommon) return 'This password is too common. Please choose a stronger password.';

  if (String(password || '').length > 30) return 'Password must not exceed 30 characters.';

  return '';
};

/**
 * Validate phone number format (PH specific)
 * @param {string} phoneDigits - 10 digits only (after +63)
 * @returns {string} - Error message, or empty string if valid
 */
export const validatePhoneFormat = (phoneDigits) => {
  const v = String(phoneDigits || '').trim();
  if (!v) return 'Phone number is required.';
  if (v.length !== 10) return 'Enter 10 digits after +63 (9XXXXXXXXX).';
  if (!v.startsWith('9')) return 'PH mobile numbers must start with 9.';
  if (!/^\d+$/.test(v)) return 'Phone number must contain only digits.';
  return '';
};

/**
 * Check if phone number is already registered (async)
 * Call your backend API here
 * @param {string} phoneE164 - Phone in E.164 format (+63XXXXXXXXXX)
 * @returns {Promise<{exists: boolean, error?: string}>}
 */
export const checkPhoneDuplicate = async (phoneE164) => {
  try {
    // TODO: Replace with your actual backend API call
    // Example:
    // const response = await fetch('/api/auth/check-phone', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ phone: phoneE164 }),
    // });
    // const data = await response.json();
    // return { exists: data.exists };

    // For now, return false (no duplicate) as placeholder
    return { exists: false };
  } catch (error) {
    console.error('Error checking phone duplicate:', error);
    return { exists: false, error: 'Could not verify phone availability' };
  }
};

/**
 * Get password strength label and score
 * @param {string} password - Password to score
 * @returns {object} - { label: string, score: number }
 */
export const getPasswordStrength = (password) => {
  const p = String(password || '');
  if (!p) return { label: '', score: 0 };

  const rules = getPasswordRules(p);
  let score = 0;

  if (rules.hasMinLen) score += 1;
  if (rules.hasUpper) score += 1;
  if (rules.hasLower) score += 1;
  if (rules.hasNumber) score += 1;
  if (rules.hasSymbol) score += 1;
  if (p.length >= 12) score += 1;
  if (rules.isNotCommon) score += 1;

  // 0-3 weak, 4-5 medium, 6-7 strong
  const label = score <= 3 ? 'Weak' : score <= 5 ? 'Medium' : 'Strong';
  return { label, score };
};

/**
 * Normalize email: trim, lowercase, handle + addressing
 * @param {string} email - Raw email
 * @returns {string} - Normalized email
 */
export const normalizeEmail = (email) => {
  return String(email || '').trim().toLowerCase();
};

/**
 * Debounced function wrapper
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} - Debounced function
 */
export const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};
