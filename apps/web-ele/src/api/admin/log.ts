import { requestClient } from '#/api/request';

export interface SysLog {
  /* 日志编号 */
  id?: string;

  /* 日志类型 */
  logType: string;

  /* 日志标题 */
  title: string;

  /* 创建人 */
  createBy?: string;

  /* 创建时间 */
  createTime?: Record<string, unknown>;

  /* 更新时间 */
  updateTime?: Record<string, unknown>;

  /* 操作ip地址 */
  remoteAddr?: string;

  /* 用户代理 */
  userAgent?: string;

  /* 请求uri */
  requestUri?: string;

  /* 操作方式 */
  method?: string;

  /* 提交数据 */
  params?: string;

  /* 方法执行时间 */
  time?: number;

  /* 异常信息 */
  exception?: string;

  /* 应用标识 */
  serviceId?: string;

  /* 删除标记,1:已删除,0:正常 */
  delFlag?: string;
}

export const pageList = (params?: object) => {
  return requestClient.get<SysLog>('/admin/log/page', {
    params,
  });
};

export const delObj = (ids?: object) => {
  return requestClient.delete('/admin/log', {
    data: ids,
  });
};
