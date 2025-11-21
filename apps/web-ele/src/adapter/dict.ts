import { ref, toRefs } from 'vue';

import { getDicts } from '#/api/admin/dict';
import { dict } from '#/store/dict';

/**
 * 获取字典数据
 */
export function useDict(...args: string[]): any {
  const res = ref<Record<string, any>>({});
  return (() => {
    args.forEach((dictType: string) => {
      res.value[dictType] = [];
      const dicts = dict().getDict(dictType);
      if (dicts) {
        res.value[dictType] = dicts;
      } else {
        getDicts(dictType).then((resp) => {
          res.value[dictType] = resp.map((p: any) => ({
            label: p.label,
            value: p.value,
            elTagType: p.listClass,
            elTagClass: p.cssClass,
          }));
          dict().setDict(dictType, res.value[dictType]);
        });
      }
    });
    return toRefs(res.value);
  })();
}
