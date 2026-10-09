import { cn } from 'cn';

import { categoryLabel } from '@fanste/core';

import { Badge } from '@/components/ui/badge';

import { CategoryIcon } from './category-icon';
import { categoryClasses } from './category-style';

import type { ItemCategory } from '@fanste/core';

interface CategoryBadgeProps {
  category: ItemCategory;
  /** Shows only the icon; the label stays available to screen readers. */
  iconOnly?: boolean;
  className?: string;
}

/** The item's category with its icon and accent color. */
export function CategoryBadge({ category, iconOnly = false, className }: CategoryBadgeProps) {
  const label = categoryLabel(category);
  return (
    <Badge
      variant="secondary"
      className={cn(categoryClasses(category).soft, iconOnly && 'px-1.5', className)}
      title={iconOnly ? label : undefined}
    >
      <CategoryIcon category={category} />
      <span className={cn(iconOnly && 'sr-only')}>{label}</span>
    </Badge>
  );
}
