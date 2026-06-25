import { isPasswordStrong } from '@/features/auth/components/password-strength';

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address';
  return undefined;
}

export function validatePasswordRequired(password: string): string | undefined {
  if (!password) return 'Password is required';
  return undefined;
}

export function validateFullName(name: string): string | undefined {
  if (!name.trim()) return 'Full name is required';
  return undefined;
}

export function validateUserPassword(password: string): string | undefined {
  if (!isPasswordStrong(password)) return 'Password does not meet requirements';
  return undefined;
}

export function validatePasswordMatch(password: string, confirm: string): string | undefined {
  if (password !== confirm) return 'Passwords do not match';
  return undefined;
}

export function validateAdminPassword(password: string): string | undefined {
  if (password.length < 8) return 'Password must be at least 8 characters';
  return undefined;
}

export function validateAdminSecret(secret: string): string | undefined {
  if (!secret.trim()) return 'Admin secret key is required';
  return undefined;
}
