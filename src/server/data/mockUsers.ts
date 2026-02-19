import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export type UserRole = 'admin' | 'learner';

export interface MockUser {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  organizationId?: string;
  timeZone?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  organizationId?: string;
  timeZone?: string;
}

const seedUsers: Array<Omit<MockUser, 'passwordHash'> & { password: string }> = [
  {
    id: '00000000-0000-0000-0000-000000000001',
  email: 'mya@the-huddle.co',
    password: 'admin123',
    role: 'admin',
    firstName: 'Avery',
    lastName: 'Chen',
    organizationId: 'org-huddle',
    timeZone: 'America/Los_Angeles',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'learner@pacificcoast.edu',
    password: 'learner123',
    role: 'learner',
    firstName: 'Jordan',
    lastName: 'Lee',
    organizationId: 'org-pacific',
    timeZone: 'America/Chicago',
  },
];

const usersByEmail = new Map<string, MockUser>();
const usersById = new Map<string, MockUser>();
seedUsers.forEach((user) => {
  const passwordHash = bcrypt.hashSync(user.password, 10);
  const record = { ...user, passwordHash };
  usersByEmail.set(user.email.toLowerCase(), record);
  usersById.set(user.id, record);
});

const passwordResetTokens = new Map<string, { userId: string; expiresAt: number }>();
const mfaChallenges = new Map<string, { code: string; expiresAt: number }>();

export const findUserByEmail = (email: string): MockUser | undefined => {
  return usersByEmail.get(email.toLowerCase());
};

export const findUserById = (id: string): MockUser | undefined => {
  return usersById.get(id);
};

export const verifyPassword = async (user: MockUser, password: string): Promise<boolean> => {
  return bcrypt.compare(password, user.passwordHash);
};

export const toPublicUser = (user: MockUser): PublicUser => ({
  id: user.id,
  email: user.email,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
  organizationId: user.organizationId,
  timeZone: user.timeZone,
});

export const createPasswordResetToken = (userId: string, ttlMs = 15 * 60 * 1000): string => {
  const token = randomUUID();
  passwordResetTokens.set(token, { userId, expiresAt: Date.now() + ttlMs });
  return token;
};

export const verifyPasswordResetToken = (token: string): string | null => {
  const entry = passwordResetTokens.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    passwordResetTokens.delete(token);
    return null;
  }
  return entry.userId;
};

export const saveMfaChallenge = (email: string, code: string, ttlMs = 5 * 60 * 1000): void => {
  mfaChallenges.set(email.toLowerCase(), { code, expiresAt: Date.now() + ttlMs });
};

export const verifyMfaChallenge = (email: string, code: string): boolean => {
  const entry = mfaChallenges.get(email.toLowerCase());
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    mfaChallenges.delete(email.toLowerCase());
    return false;
  }
  const match = entry.code === code;
  if (match) {
    mfaChallenges.delete(email.toLowerCase());
  }
  return match;
};

export const listUsers = (): PublicUser[] => {
  return Array.from(usersByEmail.values()).map(toPublicUser);
};
