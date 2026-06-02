<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { computed, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';

import { confirm, Page } from '@vben/common-ui';

import { Search } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElDialog,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus';

import { addObj as addAnalysis } from '#/api/ai/analysis';
import { fetchList as auditRulesFetchList } from '#/api/ai/auditRules';
import { fetchList } from '#/api/ai/reviewNode';

interface RuleGroup {
  categoryId: string;
  categoryName: string;
  ruleTotal: 0;
  rules: any[];
}

const route = useRoute();

// --- 状态管理 ---
const activeTab = ref<string>();
const searchKeyword = ref<string>('');
const selectedIds = ref<string[]>([]);
const saving = ref<boolean>(false);
const analysisFormVisible = ref(false);
const projectId = ref();

// --- 模拟数据 (实际应从 API 获取) ---
const allRulesData = reactive<RuleGroup[]>([]);

const ruleFormRef = ref<FormInstance>();
const form = reactive({
  analysisName: null,
});

const rules = reactive({
  analysisName: [
    { required: true, message: '请输入报告名称', trigger: 'blur' },
  ],
});

const getAllRuleGroup = () => {
  fetchList({ pid: '0', ruleTotal: 1 }).then((res) => {
    const records = res.records;
    records.forEach(async (item: any) => {
      allRulesData.push({
        categoryId: item.id,
        categoryName: item.rwName,
        ruleTotal: item.ruleTotal,
        rules: await getAuditRulesList(item.id),
      });
    });
    if (records.length > 0) {
      activeTab.value = records[0].id;
    }
  });
};

getAllRuleGroup();

const getAuditRulesList = async (groupId: string) => {
  const res = await auditRulesFetchList({ groupId, size: 50 });
  return res.records;
};

// --- 计算属性：搜索过滤 ---
const filteredGroups = computed<RuleGroup[]>(() => {
  if (!searchKeyword.value) return allRulesData;

  const keyword = searchKeyword.value.toLowerCase();
  return allRulesData
    .map((group) => ({
      ...group,
      rules: group.rules.filter(
        (rule) =>
          rule.name.toLowerCase().includes(keyword) ||
          rule.description.toLowerCase().includes(keyword),
      ),
    }))
    .filter((group) => group.rules.length > 0);
});

const selectAllCurrent = () => {
  const currentGroup = filteredGroups.value.find(
    (g) => g.categoryId === activeTab.value,
  );
  if (!currentGroup) return;
  const selectedSet = new Set(selectedIds.value);
  currentGroup.rules.forEach((rule) => selectedSet.add(rule.id));
  selectedIds.value = [...selectedSet];
};

const deselectAllCurrent = () => {
  const currentGroup = filteredGroups.value.find(
    (g) => g.categoryId === activeTab.value,
  );
  if (!currentGroup) return;
  const currentIds = new Set(currentGroup.rules.map((r) => r.id));
  selectedIds.value = selectedIds.value.filter((id) => !currentIds.has(id));
};

const resetSelection = () => {
  confirm('确定要清空所有已选规则吗？').then(async () => {
    selectedIds.value = [];
  });
};

const handleSave = () => {
  analysisFormVisible.value = true;
};

const submitForm = async () => {
  const formEl = ruleFormRef.value;
  if (!formEl) return;
  try {
    await formEl.validate();
    saving.value = true;
    await addAnalysis({
      analysisName: form.analysisName,
      projectId: route.query.id,
      analysisConfigIds: selectedIds.value,
    });
    ElMessage.success('保存成功！');
    analysisFormVisible.value = false;
  } catch (error) {
    console.error('校验未通过或请求失败:', error);
    ElMessage.error('保存失败，请检查表单或重试');
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <Page auto-content-height>
    <div
      class="bg-content dark:bg-content-dark flex h-full flex-col transition-colors duration-300"
    >
      <div
        class="dark:bg-card-dark dark:border-border-dark mb-4 flex flex-wrap items-center justify-between gap-4 rounded border border-border bg-card p-4 shadow-sm"
      >
        <div class="w-64">
          <ElInput
            v-model="searchKeyword"
            placeholder="搜索规则名称或描述..."
            :prefix-icon="Search"
            clearable
          />
        </div>

        <div class="flex items-center gap-2">
          <ElButton @click="selectAllCurrent">全选当前</ElButton>
          <ElButton @click="deselectAllCurrent">取消全选</ElButton>
          <ElTag effect="plain"> 已选择 {{ selectedIds.length }} 项 </ElTag>
        </div>
      </div>

      <div
        class="dark:bg-card-dark dark:border-border-dark flex flex-1 flex-col overflow-hidden rounded border border-border bg-card p-4 shadow-sm"
      >
        <ElTabs
          v-model="activeTab"
          class="flex flex-1 flex-col overflow-y-auto"
        >
          <ElTabPane
            v-for="group in filteredGroups"
            :key="group.categoryId"
            :label="`${group.categoryName} (${group.ruleTotal})`"
            :name="group.categoryId"
            class="flex-1 p-2"
          >
            <div class="h-full overflow-y-auto overflow-x-hidden">
              <ElCheckboxGroup
                v-model="selectedIds"
                class="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5"
              >
                <div v-for="rule in group.rules" :key="rule.id">
                  <ElCheckbox
                    :value="rule.id"
                    border
                    class="rule-checkbox-item w-full !rounded-lg transition-all duration-200"
                  >
                    <div class="rule-content-wrapper">
                      <div class="rule-title">
                        {{ rule.ruleName }}
                      </div>
                      <div class="rule-description">
                        {{ rule.policyReference }}
                      </div>
                    </div>
                  </ElCheckbox>
                </div>
              </ElCheckboxGroup>

              <ElEmpty
                v-if="group.rules.length === 0"
                description="该分类下无匹配规则"
                :image-size="80"
              />
            </div>
          </ElTabPane>
        </ElTabs>
      </div>

      <transition name="slide-up">
        <div
          v-if="selectedIds.length > 0"
          class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div
            class="bg-bg-emphasized/90 dark:bg-bg-emphasized-dark/90 text-text-primary dark:text-text-primary-dark dark:border-border-dark flex items-center gap-6 rounded-full border border-border px-6 py-3 shadow-lg backdrop-blur-md"
          >
            <div class="text-sm font-medium">
              当前已选择
              <span
                class="dark:text-primary-dark mx-1 text-lg font-bold text-primary"
                >{{ selectedIds.length }}</span
              >条规则
            </div>
            <div
              class="dark:border-border-dark flex items-center gap-2 border-l border-border pl-4"
            >
              <ElButton size="small" @click="resetSelection">重置</ElButton>
              <ElButton
                type="primary"
                size="small"
                :loading="saving"
                @click="handleSave"
              >
                保存配置
              </ElButton>
            </div>
          </div>
        </div>
      </transition>
    </div>
    <ElDialog
      v-model="analysisFormVisible"
      title="编辑"
      width="450px"
      :show-close="false"
    >
      <ElForm :model="form" :rules="rules" ref="ruleFormRef">
        <ElFormItem label="报告名称" prop="analysisName">
          <ElInput v-model="form.analysisName" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <div class="dialog-footer">
          <ElButton @click="analysisFormVisible = false" :loading="saving">
            取消
          </ElButton>
          <ElButton type="primary" @click="submitForm" :loading="saving">
            保存并生成报告
          </ElButton>
        </div>
      </template>
    </ElDialog>
  </Page>
</template>

<style scoped>
:deep(.rule-checkbox-item.el-checkbox.is-bordered) {
  padding: 10px !important;
  border-radius: 0.5rem !important;
  transition: all 0.2s ease !important;
  min-height: 70px !important;
  display: flex !important;
  align-items: flex-start !important;
}

/* 内容包装器 - 增加间距 */
:deep(.rule-content-wrapper) {
  display: flex !important;
  flex-direction: column !important;
  gap: 0.75rem !important;
  width: 100% !important;
  line-height: 1.6 !important;
}

/* 标题样式 */
:deep(.rule-title) {
  font-weight: 600 !important;
  font-size: 0.95rem !important;
  color: var(--foreground);
  line-height: 1.4 !important;
  word-break: break-word !important;
  display: -webkit-box !important;
  -webkit-line-clamp: 3 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

/* 描述样式 */
:deep(.rule-description) {
  font-size: 0.825rem !important;
  opacity: 0.7;
  line-height: 1.6 !important;
  display: -webkit-box !important;
  -webkit-line-clamp: 3 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

/* Hover 效果 - 浅色模式 */
:deep(.rule-checkbox-item.el-checkbox.is-bordered:hover) {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
  border-color: var(--el-color-primary, #3b82f6) !important;
  transform: translateY(-2px) !important;
  background-color: var(--primary-foreground, #f9fafb) !important;
}

/* Checkbox 图标位置调整 */
:deep(.rule-checkbox-item .el-checkbox__input) {
  top: 1.25rem !important;
  left: 1rem !important;
}

:deep(.rule-checkbox-item .el-checkbox__label) {
  padding-left: 2rem !important;
  width: 100% !important;
}

/* 确保 Element Plus 的 Checkbox 边框在深色模式下可见 */
:deep(.el-checkbox.is-bordered) {
  @apply dark:border-gray-700 dark:bg-gray-800/50;
}

:deep(.el-tabs__content) {
  @apply h-full flex-1 overflow-y-auto overflow-x-hidden;
}

:deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: var(--input);
}

/* 动画效果 */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}
</style>
