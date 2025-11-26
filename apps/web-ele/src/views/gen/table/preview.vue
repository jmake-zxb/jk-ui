<script setup lang="ts" name="preview">
import { defineAsyncComponent, reactive, ref } from 'vue';

import { VbenIcon } from '@vben/common-ui';

import {
  ElDialog,
  ElScrollbar,
  ElSplitter,
  ElSplitterPanel,
  ElTabPane,
  ElTabs,
  ElTree,
} from 'element-plus';

import { useGeneratorPreviewApi } from '#/api/gen/table';
import { handleTree } from '#/utils/other';

const CodeEditor = defineAsyncComponent(
  () => import('#/component/CodeEditor/index.vue'),
);

const visible = ref(false);
// ======== 显示页面 ========
const preview = reactive({
  open: false,
  titel: '代码预览',
  fileTree: [],
  activeName: '',
});

const previewCodegen: Record<string, any> = ref([]);
const previewCodeStr = ref('');
const fileTreeOriginal = ref([] as any[]);

const openDialog = async (id: string) => {
  await getGenCodeFile(id);
  visible.value = true;
};

const loading = ref(false);
const codeEditorRef = ref();
const treeRef = ref<InstanceType<typeof ElTree> | null>(null);

/**
 * 获取特定资源的代码生成文件，显示在页面上。
 * @param id 需要渲染的资源 ID。
 */
const getGenCodeFile = (id: string) => {
  loading.value = true;
  fileTreeOriginal.value = [];
  useGeneratorPreviewApi(id)
    .then((res: any) => {
      previewCodegen.value = res;
      for (const index in res) {
        fileTreeOriginal.value.push(res[index].codePath);
      }
      // 默认选中第一个 选项卡
      previewCodeStr.value = res[0].code;
      preview.activeName = res[0].codePath;
      const files = handleFiles(fileTreeOriginal);
      preview.fileTree = handleTree(files, 'id', 'parentId', 'children', '/');
    })
    .finally(() => {
      loading.value = false;
    });
};

const handleNodeClick = async (data: any, node: any) => {
  if (node && !node.isLeaf) {
    return false;
  }

  preview.activeName = data.id;

  const filteredCode = previewCodegen.value.filter(
    (code: any) => code.codePath === data.id,
  );
  if (filteredCode.length > 0) {
    previewCodeStr.value = filteredCode[0].code;
  }
};

const handleTabClick = (item: any) => {
  const filteredCode = previewCodegen.value.filter(
    (code: any) => code.codePath === item.paneName,
  );
  if (filteredCode.length > 0) {
    previewCodeStr.value = filteredCode[0].code;
  }
};

/**
 * 生成 files 目录
 * @param fileTreeOriginal
 */
const handleFiles = (fileTreeOriginal: any) => {
  const exists: Record<string, any> = {};
  const files = [] as any[];

  // 遍历每个元素
  for (const data of fileTreeOriginal.value) {
    let paths = [];
    paths = data.includes('\\') ? data.split('\\') : data.split('/');
    let fullPath = ''; // 从头开始的路径，用于生成 id
    // 遍历每个 path， 拼接成树
    for (const path of paths) {
      // 已经添加到 files 中，则跳过
      const oldFullPath = fullPath;
      // 下面的 replaceAll 的原因，是因为上面包处理了，导致和 tabs 不匹配，所以 replaceAll 下
      fullPath =
        fullPath.length === 0
          ? path
          : `${fullPath.replaceAll('.', '/')}/${path}`;
      if (exists[fullPath]) {
        continue;
      }
      // 添加到 files 中
      exists[fullPath] = true;
      files.push({
        id: fullPath,
        label: path,
        parentId: oldFullPath || '/',
        templateName: data.k,
      });
    }
  }
  return files;
};

defineExpose({
  openDialog,
});
</script>
<template>
  <ElDialog
    fullscreen
    title="代码预览"
    v-model="visible"
    width="90%"
    top="3vh"
    append-to-body
    :close-on-click-modal="false"
  >
    <ElSplitter>
      <ElSplitterPanel size="300px">
        <ElScrollbar height="calc(100vh - 100px)" class="mt20">
          <ElTree
            ref="treeRef"
            node-key="id"
            :data="preview.fileTree"
            :expand-on-click-node="false"
            highlight-current
            @node-click="handleNodeClick"
          />
        </ElScrollbar>
      </ElSplitterPanel>
      <ElSplitterPanel>
        <ElTabs v-model="preview.activeName" @tab-click="handleTabClick">
          <ElTabPane
            v-for="item in previewCodegen"
            :label="item.codePath.substring(item.codePath.lastIndexOf('/') + 1)"
            :name="item.codePath"
            :key="item.codePath"
          >
            <VbenIcon
              icon="ant-design:copy-outlined"
              :size="25"
              class="copy-btn"
            />
          </ElTabPane>
          <CodeEditor
            ref="codeEditorRef"
            theme="darcula"
            v-model="previewCodeStr"
            mode="java"
            read-only
            height="calc(100vh - 100px)"
          />
        </ElTabs>
      </ElSplitterPanel>
    </ElSplitter>
  </ElDialog>
</template>

<style scoped lang="css">
.copy-btn {
  position: absolute;
  top: 10px;
  right: 20px;
  z-index: 9;
  color: white;
}
</style>
