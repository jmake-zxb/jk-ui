/**
 * 模型管理标准枚举与选项数据
 * 对齐参考实现的模型类型定义，包含 9 种标准模型类型
 */

/** 标准模型类型枚举（9 种） */
export enum ModelType {
  EMBEDDING = 'EMBEDDING',
  IMAGE = 'IMAGE',
  ITV = 'ITV',
  LLM = 'LLM',
  RERANKER = 'RERANKER',
  STT = 'STT',
  TTI = 'TTI',
  TTS = 'TTS',
  TTV = 'TTV',
}

/** 模型类型 → 中文标签映射 */
export const modelTypeLabelMap: Record<string, string> = {
  [ModelType.LLM]: '大语言模型',
  [ModelType.EMBEDDING]: '向量模型',
  [ModelType.RERANKER]: '重排模型',
  [ModelType.STT]: '语音识别',
  [ModelType.TTS]: '语音合成',
  [ModelType.IMAGE]: '图像理解',
  [ModelType.TTI]: '文生图',
  [ModelType.ITV]: '图生视频',
  [ModelType.TTV]: '文生视频',
};

/** 兼容历史非标准类型（CHAT/VIDEO/MULTIMODAL）映射到标准类型 */
export const modelTypeAliasMap: Record<string, string> = {
  CHAT: ModelType.LLM,
  VIDEO: ModelType.TTV,
  MULTIMODAL: ModelType.IMAGE,
  RERANK: ModelType.RERANKER,
};

/** 模型类型下拉选项 */
export const modelTypeList: Array<{ label: string; value: string }> = (
  Object.values(ModelType) as string[]
).map((value) => ({
  label: modelTypeLabelMap[value] ?? value,
  value,
}));

/** 全部模型类型选项（含「全部」占位） */
export const modelTypeOptions: Array<{ label: string; value: string }> = [
  { label: '全部模型', value: '' },
  ...modelTypeList,
];

/** 「全部供应商」占位对象 */
export const allProviderObj = {
  icon: '',
  provider: '',
  name: '全部供应商',
};

/** 「共享模型」占位对象 */
export const sharedProviderObj = {
  icon: '',
  provider: 'share',
  name: '共享模型',
};

/** 私有部署供应商编码列表（本地模型类） */
export const localProviderCodes: string[] = [
  'model_ollama_provider',
  'model_local_provider',
  'model_xinference_provider',
  'model_vllm_provider',
  'model_docker_ai_provider',
  // 兼容短编码
  'ollama',
  'local',
  'xinference',
  'vllm',
  'docker-ai',
];

/**
 * 获取模型类型的中文标签
 * @param type 模型类型字符串
 * @returns 中文标签
 */
export function modelTypeLabel(type?: string): string {
  if (!type) return '未分类';
  const upper = type.toUpperCase();
  // 先查标准映射
  if (modelTypeLabelMap[upper]) return modelTypeLabelMap[upper];
  // 再查别名映射
  const alias = modelTypeAliasMap[upper];
  if (alias && modelTypeLabelMap[alias]) return modelTypeLabelMap[alias];
  return upper;
}

/**
 * 将任意模型类型规范化为标准枚举值
 * @param type 原始类型
 * @returns 标准类型
 */
export function normalizeModelType(type?: string): string {
  if (!type) return '';
  const upper = type.toUpperCase();
  if (modelTypeLabelMap[upper]) return upper;
  const alias = modelTypeAliasMap[upper];
  return alias || upper;
}
