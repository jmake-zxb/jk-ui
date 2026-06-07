import { describe, expect, it } from 'vitest';

import {
  buildToolSearchParams,
  normalizeCreatorLabel,
  normalizeCreatorValue,
} from './tool-query-utils';

describe('buildToolSearchParams', () => {
  it('sends name and omits creator aliases in name mode', () => {
    const params = buildToolSearchParams({
      create_user: 'creator-1',
      name: 'weather',
      searchType: 'name',
    });

    expect(params).toEqual({ name: 'weather' });
    expect(params).not.toHaveProperty('create_user');
    expect(params).not.toHaveProperty('createUser');
  });

  it('sends creator aliases and omits name in creator mode', () => {
    const params = buildToolSearchParams({
      create_user: 'creator-1',
      name: 'weather',
      searchType: 'create_user',
    });

    expect(params).toEqual({
      createUser: 'creator-1',
      create_user: 'creator-1',
    });
    expect(params).not.toHaveProperty('name');
  });

  it('omits all search params in empty creator mode', () => {
    expect(
      buildToolSearchParams({
        create_user: '',
        name: 'weather',
        searchType: 'create_user',
      }),
    ).toEqual({});
  });
});

describe('creator option normalization', () => {
  it('uses username as a label fallback without using it as a creator value fallback', () => {
    const user = { username: 'alice' };

    expect(normalizeCreatorLabel(user)).toBe('alice');
    expect(normalizeCreatorValue(user)).toBeUndefined();
  });

  it('prefers userId, then user_id, then id for creator values', () => {
    expect(normalizeCreatorValue({ id: 3, user_id: 2, userId: 1 })).toBe(1);
    expect(normalizeCreatorValue({ id: 3, user_id: 2 })).toBe(2);
    expect(normalizeCreatorValue({ id: 3 })).toBe(3);
  });
});
