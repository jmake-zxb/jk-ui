<script setup lang="ts">
import { ElCard, ElScrollbar, ElText } from 'element-plus';

import { $t } from '#/locales';
import { getFileUrl, getImgUrl } from '#/utils/common';
import { MsgInfo } from '#/utils/message';

defineProps({
  data: {
    type: Object,
    default: () => {},
  },
  content: {
    type: String,
    default: '',
  },
  index: {
    type: Number,
    default: 0,
  },
  score: {
    type: Number,
    default: null,
  },
});
function infoMessage(data: any) {
  if (data?.meta?.allow_download === false) {
    MsgInfo($t('aiChat.noPermissionDownload'));
  } else {
    MsgInfo($t('aiChat.noDocument'));
  }
}
</script>
<template>
  <CardBox
    shadow="never"
    :title="`${index + 1}.${data.title}` || '-'"
    class="paragraph-source-card cursor paragraph-source-card-height mb-2"
    :style="{ height: data?.document_name?.trim() ? '300px' : '260px' }"
    :class="data.is_active ? '' : 'disabled'"
    :show-icon="false"
  >
    <template #tag>
      <div class="color-primary">
        {{ score?.toFixed(3) || data.similarity?.toFixed(3) }}
      </div>
    </template>

    <ElScrollbar height="150">
      <MdPreview
        editor-id="preview-only"
        :model-value="content"
        no-img-zoom-in
      />
    </ElScrollbar>

    <template #footer>
      <slot name="footer">
        <ElCard
          shadow="never"
          style="--el-card-padding: 8px"
          class="mb-3 w-full"
          v-if="data?.document_name?.trim()"
        >
          <ElText class="align-center item flex">
            <img
              :src="getImgUrl(data?.document_name?.trim())"
              alt=""
              width="20"
              class="mr-1"
            />
            <div class="ml-2">
              <div
                class="ml-1"
                v-if="data?.meta?.source_file_id || data?.meta?.source_url"
              >
                <a
                  :href="
                    getFileUrl(data?.meta?.source_file_id) ||
                    data?.meta?.source_url
                  "
                  target="_blank"
                  class="ellipsis-1"
                  :title="data?.document_name?.trim()"
                >
                  <span :title="data?.document_name?.trim()">{{
                    data?.document_name
                  }}</span>
                </a>
              </div>
              <div v-else @click="infoMessage(data)">
                <span
                  class="ellipsis-1 break-all"
                  :title="data?.document_name?.trim()"
                >
                  {{ data?.document_name?.trim() }}
                </span>
              </div>
            </div>
          </ElText>
        </ElCard>
        <div class="align-center flex border-t" style="padding: 12px 0 8px">
          <KnowledgeIcon :type="data?.knowledge_type" :size="18" class="mr-2" />
          <span class="ellipsis-1 break-all" :title="data?.knowledge_name">
            {{ data?.knowledge_name || '-' }}
          </span>
        </div>
      </slot>
    </template>
  </CardBox>
</template>
<style lang="scss" scoped></style>
