<script setup lang="ts">
import type { Component } from 'vue';

import type { PublicChatMode, PublicChatProfile } from './types';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { getTokenApplicationProfile } from '#/api/ai/public';

import EmbedTemplate from './embed/index.vue';
import MobileTemplate from './mobile/index.vue';
import NoServiceTemplate from './no-service/index.vue';
import PcTemplate from './pc/index.vue';
import {
  buildPublicInputJson,
  getRouteMode,
  getRouteToken,
  normalizePublicChatProfile,
  resolvePublicChatMode,
} from './utils';

const route = useRoute();

const templates: Record<PublicChatMode, Component> = {
  embed: EmbedTemplate,
  mobile: MobileTemplate,
  'no-service': NoServiceTemplate,
  pc: PcTemplate,
};

const loading = ref(false);
const profile = ref<null | PublicChatProfile>(null);
const isMobileViewport = ref(false);

const publicToken = computed(() => getRouteToken(route));
const publicInputJson = computed(() => buildPublicInputJson(route.query));
const applicationAvailable = computed(() => Boolean(profile.value));

const currentMode = computed<PublicChatMode>(() => {
  return resolvePublicChatMode(
    Boolean(profile.value),
    getRouteMode(route.query),
    isMobileViewport.value,
  );
});

const currentTemplate = computed(() => templates[currentMode.value]);

function updateViewport() {
  isMobileViewport.value = window.innerWidth <= 768;
}

async function loadTokenProfile() {
  const token = publicToken.value;
  if (!token) {
    profile.value = null;
    return;
  }

  loading.value = true;
  try {
    const data = await getTokenApplicationProfile(token);
    profile.value = normalizePublicChatProfile(data);
  } catch {
    profile.value = null;
  } finally {
    loading.value = false;
  }
}

watch(publicToken, () => {
  void loadTokenProfile();
});

onMounted(() => {
  updateViewport();
  window.addEventListener('resize', updateViewport);
  void loadTokenProfile();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport);
});
</script>

<template>
  <div v-loading="loading" class="public-chat-shell">
    <component
      :is="currentTemplate"
      :key="route.fullPath"
      :application_profile="profile"
      :application-available="applicationAvailable"
      :public-input-json="publicInputJson"
      :public-token="publicToken"
    />
  </div>
</template>

<style scoped lang="scss">
.public-chat-shell {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-page);
}
</style>
