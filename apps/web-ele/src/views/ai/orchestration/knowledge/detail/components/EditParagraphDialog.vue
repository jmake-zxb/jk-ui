<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

import { Plus } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCol,
  ElDialog,
  ElDivider,
  ElInput,
  ElRow,
  ElScrollbar,
  ElTag,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

import ParagraphForm from './ParagraphForm.vue';

defineProps<{
  isConnect?: boolean;
  knowledgeId?: string;
}>();

const emit = defineEmits<{
  updateContent: [data: Record<string, any>];
}>();

const dialogVisible = ref<boolean>(false);

const detail = ref<Record<string, any>>({});

const paragraphFormRef = ref<InstanceType<typeof ParagraphForm>>();
const inputRef = ref<InstanceType<typeof ElInput>>();

const isAddProblem = ref(false);

const problemValue = ref('');

watch(dialogVisible, (bool) => {
  if (!bool) {
    detail.value = {};
  }
});

const open = (data: Record<string, any>) => {
  detail.value = cloneDeep(data);
  dialogVisible.value = true;
};

function delProblemHandle(_item: any, index: number | string) {
  detail.value.problem_list.splice(Number(index), 1);
}

function addProblemHandle() {
  if (problemValue.value.trim()) {
    if (
      !detail.value?.problem_list.some(
        (item: any) => item.content === problemValue.value.trim(),
      )
    ) {
      detail.value?.problem_list?.push({
        content: problemValue.value.trim(),
      });
    }

    problemValue.value = '';
    isAddProblem.value = false;
  }
}

function addProblem() {
  isAddProblem.value = true;
  nextTick(() => {
    inputRef.value?.focus();
  });
}

const submitHandle = async () => {
  if (await paragraphFormRef.value?.validate()) {
    emit('updateContent', {
      problem_list: detail.value.problem_list,
      ...paragraphFormRef.value?.form,
    });
    dialogVisible.value = false;
  }
};

defineExpose({ open });
</script>

<template>
  <ElDialog
    title="编辑分段"
    v-model="dialogVisible"
    width="80%"
    destroy-on-close
    class="paragraph-dialog"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <ElRow v-if="isConnect">
      <ElCol :span="18" class="p-24">
        <ParagraphForm
          ref="paragraphFormRef"
          :data="detail"
          :is-edit="true"
          :knowledge-id="knowledgeId"
        />
      </ElCol>
      <ElCol :span="6" class="border-l" style="width: 300px">
        <p class="bold title p-24" style="padding-bottom: 0">
          <span class="align-center flex">
            <span>关联问题</span>
            <ElDivider direction="vertical" class="mr-4" />
            <ElButton text @click="addProblem">
              <Plus />
            </ElButton>
          </span>
        </p>
        <ElScrollbar height="500px">
          <div class="p-24" style="padding-top: 16px">
            <ElInput
              v-if="isAddProblem"
              v-model="problemValue"
              placeholder="请输入关联问题"
              @change="addProblemHandle"
              @blur="isAddProblem = false"
              ref="inputRef"
              class="mb-8"
            />

            <template v-for="(item, index) in detail.problem_list" :key="index">
              <ElTag
                @close="delProblemHandle(item, index)"
                class="question-tag"
                type="info"
                effect="plain"
                closable
              >
                <span :title="item.content">
                  {{ item.content }}
                </span>
              </ElTag>
            </template>
          </div>
        </ElScrollbar>
      </ElCol>
    </ElRow>
    <div v-else class="p-24">
      <ParagraphForm
        ref="paragraphFormRef"
        :data="detail"
        :is-edit="true"
        :knowledge-id="knowledgeId"
      />
    </div>

    <template #footer>
      <span class="dialog-footer">
        <ElButton @click.prevent="dialogVisible = false"> 取消 </ElButton>
        <ElButton type="primary" @click="submitHandle"> 保存 </ElButton>
      </span>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.p-24 {
  padding: 24px;
}

.bold {
  font-weight: bold;
}

.title {
  font-size: 14px;
}

.flex {
  display: flex;
}

.align-center {
  align-items: center;
}

.border-l {
  border-left: 1px solid var(--el-border-color-light);
}

.mr-4 {
  margin-right: 4px;
}

.mb-8 {
  margin-bottom: 8px;
}

.question-tag {
  max-width: 100%;
  margin-right: 8px;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
