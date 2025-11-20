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
