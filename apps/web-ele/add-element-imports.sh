#!/bin/bash
# 为 ai-chat 组件添加 Element Plus 导入

cd "E:/code/java/jk/jk-ui/apps/web-ele/src/components/ai-chat"

for file in $(find . -name "*.vue"); do
  # 检查是否使用了 el- 组件但没有导入 element-plus
  if grep -q '<el-' "$file" && ! grep -q "from 'element-plus'" "$file"; then
    echo "Processing: $file"

    # 提取使用的组件
    components=$(grep -oP '<el-[a-z-]+' "$file" | sed 's/<el-/El/' | sed 's/-\([a-z]\)/\U\1/g' | sort -u | tr '\n' ',' | sed 's/,$//')

    # 查找 script setup 标签的位置
    if grep -q '<script setup' "$file"; then
      # 在第一个 import 语句之前添加 Element Plus 导入
      sed -i "/<script setup/a import { $components } from 'element-plus'" "$file"
    elif grep -q '<script' "$file"; then
      sed -i "/<script/a import { $components } from 'element-plus'" "$file"
    fi
  fi
done

echo "Done!"
