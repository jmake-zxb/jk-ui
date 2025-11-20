import { requestClient } from '#/api/request';

export function fetchList(query?: object) {
  return requestClient.get('/gen/table/page', {
    params: query,
  });
}

export function addObj(obj?: object) {
  return requestClient.post('/gen/table', obj);
}

export function getObj(id?: string) {
  return requestClient.get(`/gen/table/${id}`);
}

export function delObj(id?: string) {
  return requestClient.delete(`/gen/table/${id}`);
}

export function putObj(obj?: object) {
  return requestClient.put('/gen/table', obj);
}

export const useSyncTableApi = (dsName: string, tableName: string) => {
  return requestClient.get(`/gen/table/sync/${dsName}/${tableName}`);
};

export const useTableApi = (dsName: string, tableName: string) => {
  return requestClient.get(`/gen/table/${dsName}/${tableName}`);
};

export const useListTableApi = (dsName: string) => {
  return requestClient.get(`/gen/table/list/${dsName}`);
};

export const useListTableColumnApi = (dsName: string, tableName: string) => {
  return requestClient.get(`/gen/table/column/${dsName}/${tableName}`);
};

export const useTableFieldSubmitApi = (
  dsName: string,
  tableName: string,
  fieldList: any,
) => {
  return requestClient.put(
    `/gen/table/field/${dsName}/${tableName}`,
    fieldList,
  );
};

export const useGeneratorCodeApi = (tableIds: any) => {
  return requestClient.get('/gen/generator/code', {
    params: { tableIds },
  });
};

export const useGeneratorVFormApi = (dsName: any, tableName: any) => {
  return requestClient.get('/gen/generator/vform', {
    params: { dsName, tableName },
  });
};

export const useGeneratorVFormSfcApi = (id: string) => {
  return requestClient.get('/gen/generator/vform/sfc', {
    params: { formId: id },
  });
};

export const useGeneratorPreviewApi = (tableId: any) => {
  return requestClient.get('/gen/generator/preview', {
    params: { tableId },
  });
};

export function fetchDictList() {
  return requestClient.get('/admin/dict/list');
}

export function useFormConfSaveApi(obj?: object) {
  return requestClient.post('/gen/form', obj);
}

export function fetchFormList(query?: object) {
  return requestClient.get('/gen/form/page', {
    params: query,
  });
}

export function fetchFormById(id?: string) {
  return requestClient.get(`/gen/form/${id}`);
}

export function delFormObj(id?: string) {
  return requestClient.delete(`/gen/form/${id}`);
}
