<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

import { Back } from '@element-plus/icons-vue';
import {
  ElAvatar,
  ElButton,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
} from 'element-plus';

import {
  createTool,
  getTool,
  testToolConnection,
  updateTool,
} from '#/api/ai/tools';

import EditAvatarDialog from './EditAvatarDialog.vue';
import { buildToolPayload } from './tool-form-utils';

type Id = number | string;

interface ToolRecord {
  id?: Id;
  name?: string;
  description?: string;
  desc?: string;
  icon?: string;
  code?: string;
  enabled?: boolean;
  isActive?: boolean;
  is_active?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  folderId: undefined,
  workspaceId: 'default',
});

const emit = defineEmits<{
  refresh: [];
}>();

function stringValue(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function idValue(value: unknown): Id | undefined {
  if (value === null || value === undefined) return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? String(value) : num;
}

interface Props {
  folderId?: number | string;
  workspaceId?: string;
}

const editAvatarDialogRef = ref<InstanceType<typeof EditAvatarDialog>>();
const visible = ref(false);
const loading = ref(false);
const editingId = ref<number | string>();

const form = reactive({
  name: '',
  description: '',
  icon: '',
  code: '',
  tool_type: 'MCP' as const,
  enabled: false,
  folder_id: props.folderId,
  workspace_id: props.workspaceId,
});

const mcpJsonExample = `{
  "math": {
    "url": "your_server_url",
    "transport": "sse"
  }
}`;

const drawerTitle = computed(() =>
  editingId.value ? '编辑 MCP 工具' : '创建 MCP 工具',
);

function resetForm() {
  form.name = '';
  form.description = '';
  form.icon = '';
  form.code = '';
  form.enabled = false;
  editingId.value = undefined;
}

function openEditAvatar() {
  editAvatarDialogRef.value?.open(form.icon);
}

function saveAvatar(icon: string) {
  form.icon = icon;
}

async function testConnection() {
  if (!form.code.trim()) {
    ElMessage.warning('请输入 MCP Server Config JSON');
    return;
  }
  try {
    const parsed = JSON.parse(form.code);
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      ElMessage.warning('MCP Server 必须是 JSON 对象');
      return;
    }
  } catch {
    ElMessage.warning('MCP Server Config JSON 格式错误');
    return;
  }

  loading.value = true;
  try {
    await testToolConnection({ code: form.code, mcp_servers: form.code });
    ElMessage.success('MCP 连接成功');
  } catch (error: any) {
    ElMessage.error(error?.message || 'MCP 连接失败');
  } finally {
    loading.value = false;
  }
}

async function saveTool() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入工具名称');
    return;
  }
  if (!form.code.trim()) {
    ElMessage.warning('请输入 MCP Server Config JSON');
    return;
  }

  loading.value = true;
  try {
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

async function open(row?: ToolRecord) {
  resetForm();
  loading.value = true;

  try {
    if (row?.id) {
      editingId.value = idValue(row.id);
      const detail = await getTool(row.id);
      form.name = stringValue(detail.name || row.name);
      form.description = stringValue(
        detail.description || detail.desc || row.description || row.desc,
      );
      form.icon = stringValue(detail.icon || row.icon);
      form.code = stringValue(detail.code || row.code);
      form.enabled = !!(
        detail.enabled ??
        detail.isActive ??
        detail.is_active ??
        row.enabled ??
        row.isActive ??
        row.is_active
      );
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
              <span class="text-lg">MCP</span>
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
              placeholder="请输入 MCP 工具名称"
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
        <h4 class="tool-form-section__title mb-4">MCP Server Config JSON</h4>
        <ElFormItem required>
          <template #label>
            <span>配置 JSON</span>
            <span class="ml-2 text-gray-400">（示例见占位符）</span>
          </template>
          <ElInput
            v-model="form.code"
            type="textarea"
            :placeholder="mcpJsonExample"
            :rows="8"
          />
        </ElFormItem>
      </section>
    </ElForm>

    <template #footer>
      <ElButton @click="testConnection" :loading="loading">测试连接</ElButton>
      <ElButton @click="closeDrawer" :loading="loading">取消</ElButton>
      <ElButton type="primary" @click="saveTool" :loading="loading">
        {{ editingId ? '保存' : '创建' }}
      </ElButton>
    </template>

    <EditAvatarDialog ref="editAvatarDialogRef" @save="saveAvatar" />
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
</style>
