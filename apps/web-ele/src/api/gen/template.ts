import { requestClient } from '#/api/request';

export function fetchList(query?: object) {
  return requestClient.get('/gen/template/page', {
    params: query,
  });
}

export function list() {
  return requestClient.get('/gen/template/list');
}

export function online() {
  return requestClient.get('/gen/template/online');
}

export function checkVersion() {
  return requestClient.get('/gen/template/checkVersion');
}

export function addObj(obj?: object) {
  return requestClient.post('/gen/template', obj);
}

export function getObj(id?: string) {
  return requestClient.get(`/gen/template/${id}`);
}

export function delObjs(ids?: object) {
  return requestClient.delete('/gen/template', {
    data: ids,
  });
}

export function putObj(obj?: object) {
  return requestClient.put('/gen/template', obj);
}

/**
 * 导出数据
 * @param obj - 查询参数对象（包含ID等）
 * @returns Promise<数据详情>
 */
export function exportData(obj: object) {
  return requestClient.get('/gen/template/export', { params: obj });
}
