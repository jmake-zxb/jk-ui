<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';

import {
  ArrowDown,
  ArrowUp,
  Delete,
  Edit,
  Plus,
  QuestionFilled,
} from '@element-plus/icons-vue';
import {
  ElButton,
  ElCard,
  ElDialog,
  ElEmpty,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElPagination,
  ElSwitch,
  ElTag,
  ElText,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

import {
  adjustParagraphPosition,
  createParagraphProblem,
  listParagraphProblems,
  unassociateProblemFromParagraph,
  updateParagraph,
} from '#/api/ai/knowledge';

import EditParagraphDialog from './EditParagraphDialog.vue';

const props = defineProps<{
  documentId?: string;
  isConnect?: boolean;
  knowledgeId?: string;
  modelValue: any[];
}>();

const emit = defineEmits<{
  refresh: [];
  'update:modelValue': [value: any[]];
}>();

const pageSize = ref<number>(30);
const currentPage = ref<number>(1);
const currentCIndex = ref<number>(0);
const EditParagraphDialogRef = ref<InstanceType<typeof EditParagraphDialog>>();
const show = ref<null | number>(null);

// --- Problem management state ---
const problemDialogVisible = ref(false);
const problemParagraphId = ref<string>('');
const problemParagraphTitle = ref('');
const paragraphProblemsMap = ref<Record<string, any[]>>({});
const newProblemText = ref('');
const problemInputVisible = ref(false);
const problemInputRef = ref<InstanceType<typeof ElInput>>();
const problemLoading = ref(false);

const paragraphList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return props.modelValue.slice(start, Math.min(end, props.modelValue.length));
});

function cardEnter(cIndex: number) {
  show.value = cIndex;
}

function cardLeave() {
  show.value = null;
}

const editHandle = (item: any, cIndex: number) => {
  currentCIndex.value = cIndex + pageSize.value * (currentPage.value - 1);
  EditParagraphDialogRef.value?.open(item);
};

const updateContent = (data: any) => {
  const newValue = [...props.modelValue];
  if (
    props.isConnect &&
    data.title &&
    !data?.problem_list.some((item: any) => item.content === data.title.trim())
  ) {
    data.problem_list.push({
      content: data.title.trim(),
    });
  }
  newValue[currentCIndex.value] = cloneDeep(data);
  emit('update:modelValue', newValue);
};

const deleteHandle = (item: any, cIndex: number) => {
  const actualIndex = cIndex + pageSize.value * (currentPage.value - 1);
  ElMessageBox.confirm(`确认删除 "${item.title || '-'}" ?`, '删除分段', {
    confirmButtonText: '确认',
    confirmButtonClass: 'danger',
    type: 'warning',
  })
    .then(() => {
      const newValue = [...props.modelValue];
      newValue.splice(actualIndex, 1);
      emit('update:modelValue', newValue);
    })
    .catch(() => {});
};

// --- Problem management ---

async function openProblemDialog(paragraph: any) {
  if (!props.knowledgeId || !props.documentId) {
    ElMessage.warning('缺少知识库或文档信息');
    return;
  }
  problemParagraphId.value = String(paragraph.id);
  problemParagraphTitle.value =
    paragraph.title || paragraph.content?.slice(0, 30) || '';
  problemDialogVisible.value = true;
  await loadProblems(String(paragraph.id));
}

async function loadProblems(paragraphId: string) {
  if (!props.knowledgeId || !props.documentId) return;
  problemLoading.value = true;
  try {
    const res = await listParagraphProblems(
      props.knowledgeId,
      props.documentId,
      paragraphId,
    );
    paragraphProblemsMap.value[paragraphId] = (res as any) || [];
  } catch {
    paragraphProblemsMap.value[paragraphId] = [];
  } finally {
    problemLoading.value = false;
  }
}

async function addProblem() {
  const text = newProblemText.value.trim();
  if (!text || !props.knowledgeId || !props.documentId) return;

  const paragraphId = problemParagraphId.value;
  try {
    await createParagraphProblem(
      props.knowledgeId,
      props.documentId,
      paragraphId,
      {
        content: text,
      },
    );
    newProblemText.value = '';
    problemInputVisible.value = false;
    await loadProblems(paragraphId);
  } catch {
    ElMessage.error('添加问题失败');
  }
}

function showProblemInput() {
  problemInputVisible.value = true;
  nextTick(() => {
    problemInputRef.value?.focus();
  });
}

async function removeProblem(problemId: number | string) {
  if (!props.knowledgeId || !props.documentId) return;
  const paragraphId = problemParagraphId.value;
  try {
    await unassociateProblemFromParagraph(
      props.knowledgeId,
      props.documentId,
      paragraphId,
      String(problemId),
    );
    await loadProblems(paragraphId);
  } catch {
    ElMessage.error('移除问题失败');
  }
}

function getProblemCount(paragraphId: number | string): number {
  return paragraphProblemsMap.value[String(paragraphId)]?.length || 0;
}

// --- Position adjustment ---

async function moveParagraph(paragraph: any, direction: 'down' | 'up') {
  if (!props.knowledgeId || !props.documentId) return;
  const actualIndex = props.modelValue.indexOf(paragraph);
  if (actualIndex === -1) return;
  if (direction === 'up' && actualIndex === 0) return;
  if (direction === 'down' && actualIndex === props.modelValue.length - 1)
    return;

  const newPosition = direction === 'up' ? actualIndex : actualIndex + 2;
  try {
    await adjustParagraphPosition(
      props.knowledgeId,
      props.documentId,
      String(paragraph.id),
      newPosition,
    );
    emit('refresh');
  } catch {
    ElMessage.error('调整位置失败');
  }
}

// --- is_active toggle ---

async function toggleActive(paragraph: any, val: boolean) {
  if (!props.knowledgeId || !props.documentId) return;
  try {
    await updateParagraph(
      props.knowledgeId,
      props.documentId,
      String(paragraph.id),
      {
        isActive: val,
      } as any,
    );
    const newValue = [...props.modelValue];
    const idx = newValue.indexOf(paragraph);
    if (idx !== -1) {
      newValue[idx] = { ...cloneDeep(newValue[idx]), isActive: val };
      emit('update:modelValue', newValue);
    }
  } catch {
    ElMessage.error('更新状态失败');
  }
}
</script>

<template>
  <div>
    <ElEmpty v-if="props.modelValue.length === 0" description="暂无分段" />

    <ElCard
      v-for="(child, cIndex) in paragraphList"
      :key="cIndex"
      shadow="never"
      class="paragraph-preview-card card-never mb-16"
      @mouseenter="cardEnter(cIndex)"
      @mouseleave="cardLeave()"
    >
      <div v-show="show === cIndex" class="mk-sticky">
        <ElCard
          class="paragraph-box-operation mr-8 mt-8"
          shadow="always"
          :body-style="{ padding: '8px 12px', borderRadius: '8px' }"
          @click.stop
        >
          <ElButton link @click="editHandle(child, cIndex)">
            <Edit />
          </ElButton>
          <ElButton link @click="deleteHandle(child, cIndex)">
            <Delete />
          </ElButton>
          <ElButton
            v-if="props.isConnect"
            link
            :title="`${getProblemCount(child.id)} 个问题`"
            @click="openProblemDialog(child)"
          >
            <QuestionFilled />
            <span class="problem-badge" v-if="getProblemCount(child.id) > 0">
              {{ getProblemCount(child.id) }}
            </span>
          </ElButton>
          <ElButton
            link
            :disabled="cIndex === 0 && currentPage === 1"
            title="上移"
            @click.stop="moveParagraph(child, 'up')"
          >
            <ArrowUp />
          </ElButton>
          <ElButton
            link
            :disabled="
              cIndex === paragraphList.length - 1 &&
              currentPage * pageSize >= props.modelValue.length
            "
            title="下移"
            @click.stop="moveParagraph(child, 'down')"
          >
            <ArrowDown />
          </ElButton>
        </ElCard>
      </div>
      <div class="flex-between">
        <span>{{ child.title || '-' }}</span>
        <ElSwitch
          :model-value="child.isActive ?? true"
          size="small"
          @change="
            (val: boolean | string | number) =>
              toggleActive(child, val as boolean)
          "
        />
      </div>
      <div class="lighter mt-12">
        {{ child.content }}
      </div>
      <div class="lighter mt-12">
        <ElText type="info"> {{ child.content?.length || 0 }} 字符 </ElText>
      </div>
    </ElCard>

    <div class="paragraph-pagination" v-if="props.modelValue.length > 0">
      <ElPagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 30, 50]"
        :total="props.modelValue.length"
        layout="total, sizes, prev, pager, next"
        background
      />
    </div>

    <EditParagraphDialog
      ref="EditParagraphDialogRef"
      @update-content="updateContent"
      :is-connect="isConnect"
      :knowledge-id="knowledgeId"
    />

    <!-- Problem management dialog -->
    <ElDialog
      v-model="problemDialogVisible"
      :title="`问题管理 — ${problemParagraphTitle}`"
      width="500px"
      destroy-on-close
      :close-on-click-modal="false"
    >
      <div class="problem-dialog-body">
        <div class="problem-add-row">
          <ElButton
            v-if="!problemInputVisible"
            type="primary"
            link
            :icon="Plus"
            @click="showProblemInput"
          >
            添加问题
          </ElButton>
          <ElInput
            v-else
            ref="problemInputRef"
            v-model="newProblemText"
            placeholder="请输入问题内容"
            class="problem-input"
            @keyup.enter="addProblem"
            @blur="addProblem"
          />
        </div>

        <div v-if="problemLoading" class="problem-loading">加载中...</div>

        <div
          v-else-if="!paragraphProblemsMap[problemParagraphId]?.length"
          class="problem-empty"
        >
          <ElText type="info">暂无关联问题</ElText>
        </div>

        <div v-else class="problem-list">
          <div
            v-for="problem in paragraphProblemsMap[problemParagraphId]"
            :key="problem.id"
            class="problem-item"
          >
            <ElTag type="info" effect="plain" class="problem-tag">
              {{ problem.content }}
            </ElTag>
            <ElButton
              link
              type="danger"
              :icon="Delete"
              @click="removeProblem(problem.id)"
            />
          </div>
        </div>
      </div>
    </ElDialog>
  </div>
</template>

<style scoped lang="scss">
.paragraph-preview-card {
  --kb-space-2: 8px;
  --kb-space-3: 12px;
  --kb-border-color: var(--el-border-color-lighter);
  --kb-panel-bg: hsl(var(--card));
  --kb-radius: 6px;

  position: relative;
  background: var(--kb-panel-bg);
  border: 1px solid var(--kb-border-color);
  border-radius: var(--kb-radius);
  transition:
    border-color var(--el-transition-duration),
    box-shadow var(--el-transition-duration);

  &:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: var(--el-box-shadow-light);
  }

  :deep(.el-card__body) {
    padding: var(--kb-space-4, 16px);
  }

  .mk-sticky {
    position: sticky;
    top: 12px;
    right: 0;
    z-index: 10;
    height: 0;
    overflow: inherit;
  }

  .paragraph-box-operation {
    position: absolute;
    top: -20px;
    right: -10px;
    z-index: 10;
    overflow: inherit;
    background: var(--kb-panel-bg);
    border: 1px solid var(--kb-border-color);
    border-radius: var(--kb-radius);
    box-shadow: var(--el-box-shadow);

    :deep(.el-card__body) {
      display: flex;
      gap: var(--kb-space-1, 4px);
      padding: var(--kb-space-2) var(--kb-space-3);
    }

    :deep(.el-button) {
      color: var(--el-text-color-secondary);
      transition: all var(--el-transition-duration);

      &:hover {
        color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
      }

      &:disabled {
        color: var(--el-text-color-placeholder);
      }
    }
  }
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--kb-space-3, 12px);

  > span {
    font-size: var(--el-font-size-base);
    font-weight: var(--el-font-weight-primary);
    color: var(--el-text-color-primary);
  }
}

.lighter {
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
  word-break: break-all;
}

.mt-12 {
  margin-top: var(--kb-space-3, 12px);
}

.mt-8 {
  margin-top: var(--kb-space-2, 8px);
}

.mr-8 {
  margin-right: var(--kb-space-2, 8px);
}

.mb-16 {
  margin-bottom: var(--kb-space-4, 16px);
}

.paragraph-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--kb-space-4, 16px);
}

.problem-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  margin-left: 2px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  color: var(--el-color-white);
  background: var(--el-color-danger);
  border-radius: 8px;
}

.problem-dialog-body {
  min-height: 120px;
}

.problem-add-row {
  margin-bottom: var(--kb-space-3, 12px);
}

.problem-input {
  width: 100%;
}

.problem-loading {
  padding: 24px 0;
  font-size: var(--el-font-size-base);
  color: var(--el-text-color-secondary);
  text-align: center;
}

.problem-empty {
  padding: 24px 0;
  font-size: var(--el-font-size-base);
  color: var(--el-text-color-secondary);
  text-align: center;
}

.problem-list {
  display: flex;
  flex-direction: column;
  gap: var(--kb-space-2, 8px);
  max-height: 300px;
  overflow-y: auto;
}

.problem-item {
  display: flex;
  gap: var(--kb-space-2, 8px);
  align-items: center;
  justify-content: space-between;
  padding: var(--kb-space-2, 8px);
  background: var(--el-fill-color-lighter);
  border-radius: var(--kb-radius, 6px);
  transition: background-color var(--el-transition-duration);

  &:hover {
    background: var(--el-fill-color-light);
  }
}

.problem-tag {
  flex: 1;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--el-font-size-extra-small);
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}
</style>
