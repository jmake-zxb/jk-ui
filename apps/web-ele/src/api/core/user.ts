import { requestClient } from '#/api/request';

export interface BasicUserInfo {
  [key: string]: any;
  userId: string;
  username: string;
  password?: any;
  salt?: any;
  wxOpenid?: any;
  qqOpenid?: any;
  giteeOpenId: string;
  oscOpenId?: any;
  createTime: Date;
  updateTime: Date;
  delFlag: string;
  lockFlag: string;
  phone: string;
  avatar: string;
  dept: Dept;
  roleList: Array<RoleList>;
  postList: Array<PostList>;
  nickname: string;
  name: string;
  email: string;
  permissions: Array<string>;
}

export interface Dept {
  deptId: string;
  name: string;
  sortOrder: number;
  createBy: string;
  updateBy: string;
  createTime: Date;
  updateTime: Date;
  parentId: string;
  delFlag: string;
}

export interface RoleList {
  roleId: string;
  roleName: string;
  roleCode: string;
  roleDesc: string;
  createBy?: any;
  updateBy?: any;
  createTime: Date;
  updateTime: Date;
  delFlag: string;
}

export interface PostList {
  postId: string;
  postCode: string;
  postName: string;
  postSort: number;
  remark: string;
  createBy?: any;
  updateBy?: any;
  delFlag: string;
  createTime: Date;
  updateTime: Date;
}

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  return requestClient.get<BasicUserInfo>('/admin/user/info');
}

export const pageList = async (params: any) => {
  return requestClient.get<BasicUserInfo>('/admin/user/page', { params });
};

export const addObj = (obj: object) => {
  return requestClient.post('/admin/user', obj);
};

export const getObj = (id: string) => {
  return requestClient.get(`/admin/user/details/${id}`);
};

export const delObj = (ids: object) => {
  return requestClient.delete('/admin/user', {
    data: ids,
  });
};

export const putObj = (obj: object) => {
  return requestClient.put('/admin/user', obj);
};

export function getDetails(obj: object) {
  return requestClient.get('/admin/user/details', {
    params: obj,
  });
}

// 更改个人信息
export function editInfo(obj: object) {
  return requestClient.put('/admin/user/edit', obj);
}

export function password(obj: object) {
  return requestClient.put('/admin/user/password', obj);
}

export function UnbindingUser(type: any) {
  return requestClient.post(
    '/admin/user/unbinding',
    {},
    {
      params: {
        type,
      },
    },
  );
}

export function checkPassword(password: string) {
  return requestClient.post(
    '/admin/user/check',
    {},
    {
      params: {
        password,
      },
    },
  );
}

/**
 * 注册用户
 */
export const registerUser = (userInfo: object) => {
  return requestClient.post('/admin/register/user', userInfo);
};

export function validateUsername(
  _rule: any,
  value: any,
  callback: any,
  isEdit: boolean,
) {
  const flag = /^[a-z\d]+$/.test(value);
  if (!flag) {
    callback(new Error('用户名支持小写英文、数字'));
  }

  if (isEdit) {
    return callback();
  }

  getDetails({ username: value }).then((response) => {
    const result = response.data;
    if (result === null) {
      callback();
    } else {
      callback(new Error('用户名已经存在'));
    }
  });
}

export function validatePhone(
  _rule: any,
  value: any,
  callback: any,
  isEdit: boolean,
) {
  if (isEdit) {
    return callback();
  }
  getDetails({ phone: value }).then((response) => {
    const result = response.data;
    if (result === null) {
      callback();
    } else {
      callback(new Error('手机号已经存在'));
    }
  });
}
