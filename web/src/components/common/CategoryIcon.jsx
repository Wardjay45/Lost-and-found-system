import { TagIcon } from '@heroicons/react/24/outline';

export const CATEGORY_ICON_OPTIONS = [
  { value: 'tag', label: 'Minimal outline', Icon: TagIcon },
];

// Keep the data contract for older category records, but render one quiet
// icon consistently across the panel and mobile-created reports.
export function getCategoryIconKey() { return 'tag'; }

export default function CategoryIcon({ className = 'h-7 w-7', ...props }) {
  const cleanProps = { ...props };
  delete cleanProps.icon;
  delete cleanProps.categoryName;
  return <TagIcon className={className} aria-hidden="true" {...cleanProps} />;
}
