/**
 * 判断是否为空
 * @param val 数据
 */
export const validateNull = (val: any) => {
  if (typeof val === 'boolean') {
    return false;
  }
  if (typeof val === 'number') {
    return false;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return true;
  } else if (val instanceof Object) {
    if (JSON.stringify(val) === '{}') return true;
  } else {
    if (
      val === 'null' ||
      val === null ||
      val === 'undefined' ||
      val === undefined ||
      val === ''
    )
      return true;
    return false;
  }
  return false;
};

export const rule = {
  overLength(_rule: any, value: any, callback: any) {
    if (value?.length > 255) {
      callback(new Error('输入内容过长，请重新输入'));
    } else {
      callback();
    }
  },
  /**
   * 校验 请输入中文、英文、数字包括下划线
   * 名称校验
   */
  validatorNameCn(_rule: any, value: any, callback: any) {
    const acount = /^[\u4E00-\u9FA5\w]+$/;
    if (value && !acount.test(value)) {
      callback(new Error('请输入中文、英文、数字包括下划线'));
    } else {
      callback();
    }
  },
  /**
   * 校验 请输入大写英文、下划线
   * 名称校验
   */
  validatorCapital(_rule: any, value: any, callback: any) {
    const acount = /^[A-Z_]+$/;
    if (value && !acount.test(value)) {
      callback(new Error('请输入大写英文、下划线'));
    } else {
      callback();
    }
  },

  /**
   * 校验 请输入小写英文、下划线
   * 名称校验
   */
  validatorLowercase(_rule: any, value: any, callback: any) {
    const acount = /^[a-z_]+$/;
    if (value && !acount.test(value)) {
      callback(new Error('请输入小写英文、下划线'));
    } else {
      callback();
    }
  },

  /**
   * 校验 请输入小写英文
   * 名称校验
   */
  validatorLower(_rule: any, value: any, callback: any) {
    const acount = /^[a-z]+$/;
    if (value && !acount.test(value)) {
      callback(new Error('请输入小写英文'));
    } else {
      callback();
    }
  },

  /**
   * 校验首尾空白字符的正则表达式
   *
   */
  checkSpace(_rule: any, value: any, callback: any) {
    const longrg = /\S+$/;
    if (longrg.test(value)) {
      callback();
    } else {
      callback(new Error('请输入非空格信息'));
    }
  },

  /**
   * 校验手机号
   */
  validatePhone(_rule: any, value: any, callback: any) {
    const isPhone =
      /^1(?:3\d|4[5-9]|5[0-35-9]|6[2567]|7[0-8]|8\d|9[0-35-9])\d{8}$/;

    if (value.includes('****')) {
      return callback();
    }

    if (isPhone.test(value)) {
      callback();
    } else {
      callback(new Error('请输入合法手机号'));
    }
  },

  /* 数字 */
  number(rule: any, value: any, callback: any) {
    validateFn('number', rule, value, callback, '包含非数字字符');
  },

  /* 字母 */
  letter(rule: any, value: any, callback: any) {
    validateFn('letter', rule, value, callback, '包含非字母字符');
  },

  /* 字母和数字 */
  letterAndNumber(rule: any, value: any, callback: any) {
    validateFn('letterAndNumber', rule, value, callback, '只能输入字母或数字');
  },

  /* 手机号码 */
  mobilePhone(rule: any, value: any, callback: any) {
    validateFn('mobilePhone', rule, value, callback, '手机号码格式有误');
  },

  /* 字母开头，仅可包含数字 */
  letterStartNumberIncluded(rule: any, value: any, callback: any) {
    validateFn(
      'letterStartNumberIncluded',
      rule,
      value,
      callback,
      '必须以字母开头，可包含数字',
    );
  },

  /* 禁止中文输入 */
  noChinese(rule: any, value: any, callback: any) {
    validateFn('noChinese', rule, value, callback, '不可输入中文字符');
  },

  /* 必须中文输入 */
  chinese(rule: any, value: any, callback: any) {
    validateFn('chinese', rule, value, callback, '只能输入中文字符');
  },

  /* 电子邮箱 */
  email(rule: any, value: any, callback: any) {
    validateFn('email', rule, value, callback, '邮箱格式有误');
  },

  /* URL网址 */
  url(rule: any, value: any, callback: any) {
    validateFn('url', rule, value, callback, 'URL格式有误');
  },

  regExp(
    rule: { errorMsg: string; regExp: RegExp | string },
    value: string,
    callback: (arg0?: Error | undefined) => void,
  ) {
    if (validateNull(value) || value.length <= 0) {
      callback();
      return;
    }

    const pattern = new RegExp(rule.regExp);

    if (pattern.test(value)) {
      callback();
    } else {
      const errTxt = rule.errorMsg || 'invalid value';
      callback(new Error(errTxt));
    }
  },
};

/**
 * @desc  [自定义校验规则]
 * @example
 *  import { validateRule } from "@/utils/validateRules";
 *  rules: [
 *     { validator: validateRule.emailValue, trigger: 'blur'}
 *  ]
 */

export const getRegExp = function (validatorName: string) {
  const commonRegExp: Record<string, any> = {
    number: String.raw`^[-]?\d+(\.\d+)?$`,
    letter: '^[A-Za-z]+$',
    letterAndNumber: '^[A-Za-z0-9]+$',
    mobilePhone: '^[1][3-9][0-9]{9}$',
    letterStartNumberIncluded: String.raw`^[A-Za-z]+[A-Za-z\d]*$`,
    noChinese: '^[^\u4E00-\u9FA5]+$',
    chinese: '^[\u4E00-\u9FA5]+$',
    email: String.raw`^([-_A-Za-z0-9.]+)@([_A-Za-z0-9]+\.)+[A-Za-z0-9]{2,3}$`,
    url: '(https?|ftp|file)://[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]',
  };
  return commonRegExp[validatorName];
};

const validateFn = (
  validatorName: string,
  rule: { errorMsg: any },
  value: string,
  callback: (arg0?: Error | undefined) => void,
  defaultErrorMsg: string,
) => {
  if (validateNull(value) || value.length <= 0) {
    callback();
    return;
  }

  const reg = new RegExp(getRegExp(validatorName));

  if (reg.test(value)) {
    callback();
  } else {
    const errTxt = rule.errorMsg || defaultErrorMsg;
    callback(new Error(errTxt));
  }
};

/**
 * 创建一个带防抖的 Zod 异步校验函数
 * @param checkFn 实际执行校验的异步函数，返回 true(通过) 或 false(不通过)
 * @param delay 防抖时间，默认为 500ms
 */
export function createDebouncedRefine(
  checkFn: (value: string) => Promise<boolean>,
  delay: number = 500,
) {
  let timer: null | ReturnType<typeof setTimeout> = null;
  let prevResolve: ((result: boolean) => void) | null = null;

  return (value: string): Promise<boolean> => {
    // 1. 如果有上一次还在挂起的校验，直接让它通过
    // (防止快速输入时 Zod 一直等待旧的 Promise，导致卡死)
    if (prevResolve) {
      prevResolve(true);
    }

    // 2. 清除旧的定时器
    if (timer) {
      clearTimeout(timer);
    }

    // 3. 返回新的 Promise 给 Zod
    return new Promise((resolve) => {
      prevResolve = resolve; // 保存 resolve 引用以便下次取消

      timer = setTimeout(async () => {
        try {
          // 执行业务传入的校验逻辑
          const result = await checkFn(value);
          resolve(result);
        } catch (error) {
          console.error('Validation API Error:', error);
          // 接口报错时，通常建议视为校验通过(以免阻断表单)或失败，根据业务决定
          resolve(false);
        } finally {
          // 清理状态
          prevResolve = null;
          timer = null;
        }
      }, delay);
    });
  };
}

/**
 * 快速生成通用的唯一性校验规则
 * @param fieldName 传给后端的字段名，如 'appid', 'username'
 * @param getObjApi 你的通用查询接口
 * @param getIdFn 一个获取当前 ID 的函数(用于判断是否是编辑模式)
 */
export function createUniqueFieldRule(
  fieldName: string,
  getObjApi: (params: any) => Promise<any>,
  getIdFn: () => null | string | undefined,
  delay: number = 500,
) {
  return createDebouncedRefine(async (value) => {
    if (!value) return true;
    // 1. 动态检查是否为编辑模式
    const currentId = getIdFn();
    if (currentId) return true; // 有 ID 视为编辑，跳过

    // 2. 查重
    const res = await getObjApi({ [fieldName]: value });
    return !(res && res.length > 0);
  }, delay);
}
