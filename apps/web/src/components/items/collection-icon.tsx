import {
  BookOpen,
  Blocks,
  Box,
  Camera,
  CarFront,
  Coins,
  Footprints,
  Gem,
  Glasses,
  Guitar,
  Heart,
  Leaf,
  Library,
  Medal,
  Package,
  Palette,
  Plane,
  Puzzle,
  Shapes,
  Shirt,
  Stamp,
  Star,
  Swords,
  ToyBrick,
  TrainFront,
  Trophy,
  Watch,
  Wine,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';

import type { CustomCollectionIcon } from '@fanste/core';

// Exhaustive, so a new icon name in `@fanste/core` fails the typecheck until it's mapped here.
export const COLLECTION_ICONS: Record<CustomCollectionIcon, LucideIcon> = {
  shapes: Shapes,
  'toy-brick': ToyBrick,
  blocks: Blocks,
  'book-open': BookOpen,
  library: Library,
  coins: Coins,
  gem: Gem,
  stamp: Stamp,
  footprints: Footprints,
  shirt: Shirt,
  watch: Watch,
  glasses: Glasses,
  'car-front': CarFront,
  plane: Plane,
  'train-front': TrainFront,
  trophy: Trophy,
  medal: Medal,
  camera: Camera,
  palette: Palette,
  guitar: Guitar,
  puzzle: Puzzle,
  swords: Swords,
  wine: Wine,
  leaf: Leaf,
  star: Star,
  heart: Heart,
  package: Package,
  box: Box,
};

interface CollectionIconProps extends LucideProps {
  icon: CustomCollectionIcon;
}

/** A custom collection's icon (FC-13). Decorative (`aria-hidden`) unless you pass an `aria-label`. */
export function CollectionIcon({ icon, ...props }: CollectionIconProps) {
  const Icon = COLLECTION_ICONS[icon];
  return <Icon aria-hidden={props['aria-label'] ? undefined : true} {...props} />;
}
