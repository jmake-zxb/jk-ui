/**
 * 按指定属性对数组排序
 * @param list  待排序数组
 * @param property  排序属性名
 * @param desc  是否降序（默认升序）
 */
export function arraySort(
  list: Array<Record<string, any>>,
  property: string,
  desc?: boolean,
) {
  return [...list].toSorted((a, b) => {
    return desc ? b[property] - a[property] : a[property] - b[property];
  });
}
