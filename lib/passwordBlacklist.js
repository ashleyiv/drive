const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'password12', 'password1!',
  'password!', 'password@', '12345678', '123456789', '1234567890',
  '1234567', '123456', '12345', '1234', '123', '12',
  'qwerty', 'qwerty123', 'qwerty1', 'qwertyu', 'qwert123',
  'abc123', 'abc123456', 'abcd1234', 'abcdef123', 'abcdefg1',
  'letmein', 'letmein1', 'letmein12', 'letmein123',
  'welcome', 'welcome1', 'welcome123', 'welcome12', 'welcome!',
  'monkey', 'monkey123', 'monkeybusiness', 'monkeybutt',
  'passw0rd', 'passw0rd1', 'pass123', 'pass1234', 'pass12345',
  'admin', 'admin123', 'admin1234', 'admin12345', 'adminpass',
  'dragon', 'dragon123', 'dragonfly', 'dragons',
  'trustno1', 'trustnoone', 'trustme', 'trueme1',
  'baseball', 'baseball1', 'baseball123', 'basballplayer',
  'football', 'football1', 'football123', 'footballfan',
  'soccer', 'soccer123', 'soccerball', 'soccerfan',
  'master', 'master123', 'masterkey', 'mastercraft',
  'shadow', 'shadow123', 'shadowy', 'shadowing',
  'princess', 'princess1', 'princess123', 'princessleia',
  'superman', 'superman123', 'supermoon', 'superpower',
  'batman', 'batman123', 'batmobile', 'batcave',
  'sunshine', 'sunshine1', 'sunshine123', 'sunshiny',
  'flower', 'flower123', 'flowers', 'flowerbed',
  'butterfly', 'butterfly1', 'butterfly123', 'butterflynet',
  'rainbow', 'rainbow123', 'rainbows', 'rainbowy',
  'swordfish', 'swordfish1', 'swordfish123', 'sword123',
  'freedom', 'freedom1', 'freedom123', 'freedomfighter',
  'michael', 'michael1', 'michael123', 'michaelangelo',
  'ashley', 'ashley123', 'ashleyy', 'ashley1',
  'jessica', 'jessica1', 'jessica123', 'jessicarabbit',
  'jennifer', 'jennifer1', 'jennifer123', 'jenniferlopez',
  'melissa', 'melissa1', 'melissa123', 'melissafleis',
  'joshua', 'joshua123', 'joshua1', 'joshuatree',
  'alexander', 'alexander1', 'alex123', 'alexander123',
  'christoph', 'christopher', 'chris123', 'christopher1',
  'iloveyou', 'iloveyou1', 'iloveyou!', 'iloveu',
  'lovely', 'lovely123', 'loveme', 'loveyu',
  'secret', 'secret123', 'secret1', 'secrets',
  'passion', 'passion1', 'passion123', 'passionate',
  'freedom', 'forever', 'forward', 'forwards',
  'gateway', 'gateway123', 'gatesway', 'gateway1',
  'hannah', 'hannah1', 'hannah123', 'hannahanna',
  'oliver', 'oliver1', 'oliver123', 'oliver!',
  'jordan', 'jordan1', 'jordan123', 'jordanspieth',
  'nicholas', 'nicholas1', 'nicholas123', 'nicholas!',
  'sophie', 'sophie1', 'sophie123', 'sophiee',
  'emma', 'emma1', 'emma123', 'emmaa',
  'olivia', 'olivia1', 'olivia123', 'oliviaa',
  'ava', 'ava1', 'ava123', 'avaa',
  'isabella', 'isabella1', 'isabella123', 'isabella',
  'mia', 'mia1', 'mia123', 'miaa',
  'charlotte', 'charlotte1', 'charlotte123', 'charlott',
  'amelia', 'amelia1', 'amelia123', 'ameliaa',
  'evelyn', 'evelyn1', 'evelyn123', 'evelynn',
  'abigail', 'abigail1', 'abigail123', 'abigaill',
  'george', 'george1', 'george123', 'georgee',
  'henry', 'henry1', 'henry123', 'henryy',
  'benjamin', 'benjamin1', 'benjamin123', 'benjaminn',
  'lucas', 'lucas1', 'lucas123', 'lucass',
  'mason', 'mason1', 'mason123', 'masonn',
  'logan', 'logan1', 'logan123', 'logann',
  'liam', 'liam1', 'liam123', 'liamm',
  'noah', 'noah1', 'noah123', 'noahh',
  'james', 'james1', 'james123', 'jamesb',
  'robert', 'robert1', 'robert123', 'robertt',
  'john', 'john1', 'john123', 'johnn',
  'richard', 'richard1', 'richard123', 'richardd',
  'david', 'david1', 'david123', 'davidd',
  'charles', 'charles1', 'charles123', 'charless',
  'joseph', 'joseph1', 'joseph123', 'josephh',
  'thomas', 'thomas1', 'thomas123', 'thomass',
  'daniel', 'daniel1', 'daniel123', 'daniell',
  'matthew', 'matthew1', 'matthew123', 'mattheew',
  'mark', 'mark1', 'mark123', 'markk',
  'anthony', 'anthony1', 'anthony123', 'anthonyy',
  'donald', 'donald1', 'donald123', 'donaldd',
  'kenneth', 'kenneth1', 'kenneth123', 'kennethh',
  'steven', 'steven1', 'steven123', 'stevenn',
  'brian', 'brian1', 'brian123', 'briann',
  'edward', 'edward1', 'edward123', 'edwardd',
  'ronald', 'ronald1', 'ronald123', 'ronaldd',
  'timothy', 'timothy1', 'timothy123', 'timothyy',
  'jason', 'jason1', 'jason123', 'jasonn',
  'jeffrey', 'jeffrey1', 'jeffrey123', 'jeffreyy',
  'ryan', 'ryan1', 'ryan123', 'ryann',
  'jacob', 'jacob1', 'jacob123', 'jacobb',
  'gary', 'gary1', 'gary123', 'garyy',
  'nicholas', 'nicholas1', 'nicholas123', 'nicholasss',
  'eric', 'eric1', 'eric123', 'ericc',
  'jonathan', 'jonathan1', 'jonathan123', 'jonathann',
  'stephen', 'stephen1', 'stephen123', 'stephenn',
  'larry', 'larry1', 'larry123', 'larryy',
  'justin', 'justin1', 'justin123', 'justinn',
  'scott', 'scott1', 'scott123', 'scottt',
  'brandon', 'brandon1', 'brandon123', 'brandonn',
  'benjamin', 'benjamin1', 'benjamin123', 'benjaminn',
  'samuel', 'samuel1', 'samuel123', 'samuelL',
  'raymond', 'raymond1', 'raymond123', 'raymondd',
  'frank', 'frank1', 'frank123', 'frankk',
  'gregory', 'gregory1', 'gregory123', 'gregoryy',
  'alexander', 'alexander1', 'alexander123', 'alexanderr',
  'patrick', 'patrick1', 'patrick123', 'patrickk',
  'jack', 'jack1', 'jack123', 'jackk',
  'dennis', 'dennis1', 'dennis123', 'denniss',
  'jerry', 'jerry1', 'jerry123', 'jerryy',
  'tyler', 'tyler1', 'tyler123', 'tylerr',
  'aaron', 'aaron1', 'aaron123', 'aaronn',
  'jose', 'jose1', 'jose123', 'josee',
  'adam', 'adam1', 'adam123', 'adamm',
  'henry', 'henry1', 'henry123', 'henryy',
  'douglas', 'douglas1', 'douglas123', 'douglass',
  'zachary', 'zachary1', 'zachary123', 'zacharyy',
  'peter', 'peter1', 'peter123', 'peterr',
  'kyle', 'kyle1', 'kyle123', 'kylee',
  'evan', 'evan1', 'evan123', 'evann',
  'jerry', 'jerry1', 'jerry123', 'jerryy',
]);

// ===========================
// SEQUENTIAL & PATTERN CHECKS
// ===========================
const SEQUENTIAL_PATTERNS = [
  '12345678', '23456789', '34567890', '123456789', '1234567890',
  'abcdefgh', 'bcdefghi', 'cdefghij', 'abcdefghi', 'abcdefghij',
  '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999',
  '000000', '99999', '88888', '77777', '66666', '55555', '44444', '33333', '22222', '11111',
  'aaaaaa', 'bbbbbb', 'cccccc', 'dddddd', 'eeeeee', 'ffffff', 'gggggg', 'hhhhhh',
];

// ===========================
// CONTEXT-BASED PATTERNS
// ===========================
// These should be checked with user data (email, name, phone, etc.)
const CONTEXT_PATTERNS = [
  // Variations of "drive", "app", "alert", etc - specific to this app
  'drive', 'driveapp', 'drowsy', 'alert', 'sleepy', 'tired',
  // Generic app patterns
  'application', 'myapp', 'testapp', 'testpass', 'test1234',
];

/**
 * Validates password against blacklist
 * @param {string} password - The password to validate
 * @param {object} context - User context { email, firstName, lastName, phone }
 * @returns {string} Error message if password is blacklisted, empty string if valid
 */
export const checkPasswordBlacklist = (password, context = {}) => {
  if (!password) return '';

  const pwd = String(password || '').toLowerCase().trim();
  const email = String(context.email || '').toLowerCase().trim();
  const firstName = String(context.firstName || '').toLowerCase().trim();
  const lastName = String(context.lastName || '').toLowerCase().trim();
  const phone = String(context.phone || '').toLowerCase().trim();

  // ==========================================
  // 1. EXACT MATCH IN COMMON PASSWORDS LIST
  // ==========================================
  if (COMMON_PASSWORDS.has(pwd)) {
    return 'This password is too common and has been breached. Please choose a different one.';
  }

  // ==========================================
  // 2. SEQUENTIAL PATTERNS (123, abc, etc)
  // ==========================================
  for (const pattern of SEQUENTIAL_PATTERNS) {
    if (pwd.includes(pattern)) {
      return 'Password contains sequential patterns (123, abc, etc). Choose a more complex password.';
    }
  }

  // ==========================================
  // 3. REPEATED CHARACTERS (aaa, 111, etc)
  // ==========================================
  if (/(.)\\1{4,}/.test(pwd)) {
    // 5+ consecutive same characters
    return 'Password contains too many repeated characters.';
  }

  // ==========================================
  // 4. CONTEXT-BASED: User's personal data
  // ==========================================
  // Password contains user's email (before @)
  if (email && pwd.includes(email.split('@')[0])) {
    return 'Password cannot contain your email address or username.';
  }

  // Password contains first name
  if (firstName && pwd.includes(firstName)) {
    return 'Password cannot contain your first name.';
  }

  // Password contains last name
  if (lastName && pwd.includes(lastName)) {
    return 'Password cannot contain your last name.';
  }

  // Password contains phone number
  if (phone && pwd.includes(phone.slice(-6))) {
    // last 6 digits of phone
    return 'Password cannot contain your phone number.';
  }

  // ==========================================
  // 5. KEYBOARD PATTERNS (qwerty, asdf, etc)
  // ==========================================
  const keyboardPatterns = [
    'qwerty', 'qwertyu', 'qwertyi', 'qwertyo', 'qwertyp',
    'asdfgh', 'asdfghjk', 'zxcvbn', 'zxcvbnm',
    'ytrewq', 'hgfdsa', 'mnbvcx', // reverse patterns
    'qazwsx', 'wsxedc', 'edcrfv', 'rfvtgb', 'tgbyhn', 'gyuiop', // diagonal
  ];

  for (const pattern of keyboardPatterns) {
    if (pwd.includes(pattern)) {
      return 'Password contains keyboard patterns (qwerty, asdf, etc). Please be more creative.';
    }
  }

  // ==========================================
  // 6. COMMON APP/CONTEXT-SPECIFIC PATTERNS
  // ==========================================
  for (const pattern of CONTEXT_PATTERNS) {
    if (pwd.includes(pattern)) {
      return 'Password contains app-related terms. Please choose something more unique.';
    }
  }

  // ==========================================
  // 7. LEET SPEAK BYPASS ATTEMPTS
  // ==========================================
  // Convert common leet speak and check again
  const leetMap = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g' };
  let deLeetPwd = pwd;
  Object.entries(leetMap).forEach(([digit, letter]) => {
    deLeetPwd = deLeetPwd.replaceAll(digit, letter);
  });

  if (COMMON_PASSWORDS.has(deLeetPwd)) {
    return 'This password is a common variant (using numbers as letters). Please choose something more unique.';
  }

  // ==========================================
  // ALL CHECKS PASSED
  // ==========================================
  return '';
};

/**
 * Get all validation checks for a password
 * Returns detailed info about what makes it weak
 * Useful for debugging and displaying to users
 */
export const getPasswordVulnerabilities = (password, context = {}) => {
  const vulnerabilities = [];

  if (!password) return vulnerabilities;

  const pwd = String(password || '').toLowerCase().trim();
  const email = String(context.email || '').toLowerCase().trim();
  const firstName = String(context.firstName || '').toLowerCase().trim();
  const lastName = String(context.lastName || '').toLowerCase().trim();
  const phone = String(context.phone || '').toLowerCase().trim();

  // Common passwords
  if (COMMON_PASSWORDS.has(pwd)) {
    vulnerabilities.push('Common password (breached)');
  }

  // Sequential
  for (const pattern of SEQUENTIAL_PATTERNS) {
    if (pwd.includes(pattern)) {
      vulnerabilities.push('Contains sequential pattern');
      break;
    }
  }

  // Repeated chars
  if (/(.)\\1{4,}/.test(pwd)) {
    vulnerabilities.push('Too many repeated characters');
  }

  // Personal data
  if (email && pwd.includes(email.split('@')[0])) {
    vulnerabilities.push('Contains your email/username');
  }

  if (firstName && pwd.includes(firstName)) {
    vulnerabilities.push('Contains your first name');
  }

  if (lastName && pwd.includes(lastName)) {
    vulnerabilities.push('Contains your last name');
  }

  if (phone && pwd.includes(phone.slice(-6))) {
    vulnerabilities.push('Contains your phone number');
  }

  // Keyboard patterns
  const keyboardPatterns = [
    'qwerty', 'qwertyu', 'qwertyi', 'qwertyo', 'qwertyp',
    'asdfgh', 'asdfghjk', 'zxcvbn', 'zxcvbnm',
    'ytrewq', 'hgfdsa', 'mnbvcx',
    'qazwsx', 'wsxedc', 'edcrfv', 'rfvtgb', 'tgbyhn', 'gyuiop',
  ];

  for (const pattern of keyboardPatterns) {
    if (pwd.includes(pattern)) {
      vulnerabilities.push('Contains keyboard pattern');
      break;
    }
  }

  // App context
  for (const pattern of CONTEXT_PATTERNS) {
    if (pwd.includes(pattern)) {
      vulnerabilities.push('Contains app-related terms');
      break;
    }
  }

  return vulnerabilities;
};
