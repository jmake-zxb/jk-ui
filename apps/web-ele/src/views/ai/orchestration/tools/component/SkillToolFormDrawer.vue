<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

import { Back, Plus } from '@element-plus/icons-vue';
import {
  ElAvatar,
  ElButton,
  ElCard,
  ElDialog,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
  ElUpload,
} from 'element-plus';

import {
  createTool,
  getTool,
  updateTool,
  uploadSkillFile,
} from '#/api/ai/tools';

import EditAvatarDialog from './EditAvatarDialog.vue';
import { buildToolPayload } from './tool-form-utils';

interface Props {
  folderId?: number | string;
  workspaceId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  folderId: undefined,
  workspaceId: 'default',
});

const emit = defineEmits<{
  refresh: [];
}>();

const editAvatarDialogRef = ref<InstanceType<typeof EditAvatarDialog>>();
const visible = ref(false);
const loading = ref(false);
const editingId = ref<number | string>();
const uploadedFile = ref<File | null>(null);
const fieldDialogOpen = ref(false);
const fieldIndex = ref<number>();

const form = reactive({
  name: '',
  description: '',
  icon: '',
  code: '',
  tool_type: 'SKILL' as const,
  enabled: false,
  folder_id: props.folderId,
  workspace_id: props.workspaceId,
  init_field_list: [] as any[],
});

const fieldForm = reactive({
  field: '',
  label: '',
  input_type: 'TextInput',
  required: false,
});

const drawerTitle = computed(() =>
  editingId.value ? '编辑 Skill 工具' : '创建 Skill 工具',
);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function resetForm() {
  form.name = '';
  form.description = '';
  form.icon = '';
  form.code = '';
  form.enabled = false;
  form.init_field_list = [];
  uploadedFile.value = null;
  editingId.value = undefined;
}

function openEditAvatar() {
  editAvatarDialogRef.value?.open(form.icon);
}

function saveAvatar(icon: string) {
  form.icon = icon;
}

function handleFileChange(file: any) {
  if (file.size > 100 * 1024 * 1024) {
    ElMessage.warning('文件大小不能超过 100MB');
    return;
  }
  uploadedFile.value = file.raw;
}

function openFieldDialog(_mode: 'init', row?: any, index?: number) {
  fieldIndex.value = index;
  if (row) {
    Object.assign(fieldForm, row);
  } else {
    fieldForm.field = '';
    fieldForm.label = '';
    fieldForm.input_type = 'TextInput';
    fieldForm.required = false;
  }
  fieldDialogOpen.value = true;
}

function saveField() {
  if (!fieldForm.field.trim()) {
    ElMessage.warning('请输入参数名');
    return;
  }

  const field = { ...fieldForm };
  if (fieldIndex.value === undefined) {
    form.init_field_list.push(field);
  } else {
    form.init_field_list[fieldIndex.value] = field;
  }
  fieldDialogOpen.value = false;
}

function removeInitField(index: number) {
  form.init_field_list.splice(index, 1);
}

async function saveTool() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入工具名称');
    return;
  }
  if (!uploadedFile.value && !editingId.value) {
    ElMessage.warning('请上传 Skill ZIP 文件');
    return;
  }

  loading.value = true;
  try {
    // Upload file first if new file
    if (uploadedFile.value) {
      const uploadRes: any = await uploadSkillFile(uploadedFile.value as any);
      form.code = uploadRes.data || uploadRes.id || uploadRes;
    }

    const payload = buildToolPayload(form as any, {
      enabled: form.enabled,
      isEdit: !!editingId.value,
    });

    if (editingId.value) {
      await updateTool(editingId.value, payload);
      ElMessage.success('保存成功');
    } else {
      await createTool(payload);
      ElMessage.success('创建成功');
    }

    visible.value = false;
    emit('refresh');
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败');
  } finally {
    loading.value = false;
  }
}

function closeDrawer() {
  visible.value = false;
}

async function open(row?: any) {
  resetForm();
  loading.value = true;

  try {
    if (row?.id) {
      editingId.value = row.id;
      const detail = await getTool(row.id);
      form.name = detail.name || row.name || '';
      form.description =
        detail.description || detail.desc || row.description || row.desc || '';
      form.icon = detail.icon || row.icon || '';
      form.code = detail.code || row.code || '';
      form.enabled = !!(detail.enabled ?? row.enabled);

      // Parse init_field_list
      const initList =
        detail.init_field_list ||
        detail.initFieldList ||
        row.init_field_list ||
        row.initFieldList;
      if (typeof initList === 'string') {
        try {
          form.init_field_list = JSON.parse(initList);
        } catch {
          form.init_field_list = [];
        }
      } else if (Array.isArray(initList)) {
        form.init_field_list = initList;
      }
    }
    visible.value = true;
  } finally {
    loading.value = false;
  }
}

defineExpose({ open });
</script>

<template>
  <ElDrawer
    v-model="visible"
    append-to-body
    size="60%"
    :before-close="closeDrawer"
    :show-close="false"
  >
    <template #header>
      <div class="tool-form-drawer__header">
        <ElButton
          class="tool-form-drawer__back"
          link
          @click.prevent="closeDrawer"
        >
          <Back />
        </ElButton>
        <h4>{{ drawerTitle }}</h4>
      </div>
    </template>

    <ElForm
      :model="form"
      label-position="top"
      v-loading="loading"
      @submit.prevent
    >
      <section class="tool-form-section">
        <h4 class="tool-form-section__title mb-4">基础信息</h4>

        <ElFormItem label="名称" required>
          <div class="flex w-full items-center">
            <ElAvatar
              v-if="form.icon"
              :src="form.icon"
              shape="square"
              :size="32"
              class="mr-3"
            />
            <ElAvatar v-else shape="square" :size="32" class="mr-3">
              <span class="text-lg">SK</span>
            </ElAvatar>
            <ElButton
              v-if="editingId"
              link
              type="primary"
              @click="openEditAvatar"
              class="mr-3"
            >
              编辑图标
            </ElButton>
            <ElInput
              v-model="form.name"
              placeholder="请输入 Skill 工具名称"
              maxlength="64"
              show-word-limit
              @blur="form.name = form.name?.trim()"
            />
          </div>
        </ElFormItem>

        <ElFormItem label="描述">
          <ElInput
            v-model="form.description"
            type="textarea"
            placeholder="请输入描述"
            maxlength="128"
            show-word-limit
            :rows="3"
            @blur="form.description = form.description?.trim()"
          />
        </ElFormItem>
      </section>

      <section class="tool-form-section">
        <div class="mb-4 flex items-center justify-between">
          <h4 class="tool-form-section__title">启动参数</h4>
          <ElButton link type="primary" @click="openFieldDialog('init')">
            <Plus />
            添加
          </ElButton>
        </div>
        <ElTable :data="form.init_field_list" size="small">
          <ElTableColumn label="参数名" prop="field" />
          <ElTableColumn label="类型" width="120">
            <template #default="{ row }">
              <ElTag size="small" type="info">{{ row.input_type }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="必填" width="80">
            <template #default="{ row }">
              <ElSwitch size="small" v-model="row.required" />
            </template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="110">
            <template #default="{ row, $index }">
              <ElButton
                link
                type="primary"
                @click="openFieldDialog('init', row, $index)"
              >
                编辑
              </ElButton>
              <ElButton link type="danger" @click="removeInitField($index)">
                删
              </ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </section>

      <section class="tool-form-section">
        <h4 class="tool-form-section__title mb-4">Skill ZIP 文件</h4>

        <ElFormItem required>
          <div v-if="uploadedFile" class="uploaded-file">
            <ElCard shadow="never">
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <span class="mr-3 text-2xl">📦</span>
                  <div>
                    <p class="font-medium">{{ uploadedFile.name }}</p>
                    <p class="text-sm text-gray-400">
                      {{ formatFileSize(uploadedFile.size) }}
                    </p>
                  </div>
                </div>
                <ElButton link type="primary" @click="uploadedFile = null">
                  重新上传
                </ElButton>
              </div>
            </ElCard>
          </div>

          <ElUpload
            v-else
            drag
            :auto-upload="false"
            accept=".zip"
            :show-file-list="false"
            :on-change="handleFileChange"
            class="w-full"
          >
            <div class="el-upload__text">
              <p class="mb-2 text-lg">📦</p>
              <p>拖拽 Skill ZIP 文件到此处，或<em>点击上传</em></p>
              <p class="mt-2 text-sm text-gray-400">
                仅支持 .zip 文件，最大 100MB
              </p>
            </div>
          </ElUpload>
        </ElFormItem>
      </section>
    </ElForm>

    <template #footer>
      <ElButton @click="closeDrawer" :loading="loading">取消</ElButton>
      <ElButton type="primary" @click="saveTool" :loading="loading">
        {{ editingId ? '保存' : '创建' }}
      </ElButton>
    </template>

    <EditAvatarDialog ref="editAvatarDialogRef" @save="saveAvatar" />

    <ElDialog
      v-model="fieldDialogOpen"
      append-to-body
      title="启动参数"
      width="620px"
    >
      <ElForm :model="fieldForm" label-position="top">
        <ElFormItem label="参数名" required>
          <ElInput v-model="fieldForm.field" placeholder="请输入参数名" />
        </ElFormItem>
        <ElFormItem label="标签">
          <ElInput v-model="fieldForm.label" placeholder="请输入标签" />
        </ElFormItem>
        <ElFormItem label="输入类型">
          <ElSelect v-model="fieldForm.input_type" class="w-full">
            <ElOption label="文本输入" value="TextInput" />
            <ElOption label="下拉选择" value="SingleSelect" />
            <ElOption label="多选" value="MultiSelect" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="必填">
          <ElSwitch v-model="fieldForm.required" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="fieldDialogOpen = false">取消</ElButton>
        <ElButton type="primary" @click="saveField">保存</ElButton>
      </template>
    </ElDialog>
  </ElDrawer>
</template>

<style scoped lang="scss">
.tool-form-drawer__header {
  display: flex;
  align-items: center;
  margin-left: -8px;
}

.tool-form-drawer__back {
  margin-right: 8px;
  font-size: 20px;
}

.tool-form-section {
  margin-bottom: 24px;

  &__title {
    font-size: 16px;
    font-weight: 500;
  }
}

.uploaded-file {
  width: 100%;
}
</style>
