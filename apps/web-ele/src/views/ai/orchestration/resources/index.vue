<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
} from 'element-plus';

import {
  createResourceFolder,
  deleteResourceFolder,
  listResourceAuth,
  listResourceFolders,
  listResourceMappings,
  pageResourceFolders,
  saveResourceAuth,
  saveResourceMapping,
  updateResourceFolder,
} from '#/api/ai/resources';

import { prettyJson, recordsOf } from '../utils';

const loading = ref(false);
const activeTab = ref('folders');
const folders = ref<any[]>([]);
const mappings = ref<any[]>([]);
const authList = ref<any[]>([]);
const folderForm = reactive<any>({
  id: '',
  name: '',
  source: 'default',
  type: 'APPLICATION',
  targetFolderId: undefined,
});
const mappingForm = reactive<any>({
  id: '',
  source: 'default',
  type: 'APPLICATION',
  targetFolderId: undefined,
});
const authForm = reactive<any>({
  id: '',
  source: 'default',
  type: 'APPLICATION',
  name: 'USER',
  applicationId: '',
  configJson: '{\n  "read": true,\n  "write": false\n}',
});

async function loadFolders() {
  loading.value = true;
  try {
    folders.value = recordsOf(
      await pageResourceFolders({
        current: 1,
        page: 1,
        size: 50,
        resourceType: folderForm.type,
        workspaceId: folderForm.source,
      }),
    );
  } finally {
    loading.value = false;
  }
}

async function saveFolder() {
  await (folderForm.id
    ? updateResourceFolder(folderForm.id, folderForm)
    : createResourceFolder(folderForm));
  ElMessage.success('文件夹已保存');
  folderForm.id = '';
  await loadFolders();
}

function editFolder(row: any) {
  Object.assign(folderForm, {
    id: row.id,
    name: row.name,
    source: row.workspaceId || 'default',
    type: row.resourceType || 'APPLICATION',
    targetFolderId: row.parentId,
  });
}

async function removeFolder(row: any) {
  await deleteResourceFolder(row.id);
  await loadFolders();
}

async function loadMappings() {
  mappings.value = recordsOf(
    await listResourceMappings({
      resourceType: mappingForm.type,
      folderId: mappingForm.targetFolderId,
      workspaceId: mappingForm.source,
    }),
  );
}

async function saveMapping() {
  await saveResourceMapping(mappingForm);
  ElMessage.success('映射已保存');
  await loadMappings();
}

async function loadAuth() {
  if (!authForm.id) return;
  authList.value = recordsOf(
    await listResourceAuth({
      resourceType: authForm.type,
      resourceId: authForm.id,
      workspaceId: authForm.source,
    }),
  );
}

async function saveAuth() {
  await saveResourceAuth(authForm);
  ElMessage.success('授权已保存');
  await loadAuth();
}

async function refreshFolderOptions() {
  folders.value = recordsOf(
    await listResourceFolders({
      resourceType: folderForm.type,
      workspaceId: folderForm.source,
    }),
  );
}

onMounted(loadFolders);
</script>

<template>
  <Page auto-content-height>
    <div class="resource-page" v-loading="loading">
      <ElTabs v-model="activeTab" class="fill-tabs">
        <ElTabPane label="文件夹" name="folders">
          <div class="two-col">
            <section class="panel">
              <div class="panel-title">文件夹表单</div>
              <ElForm label-width="90px" :model="folderForm">
                <ElFormItem label="工作空间">
                  <ElInput v-model="folderForm.source" />
                </ElFormItem>
                <ElFormItem label="资源类型">
                  <ElSelect
                    v-model="folderForm.type"
                    @change="refreshFolderOptions"
                  >
                    <ElOption label="应用" value="APPLICATION" />
                    <ElOption label="知识库" value="KNOWLEDGE" />
                    <ElOption label="工具" value="TOOL" />
                  </ElSelect>
                </ElFormItem>
                <ElFormItem label="父级">
                  <ElSelect v-model="folderForm.targetFolderId" clearable>
                    <ElOption
                      v-for="item in folders"
                      :key="item.id"
                      :label="item.name"
                      :value="item.id"
                    />
                  </ElSelect>
                </ElFormItem>
                <ElFormItem label="名称">
                  <ElInput v-model="folderForm.name" />
                </ElFormItem>
                <ElButton type="primary" @click="saveFolder">保存</ElButton>
                <ElButton @click="loadFolders">刷新</ElButton>
              </ElForm>
            </section>
            <section class="panel">
              <div class="panel-title">文件夹列表</div>
              <ElTable :data="folders" height="100%" size="small">
                <ElTableColumn prop="name" label="名称" />
                <ElTableColumn prop="resourceType" label="类型" width="110" />
                <ElTableColumn prop="workspaceId" label="空间" width="110" />
                <ElTableColumn label="操作" width="120">
                  <template #default="{ row }">
                    <ElButton link @click="editFolder(row)">编辑</ElButton>
                    <ElButton link type="danger" @click="removeFolder(row)">
                      删
                    </ElButton>
                  </template>
                </ElTableColumn>
              </ElTable>
            </section>
          </div>
        </ElTabPane>
        <ElTabPane label="资源映射" name="mappings">
          <div class="two-col">
            <section class="panel">
              <div class="panel-title">映射资源到文件夹</div>
              <ElForm label-width="90px" :model="mappingForm">
                <ElFormItem label="资源 ID">
                  <ElInput v-model="mappingForm.id" />
                </ElFormItem>
                <ElFormItem label="资源类型">
                  <ElSelect v-model="mappingForm.type">
                    <ElOption label="应用" value="APPLICATION" />
                    <ElOption label="知识库" value="KNOWLEDGE" />
                    <ElOption label="工具" value="TOOL" />
                  </ElSelect>
                </ElFormItem>
                <ElFormItem label="文件夹 ID">
                  <ElInput v-model="mappingForm.targetFolderId" />
                </ElFormItem>
                <ElFormItem label="工作空间">
                  <ElInput v-model="mappingForm.source" />
                </ElFormItem>
                <ElButton type="primary" @click="saveMapping">
                  保存映射
                </ElButton>
                <ElButton @click="loadMappings">查询</ElButton>
              </ElForm>
            </section>
            <section class="panel">
              <div class="panel-title">映射结果</div>
              <ElTable :data="mappings" height="100%" size="small">
                <ElTableColumn prop="resourceId" label="资源" />
                <ElTableColumn prop="resourceType" label="类型" />
                <ElTableColumn prop="folderId" label="文件夹" />
              </ElTable>
            </section>
          </div>
        </ElTabPane>
        <ElTabPane label="授权" name="auth">
          <div class="two-col">
            <section class="panel">
              <div class="panel-title">资源授权</div>
              <ElForm label-width="90px" :model="authForm">
                <ElFormItem label="资源 ID">
                  <ElInput v-model="authForm.id" />
                </ElFormItem>
                <ElFormItem label="资源类型">
                  <ElSelect v-model="authForm.type">
                    <ElOption label="应用" value="APPLICATION" />
                    <ElOption label="知识库" value="KNOWLEDGE" />
                    <ElOption label="工具" value="TOOL" />
                  </ElSelect>
                </ElFormItem>
                <ElFormItem label="主体类型">
                  <ElSelect v-model="authForm.name">
                    <ElOption label="用户" value="USER" />
                    <ElOption label="角色" value="ROLE" />
                  </ElSelect>
                </ElFormItem>
                <ElFormItem label="主体 ID">
                  <ElInput v-model="authForm.applicationId" />
                </ElFormItem>
                <ElFormItem label="权限 JSON">
                  <ElInput
                    v-model="authForm.configJson"
                    type="textarea"
                    :rows="6"
                  />
                </ElFormItem>
                <ElButton type="primary" @click="saveAuth">保存授权</ElButton>
                <ElButton @click="loadAuth">查询</ElButton>
              </ElForm>
            </section>
            <section class="panel">
              <div class="panel-title">授权列表</div>
              <ElTable :data="authList" height="100%" size="small">
                <ElTableColumn prop="principalType" label="主体" width="100" />
                <ElTableColumn prop="principalId" label="主体 ID" width="120" />
                <ElTableColumn prop="permissionJson" label="权限">
                  <template #default="{ row }">
                    <span class="mono-line">{{
                      prettyJson(row.permissionJson, '-')
                    }}</span>
                  </template>
                </ElTableColumn>
              </ElTable>
            </section>
          </div>
        </ElTabPane>
      </ElTabs>
    </div>
  </Page>
</template>

<style scoped lang="scss">
.resource-page {
  height: 100%;
  overflow: hidden;
}

.fill-tabs,
.fill-tabs :deep(.el-tabs__content),
.fill-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.two-col {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 12px;
  height: 100%;
}

.panel {
  padding: 12px;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.panel-title {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
}

.mono-line {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: nowrap;
}
</style>
