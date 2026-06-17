export interface PublicChatCustomTheme {
  header_font_color: string;
  theme_color: string;
}

export interface PublicChatProfileResponse {
  [key: string]: unknown;
  appIcon?: string;
  applicationId?: number | string;
  avatar?: string;
  chatBackground?: string;
  customTheme?: string;
  description?: string;
  disclaimer?: boolean;
  disclaimerValue?: string;
  draggable?: boolean;
  floatIcon?: string;
  floatLocation?: string;
  icon?: string;
  language?: string;
  name?: string;
  prologue?: string;
  showAvatar?: boolean;
  showExec?: boolean;
  showGuide?: boolean;
  showHistory?: boolean;
  showSource?: boolean;
  showUserAvatar?: boolean;
  sttAutosend?: boolean;
  sttModelEnable?: boolean;
  ttsAutoplay?: boolean;
  ttsModelEnable?: boolean;
  ttsType?: string;
  type?: string;
  userAvatar?: string;
}

export interface PublicChatProfile extends PublicChatProfileResponse {
  app_icon: string;
  chat_background: string;
  custom_theme: PublicChatCustomTheme;
  disclaimer_value: string;
  file_upload_enable: boolean;
  file_upload_setting: Record<string, unknown>;
  id: string;
  language: string;
  prologue: string;
  show_avatar: boolean;
  show_exec: boolean;
  show_guide: boolean;
  show_history: boolean;
  show_source: boolean;
  show_user_avatar: boolean;
  stt_autosend: boolean;
  stt_model_enable: boolean;
  tts_autoplay: boolean;
  tts_model_enable: boolean;
  tts_type: string;
  type: string;
  user_avatar: string;
  work_flow: Record<string, unknown>;
}

export interface PublicChatTemplateProps {
  application_profile: null | PublicChatProfile;
  applicationAvailable: boolean;
  publicInputJson: string;
  publicToken: string;
}

export type PublicChatMode = 'embed' | 'mobile' | 'no-service' | 'pc';
