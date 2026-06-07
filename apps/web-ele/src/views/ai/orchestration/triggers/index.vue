<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { confirm, Page } from '@vben/common-ui';

import {
  ElButton,
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
} from 'element-plus';

import { listApplications } from '#/api/ai/applications';
import {
  createTrigger,
  deleteTrigger,
  pageTriggerRecords,
  pageTriggers,
  testRunTrigger,
  toggleTrigger,
  updateTrigger,
  webhookTriggerUrl,
} from '#/api/ai/triggers';

import { enabledText, prettyJson, recordsOf, statusType } from '../utils';

const applications = ref<any[]>([]);
const applicationId = ref<number | string>();
const triggers = ref<any[]>([]);
const records = ref<any[]>([]);
const loading = ref(false);
const dialogOpen = ref(false);
const recordsOpen = ref(false);
const editingId = ref<number | string>();
const activeTrigger = ref<any>();
const testInput = ref('{\n  "source": "manual"\n}');
const testResult = ref<any>();
const form = reactive<any>({
  name: '',
  triggerType: 'MANUAL',
  enabled: true,
  configJson: '{\n  "secret": ""\n}',
});
const webhookUrl = computed(() =>
  activeTrigger.value?.id && applicationId.value
    ? webhookTriggerUrl(applicationId.value, activeTrigger.value.id)
    : '',
);

async function loadApplications() {
  applications.value = recordsOf(await listApplications());
  if (!applicationId.value && applications.value.length > 0)
    applicationId.value = applications.value[0].id;
  await loadTriggers();
}

async function loadTriggers() {
  if (!applicationId.value) return;
  loading.value = true;
  try {
    triggers.value = recordsOf(
      await pageTriggers(applicationId.value, {
        current: 1,
        page: 1,
        size: 20,
      }),
    );
  } finally {
    loading.value = false;
  }
}

function openDialog(row?: any) {
  editingId.value = row?.id;
  activeTrigger.value = row;
  Object.assign(form, {
    name: row?.name || '',
    triggerType: row?.triggerType || 'MANUAL',
    enabled: row?.enabled !== false,
    configJson: prettyJson(row?.configJson, '{\n  "secret": ""\n}'),
  });
  testResult.value = undefined;
  dialogOpen.value = true;
}

async function saveTrigger() {
  await (editingId.value
    ? updateTrigger(applicationId.value!, editingId.value, form)
    : createTrigger(applicationId.value!, form));
  ElMessage.success('保存成功');
  dialogOpen.value = false;
  await loadTriggers();
}

async function toggleRow(row: any) {
  await toggleTrigger(applicationId.value!, row.id, !row.enabled);
  await loadTriggers();
}

function removeTrigger(row: any) {
  confirm(`确认删除触发器 ${row.name || row.id}？`).then(async () => {
    await deleteTrigger(applicationId.value!, row.id);
    await loadTriggers();
  });
}

async function runTest(row?: any) {
  const target = row || { id: editingId.value };
  testResult.value = await testRunTrigger(applicationId.value!, target.id, {
    inputJson: testInput.value,
    message: '触发器测试',
  });
}

async function openRecords(row: any) {
  activeTrigger.value = row;
  recordsOpen.value = true;
  records.value = recordsOf(
    await pageTriggerRecords(applicationId.value!, row.id, {
      current: 1,
      page: 1,
      size: 20,
    }),
  );
}

onMounted(loadApplications);
</script>

<template>
  <Page auto-content-height>
    <div class="ops-page">
      <div class="toolbar">
        <ElSelect
          v-model="applicationId"
          filterable
          placeholder="应用"
          @change="loadTriggers"
        >
          <ElOption
            v-for="item in applications"
            :key="item.id"
            :label="item.name || item.id"
            :value="item.id"
          />
        </ElSelect>
        <ElButton type="primary" @click="loadTriggers">刷新</ElButton>
        <ElButton type="primary" @click="openDialog()">新增触发器</ElButton>
      </div>
      <ElTable v-loading="loading" :data="triggers" height="100%" size="small">
        <ElTableColumn prop="name" label="触发器" min-width="160" />
        <ElTableColumn prop="triggerType" label="类型" width="120" />
        <ElTableColumn label="Webhook" min-width="260">
          <template #default="{ row }">
            <span class="mono-line">{{
              webhookTriggerUrl(applicationId || '', row.id)
            }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="90">
          <template #default="{ row }">
            <ElTag size="small">
              {{ enabledText(row.enabled) }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="300">
          <template #default="{ row }">
            <ElButton link type="primary" @click="openDialog(row)">
              编辑
            </ElButton>
            <ElButton link @click="toggleRow(row)">切换</ElButton>
            <ElButton link @click="runTest(row)">测试</ElButton>
            <ElButton link @click="openRecords(row)">记录</ElButton>
            <ElButton link type="danger" @click="removeTrigger(row)">
              删除
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <ElDialog v-model="dialogOpen" title="触发器配置" width="680px">
        <ElForm label-width="90px" :model="form">
          <ElFormItem label="名称">
            <ElInput v-model="form.name" />
          </ElFormItem>
          <ElFormItem label="类型">
            <ElSelect v-model="form.triggerType">
              <ElOption label="MANUAL" value="MANUAL" />
              <ElOption label="WEBHOOK" value="WEBHOOK" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="启用">
            <ElSwitch v-model="form.enabled" />
          </ElFormItem>
          <ElFormItem label="配置 JSON">
            <ElInput v-model="form.configJson" type="textarea" :rows="6" />
          </ElFormItem>
          <ElFormItem label="测试输入">
            <ElInput v-model="testInput" type="textarea" :rows="4" />
          </ElFormItem>
          <ElFormItem label="Webhook">
            <ElInput :model-value="webhookUrl" readonly />
          </ElFormItem>
          <pre class="result-box">{{
            prettyJson(testResult, '暂无测试结果')
          }}</pre>
        </ElForm>
        <template #footer>
          <ElButton @click="runTest()">测试运行</ElButton>
          <ElButton @click="dialogOpen = false">取消</ElButton>
          <ElButton type="primary" @click="saveTrigger">保存</ElButton>
        </template>
      </ElDialog>

      <ElDrawer
        v-model="recordsOpen"
        :title="`${activeTrigger?.name || ''} 运行记录`"
        size="700px"
      >
        <ElTable :data="records" size="small">
          <ElTableColumn prop="source" label="来源" width="100" />
          <ElTableColumn prop="status" label="状态" width="100">
            <template #default="{ row }">
              <ElTag :type="statusType(row.status)" size="small">
                {{ row.status }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="runTime" label="耗时" width="90" />
          <ElTableColumn prop="inputJson" label="输入" />
          <ElTableColumn prop="outputJson" label="输出" />
        </ElTable>
      </ElDrawer>
    </div>
  </Page>
</template>

<style scoped lang="scss">
.ops-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  overflow: hidden;
}

.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.toolbar .el-select {
  width: 260px;
}

.mono-line {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: nowrap;
}

.result-box {
  max-height: 180px;
  padding: 8px;
  overflow: auto;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
</style>
