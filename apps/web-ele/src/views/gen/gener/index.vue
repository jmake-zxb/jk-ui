<script lang="ts" setup>
import { defineAsyncComponent, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { ElButton, ElCard, ElMessage, ElStep, ElSteps } from 'element-plus';

import { downBlobFile } from '#/api/core/other';
import { useGeneratorCodeApi } from '#/api/gen/table';

const Generator = defineAsyncComponent(() => import('../table/generator.vue'));
const EditTable = defineAsyncComponent(() => import('../table/edit.vue'));
const PreviewDialog = defineAsyncComponent(
  () => import('../table/preview.vue'),
);
const previewDialogRef = ref();
const generatorRef = ref();

const route = useRoute();
const active = ref(0);
const tableId = ref();
const tableName = ref();
const dsName = ref();
const editTableRef = ref();
const generatorType = ref();

// tab 跳转
const go = async (activeNum: number) => {
  try {
    if (activeNum === 0) {
      await editTableRef.value.submitHandle();
    } else if (activeNum === 1) {
      const dataform = await generatorRef.value.submitHandle();
      tableId.value = dataform.id;
      generatorType.value = dataform.generatorType;
    }
    if (active.value === activeNum) return;
    active.value = activeNum;
  } catch (error) {
    console.error(error);
  }
};

// 预览
const preview = async () => {
  await editTableRef.value.submitHandle();
  previewDialogRef.value.openDialog(tableId.value);
};

// 生成
const generatorHandle = async () => {
  await editTableRef.value.submitHandle();
  // 生成代码，zip压缩包
  if (generatorType.value === '0') {
    downBlobFile(
      `/gen/generator/download?tableIds=${[tableId.value].join(',')}`,
      {},
      `${tableName.value}.zip`,
    );
  }

  // 写入到指定目录
  if (generatorType.value === '1') {
    useGeneratorCodeApi([tableId.value].join(',')).then(() => {
      ElMessage.success($t('common.optSuccessText'));
    });
  }
};

onMounted(() => {
  tableName.value = route.query.tableName;
  dsName.value = route.query.dsName;
});
</script>

<template>
  <Page>
    <ElCard class="layout-padding-auto" shadow="hover">
      <ElSteps :active="active" finish-status="success" simple>
        <ElStep title="基础信息" @click="go(0)" />
        <ElStep title="数据修改" @click="go(1)" />
      </ElSteps>
    </ElCard>
    <div class="h-[15px]"></div>
    <ElCard class="layout-padding-auto mt5" shadow="hover">
      <!-- 生成基本信息设置 -->
      <Generator
        ref="generatorRef"
        :table-name="tableName"
        :ds-name="dsName"
        v-if="active === 0"
      />
      <!-- 字段编辑设置 -->
      <EditTable
        ref="editTableRef"
        :table-name="tableName"
        :ds-name="dsName"
        v-if="active === 1"
      />

      <div style="text-align: center">
        <ElButton style="margin-top: 12px" @click="go(1)" v-if="active === 0">
          下一步
        </ElButton>
        <ElButton style="margin-top: 12px" @click="go(0)" v-if="active === 1">
          上一步
        </ElButton>
        <ElButton style="margin-top: 12px" @click="preview" v-if="active === 1">
          保存并预览
        </ElButton>
        <ElButton
          style="margin-top: 12px"
          @click="generatorHandle"
          v-if="active === 1"
        >
          保存并生成
        </ElButton>
      </div>
    </ElCard>

    <!-- 预览基本信息 -->
    <PreviewDialog ref="previewDialogRef" />
  </Page>
</template>

<style scoped></style>
