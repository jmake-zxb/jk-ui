import { acceptHMRUpdate, defineStore } from 'pinia';

interface BasicUserInfo {
  [key: string]: any;
  avatar: string;
  createTime: Date;
  delFlag: string;
  dept: Dept;
  email: string;
  giteeOpenId: string;
  lockFlag: string;
  name: string;
  nickname: string;
  oscOpenId?: any;
  password?: any;
  permissions: Array<string>;
  phone: string;
  postList: Array<PostList>;
  qqOpenid?: any;
  roleList: Array<RoleList>;
  salt?: any;
  updateTime: Date;
  userId: string;
  username: string;
  wxOpenid?: any;
}

interface Dept {
  createBy: string;
  createTime: Date;
  delFlag: string;
  deptId: string;
  name: string;
  parentId: string;
  sortOrder: number;
  updateBy: string;
  updateTime: Date;
}

interface RoleList {
  createBy?: any;
  createTime: Date;
  delFlag: string;
  roleCode: string;
  roleDesc: string;
  roleId: string;
  roleName: string;
  updateBy?: any;
  updateTime: Date;
}
interface PostList {
  createBy?: any;
  createTime: Date;
  delFlag: string;
  postCode: string;
  postId: string;
  postName: string;
  postSort: number;
  remark: string;
  updateBy?: any;
  updateTime: Date;
}

interface AccessState {
  /**
   * 用户信息
   */
  userInfo: BasicUserInfo | null;
  /**
   * 用户角色
   */
  userRoles: string[];
}

/**
 * @zh_CN 用户信息相关
 */
export const useUserStore = defineStore('core-user', {
  actions: {
    setUserInfo(userInfo: BasicUserInfo | null) {
      // 设置用户信息
      this.userInfo = userInfo;
      // 设置角色信息
      const roles = userInfo?.roles ?? [];
      this.setUserRoles(roles);
    },
    setUserRoles(roles: string[]) {
      this.userRoles = roles;
    },
  },
  state: (): AccessState => ({
    userInfo: null,
    userRoles: [],
  }),
});

// 解决热更新问题
const hot = import.meta.hot;
if (hot) {
  hot.accept(acceptHMRUpdate(useUserStore, hot));
}
