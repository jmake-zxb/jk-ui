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
