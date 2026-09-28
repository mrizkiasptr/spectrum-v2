import { describe, expect, it } from 'vitest';
import { initialsOf, memberForProfile, nameFromEmail } from './profile';

const members = [{ id: 'u-mr', name: 'Muhammad Rizkia Saputra', initials: 'MR', role: 'Business Analyst' }];

describe('profile → member', () => {
  it('derives initials and names', () => {
    expect(initialsOf('Muhammad Rizkia Saputra')).toBe('MS');
    expect(initialsOf('anisa')).toBe('AN');
    expect(nameFromEmail('rizkia.saputra@spe.co.id')).toBe('Rizkia Saputra');
  });

  it('reuses a member with the same name so their tasks stay theirs', () => {
    const m = memberForProfile({ id: 'uuid-1', email: 'x@y.z', fullName: 'muhammad rizkia saputra', role: '' }, members);
    expect(m.id).toBe('u-mr');
    expect(m.role).toBe('Business Analyst');
  });

  it('creates a member for a new person', () => {
    const m = memberForProfile({ id: 'uuid-2', email: 'dewi.lestari@spe.co.id', fullName: '', role: 'QA Engineer' }, members);
    expect(m).toEqual({ id: 'uuid-2', name: 'Dewi Lestari', initials: 'DL', role: 'QA Engineer' });
  });
});
