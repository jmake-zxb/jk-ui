<script setup lang="ts">
import type { PropType } from 'vue';

import { computed, ref } from 'vue';

import {
  CaretRight,
  CircleCheck,
  CircleClose,
  Loading,
} from '@element-plus/icons-vue';
import {
  ElCard,
  ElCollapseTransition,
  ElIcon,
  ElImage,
  ElRadioButton,
  ElRadioGroup,
  ElScrollbar,
  ElSpace,
  ElTabPane,
  ElTabs,
} from 'element-plus';

import ParagraphCard from '#/components/ai-chat/component/knowledge-source-component/ParagraphCard.vue';
import DynamicsForm from '#/components/dynamics-form/index.vue';
import MdRenderer from '#/components/markdown/MdRenderer.vue';
import { WorkflowType } from '#/enums/application';
import { arraySort } from '#/utils/array';
import { getImgUrl } from '#/utils/file-util';
import { nodeTypeIcon } from '#/views/ai/orchestration/workflow/designer/common/node-type-icons';

defineOptions({ name: 'ExecutionDetailCard' });

const props = defineProps({
  data: {
    type: Object as PropType<any>,
    default: null,
  },
  type: {
    type: String as PropType<'application' | 'knowledge'>,
    default: 'application',
  },
});
const isKnowLedge = computed(() => props.type === 'knowledge');
const currentLoopNode = ref(0);
const currentParagraph = ref(0);
const currentWriteContent = ref(0);

const tokenVisibleNodeTypes = new Set<string>([
  WorkflowType.AiChat,
  WorkflowType.Application,
  WorkflowType.ImageGenerateNode,
  WorkflowType.ImageUnderstandNode,
  WorkflowType.IntentNode,
  WorkflowType.Question,
  WorkflowType.VideoUnderstandNode,
]);

function toFiniteNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

const nodeIconComponent = computed(() => nodeTypeIcon(props.data?.type));
const showTokenUsage = computed(() =>
  tokenVisibleNodeTypes.has(`${props.data?.type ?? ''}`),
);
const totalTokenNumber = computed(
  () =>
    toFiniteNumber(props.data?.message_tokens) +
    toFiniteNumber(props.data?.answer_tokens),
);
const runtimeNumber = computed(() => toFiniteNumber(props.data?.run_time));
const runtimeText = computed(() => runtimeNumber.value.toFixed(2));

function toggleShow() {
  const target = props.data;
  target.show = !target.show;
}

const formData = computed({
  get: () => props.data?.form_data,
  set: (val) => {
    const target = props.data;
    target.form_data = val;
  },
});
</script>
<template>
  <ElCard
    class="g-mb-8 execution-detail-card"
    shadow="never"
    style="--el-card-padding: 12px 16px"
  >
    <div
      class="flex-between cursor execution-detail-card__header"
      @click="toggleShow"
    >
      <div class="align-center execution-detail-card__title flex">
        <ElIcon class="g-mr-8 arrow-icon" :class="data.show ? 'rotate-90' : ''">
          <CaretRight />
        </ElIcon>
        <ElIcon class="g-mr-8 node-type-icon" :size="24">
          <component :is="nodeIconComponent" />
        </ElIcon>
        <h4 class="execution-detail-card__title-text">{{ data.name }}</h4>
      </div>
      <div class="align-center execution-detail-card__metrics flex">
        <span class="g-mr-16 color-secondary" v-if="showTokenUsage">
          {{ totalTokenNumber }} tokens
        </span>
        <span class="g-mr-16 color-secondary" v-if="data.status !== 202"
          >{{ runtimeText }} s</span
        >
        <ElIcon class="color-success" :size="16" v-if="data.status === 200">
          <CircleCheck />
        </ElIcon>
        <ElIcon class="is-loading" :size="16" v-else-if="data.status === 202">
          <Loading />
        </ElIcon>
        <ElIcon class="color-danger" :size="16" v-else>
          <CircleClose />
        </ElIcon>
      </div>
    </div>
    <ElCollapseTransition>
      <div class="g-mt-12" v-if="data.show">
        <template
          v-if="data.status === 200 || data.type === WorkflowType.LoopNode"
        >
          <!-- 开始 -->
          <template
            v-if="
              data.type === WorkflowType.Start ||
              data.type === WorkflowType.Application
            "
          >
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">输入参数</h5>

              <div class="g-p-8-12 border-t-dashed lighter">
                <div class="g-mb-8">
                  <span class="color-secondary"> 问题:</span>
                  {{ data.question || '-' }}
                </div>

                <div
                  v-for="(f, i) in data.global_fields"
                  :key="i"
                  class="g-mb-8"
                >
                  <span class="color-secondary">{{ f.label }}:</span>
                  {{ f.value }}
                </div>
                <div v-if="data.document_list?.length > 0">
                  <p class="g-mb-8 color-secondary">文档:</p>
                  <ElSpace wrap>
                    <template v-for="(f, i) in data.document_list" :key="i">
                      <ElCard
                        shadow="never"
                        style="--el-card-padding: 8px"
                        class="file cursor"
                      >
                        <div class="align-center flex">
                          <img
                            :src="getImgUrl(f && f?.name)"
                            alt=""
                            width="24"
                          />
                          <div class="g-ml-4 ellipsis" :title="f && f?.name">
                            {{ f && f?.name }}
                          </div>
                        </div>
                      </ElCard>
                    </template>
                  </ElSpace>
                </div>
                <div v-if="data.image_list?.length > 0">
                  <p class="g-mb-8 color-secondary">图片:</p>
                  <ElSpace wrap>
                    <template v-for="(f, i) in data.image_list" :key="i">
                      <ElImage
                        :src="f.url"
                        alt=""
                        fit="cover"
                        style="display: block; width: 40px; height: 40px"
                        class="border-r-6"
                      />
                    </template>
                  </ElSpace>
                </div>
                <div v-if="data.audio_list?.length > 0">
                  <p class="g-mb-8 color-secondary">音频文件:</p>
                  <ElSpace wrap>
                    <template v-for="(f, i) in data.audio_list" :key="i">
                      <audio
                        :src="f.url"
                        controls
                        style="width: 300px; height: 43px"
                        class="border-r-6"
                      ></audio>
                    </template>
                  </ElSpace>
                </div>
                <div v-if="data.video_list?.length > 0">
                  <p class="g-mb-8 color-secondary">图片:</p>
                  <ElSpace wrap>
                    <template v-for="(f, i) in data.video_list" :key="i">
                      <video
                        :src="f.url"
                        style="display: block; width: 170px"
                        controls
                        autoplay
                        class="border-r-6"
                      ></video>
                    </template>
                  </ElSpace>
                </div>
                <div v-if="data.other_list?.length > 0">
                  <p class="g-mb-8 color-secondary">文档:</p>
                  <ElSpace wrap>
                    <template v-for="(f, i) in data.other_list" :key="i">
                      <ElCard
                        shadow="never"
                        style="--el-card-padding: 8px"
                        class="file cursor"
                      >
                        <div class="align-center flex">
                          <img
                            :src="getImgUrl(f && f?.name)"
                            alt=""
                            width="24"
                          />
                          <div class="g-ml-4 ellipsis" :title="f && f?.name">
                            {{ f && f?.name }}
                          </div>
                        </div>
                      </ElCard>
                    </template>
                  </ElSpace>
                </div>
              </div>
            </div>
          </template>
          <!-- 知识库检索 -->
          <template v-if="data.type === WorkflowType.SearchKnowledge">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">检索内容</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                {{ data.question || '-' }}
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">检索结果</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <template v-if="data.paragraph_list?.length > 0">
                  <template
                    v-for="(paragraph, paragraphIndex) in arraySort(
                      data.paragraph_list,
                      'similarity',
                      true,
                    )"
                    :key="paragraphIndex"
                  >
                    <ParagraphCard
                      :data="paragraph"
                      :content="paragraph.content"
                      :index="Number(paragraphIndex)"
                    />
                  </template>
                </template>
                <template v-else> -</template>
              </div>
            </div>
          </template>
          <!-- 判断器 -->
          <template v-if="data.type === WorkflowType.Condition">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">判断结果</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                {{ data.branch_name || '-' }}
              </div>
            </div>
          </template>
          <!-- AI 对话 -->
          <template v-if="data.type === WorkflowType.AiChat">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">角色设定</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                {{ data.system || '-' }}
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8" v-if="!isKnowLedge">
              <h5 class="g-p-8-12">历史记录</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <template v-if="data.history_message?.length > 0">
                  <p
                    class="g-mt-4 g-mb-4"
                    v-for="(history, historyIndex) in data.history_message"
                    :key="historyIndex"
                  >
                    <span class="color-secondary g-mr-4"
                      >{{ history.role }}:</span
                    ><span>{{ history.content }}</span>
                  </p>
                </template>
                <template v-else> -</template>
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">
                {{ isKnowLedge ? '提示词' : '当前对话' }}
              </h5>
              <div class="g-p-8-12 border-t-dashed lighter pre-wrap">
                {{ data.question || '-' }}
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">思考</h5>
              <div class="g-p-8-12 border-t-dashed lighter pre-wrap">
                {{ data.reasoning_content || '-' }}
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">回答</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <MdRenderer v-if="data.answer" :source="data.answer" />
                <template v-else> -</template>
              </div>
            </div>
          </template>
          <!-- 问题优化 / 意图识别-->
          <template
            v-if="
              data.type === WorkflowType.Question ||
              data.type === WorkflowType.Application ||
              data.type === WorkflowType.IntentNode
            "
          >
            <div
              class="card-never border-r-6"
              v-if="data.type !== WorkflowType.Application"
            >
              <h5 class="g-p-8-12">角色设定</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                {{ data.system || '-' }}
              </div>
            </div>
            <div
              class="card-never border-r-6 g-mt-8"
              v-if="data.type !== WorkflowType.Application"
            >
              <h5 class="g-p-8-12">历史记录</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <template v-if="data.history_message?.length > 0">
                  <p
                    class="g-mt-4 g-mb-4"
                    v-for="(history, historyIndex) in data.history_message"
                    :key="historyIndex"
                  >
                    <span class="color-secondary g-mr-4"
                      >{{ history.role }}:</span
                    ><span>{{ history.content }}</span>
                  </p>
                </template>
                <template v-else> -</template>
              </div>
            </div>
            <div
              class="card-never border-r-6 g-mt-8"
              v-if="data.type !== WorkflowType.Application"
            >
              <h5 class="g-p-8-12">当前对话</h5>
              <div class="g-p-8-12 border-t-dashed lighter pre-wrap">
                {{ data.question || '-' }}
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">
                {{
                  data.type === WorkflowType.Application ? '输出参数' : '回答'
                }}
              </h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <MdRenderer v-if="data.answer" :source="data.answer" />
                <template v-else> -</template>
              </div>
            </div>
          </template>

          <!-- 指定回复 -->
          <template v-if="data.type === WorkflowType.Reply">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">回复内容</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <ElScrollbar height="150">
                  <MdRenderer v-if="data.answer" :source="data.answer" />
                  <template v-else> -</template>
                </ElScrollbar>
              </div>
            </div>
          </template>

          <!-- 文档内容提取 -->
          <template v-if="data.type === WorkflowType.DocumentExtractNode">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12 align-center flex">
                <span class="g-mr-4"> 输出参数</span>
              </h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <ElScrollbar height="200">
                  <ElCard
                    shadow="never"
                    style="--el-card-padding: 8px"
                    v-for="(file_content, index) in data.content"
                    :key="index"
                    class="g-mb-8"
                  >
                    <MdRenderer v-if="file_content" :source="file_content" />
                    <template v-else> -</template>
                  </ElCard>
                </ElScrollbar>
              </div>
            </div>
          </template>
          <template v-if="data.type === WorkflowType.SpeechToTextNode">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">输入参数</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <div class="g-mb-8">
                  <div v-if="data.audio_list?.length > 0">
                    <p class="g-mb-8 color-secondary">音频文件:</p>
                    <ElSpace wrap>
                      <template v-for="(f, i) in data.audio_list" :key="i">
                        <audio
                          :src="f.url"
                          controls
                          style="width: 300px; height: 43px"
                          class="border-r-6"
                        ></audio>
                      </template>
                    </ElSpace>
                  </div>
                </div>
              </div>
            </div>
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">输出参数</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <ElCard
                  shadow="never"
                  style="--el-card-padding: 8px"
                  v-for="(file_content, index) in data.content"
                  :key="index"
                  class="g-mb-8"
                >
                  <MdRenderer v-if="file_content" :source="file_content" />
                  <template v-else> -</template>
                </ElCard>
              </div>
            </div>
          </template>

          <template v-if="data.type === WorkflowType.TextToSpeechNode">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">输入参数</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <div class="g-p-8-12 border-t-dashed lighter">
                  <p class="g-mb-8 color-secondary">文本内容:</p>
                  <div v-if="data.content">
                    <MdRenderer :source="data.content" />
                  </div>
                </div>
              </div>
            </div>
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">输出参数</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <p class="g-mb-8 color-secondary">音频文件:</p>
                <div v-if="data.answer" v-safe-html="data.answer"></div>
              </div>
            </div>
          </template>

          <!-- 工具库 -->
          <template
            v-if="
              data.type === WorkflowType.ToolLib ||
              data.type === WorkflowType.ToolLibCustom
            "
          >
            <div class="card-never border-r-6 g-mt-8" v-if="data.index !== 0">
              <h5 class="g-p-8-12">输入</h5>
              <div class="g-p-8-12 border-t-dashed lighter break-all">
                {{ data.params || '-' }}
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">输出</h5>
              <div class="g-p-8-12 border-t-dashed lighter break-all">
                {{ data.result || '-' }}
              </div>
            </div>
          </template>
          <!-- 多路召回 -->
          <template v-if="data.type === WorkflowType.RerankerNode">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">检索内容</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                {{ data.question || '-' }}
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">多路召回内容</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <template v-if="data.document_list?.length > 0">
                  <template
                    v-for="(paragraph, paragraphIndex) in data.document_list"
                    :key="paragraphIndex"
                  >
                    <ParagraphCard
                      :data="paragraph.metadata"
                      :content="paragraph.page_content"
                      :index="Number(paragraphIndex)"
                    />
                  </template>
                </template>
                <template v-else> -</template>
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">多路召回结果</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <template v-if="data.result_list?.length > 0">
                  <template
                    v-for="(paragraph, paragraphIndex) in data.result_list"
                    :key="paragraphIndex"
                  >
                    <ParagraphCard
                      :data="paragraph.metadata"
                      :content="paragraph.page_content"
                      :index="Number(paragraphIndex)"
                      :score="paragraph.metadata?.relevance_score"
                    />
                  </template>
                </template>
                <template v-else> -</template>
              </div>
            </div>
          </template>

          <!-- 表单收集 -->
          <template v-if="data.type === WorkflowType.FormNode">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">
                输出参数<span style="color: #f54a45">{{
                  data.is_submit ? '' : `(未提交)`
                }}</span>
              </h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <DynamicsForm
                  :view="true"
                  :render-fields="data.form_field_list"
                  v-model="formData"
                />
              </div>
            </div>
          </template>
          <!-- 图片理解 -->
          <template v-if="data.type === WorkflowType.ImageUnderstandNode">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">角色设定</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                {{ data.system || '-' }}
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8" v-if="!isKnowLedge">
              <h5 class="g-p-8-12">历史记录</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <template v-if="data.history_message?.length > 0">
                  <p
                    class="g-mt-4 g-mb-4"
                    v-for="(history, historyIndex) in data.history_message"
                    :key="historyIndex"
                  >
                    <span class="color-secondary g-mr-4"
                      >{{ history.role }}:</span
                    >
                    <span v-if="Array.isArray(history.content)">
                      <template v-for="(h, i) in history.content" :key="i">
                        <ElImage
                          v-if="h.type === 'image_url'"
                          :src="h.image_url.url"
                          alt=""
                          fit="cover"
                          style="
                            display: inline-block;
                            width: 40px;
                            height: 40px;
                          "
                          class="border-r-6 g-mr-8"
                        />
                        <span v-else>{{ h.text }}<br /></span>
                      </template>
                    </span>
                    <span v-else>{{ history.content }}</span>
                  </p>
                </template>
                <template v-else> -</template>
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">
                {{ isKnowLedge ? '提示词' : '当前对话' }}
              </h5>
              <div class="g-p-8-12 border-t-dashed lighter pre-wrap">
                <div v-if="data.image_list?.length > 0">
                  <ElSpace wrap>
                    <template v-for="(f, i) in data.image_list" :key="i">
                      <ElImage
                        :src="
                          f.url || (f.file_id ? `./oss/file/${f.file_id}` : '')
                        "
                        alt=""
                        fit="cover"
                        style="display: block; width: 40px; height: 40px"
                        class="border-r-6"
                      />
                    </template>
                  </ElSpace>
                </div>
                <div>
                  {{ data.question || '-' }}
                </div>
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">思考</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <MdRenderer
                  v-if="data.reasoning_content"
                  :source="data.reasoning_content"
                />
                <template v-else> -</template>
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">回答</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <MdRenderer v-if="data.answer" :source="data.answer" />
                <template v-else> -</template>
              </div>
            </div>
          </template>
          <!-- 视频理解 -->
          <template v-if="data.type === WorkflowType.VideoUnderstandNode">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">角色设定</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                {{ data.system || '-' }}
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8" v-if="!isKnowLedge">
              <h5 class="g-p-8-12">历史记录</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <template v-if="data.history_message?.length > 0">
                  <p
                    class="g-mt-4 g-mb-4"
                    v-for="(history, historyIndex) in data.history_message"
                    :key="historyIndex"
                  >
                    <span class="color-secondary g-mr-4"
                      >{{ history.role }}:</span
                    >
                    <span v-if="Array.isArray(history.content)">
                      <template v-for="(h, i) in history.content" :key="i">
                        <video
                          v-if="h.type === 'video_url'"
                          :src="h.video_url.url"
                          style="
                            display: inline-block;
                            width: 40px;
                            height: 40px;
                          "
                          class="border-r-6 g-mr-8"
                        ></video>
                        <span v-else>{{ h.text }}<br /></span>
                      </template>
                    </span>
                    <span v-else>{{ history.content }}</span>
                  </p>
                </template>
                <template v-else> -</template>
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">
                {{ isKnowLedge ? '提示词' : '当前对话' }}
              </h5>
              <div class="g-p-8-12 border-t-dashed lighter pre-wrap">
                <div v-if="data.video_list?.length > 0">
                  <ElSpace wrap>
                    <template v-for="(f, i) in data.video_list" :key="i">
                      <video
                        :src="f.url"
                        style="display: block; width: 100px"
                        class="border-r-6"
                        autoplay
                        controls
                      ></video>
                    </template>
                  </ElSpace>
                </div>
                <div>
                  {{ data.question || '-' }}
                </div>
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">思考</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <MdRenderer
                  v-if="data.reasoning_content"
                  :source="data.reasoning_content"
                />
                <template v-else> -</template>
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">回答</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <MdRenderer v-if="data.answer" :source="data.answer" />
                <template v-else> -</template>
              </div>
            </div>
          </template>
          <!-- 图片生成 -->
          <template v-if="data.type === WorkflowType.ImageGenerateNode">
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">当前对话</h5>
              <div class="g-p-8-12 border-t-dashed lighter pre-wrap">
                {{ data.question || '-' }}
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">反向提示词</h5>
              <div class="g-p-8-12 border-t-dashed lighter pre-wrap">
                {{ data.negative_prompt || '-' }}
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">回答</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <MdRenderer v-if="data.answer" :source="data.answer" />
                <template v-else> -</template>
              </div>
            </div>
          </template>
          <template v-if="data.type === WorkflowType.TextToVideoGenerateNode">
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">当前对话</h5>
              <div class="g-p-8-12 border-t-dashed lighter pre-wrap">
                {{ data.question || '-' }}
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">反向提示词</h5>
              <div class="g-p-8-12 border-t-dashed lighter pre-wrap">
                {{ data.negative_prompt || '-' }}
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">回答</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <MdRenderer v-if="data.answer" :source="data.answer" />
                <template v-else> -</template>
              </div>
            </div>
          </template>

          <template v-if="data.type === WorkflowType.ImageToVideoGenerateNode">
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">当前对话</h5>
              <div class="g-p-8-12 border-t-dashed lighter pre-wrap">
                {{ data.question || '-' }}
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">反向提示词</h5>
              <div class="g-p-8-12 border-t-dashed lighter pre-wrap">
                {{ data.negative_prompt || '-' }}
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">首帧</h5>
              <div class="g-p-8-12 border-t-dashed lighter pre-wrap">
                <div v-if="typeof data.first_frame_url === 'string'">
                  <ElImage
                    :src="data.first_frame_url"
                    alt=""
                    fit="cover"
                    style="display: block; width: 40px; height: 40px"
                    class="border-r-6"
                  />
                </div>
                <div v-else-if="Array.isArray(data.first_frame_url)">
                  <ElSpace wrap>
                    <template v-for="(f, i) in data.first_frame_url" :key="i">
                      <ElImage
                        :src="f.url"
                        alt=""
                        fit="cover"
                        style="display: block; width: 40px; height: 40px"
                        class="border-r-6"
                      />
                    </template>
                  </ElSpace>
                </div>
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">尾帧</h5>
              <div class="g-p-8-12 border-t-dashed lighter pre-wrap">
                <div v-if="typeof data.last_frame_url === 'string'">
                  <ElImage
                    :src="data.last_frame_url"
                    alt=""
                    fit="cover"
                    style="display: block; width: 40px; height: 40px"
                    class="border-r-6"
                  />
                </div>
                <div v-else-if="Array.isArray(data.last_frame_url)">
                  <ElSpace wrap>
                    <template v-for="(f, i) in data.last_frame_url" :key="i">
                      <ElImage
                        :src="f.url"
                        alt=""
                        fit="cover"
                        style="display: block; width: 40px; height: 40px"
                        class="border-r-6"
                      />
                    </template>
                  </ElSpace>
                </div>
                <div v-else>-</div>
              </div>
            </div>

            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">回答</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <MdRenderer v-if="data.answer" :source="data.answer" />
                <template v-else> -</template>
              </div>
            </div>
          </template>
          <!-- 变量赋值 -->
          <template v-if="data.type === WorkflowType.VariableAssignNode">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">输入参数</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <div v-for="(f, i) in data.result_list" :key="i" class="g-mb-8">
                  <span class="color-secondary"
                    >{{ f.name }} ({{ f.input_type }}):</span
                  >
                  {{ f.input_value }}
                </div>
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">输出参数</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <div v-for="(f, i) in data.result_list" :key="i" class="g-mb-8">
                  <span class="color-secondary"
                    >{{ f.name }} ({{ f.output_type }}):</span
                  >
                  {{ f.output_value }}
                </div>
              </div>
            </div>
          </template>

          <!-- 变量拆分 -->
          <template
            v-if="
              data.type === WorkflowType.VariableSplittingNode ||
              data.type === WorkflowType.ParameterExtractionNode
            "
          >
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">输入参数</h5>
              <div class="g-p-8-12 border-t-dashed lighter pre-wrap">
                {{ data.request || '-' }}
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">输出参数</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <div v-for="(f, i) in data.result" :key="i" class="g-mb-8">
                  <span class="color-secondary">{{ i }}:</span> {{ f }}
                </div>
              </div>
            </div>
          </template>
          <!-- 变量聚合 -->
          <template v-if="data.type === WorkflowType.VariableAggregationNode">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">策略</h5>
              <div class="g-p-8-12 border-t-dashed lighter pre-wrap">
                {{
                  data.strategy === 'first_non_null'
                    ? '取第一个非空值'
                    : data.strategy === 'variable_to_dict'
                      ? '变量转为字典'
                      : '取最后一个非空值'
                }}
              </div>
            </div>
            <div
              class="card-never border-r-6 g-mt-8"
              v-for="(group, groupI) in data.group_list"
              :key="groupI"
            >
              <h5 class="g-p-8-12">
                {{ `${group.label} 输入参数` }}
              </h5>
              <ElScrollbar height="200">
                <div class="g-p-8-12 border-t-dashed lighter">
                  <div
                    v-for="(f, i) in group.variable_list"
                    :key="i"
                    class="g-mb-8"
                  >
                    <span class="color-secondary"
                      >{{ `${f.node_name}.${f.field}` }}:</span
                    >
                    {{ f.value }}
                  </div>
                </div>
              </ElScrollbar>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">输出参数</h5>
              <ElScrollbar height="200">
                <div class="g-p-8-12 border-t-dashed lighter">
                  <div v-for="(f, i) in data.result" :key="i" class="g-mb-8">
                    <span class="color-secondary">{{ i }}:</span> {{ f }}
                  </div>
                </div>
              </ElScrollbar>
            </div>
          </template>
          <!-- MCP 节点 -->
          <template v-if="data.type === WorkflowType.McpNode">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">工具</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <div class="g-mb-8">
                  <span class="color-secondary"> 工具: </span>
                  {{ data.mcp_tool }}
                </div>
              </div>
            </div>
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">工具参数</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <div
                  v-for="(value, name) in data.tool_params"
                  :key="name"
                  class="g-mb-8"
                >
                  <span class="color-secondary">{{ name }}:</span> {{ value }}
                </div>
              </div>
            </div>
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">输出参数</h5>
              <div class="g-p-8-12 border-t-dashed lighter break-all">
                <div v-for="(f, i) in data.result" :key="i" class="g-mb-8">
                  <span class="color-secondary">result:</span> {{ f }}
                </div>
              </div>
            </div>
          </template>
          <!-- 循环 节点 -->
          <div
            class="card-never border-r-6"
            v-if="data.type === WorkflowType.LoopNode"
          >
            <h5 class="g-p-8-12">循环设置</h5>

            <div class="g-p-8-12 border-t-dashed lighter">
              <div class="g-mb-8">
                <span class="color-secondary"> 循环类型:</span>
                {{ data.loop_type || '-' }}
              </div>
              <div>
                <span class="color-secondary"> 循环数组:</span>
                {{
                  data.loop_type === 'NUMBER'
                    ? data.number
                    : Object.keys(data.loop_node_data) || '-'
                }}
              </div>
            </div>
            <h5 class="g-p-8-12">循环详情</h5>
            <div class="g-p-8-12 border-t-dashed lighter">
              <template v-if="data.type === WorkflowType.LoopNode">
                <ElRadioGroup
                  v-model="currentLoopNode"
                  class="app-radio-button-group g-mb-8"
                >
                  <template
                    v-for="(_loop, loopIndex) in data.loop_node_data"
                    :key="loopIndex"
                  >
                    <ElRadioButton :label="loopIndex" :value="loopIndex" />
                  </template>
                </ElRadioGroup>
                <template
                  v-for="(cLoop, cIndex) in Object.values(
                    data.loop_node_data?.[currentLoopNode] || [],
                  ).sort((x: any, y: any) => (x.index || 0) - (y.index || 0))"
                  :key="cIndex"
                >
                  <ExecutionDetailCard :data="cLoop" :type="type" />
                </template>
              </template>
            </div>
          </div>
          <!-- 循环开始 节点-->
          <template v-if="data.type === WorkflowType.LoopStartNode">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">输入参数</h5>

              <div class="g-p-8-12 border-t-dashed lighter">
                <div class="g-mb-8">
                  <span class="color-secondary"> 循环项:</span>
                  {{ data.current_item }}
                </div>
                <div class="g-mb-8">
                  <span class="color-secondary"> 循环索引:</span>
                  {{ data.current_index }}
                </div>
              </div>
            </div>
          </template>
          <!-- 循环跳过 节点-->
          <template v-if="data.type === WorkflowType.LoopContinueNode">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">输出参数</h5>

              <div class="g-p-8-12 border-t-dashed lighter">
                <div class="g-mb-8">
                  <span class="color-secondary"> 是否跳过:</span>
                  {{ data.is_continue }}
                </div>
              </div>
            </div>
          </template>
          <!-- 循环退出 节点-->
          <template v-if="data.type === WorkflowType.LoopBreakNode">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">输出参数</h5>

              <div class="g-p-8-12 border-t-dashed lighter">
                <div class="g-mb-8">
                  <span class="color-secondary"> 是否退出:</span>
                  {{ data.is_break }}
                </div>
              </div>
            </div>
          </template>
          <!-- 文档检索 -->
          <template v-if="data.type === WorkflowType.SearchDocument">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12 align-center flex">
                <span class="g-mr-4"> 输出参数</span>
              </h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <div class="g-mb-8">
                  <span class="color-secondary"> knowledge_list:</span>
                  {{ data.knowledge_items?.map((v: any) => v.name).join(',') }}
                </div>
                <div class="g-mb-8">
                  <span class="color-secondary"> document_list:</span>
                  {{ data.document_items?.map((v: any) => v.name).join(',') }}
                </div>
              </div>
            </div>
          </template>
          <!-- 文本文件 -->
          <template v-if="data.type === WorkflowType.DataSourceLocalNode">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">输出参数</h5>

              <div class="g-p-8-12 border-t-dashed lighter">
                <div class="g-mb-8">
                  {{ data.file_list || '-' }}
                </div>
              </div>
            </div>
          </template>
          <!-- 文档分段 -->
          <template v-if="data.type === WorkflowType.DocumentSplitNode">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">输入参数</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <div class="g-mb-8">
                  <span class="color-secondary">分段规则:</span>
                  {{ data.split_strategy }}
                </div>
                <div class="g-mb-8">
                  <span class="color-secondary">分段长度:</span>
                  {{ data.chunk_size }}
                </div>
                {{ data.size }}
                <div class="g-mb-8">
                  <span class="color-secondary">输入内容:</span>
                  {{ data.document_list?.map((v: any) => v.name).join(',') }}
                </div>
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">输出参数（仅展示前50条）</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <ElTabs v-model="currentParagraph" class="paragraph-tabs">
                  <template
                    v-for="(item, index) in data.paragraph_list"
                    :key="index"
                  >
                    <ElTabPane :label="item.name" :name="index">
                      <template #label>
                        <div class="flex-center">
                          <span class="g-ml-4">{{ item?.name }}</span>
                        </div>
                      </template>

                      <template
                        v-for="(paragraph, pId) in item?.paragraphs"
                        :key="pId"
                      >
                        <ParagraphCard
                          :data="paragraph"
                          :content="paragraph.content"
                          :index="Number(pId)"
                        >
                          <template #footer>
                            <span class="color-secondary">
                              字符：{{ paragraph.content.length }}</span
                            >
                          </template>
                        </ParagraphCard>
                      </template>
                    </ElTabPane>
                  </template>
                </ElTabs>
              </div>
            </div>
          </template>
          <!-- 知识库写入 -->
          <template v-if="data.type === WorkflowType.KnowledgeWriteNode">
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">写入内容（仅展示前50条）</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <ElTabs v-model="currentWriteContent" class="paragraph-tabs">
                  <template
                    v-for="(item, index) in data.write_content"
                    :key="index"
                  >
                    <ElTabPane :label="item.name" :name="index">
                      <template #label>
                        <div class="flex-center">
                          <span class="g-ml-4">{{ item?.name }}</span>
                        </div>
                      </template>

                      <template
                        v-for="(paragraph, pId) in item?.paragraphs"
                        :key="pId"
                      >
                        <ParagraphCard
                          :data="paragraph"
                          :content="paragraph.content"
                          :index="Number(pId)"
                        >
                          <template #footer>
                            <span class="color-secondary">
                              字符：{{ paragraph.content.length }}</span
                            >
                          </template>
                        </ParagraphCard>
                      </template>
                    </ElTabPane>
                  </template>
                </ElTabs>
              </div>
            </div>
          </template>
          <!-- Web站点 -->
          <template v-if="data.type === WorkflowType.DataSourceWebNode">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">输入参数</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <p class="g-mb-8 color-secondary">
                  选择器: {{ data.input_params.selector }}
                </p>
                <p class="g-mb-8 color-secondary">
                  源地址:
                  {{ data.input_params.source_url }}
                </p>
              </div>
            </div>
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">输出参数</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <ElScrollbar height="200">
                  <ElCard
                    shadow="never"
                    style="--el-card-padding: 8px"
                    v-for="(file_content, index) in data.output_params"
                    :key="index"
                    class="g-mb-8"
                  >
                    <h4>{{ file_content.name }}</h4>
                    <MdRenderer
                      v-if="file_content"
                      :source="file_content.content"
                    />
                    <template v-else> -</template>
                  </ElCard>
                </ElScrollbar>
              </div>
            </div>
          </template>

          <!-- 工作流开始 节点-->
          <template v-if="data.type === WorkflowType.ToolStartNode">
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">输入参数</h5>

              <div class="g-p-8-12 border-t-dashed lighter">
                <div
                  v-for="(f, i) in data.global_fields"
                  :key="i"
                  class="g-mb-8"
                >
                  <span class="color-secondary">{{ f.label }}:</span>
                  {{ f.value }}
                </div>
              </div>
            </div>
          </template>
          <!-- 工作流 节点 -->
          <div
            class="card-never border-r-6"
            v-if="data.type === WorkflowType.ToolWorkflowLib"
          >
            <div class="card-never border-r-6">
              <h5 class="g-p-8-12">输入参数</h5>
              <div class="g-p-8-12 border-t-dashed lighter pre-wrap">
                <div v-for="(f, i) in data.input" :key="i" class="g-mb-8">
                  <span class="color-secondary">{{ i }}:</span> {{ f }}
                </div>
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">输出参数</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <div v-for="(f, i) in data.output" :key="i" class="g-mb-8">
                  <span class="color-secondary">{{ i }}:</span> {{ f }}
                </div>
              </div>
            </div>
            <div class="card-never border-r-6 g-mt-8">
              <h5 class="g-p-8-12">执行详情</h5>
              <div class="g-p-8-12 border-t-dashed lighter">
                <template v-for="(cLoop, cIndex) in data.details" :key="cIndex">
                  <ExecutionDetailCard :data="cLoop" :type="type" />
                </template>
              </div>
            </div>
          </div>
          <slot></slot>
        </template>
        <template v-else>
          <div class="card-never border-r-6">
            <h5 class="g-p-8-12">错误信息</h5>
            <div class="g-p-8-12 border-t-dashed lighter">
              {{ data.err_message || '-' }}
            </div>
          </div>
        </template>
      </div>
    </ElCollapseTransition>
  </ElCard>
</template>
<style scoped>
.execution-detail-card {
  width: 100%;
  margin-bottom: 8px;
}

.execution-detail-card :deep(.md-editor-previewOnly) {
  background: none !important;
}

.execution-detail-card__header {
  gap: 24px;
}

.execution-detail-card__title {
  flex: 1 1 auto;
  min-width: 0;
}

.execution-detail-card__title-text {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-detail-card__metrics {
  flex: 0 0 auto;
  white-space: nowrap;
}

.arrow-icon {
  flex-shrink: 0;
  margin-right: 8px;
  transition: transform 0.3s;
}

.arrow-icon.rotate-90 {
  transform: rotate(90deg);
}

.node-type-icon {
  flex-shrink: 0;
  color: var(--el-color-primary);
}

/* Utility classes */
.flex {
  display: flex;
}

.flex-between {
  display: flex;
  justify-content: space-between;
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.align-center {
  align-items: center;
}

.cursor {
  cursor: pointer;
}

.pre-wrap {
  white-space: pre-wrap;
}

.break-all {
  word-break: break-all;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-secondary {
  color: var(--el-text-color-secondary);
}

.color-success {
  color: var(--el-color-success);
}

.color-danger {
  color: var(--el-color-danger);
}

.g-mr-4 {
  margin-right: 4px;
}

.g-mr-8 {
  margin-right: 8px;
}

.g-mr-16 {
  margin-right: 16px;
}

.g-ml-4 {
  margin-left: 4px;
}

.g-mb-8 {
  margin-bottom: 8px;
}

.g-mt-4 {
  margin-top: 4px;
}

.g-mt-8 {
  margin-top: 8px;
}

.g-mt-12 {
  margin-top: 12px;
}

.g-p-8-12 {
  padding: 8px 12px;
}

.border-r-6 {
  border-radius: 6px;
}

.border-t-dashed {
  border-top: 1px dashed var(--el-border-color-lighter);
}

.card-never {
  background: var(--el-fill-color-lighter);
}

.lighter {
  color: var(--el-text-color-secondary);
}

.file {
  max-width: 200px;
}

.app-radio-button-group {
  margin-bottom: 8px;
}

.paragraph-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}
</style>
