import type { LocationQuery, RouteLocationNormalizedLoaded } from 'vue-router';

import type {
  PublicChatCustomTheme,
  PublicChatMode,
  PublicChatProfile,
  PublicChatProfileResponse,
} from './types';

const CONTROL_QUERY_KEYS = new Set([
  'applicationId',
  'display',
  'mode',
  'token',
]);

export function getRouteToken(route: RouteLocationNormalizedLoaded) {
  return firstString(route.params.token) || firstString(route.query.token);
}

export function getRouteMode(query: LocationQuery) {
  const mode = firstString(query.mode);
  return mode === 'mobile' || mode === 'embed' || mode === 'pc' ? mode : '';
}

export function resolvePublicChatMode(
  hasProfile: boolean,
  mode: string,
  isMobileViewport: boolean,
): PublicChatMode {
  if (!hasProfile) return 'no-service';
  if (mode === 'mobile' || mode === 'embed') return mode;
  return isMobileViewport ? 'mobile' : 'pc';
}

export function buildPublicInputJson(query: LocationQuery) {
  const input: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (CONTROL_QUERY_KEYS.has(key)) continue;
    const normalized = firstString(value);
    if (normalized) input[key] = normalized;
  }
  return JSON.stringify(input);
}

export function normalizePublicChatProfile(
  value: unknown,
): null | PublicChatProfile {
  const source = unwrapProfile(value);
  const id = firstString(source.applicationId, source.id);
  const name = firstString(source.name);
  if (!id && !name) return null;

  const customTheme = normalizeTheme(source.customTheme, source.custom_theme);
  const showGuide = booleanValue(source.showGuide, source.show_guide, true);
  const appIcon = firstString(source.appIcon, source.app_icon, source.icon);
  const icon = firstString(source.icon, appIcon);
  const description = firstString(source.description);
  const prologue = showGuide ? firstString(source.prologue, description) : '';
  const fileUploadSettingRaw =
    source.file_upload_setting ?? source.fileUploadSetting;
  const fileUploadSetting =
    typeof fileUploadSettingRaw === 'string'
      ? parseObject(fileUploadSettingRaw)
      : objectValue(fileUploadSettingRaw);
  const workflow = objectValue(source.work_flow ?? source.workflow);

  return {
    ...source,
    app_icon: appIcon,
    avatar: firstString(source.avatar),
    chat_background: firstString(source.chatBackground, source.chat_background),
    custom_theme: customTheme,
    description,
    disclaimer: booleanValue(source.disclaimer, undefined, false),
    disclaimer_value: firstString(
      source.disclaimerValue,
      source.disclaimer_value,
    ),
    file_upload_enable: booleanValue(
      source.fileUploadEnable,
      source.file_upload_enable,
      false,
    ),
    file_upload_setting: fileUploadSetting,
    icon,
    id: id || firstString(source.applicationId),
    name: name || '公开聊天',
    prologue,
    show_avatar: booleanValue(source.showAvatar, source.show_avatar, true),
    show_guide: showGuide,
    show_history: booleanValue(source.showHistory, source.show_history, true),
    show_user_avatar: booleanValue(
      source.showUserAvatar,
      source.show_user_avatar,
      true,
    ),
    show_source: booleanValue(source.showSource, source.show_source, false),
    show_exec: booleanValue(source.showExec, source.show_exec, false),
    stt_model_enable: booleanValue(
      source.sttModelEnable,
      source.stt_model_enable,
      false,
    ),
    stt_autosend: booleanValue(source.sttAutosend, source.stt_autosend, false),
    tts_model_enable: booleanValue(
      source.ttsModelEnable,
      source.tts_model_enable,
      false,
    ),
    tts_autoplay: booleanValue(source.ttsAutoplay, source.tts_autoplay, false),
    tts_type: optionalString(source.ttsType, source.tts_type) ?? 'BROWSER',
    language: optionalString(source.language),
    type: optionalString(source.type),
    user_avatar: firstString(source.userAvatar, source.user_avatar),
    work_flow: workflow,
  };
}

export function getPublicChatThemeStyle(
  profile: PublicChatProfile,
): Record<string, string> {
  const themeColor = profile.custom_theme?.theme_color || '#3370FF';
  const style: Record<string, string> = { '--el-color-primary': themeColor };

  const light9 = hexToRgba(themeColor, 0.1);
  const light6 = hexToRgba(themeColor, 0.4);
  const light06 = hexToRgba(themeColor, 0.04);
  if (light9) style['--el-color-primary-light-9'] = light9;
  if (light6) style['--el-color-primary-light-6'] = light6;
  if (light06) style['--el-color-primary-light-06'] = light06;
  return style;
}

export function getPublicChatBackgroundStyle(
  profile: PublicChatProfile,
): Record<string, string> {
  return profile.chat_background
    ? {
        backgroundImage: `url(${profile.chat_background})`,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
      }
    : {};
}

export function getPublicChatHeaderStyle(
  profile: PublicChatProfile,
): Record<string, string> {
  const style: Record<string, string> = {};
  if (profile.custom_theme.theme_color) {
    style.background = profile.custom_theme.theme_color;
  }
  if (profile.custom_theme.header_font_color) {
    style.color = profile.custom_theme.header_font_color;
  }
  return style;
}

function unwrapProfile(value: unknown): PublicChatProfileResponse {
  const root = objectValue(value);
  const nestedData = objectValue(root.data);
  return nestedData.applicationId || nestedData.name ? nestedData : root;
}

function normalizeTheme(...values: unknown[]): PublicChatCustomTheme {
  for (const value of values) {
    const theme =
      typeof value === 'string' ? parseObject(value) : objectValue(value);
    const themeColor = firstString(theme.theme_color, theme.themeColor);
    const headerFontColor = firstString(
      theme.header_font_color,
      theme.headerFontColor,
    );
    if (themeColor || headerFontColor) {
      return {
        header_font_color: headerFontColor,
        theme_color: themeColor,
      };
    }
  }
  return { header_font_color: '', theme_color: '' };
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (Array.isArray(value)) {
      const normalized: string = firstString(...value);
      if (normalized) return normalized;
      continue;
    }
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' || typeof value === 'boolean')
      return `${value}`;
  }
  return '';
}

function optionalString(...values: unknown[]): string {
  const result = firstString(...values);
  return result || '';
}

function booleanValue(
  value: unknown,
  secondaryValue: unknown,
  fallback: boolean,
) {
  for (const candidate of [value, secondaryValue]) {
    if (typeof candidate === 'boolean') return candidate;
    if (typeof candidate === 'string') {
      if (candidate === 'true') return true;
      if (candidate === 'false') return false;
    }
  }
  return fallback;
}

function objectValue(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseObject(value: string): Record<string, unknown> {
  try {
    return objectValue(JSON.parse(value));
  } catch {
    return {};
  }
}

function hexToRgba(value: string, alpha: number) {
  const hex = value.trim().replace(/^#/, '');
  if (!/^[\da-f]{3}$|^[\da-f]{6}$/i.test(hex)) return '';
  const normalized =
    hex.length === 3 ? [...hex].map((char) => `${char}${char}`).join('') : hex;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgb(${red} ${green} ${blue} / ${alpha})`;
}
