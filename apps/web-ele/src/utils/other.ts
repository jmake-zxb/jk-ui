// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as CryptoJS from 'crypto-js';

import { validateNull } from './validate';

/**
 *加密处理
 */
export function encryption(src?: string, keyWord?: string) {
  const key = CryptoJS.enc.Utf8.parse(keyWord);
  // 加密
  const encrypted = CryptoJS.AES.encrypt(src, key, {
    iv: key,
    mode: CryptoJS.mode.CFB,
    padding: CryptoJS.pad.NoPadding,
  });
  return encrypted.toString();
}

/**
 * 解密
 * @param src  /
 * @param keyWord /
 * @returns 明文
 */
export function decryption(src: string, keyWord: string) {
  const key = CryptoJS.enc.Utf8.parse(keyWord);
  // 解密逻辑
  const decryptd = CryptoJS.AES.decrypt(src, key, {
    iv: key,
    mode: CryptoJS.mode.CFB,
    padding: CryptoJS.pad.NoPadding,
  });

  return decryptd.toString(CryptoJS.enc.Utf8);
}

/**
 * @description 生成唯一 uuid
 * @return string
 */
export function generateUUID(): string {
  // 先确认 crypto 存在且安全
  if (
    typeof crypto === 'object' &&
    crypto !== null &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  if (
    typeof crypto === 'object' &&
    crypto !== null &&
    typeof crypto.getRandomValues === 'function' &&
    typeof Uint8Array === 'function'
  ) {
    // 创建一个安全的随机数生成器闭包
    const getRandomByte = (): number => {
      const arr = new Uint8Array(1);
      crypto.getRandomValues(arr);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return arr[0]!;
    };

    return '10000000-1000-4000-8000-100000000000'.replaceAll(/[018]/g, (c) => {
      const num = Number(c);
      const r = getRandomByte();
      return (num ^ (r & (15 >> (num / 4)))).toString(16);
    });
  }

  // 降级方案...
  let timestamp = Date.now();
  let performanceNow =
    (typeof performance !== 'undefined' &&
      performance.now &&
      performance.now() * 1000) ||
    0;

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replaceAll(/[xy]/g, (c) => {
    let random = Math.random() * 16;
    if (timestamp > 0) {
      random = Math.trunc((timestamp + random) % 16);
      timestamp = Math.floor(timestamp / 16);
    } else {
      random = Math.trunc((performanceNow + random) % 16);
      performanceNow = Math.floor(performanceNow / 16);
    }
    return (c === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

/**
 * 自动适配不同的后端架构
 * 1. 例如 /act/oa/task ,在微服务架构保持不变,在单体架构编程 /admin/oa/task
 * 2. 特殊 /gen/xxx ,在微服务架构、单体架构编程 都需保持不变
 *
 * @param originUrl 原始路径
 */
export const adaptationUrl = (originUrl?: string) => {
  // 微服务架构 不做路径转换,为空不做路径转换
  const isMicro = import.meta.env.VITE_IS_MICRO;
  if (validateNull(isMicro) || isMicro === 'true') {
    return originUrl;
  }

  // 转为 /admin 路由前缀的请求
  return `/admin/${originUrl?.split('/').splice(2).join('/')}`;
};

/**
 * Base64 加密
 * @param {*} src  明文
 * @returns 密文
 */
export function base64Encrypt(src: string) {
  const encodedWord = CryptoJS.enc.Utf8.parse(src);
  return CryptoJS.enc.Base64.stringify(encodedWord);
}

/**
 * 解析所有太监节点ID
 */
export const resolveAllEunuchNodeId = (
  json: any[],
  idArr: any[],
  temp: any[] = [],
) => {
  for (const item of json) {
    if (item.children && item.children.length > 0) {
      resolveAllEunuchNodeId(item.children, idArr, temp);
    } else {
      temp.push(...idArr.filter((id) => id === item.id));
    }
  }
  return temp;
};

/**
 * 列表结构转树结构
 * @param data
 * @param id
 * @param parentId
 * @param children
 * @param rootId
 */
export function handleTree(
  data: any,
  id: any,
  parentId: any,
  children: any,
  rootId: any,
) {
  id = id || 'id';
  parentId = parentId || 'parentId';
  children = children || 'children';
  rootId =
    rootId ||
    // eslint-disable-next-line prefer-spread
    Math.min.apply(
      Math,
      data.map((item: any) => {
        return item[parentId];
      }),
    ) ||
    0;
  // 对源数据深度克隆
  const cloneData = structuredClone(data);
  // 循环所有项
  const treeData = cloneData.filter((father: any) => {
    const branchArr = cloneData.filter((child: any) => {
      // 返回每一项的子级数组
      return father[id] === child[parentId];
    });
    branchArr.length > 0 ? (father[children] = branchArr) : '';
    // 返回第一层
    return father[parentId] === rootId;
  });
  return treeData === '' ? data : treeData;
}

export function getQueryString(url: string, paraName: string) {
  const arrObj = url.split('?');
  if (arrObj.length > 1 && arrObj[1]) {
    const arrPara = arrObj[1].split('&');
    let arr;
    for (const element of arrPara) {
      arr = element.split('=');
      // eslint-disable-next-line eqeqeq
      if (arr != null && arr[0] == paraName) {
        return arr[1];
      }
    }
    return '';
  } else {
    return '';
  }
}
