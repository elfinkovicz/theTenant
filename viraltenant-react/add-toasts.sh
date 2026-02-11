#!/bin/bash

# Script to add toast imports to all files that need them
# This adds: import { toast } from '../utils/toast-alert';

files=(
  "src/components/VideoEditModal.tsx"
  "src/components/VideoUploadModal.tsx"
  "src/components/PodcastEditModal.tsx"
  "src/components/PodcastUploadModal.tsx"
  "src/components/EventModal.tsx"
  "src/components/ProductModal.tsx"
  "src/components/NewsfeedModal.tsx"
  "src/components/TeamMemberModal.tsx"
  "src/components/ShopSettingsModal.tsx"
  "src/components/PageSettingsModal.tsx"
  "src/components/BannerManagement.tsx"
  "src/components/CategoryModal.tsx"
  "src/pages/Videos.tsx"
  "src/pages/Podcasts.tsx"
  "src/pages/Shop.tsx"
  "src/pages/Team.tsx"
  "src/pages/Tenant.tsx"
  "src/pages/CustomPage.tsx"
  "src/pages/Live.tsx"
  "src/pages/Contact.tsx"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    # Add import if not already present
    if ! grep -q "import { toast } from" "$file"; then
      # Find the last import line and add after it
      sed -i "/^import.*from/a import { toast } from '../utils/toast-alert';" "$file" 2>/dev/null || \
      sed -i '' "/^import.*from/a\\
import { toast } from '../utils/toast-alert';
" "$file"
    fi
  fi
done

echo "Done! Toast imports added to all files."
