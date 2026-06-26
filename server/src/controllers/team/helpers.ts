import { AppError } from '../../utils/error';

const TEAM_VISIBILITIES = new Set(['PUBLIC', 'PRIVATE']);
const MANAGED_MEMBER_ROLES = new Set(['ADMIN', 'MEMBER']);

export const normalizeEmail = (value: unknown): string => {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!email) {
    throw new AppError('Email is required', 400);
  }
  return email;
};

export const normalizeTeamVisibility = (value: unknown, fallback: string): string => {
  if (value === undefined || value === null || value === '') return fallback;
  const visibility = String(value).trim().toUpperCase();
  if (!TEAM_VISIBILITIES.has(visibility)) {
    throw new AppError('Invalid team visibility', 400);
  }
  return visibility;
};

export const normalizeManagedRole = (value: unknown, fallback = 'MEMBER'): string => {
  const role = String(value || fallback)
    .trim()
    .toUpperCase();
  if (!MANAGED_MEMBER_ROLES.has(role)) {
    throw new AppError('Invalid role, only ADMIN or MEMBER allowed', 400);
  }
  return role;
};

export const parseBooleanDecision = (value: unknown, fieldName: string): boolean => {
  if (value === true || value === false) return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'accept', 'accepted'].includes(normalized)) return true;
    if (['false', '0', 'no', 'reject', 'rejected'].includes(normalized)) return false;
  }
  throw new AppError(`${fieldName} must be a boolean`, 400);
};
