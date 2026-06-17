import { describe, expect, it } from 'vitest';

import {
  buildPublicInputJson,
  getRouteMode,
  normalizePublicChatProfile,
  resolvePublicChatMode,
} from './utils';

describe('public token chat utilities', () => {
  it('resolves MaxKB-style chat templates from profile, mode, and viewport', () => {
    expect(resolvePublicChatMode(false, '', false)).toBe('no-service');
    expect(resolvePublicChatMode(true, '', false)).toBe('pc');
    expect(resolvePublicChatMode(true, 'pc', true)).toBe('mobile');
    expect(resolvePublicChatMode(true, 'mobile', false)).toBe('mobile');
    expect(resolvePublicChatMode(true, 'embed', false)).toBe('embed');
  });

  it('accepts only supported route mode values', () => {
    expect(getRouteMode({ mode: 'pc' })).toBe('pc');
    expect(getRouteMode({ mode: 'mobile' })).toBe('mobile');
    expect(getRouteMode({ mode: 'embed' })).toBe('embed');
    expect(getRouteMode({ mode: 'debug' })).toBe('');
  });

  it('keeps embed API variables while removing control query fields', () => {
    expect(
      JSON.parse(
        buildPublicInputJson({
          applicationId: '12',
          asker: 'alice',
          display: 'float',
          field: ['first', 'second'],
          mode: 'embed',
          token: 'access-token',
        }),
      ),
    ).toEqual({ asker: 'alice', field: 'first' });
  });

  it('normalizes token profile fields to MaxKB child-template shape', () => {
    const profile = normalizePublicChatProfile({
      applicationId: 42,
      chatBackground: '/bg.png',
      customTheme: JSON.stringify({
        header_font_color: '#ffffff',
        theme_color: '#3370ff',
      }),
      disclaimer: true,
      disclaimerValue: 'Use carefully',
      icon: '/icon.png',
      name: 'Demo Agent',
      showAvatar: false,
      showHistory: false,
      userAvatar: '/user.png',
    });

    expect(profile).toMatchObject({
      chat_background: '/bg.png',
      custom_theme: {
        header_font_color: '#ffffff',
        theme_color: '#3370ff',
      },
      disclaimer: true,
      disclaimer_value: 'Use carefully',
      icon: '/icon.png',
      id: '42',
      name: 'Demo Agent',
      show_avatar: false,
      show_history: false,
      user_avatar: '/user.png',
    });
  });
});
