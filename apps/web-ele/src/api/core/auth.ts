import type { BasicUserInfo } from '#/api/core/user';

import { useAccessStore } from '@vben/stores';

import { baseRequestClient, requestClient } from '#/api/request';
import { encryption } from '#/utils/other';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password?: string;
    username?: string;
    code?: string;
    randomStr?: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    access_token: string;
    aud: Array<string>;
    clientId: string;
    exp: Date;
    expires_in: string;
    iat: Date;
    iss: string;
    jti: string;
    license: string;
    nbf: Date;
    refresh_token: string;
    sub: string;
    token_type: string;
    user_id: string;
    user_info: BasicUserInfo;
    username: string;
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }
}

/**
 * https://www.ietf.org/rfc/rfc6749.txt
 * OAuth 协议 4.3.1 要求格式为 form 而不是 JSON 注意！
 */
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  const basicAuth = `Basic ${window.btoa(import.meta.env.VITE_OAUTH2_PASSWORD_CLIENT)}`;
  const accessStore = useAccessStore();
  accessStore.setAccessToken(basicAuth);
  let encPassword = data.password;
  // 密码加密
  if (import.meta.env.VITE_PWD_ENC_KEY) {
    encPassword = encryption(data.password, import.meta.env.VITE_PWD_ENC_KEY);
  }
  return requestClient.post<AuthApi.LoginResult>(
    '/auth/oauth2/token',
    { ...data, password: encPassword, grant_type: 'password' },
    {
      headers: {
        skipToken: true,
        'Content-Type': FORM_CONTENT_TYPE,
        Authorization: basicAuth,
      },
      responseReturn: 'body',
    },
  );
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  return baseRequestClient.post<AuthApi.RefreshTokenResult>(
    '/auth/oauth2/token',
    {
      withCredentials: true,
    },
  );
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return requestClient.delete('/auth/token/logout');
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/auth/codes');
}
