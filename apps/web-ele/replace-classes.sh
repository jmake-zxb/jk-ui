#!/bin/bash
# MaxKB 类名批量替换为 Tailwind CSS 等价类名

cd "E:/code/java/jk/jk-ui/apps/web-ele/src/components/ai-chat"

# 定义替换映射（MaxKB → Tailwind）
# 注意：Tailwind 的数字是 0.25rem 的倍数，1 = 4px, 2 = 8px, 4 = 16px

declare -A class_map=(
  # 圆角 (border-radius)
  ["border-r-6"]="rounded-md"      # 6px → 0.375rem
  ["border-r-8"]="rounded-lg"      # 8px → 0.5rem

  # 外边距底部 (margin-bottom)
  ["mb-8"]="mb-2"                  # 8px → 0.5rem
  ["mb-12"]="mb-3"                 # 12px → 0.75rem
  ["mb-16"]="mb-4"                 # 16px → 1rem

  # 外边距右侧 (margin-right)
  ["mr-4"]="mr-1"                  # 4px → 0.25rem
  ["mr-8"]="mr-2"                  # 8px → 0.5rem
  ["mr-16"]="mr-4"                 # 16px → 1rem

  # 外边距左侧 (margin-left)
  ["ml-4"]="ml-1"                  # 4px → 0.25rem
  ["ml-8"]="ml-2"                  # 8px → 0.5rem

  # 外边距顶部 (margin-top)
  ["mt-4"]="mt-1"                  # 4px → 0.25rem
  ["mt-8"]="mt-2"                  # 8px → 0.5rem
  ["mt-12"]="mt-3"                 # 12px → 0.75rem
  ["mt-16"]="mt-4"                 # 16px → 1rem
  ["mt-24"]="mt-6"                 # 24px → 1.5rem

  # 内边距 (padding)
  ["p-8"]="p-2"                    # 8px → 0.5rem
  ["p-12"]="p-3"                   # 12px → 0.75rem
  ["p-16"]="p-4"                   # 16px → 1rem

  # 特殊内边距组合需要保留自定义
  # p-8-12 (8px 12px) → 保留自定义
  # p-12-16 (12px 16px) → 保留自定义
)

# 备份
echo "Creating backup..."
tar -czf ../ai-chat-backup-$(date +%Y%m%d_%H%M%S).tar.gz .

# 遍历所有 .vue 文件进行替换
echo "Replacing class names..."
find . -name "*.vue" -type f | while read file; do
  echo "Processing: $file"

  for old_class in "${!class_map[@]}"; do
    new_class="${class_map[$old_class]}"

    # 替换独立的类名（前后有空格或引号）
    sed -i "s/\([\"' ]\)${old_class}\([\"' ]\)/\1${new_class}\2/g" "$file"
  done
done

echo "Done! Backup saved to ../ai-chat-backup-*.tar.gz"
