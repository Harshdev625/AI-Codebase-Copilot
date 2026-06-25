import {
  validateAdminPassword,
  validateAdminSecret,
  validateEmail,
  validateFullName,
  validatePasswordMatch,
  validatePasswordRequired,
  validateUserPassword,
} from '@/features/auth/utils/auth-validation';

jest.mock('@/features/auth/components/password-strength', () => ({
  isPasswordStrong: (password: string) => password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password),
}));

describe('validateEmail', () => {
  it('requires non-empty valid email', () => {
    expect(validateEmail('')).toBe('Email is required');
    expect(validateEmail('bad')).toBe('Enter a valid email address');
    expect(validateEmail('user@example.com')).toBeUndefined();
  });
});

describe('validatePasswordRequired', () => {
  it('requires password', () => {
    expect(validatePasswordRequired('')).toBe('Password is required');
    expect(validatePasswordRequired('secret')).toBeUndefined();
  });
});

describe('validateFullName', () => {
  it('requires trimmed name', () => {
    expect(validateFullName('   ')).toBe('Full name is required');
    expect(validateFullName('Ada Lovelace')).toBeUndefined();
  });
});

describe('validateUserPassword', () => {
  it('enforces strength rules', () => {
    expect(validateUserPassword('short')).toBe('Password does not meet requirements');
    expect(validateUserPassword('LongEnough1Pass')).toBeUndefined();
  });
});

describe('validatePasswordMatch', () => {
  it('checks confirmation', () => {
    expect(validatePasswordMatch('a', 'b')).toBe('Passwords do not match');
    expect(validatePasswordMatch('same', 'same')).toBeUndefined();
  });
});

describe('validateAdminPassword', () => {
  it('requires minimum length', () => {
    expect(validateAdminPassword('short')).toBe('Password must be at least 8 characters');
    expect(validateAdminPassword('longenough')).toBeUndefined();
  });
});

describe('validateAdminSecret', () => {
  it('requires secret key', () => {
    expect(validateAdminSecret('  ')).toBe('Admin secret key is required');
    expect(validateAdminSecret('secret')).toBeUndefined();
  });
});
