import { requestClient } from '#/api/request';

/**
 * 分页查询列表数据
 * @param query - 查询参数对象
 * @returns Promise<分页数据>
 */
export function pageList(query?: object) {
  return requestClient.get('/ai/reviewDocument/page', {
    params: query,
  });
}

/**
 * 获取详情数据
 * @param obj - 查询参数对象（包含ID等）
 * @returns Promise<数据详情>
 */
export function getObj(obj?: object) {
  return requestClient.get('/ai/reviewDocument/detail', {
    params: obj,
  });
}

/**
 * 获取数据列
 * @param obj - 查询参数对象（包含ID等）
 * @returns Promise<数据详情>
 */
export function getObjs(obj?: object) {
  return requestClient.get('/ai/reviewDocument/details', {
    params: obj,
  });
}

/**
 * 批量删除数据
 * @param ids - 要删除的ID数组
 * @returns Promise<操作结果>
 */
export function delObj(ids?: object) {
  return requestClient.delete('/ai/reviewDocument', {
    data: ids,
  });
}

/**
 * 更新数据
 * @param obj - 要更新的数据对象
 * @returns Promise<操作结果>
 */
export function putObj(obj?: object) {
  return requestClient.put('/ai/reviewDocument', obj);
}

/**
 * 检查结果接口定义
 */
export interface CheckResult {
  uploaded: boolean; // 是否已秒传
  uploadedChunks: number[]; // 已上传的分片索引数组
  fileStatus: number;
}

/**
 * 合并请求参数
 */
export interface MergeParams {
  md5: string;
  fileName: string;
}

/**
 * 检查文件状态 (秒传/断点续传)
 */
export const checkFileApi = (md5: string) => {
  return requestClient.get<CheckResult>('/ai/reviewDocument/check', {
    params: { md5 },
  });
};

/**
 * 上传单个分片
 */
export const uploadChunkApi = (data: FormData) => {
  return requestClient.post('/ai/reviewDocument/chunk', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

/**
 * 合并分片
 */
export const mergeFileApi = (data: MergeParams) => {
  return requestClient.post('/ai/reviewDocument/merge', data);
};
