<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import {
  ElButton,
  ElDialog,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElScrollbar,
  ElSelect,
  ElTag,
} from 'element-plus';

import {
  createChatRecordAnnotation,
  deleteChatRecordAnnotation,
  listChatRecordAnnotations,
} from '#/api/ai/applications';
import { listKnowledge, pageDocuments } from '#/api/ai/knowledge';

import { recordsOf } from '../../utils';

type JsonRecord = Record<string, unknown>;

const props = withDefaults(
  defineProps<{
    applicationId?: number | string;
    chatId?: number | string;
    chatRecordId?: number | string;
    defaultContent?: string;
    defaultTitle?: string;
    modelValue: boolean;
  }>(),
  {
    applicationId: '',
    chatId: '',
    chatRecordId: '',
    defaultContent: '',
    defaultTitle: '',
  },
);

const emit = defineEmits<{
  saved: [];
  'update:modelValue': [value: boolean];
}>();

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const knowledgeOptions = ref<JsonRecord[]>([]);
const documentOptions = ref<JsonRecord[]>([]);
const annotations = ref<JsonRecord[]>([]);
const knowledgeId = ref<number | string>('');
const documentId = ref<number | string>('');
const title = ref('');
const content = ref('');
const saving = ref(false);
const loadingDocuments = ref(false);
const loadingAnnotations = ref(false);

function idValue(value: unknown): number | string | undefined {
  if (typeof value === 'number' || typeof value === 'string') return value;
  return undefined;
}

function optionValue(record: JsonRecord): number | string {
  return idValue(firstValue(record, ['id'])) ?? '';
}

function firstValue(record: JsonRecord | undefined, keys: string[]): unknown {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function stringValue(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return `${value}`;
  return fallback;
}

const canSubmit = computed(
  () => !!knowledgeId.value && !!content.value.trim() && !!props.chatRecordId,
);

async function loadKnowledge() {
  const response = await listKnowledge();
  knowledgeOptions.value = recordsOf<JsonRecord>(response);
}

async function loadDocuments() {
  documentOptions.value = [];
  documentId.value = '';
  if (!knowledgeId.value) return;
  loadingDocuments.value = true;
  try {
    const response = await pageDocuments(knowledgeId.value, {
      current: 1,
      page: 1,
      size: 100,
    });
    documentOptions.value = recordsOf<JsonRecord>(response);
  } finally {
    loadingDocuments.value = false;
  }
}

async function loadAnnotations() {
  if (!props.applicationId || !props.chatId || !props.chatRecordId) {
    annotations.value = [];
    return;
  }
  loadingAnnotations.value = true;
  try {
    const response = await listChatRecordAnnotations(
      props.applicationId,
      props.chatId,
      props.chatRecordId,
    );
    annotations.value = Array.isArray(response)
      ? (response as JsonRecord[])
      : recordsOf<JsonRecord>(response);
  } finally {
    loadingAnnotations.value = false;
  }
}

async function submit() {
  if (!canSubmit.value) {
    ElMessage.warning('请选择知识库并填写标注内容');
    return;
  }
  saving.value = true;
  try {
    await createChatRecordAnnotation(
      props.applicationId,
      props.chatId,
      props.chatRecordId,
      knowledgeId.value,
      documentId.value || 0,
      {
        content: content.value.trim(),
        title: title.value.trim() || undefined,
      },
    );
    ElMessage.success('标注成功');
    await loadAnnotations();
    emit('saved');
  } catch (error) {
    const message = error instanceof Error ? error.message : '标注失败';
    ElMessage.error(message);
  } finally {
    saving.value = false;
  }
}

async function removeAnnotation(row: JsonRecord) {
  const paragraphId = idValue(firstValue(row, ['id']));
  const rowKnowledgeId = idValue(
    firstValue(row, ['knowledgeId', 'knowledge_id']),
  );
  const rowDocumentId = idValue(firstValue(row, ['documentId', 'document_id']));
  if (
    paragraphId === undefined ||
    rowKnowledgeId === undefined ||
    rowDocumentId === undefined
  ) {
    ElMessage.warning('缺少标注信息，无法删除');
    return;
  }
  try {
    await ElMessageBox.confirm('确认删除该标注分段？', '提示', {
      cancelButtonText: '取消',
      confirmButtonText: '删除',
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await deleteChatRecordAnnotation(
      props.applicationId,
      props.chatId,
      props.chatRecordId,
      rowKnowledgeId,
      rowDocumentId,
      paragraphId,
    );
    ElMessage.success('已删除');
    await loadAnnotations();
    emit('saved');
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除失败';
    ElMessage.error(message);
  }
}

watch(
  () => props.modelValue,
  async (visible) => {
    if (!visible) return;
    title.value = props.defaultTitle || '';
    content.value = props.defaultContent || '';
    knowledgeId.value = '';
    documentId.value = '';
    documentOptions.value = [];
    await Promise.all([loadKnowledge(), loadAnnotations()]);
  },
);
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    align-center
    append-to-body
    destroy-on-close
    title="标注到知识库"
    width="640px"
  >
    <ElForm label-position="top">
      <ElFormItem label="目标知识库" required>
        <ElSelect
          v-model="knowledgeId"
          class="annotation-dialog__control"
          filterable
          placeholder="请选择知识库"
          @change="loadDocuments"
        >
          <ElOption
            v-for="item in knowledgeOptions"
            :key="`${firstValue(item, ['id'])}`"
            :label="stringValue(firstValue(item, ['name']), '未命名知识库')"
            :value="optionValue(item)"
          />
        </ElSelect>
      </ElFormItem>

      <ElFormItem label="目标文档（可选，留空自动归入标注问答文档）">
        <ElSelect
          v-model="documentId"
          class="annotation-dialog__control"
          clearable
          filterable
          :loading="loadingDocuments"
          placeholder="默认归入标注问答文档"
        >
          <ElOption
            v-for="item in documentOptions"
            :key="`${firstValue(item, ['id'])}`"
            :label="stringValue(firstValue(item, ['name']), '未命名文档')"
            :value="optionValue(item)"
          />
        </ElSelect>
      </ElFormItem>

      <ElFormItem label="标注标题">
        <ElInput
          v-model="title"
          maxlength="256"
          placeholder="默认使用提问内容"
        />
      </ElFormItem>

      <ElFormItem label="标注内容" required>
        <ElInput
          v-model="content"
          placeholder="加入知识库的分段正文"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 10 }"
        />
      </ElFormItem>
    </ElForm>

    <div class="annotation-dialog__existing">
      <div class="annotation-dialog__existing-title">
        <span>已标注分段</span>
        <ElTag size="small" type="info">{{ annotations.length }}</ElTag>
      </div>
      <ElScrollbar
        v-loading="loadingAnnotations"
        class="annotation-dialog__existing-scroll"
      >
        <div
          v-for="row in annotations"
          :key="`${firstValue(row, ['id'])}`"
          class="annotation-dialog__existing-item"
        >
          <div class="annotation-dialog__existing-content">
            <div class="annotation-dialog__existing-name">
              {{ stringValue(firstValue(row, ['title']), '标注分段') }}
            </div>
            <div class="annotation-dialog__existing-text">
              {{ stringValue(firstValue(row, ['content']), '-') }}
            </div>
          </div>
          <ElButton link type="danger" @click="removeAnnotation(row)">
            删除
          </ElButton>
        </div>
        <ElEmpty
          v-if="!loadingAnnotations && annotations.length === 0"
          description="暂无标注分段"
          :image-size="40"
        />
      </ElScrollbar>
    </div>

    <template #footer>
      <ElButton @click="dialogVisible = false">取消</ElButton>
      <ElButton
        type="primary"
        :disabled="!canSubmit"
        :loading="saving"
        @click="submit"
      >
        标注
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.annotation-dialog__control {
  width: 100%;
}

.annotation-dialog__existing {
  margin-top: 8px;
}

.annotation-dialog__existing-title {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.annotation-dialog__existing-scroll {
  max-height: 200px;
  padding: 4px 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius);
}

.annotation-dialog__existing-item {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.annotation-dialog__existing-item:last-child {
  border-bottom: none;
}

.annotation-dialog__existing-content {
  min-width: 0;
}

.annotation-dialog__existing-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.annotation-dialog__existing-text {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: calc(var(--font-size-base) * 0.8125);
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
</style>
