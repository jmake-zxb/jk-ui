<script setup>
import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElAlert,
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElSelect,
} from 'element-plus';

import { fetchList } from '#/api/mp/mpAccount';
import { addObj, getObj, putObj } from '#/api/mp/mpMenu';

// --- 模拟左侧公众号数据 ---
const accountListLoading = ref(false);
const accountList = ref([]);

const searchKey = ref('');
const currentAccountId = ref(1);

// --- 菜单核心逻辑 ---
const menuFormData = reactive({
  formData: {
    id: '',
  },
});
const menuData = reactive({ buttons: [] });
const selectedMenuIndex = ref(-1);
const selectedSubMenuIndex = ref(-1);

// 当前选中的菜单项
const currentMenu = computed(() => {
  if (selectedMenuIndex.value === -1) return null;
  const parent = menuData.buttons[selectedMenuIndex.value];
  return selectedSubMenuIndex.value === -1
    ? parent
    : parent.sub_button[selectedSubMenuIndex.value];
});

// 是否是子菜单
const isSubMenu = computed(() => selectedSubMenuIndex.value !== -1);
// 是否包含子菜单（父级）
const hasSubButtons = computed(() => {
  if (isSubMenu.value) return false;
  const parent = menuData.buttons[selectedMenuIndex.value];
  return parent.sub_button && parent.sub_button.length > 0;
});

const getAccountList = async () => {
  try {
    accountListLoading.value = true;
    const data = await fetchList({ name: searchKey.value });
    accountList.value = data?.records || [];
    if (accountList?.value?.length > 0) {
      currentAccountId.value = accountList.value[0].id;
      const menuJsonData =
        (await getObj({
          wxAccountId: currentAccountId.value,
        })) || {};
      if (menuJsonData?.menu) {
        Object.assign(menuFormData.formData, menuJsonData);
        menuData.buttons = JSON.parse(menuJsonData?.menu)?.button;
      } else {
        menuFormData.formData = { id: '' };
        menuData.buttons.push({
          name: '菜单名称',
          sub_button: [],
          type: 'view',
          url: '',
        });
      }
    }
  } finally {
    accountListLoading.value = false;
  }
};

// 选中菜单
const selectMenu = (i) => {
  selectedMenuIndex.value = i;
  selectedSubMenuIndex.value = -1;
};
// 选中子菜单
const selectSubMenu = (pi, si) => {
  selectedMenuIndex.value = pi;
  selectedSubMenuIndex.value = si;
};

// 添加一级菜单
const addMenu = () => {
  if (menuData.buttons.length >= 3) return ElMessage.warning('一级菜单最多3个');
  menuData.buttons.push({
    name: '菜单名称',
    sub_button: [],
    type: 'view',
    url: '',
  });
  selectMenu(menuData.buttons.length - 1);
};

// 添加子菜单
const addSubMenu = (pi) => {
  const p = menuData.buttons[pi];
  if (!p.sub_button) p.sub_button = [];
  if (p.sub_button.length >= 5) return ElMessage.warning('二级菜单最多5个');
  // 清理父级动作
  p.type = null;
  p.url = null;
  p.key = null;
  p.sub_button.push({ name: '子菜单', type: 'view', url: null });
  selectSubMenu(pi, p.sub_button.length - 1);
};

// 删除菜单
const deleteCurrentMenu = () => {
  ElMessageBox.confirm('确定删除当前菜单吗?', '警告', { type: 'warning' }).then(
    () => {
      if (isSubMenu.value) {
        menuData.buttons[selectedMenuIndex.value].sub_button.splice(
          selectedSubMenuIndex.value,
          1,
        );
        selectedSubMenuIndex.value = -1;
      } else {
        menuData.buttons.splice(selectedMenuIndex.value, 1);
        selectedMenuIndex.value = -1;
      }
    },
  );
};

// 清空菜单
const clearMenu = () => {
  ElMessageBox.confirm('确定清空所有菜单吗?', '警告', { type: 'warning' }).then(
    () => {
      menuData.buttons = [];
      selectedMenuIndex.value = -1;
      selectedSubMenuIndex.value = -1;
    },
  );
};

// 校验单个按钮的配置是否合法
const validateButtonContent = (btn, levelName) => {
  if (!btn.type) {
    throw new Error(`${levelName}“${btn.name}”未配置菜单类型`);
  }

  switch (btn.type) {
    case 'click': {
      if (!btn.key) {
        throw new Error(`${levelName}“${btn.name}”必须填写Key值`);
      }
      break;
    }
    case 'location_select':
    case 'pic_photo_or_album':
    case 'pic_sysphoto':
    case 'pic_weixin':
    case 'scancode_push':
    case 'scancode_waitmsg': {
      if (!btn.key) {
        throw new Error(`${levelName}“${btn.name}”必须填写Key值`);
      }
      break;
    }
    case 'media_id':
    case 'view_limited': {
      if (!btn.mediaId) {
        throw new Error(`${levelName}“${btn.name}”必须选择素材`);
      }
      break;
    }

    case 'miniprogram': {
      if (!btn.appid || !btn.pagepath || !btn.url) {
        throw new Error(
          `${levelName}“${btn.name}”的小程序配置不完整(AppId, 路径, 备用网页均必填)`,
        );
      }
      break;
    }
    case 'view': {
      if (!btn.url) {
        throw new Error(`${levelName}“${btn.name}”必须填写网页链接`);
      }
      if (!/^https?:\/\//.test(btn.url)) {
        throw new Error(
          `${levelName}“${btn.name}”链接必须以 http:// 或 https:// 开头`,
        );
      }
      break;
    }

    default: {
      // 其他类型暂不强校验，可视情况补充
      break;
    }
  }
};

// --- 保存发布核心逻辑 ---
const saveMenu = async () => {
  try {
    const buttons = menuData.buttons;

    // 1. 检查一级菜单数量
    if (!buttons || buttons.length === 0) {
      throw new Error('请至少添加一个一级菜单');
    }

    // 2. 遍历校验所有菜单
    for (const [i, btn] of buttons.entries()) {
      const menuName = `一级菜单(${i + 1})`;

      // 2.1 校验一级菜单名称
      if (!btn.name || !btn.name.trim()) {
        throw new Error(`${menuName}名称不能为空`);
      }

      const hasSub = btn.sub_button && btn.sub_button.length > 0;

      if (hasSub) {
        // === Case A: 有子菜单 ===
        // 微信规定：有子菜单的一级菜单，不能有 type/key/url 等动作，只作为容器
        // 这里可以做数据清洗，防止脏数据提交
        // delete btn.type; delete btn.key; delete btn.url;

        // 遍历校验二级菜单
        for (let j = 0; j < btn.sub_button.length; j++) {
          const sub = btn.sub_button[j];
          const subMenuName = `${menuName}-子菜单(${j + 1})`;

          if (!sub.name || !sub.name.trim()) {
            throw new Error(`${subMenuName}名称不能为空`);
          }

          // 二级菜单必须有动作内容
          validateButtonContent(sub, subMenuName);
        }
      } else {
        // === Case B: 无子菜单 ===
        // 一级菜单本身必须有动作内容
        validateButtonContent(btn, menuName);
      }
    }

    const wxAccountInfo =
      accountList.value.find((item) => item.id === currentAccountId.value) ||
      {};
    if (!wxAccountInfo?.id) {
      throw new Error('请选中一个公众号然后进行操作');
    }

    const submitData = {
      id: menuFormData.formData.id,
      menu: JSON.stringify({ button: menuData.buttons }),
      wxAccountId: wxAccountInfo?.id,
      wxAccountAppid: wxAccountInfo?.appid,
      wxAccountName: wxAccountInfo?.name,
    };

    // 3. 校验通过，发送请求
    menuFormData.formData.id
      ? await putObj(submitData)
      : await addObj(submitData);

    ElMessage.success('保存并发布成功！');
  } catch (error) {
    // 捕获上述抛出的错误，并弹窗提示
    console.error(error);
  }
};

// 初始化数据
onMounted(() => {
  getAccountList();
});
</script>

<template>
  <Page auto-content-height>
    <div class="app-container">
      <!-- 左侧：公众号列表 -->

      <div class="left-panel">
        <div class="search-box">
          <ElInput
            v-model="searchKey"
            placeholder="请输入微信公众号名称"
            clearable
            @keydown="getAccountList"
          >
            <template #prefix>
              <span class="icon-[ep--search]"></span>
            </template>
          </ElInput>
        </div>
        <div class="account-list" v-loading="accountListLoading">
          <div
            class="account-item"
            v-for="item in accountList"
            :key="item.id"
            :class="{ active: currentAccountId === item.id }"
            @click="currentAccountId = item.id"
          >
            <div class="name">{{ item.name }}</div>
          </div>
        </div>
      </div>

      <!-- 中间：手机预览 -->
      <div class="center-panel">
        <div class="mobile-frame">
          <!-- 听筒/摄像头区域 -->
          <div class="camera-island">
            <div class="speaker"></div>
            <div class="camera"></div>
          </div>

          <!-- 手机屏幕 -->
          <div class="mobile-screen">
            <!-- 微信顶部 Header -->
            <div class="wx-header">
              <div class="status-bar">
                <span>WeChat</span>
                <span>1:21 AM</span>
                <span>100%</span>
              </div>
              <div class="nav-bar">
                <div class="back">
                  <span class="icon-[ep--arrow-left]"></span> 返回
                </div>
                <div class="title">
                  {{
                    accountList.find((item) => item?.id === currentAccountId)
                      ?.name || ''
                  }}
                </div>
                <div class="user-icon">
                  <span class="icon-[ep--user]"></span>
                </div>
              </div>
            </div>

            <!-- 内容区域 -->
            <div class="wx-body"></div>

            <!-- 底部菜单 Footer -->
            <div class="wx-footer">
              <div class="keyboard-btn">
                <span class="grid-icon icon-[icomoon-free--keyboard]"></span>
                <!-- 模拟键盘图标 -->
              </div>

              <div class="menu-container">
                <div
                  class="menu-item"
                  v-for="(btn, index) in menuData.buttons"
                  :key="index"
                  :class="{ active: selectedMenuIndex === index }"
                  @click="selectMenu(index)"
                >
                  <!-- 子菜单弹出层 -->
                  <div
                    class="sub-menu-popover"
                    v-show="selectedMenuIndex === index"
                  >
                    <div class="sub-menu-list">
                      <div
                        class="sub-item"
                        v-for="(sub, subIndex) in btn.sub_button"
                        :key="subIndex"
                        :class="{ active: selectedSubMenuIndex === subIndex }"
                        @click.stop="selectSubMenu(index, subIndex)"
                      >
                        {{ sub.name }}
                      </div>
                      <!-- 加号按钮 -->
                      <div
                        class="sub-item add-btn"
                        v-if="!btn.sub_button || btn.sub_button.length < 5"
                        @click.stop="addSubMenu(index)"
                      >
                        <span class="icon-[ep--plus]"></span>
                      </div>
                    </div>
                    <div class="arrow-down"></div>
                  </div>

                  <span class="menu-txt">{{ btn.name }}</span>
                </div>

                <!-- 添加一级菜单 -->
                <div
                  class="menu-item add-btn"
                  v-if="menuData.buttons.length < 3"
                  @click="addMenu"
                >
                  <span class="icon-[ep--plus]"></span>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部 Home 键区域 -->
          <div class="home-btn-area"></div>
        </div>
      </div>

      <!-- 右侧：配置面板 -->
      <div class="right-panel">
        <!-- 空状态 -->
        <div class="empty-config" v-if="!currentMenu">
          <div class="tip-icon">
            <span class="icon-[ep--setting]"></span>
          </div>
          <p>请在左侧手机预览中点击菜单进行配置</p>
        </div>

        <!-- 配置表单 -->
        <div class="config-card" v-else>
          <div class="card-header">
            <div class="header-left">
              <div class="icon-box">
                <span class="icon-[ep--setting]"></span>
              </div>
              <div class="title-box">
                <h3>菜单配置</h3>
                <p>设置菜单名称和响应行为</p>
              </div>
            </div>
            <ElButton
              type="danger"
              plain
              size="small"
              @click="deleteCurrentMenu"
            >
              <span class="icon-[ep--delete]"></span> 删除菜单
            </ElButton>
          </div>

          <div class="card-body">
            <ElForm
              label-position="left"
              label-width="80px"
              :model="currentMenu"
            >
              <ElFormItem label="菜单名称">
                <ElInput
                  v-model="currentMenu.name"
                  placeholder="请输入菜单名称"
                  maxlength="8"
                  show-word-limit
                >
                  <template #prefix>
                    <span class="icon-[ep--edit-pen]"></span>
                  </template>
                </ElInput>
              </ElFormItem>

              <template v-if="!hasSubButtons">
                <ElFormItem label="菜单标识">
                  <ElInput
                    v-model="currentMenu.key"
                    placeholder="请输入菜单 KEY (Click事件)"
                  >
                    <template #prefix>
                      <span class="icon-[ep--key]"></span>
                    </template>
                  </ElInput>
                </ElFormItem>

                <ElFormItem label="菜单类型">
                  <ElSelect
                    v-model="currentMenu.type"
                    placeholder="请选择类型"
                    style="width: 100%"
                  >
                    <ElOption label="跳转网页 (view)" value="view" />
                    <ElOption label="发送消息 (click)" value="click" />
                    <ElOption
                      label="小程序 (miniprogram)"
                      value="miniprogram"
                    />
                    <ElOption
                      label="扫码推事件 (scancode_push)"
                      value="scancode_push"
                    />
                  </ElSelect>
                </ElFormItem>

                <div class="dynamic-form">
                  <ElFormItem
                    label="网页链接"
                    v-if="currentMenu.type === 'view'"
                  >
                    <ElInput
                      v-model="currentMenu.url"
                      placeholder="请输入链接"
                    />
                  </ElFormItem>

                  <ElFormItem
                    label="小程序ID"
                    v-if="currentMenu.type === 'miniprogram'"
                  >
                    <ElInput v-model="currentMenu.appid" placeholder="appid" />
                  </ElFormItem>
                  <ElFormItem
                    label="页面路径"
                    v-if="currentMenu.type === 'miniprogram'"
                  >
                    <ElInput
                      v-model="currentMenu.pagepath"
                      placeholder="pages/index/index"
                    />
                  </ElFormItem>
                  <ElFormItem
                    label="备用网页"
                    v-if="currentMenu.type === 'miniprogram'"
                  >
                    <ElInput
                      v-model="currentMenu.url"
                      placeholder="支持小程序的老版本客户端将打开此网页"
                    />
                  </ElFormItem>
                </div>
              </template>

              <ElAlert
                v-else
                title="已添加子菜单，当前一级菜单无法设置动作。"
                type="info"
                show-icon
                :closable="false"
              />
            </ElForm>
          </div>
        </div>
        <!-- 底部操作按钮 -->
        <div class="action-btns" v-if="currentMenu">
          <ElButton type="primary" @click="saveMenu">
            <span class="icon-[ep--check]"></span> 保存发布
          </ElButton>
          <ElButton @click="clearMenu">
            <span class="icon-[ep--delete]"></span> 清空菜单
          </ElButton>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped lang="scss">
/* 整体布局 */
.app-container {
  display: flex;
  height: 100%;
  background-color: hsl(var(--background));
  border-radius: calc(var(--radius) - 2px);
}

/* 1. 左侧面板 */
.left-panel {
  display: flex;
  flex-direction: column;
  width: 260px;
  padding: 20px;
  background: hsl(var(--background));
  border-right: 1px solid hsl(var(--border));
  border-top-left-radius: calc(var(--radius) - 2px);
  border-bottom-left-radius: calc(var(--radius) - 2px);

  .search-box {
    margin-bottom: 20px;
  }

  .account-list {
    flex: 1;
    overflow-y: auto;

    .account-item {
      padding: 12px 15px;
      margin-bottom: 5px;
      color: hsl(var(--el-text-color-primary));
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s;

      &:hover {
        background-color: hsl(var(--secondary));
      }

      &.active {
        font-weight: 500;
        color: hsl(var(--primary));
        background-color: hsl(var(--secondary));
      }
    }
  }
}

/* 2. 中间面板 */
.center-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 500px;
  padding: 40px;
  background-color: hsl(var(--background));
  border-right: 1px solid hsl(var(--border));
}

/* 拟物化手机外壳 */
.mobile-frame {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 305px;
  height: 650px;
  overflow: hidden;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 40px;
  box-shadow:
    0 0 0 10px hsl(var(--background-deep)),
    0 0 20px rgb(0 0 0 / 10%);

  /* 顶部听筒区 */
  .camera-island {
    display: flex;
    flex-shrink: 0; /* 防止被挤压 */
    gap: 15px;
    align-items: center; /* 垂直居中 */
    justify-content: center; /* 水平居中 */
    width: 100%;
    height: 40px;

    .camera {
      width: 10px;
      height: 10px;
      background: #333;
      border-radius: 50%;
    }

    .speaker {
      width: 50px;
      height: 6px;
      background: #ccc;
      border-radius: 10px;
    }
  }

  .mobile-screen {
    display: flex;
    flex: 1;
    flex-direction: column;
    background: hsl(var(--secondary));
  }

  /* 微信 Header */
  .wx-header {
    color: hsl(var(--el-text-color-primary));
    background: hsl(var(--background));
    border-bottom: 1px solid hsl(var(--border));

    .status-bar {
      display: flex;
      justify-content: space-between;
      height: 20px;
      padding: 5px 10px;
      font-size: 12px;
      opacity: 0.8;
    }

    .nav-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 44px;
      padding: 0 10px;

      .back {
        display: flex;
        align-items: center;
        font-size: 14px;
        cursor: pointer;
      }

      .title {
        font-size: 16px;
        font-weight: 500;
      }

      .user-icon {
        font-size: 16px;
      }
    }
  }

  .wx-body {
    flex: 1;

    /* 可以在这里加一些背景水印模拟 PigX Admin 的效果 */
  }

  /* 微信 Footer */
  .wx-footer {
    position: relative;
    display: flex;
    align-items: center;
    height: 50px;
    padding-left: 50px; /* 给键盘图标留位置 */
    background: hsl(var(--background));
    border-top: 1px solid hsl(var(--border));

    .keyboard-btn {
      position: absolute;
      top: 0;
      left: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 50px;
      height: 100%;
      font-size: 24px;
      color: hsl(var(--el-text-color-primary));
      border-right: 1px solid hsl(var(--border));
    }

    .menu-container {
      display: flex;
      flex: 1;
      height: 100%;

      .menu-item {
        position: relative;
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        cursor: pointer;
        user-select: none;
        border-right: 1px solid hsl(var(--border));

        &:last-child {
          border-right: none;
        }

        /* 选中状态：绿色边框 */
        &.active {
          z-index: 10;
          margin: -1px; /* 抵消边框宽度 */
          color: hsl(
            var(--primary)
          ); /* PigX 风格用蓝色，或者改成微信绿 #07c160 */

          background-color: hsl(var(--menu-item-active-background-color));
          border: 1px solid hsl(var(--primary));
        }

        &.add-btn {
          color: hsl(var(--primary));
        }

        /* 子菜单 */
        .sub-menu-popover {
          position: absolute;
          bottom: 60px;
          left: 50%;
          z-index: 20;
          width: 100%;
          min-width: 90px;
          border: 1px solid hsl(var(--border));
          border-radius: 4px;
          box-shadow: 0 2px 10px hsl(var(--border));
          transform: translateX(-50%);

          .arrow-down {
            position: absolute;
            bottom: -6px;
            left: 50%;
            width: 0;
            height: 0;
            margin-left: -6px;
            border-top: 6px solid hsl(var(--border));
            border-right: 6px solid transparent;
            border-left: 6px solid transparent;

            &::after {
              position: absolute;
              bottom: 2px;
              left: -5px;
              content: '';
              border-top: 5px solid hsl(var(--border));
              border-right: 5px solid transparent;
              border-left: 5px solid transparent;
            }
          }

          .sub-menu-list {
            .sub-item {
              height: 40px;
              line-height: 40px;
              color: hsl(var(--foreground));
              text-align: center;
              cursor: pointer;
              background: hsl(var(--background));
              border-bottom: 1px solid hsl(var(--border));

              &:last-child {
                border-bottom: none;
              }

              &:hover {
                background: hsl(var(--background-deep));
              }

              &.active {
                color: hsl(var(--primary));
                background: hsl(var(--background-deep));
              }

              &.add-btn {
                color: hsl(var(--primary));
              }
            }
          }
        }
      }
    }
  }

  /* 底部 Home 键区 */
  .home-btn-area {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 50px;
    padding-top: 5px;
    padding-bottom: 5px;
    background: hsl(var(--background));
    border-top: 1px solid hsl(var(--border));

    &::after {
      width: 40px;
      height: 40px;
      content: '';
      border: 2px solid hsl(var(--border));
      border-radius: 50%;
      opacity: 0.5;
    }
  }
}

/* 底部操作按钮 */
.action-btns {
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: center;
  margin-top: 30px;
}

/* 3. 右侧面板 */
.right-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 40px;
  background: hsl(var(--background));
  border-top-right-radius: calc(var(--radius) - 2px);
  border-bottom-right-radius: calc(var(--radius) - 2px);
}

/* 卡片样式 */
.config-card {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 hsl(var(--border));

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 1px solid hsl(var(--border));

    .header-left {
      display: flex;
      gap: 15px;

      .icon-box {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        font-size: 20px;
        background: hsl(var(--success));
        border-radius: 8px;
      }

      .title-box {
        h3 {
          margin: 0;
          font-size: 16px;
          color: hsl(var(--el-text-color-primary));
        }

        p {
          margin: 5px 0 0;
          font-size: 12px;
          color: hsl(var(--el-text-color-regular));
        }
      }
    }
  }

  .card-body {
    padding: 30px 20px;
  }
}

/* 空状态 */
.empty-config {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;

  .tip-icon {
    margin-bottom: 20px;
    font-size: 48px;
    color: #e0e0e0;
  }
}
</style>
