import type { Member } from '../domain/types';

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}

/** Readable name from an email when the profile has none: "rizkia.saputra@x" → "Rizkia Saputra". */
export function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ') || email;
}

/**
 * The board member for a signed-in profile. Reuses an existing member with the same name
 * so people keep their tasks; otherwise creates one keyed by the auth user id.
 */
export function memberForProfile(profile: Profile, members: Member[]): Member {
  const name = profile.fullName.trim() || nameFromEmail(profile.email);
  const match = members.find((m) => m.id === profile.id) ?? members.find((m) => m.name.toLowerCase() === name.toLowerCase());
  if (match) return { ...match, role: profile.role || match.role };
  return { id: profile.id, name, initials: initialsOf(name), role: profile.role || 'Member' };
}
