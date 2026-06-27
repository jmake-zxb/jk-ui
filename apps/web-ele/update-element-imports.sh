#!/bin/bash
# 为 ai-chat 组件批量添加 Element Plus 导入

cd "E:/code/java/jk/jk-ui/apps/web-ele/src/components/ai-chat"

# 完整的 Element Plus 组件列表
IMPORTS="ElAvatar, ElButton, ElButtonGroup, ElCard, ElCheckTag, ElCheckbox, ElCheckboxGroup, ElCol, ElDialog, ElDivider, ElDrawer, ElDropdown, ElDropdownItem, ElDropdownMenu, ElForm, ElFormItem, ElIcon, ElImage, ElInput, ElOption, ElPopover, ElRow, ElScrollbar, ElSelect, ElSpace, ElText, ElTooltip, ElUpload, ElCollapse, ElCollapseItem"

# 遍历所有 Vue 文件
find . -name "*.vue" -type f | while read file; do
  # 检查是否使用了 el- 组件
  if grep -q '<el-' "$file"; then
    # 检查是否已经有 element-plus 导入
    if grep -q "from 'element-plus'" "$file"; then
      # 替换现有的导入为完整导入
      sed -i "s/import { [^}]* } from 'element-plus'/import { $IMPORTS } from 'element-plus'/" "$file"
      echo "Updated: $file"
    else
      # 如果有 <script setup，在其后添加导入
      if grep -q '<script setup' "$file"; then
        sed -i "/<script setup/a import { $IMPORTS } from 'element-plus'" "$file"
        echo "Added import to: $file"
      fi
    fi
  fi
done

echo "Done!"
