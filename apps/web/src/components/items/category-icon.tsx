import {
  Dices,
  Disc3,
  Film,
  Gamepad2,
  Shapes,
  Tv,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';

import { CATEGORY_META } from '@fanste/core';

import type { CategoryIconName, ItemCategory } from '@fanste/core';

// Exhaustive, so a new icon name in `@fanste/core` fails the typecheck until it's mapped here.
const ICONS: Record<CategoryIconName, LucideIcon> = {
  film: Film,
  tv: Tv,
  'disc-3': Disc3,
  'gamepad-2': Gamepad2,
  dices: Dices,
  shapes: Shapes,
};

interface CategoryIconProps extends LucideProps {
  category: ItemCategory;
}

/** The category's icon. Decorative (`aria-hidden`) unless you pass an `aria-label`. */
export function CategoryIcon({ category, ...props }: CategoryIconProps) {
  const Icon = ICONS[CATEGORY_META[category].icon];
  return <Icon aria-hidden={props['aria-label'] ? undefined : true} {...props} />;
}
