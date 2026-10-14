'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from 'cn';
import { GripVertical, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';

import { useCustomCollectionMutations, useCustomCollections } from '@fanste/collection';
import { MAX_CUSTOM_COLLECTIONS } from '@fanste/core';

import { isNavItemActive } from '@/components/app-shell/nav-items';
import { CollectionIcon } from '@/components/items/collection-icon';
import { Button } from '@/components/ui/button';

import { CollectionDialog } from './collection-dialog';
import { collectionHref, movedOrder } from './collection-view';

import type { DragEndEvent, Modifier } from '@dnd-kit/core';
import type { CustomCollection } from '@fanste/core';

/**
 * Keeps a dragged collection on the vertical axis and inside its list, so dragging never makes the
 * list (or the sidebar) overflow and scroll sideways or past its ends.
 */
const restrictToList: Modifier = ({ transform, draggingNodeRect, containerNodeRect }) => {
  if (!draggingNodeRect || !containerNodeRect) return { ...transform, x: 0 };
  const minY = containerNodeRect.top - draggingNodeRect.top;
  const maxY = containerNodeRect.bottom - draggingNodeRect.bottom;
  return { ...transform, x: 0, y: Math.min(Math.max(transform.y, minY), maxY) };
};

/**
 * "My collections" in the sidebar (FC-13): the user's custom collections in their order, with
 * "New collection". Drag a collection by its handle to reorder; the handle also works with the
 * keyboard (Space to pick up, arrows to move, Space to drop).
 */
export function SidebarCollections() {
  const router = useRouter();
  const collections = useCustomCollections();
  const { reorder } = useCustomCollectionMutations();
  const [creating, setCreating] = useState(false);
  // A stable id, so the server and client render the same accessibility attributes.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const listRef = useRef<HTMLUListElement>(null);
  const list = collections.data ?? [];
  const full = list.length >= MAX_CUSTOM_COLLECTIONS;

  function dragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    reorder.mutate(movedOrder(list, String(active.id), String(over.id)));
  }

  return (
    <section aria-labelledby="sidebar-collections" className="flex min-h-0 flex-col gap-1">
      <div className="flex items-center justify-between px-3">
        <h2 id="sidebar-collections" className="text-caption font-medium text-muted-foreground">
          My collections
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="New collection"
          title={full ? `You can have at most ${MAX_CUSTOM_COLLECTIONS} collections.` : undefined}
          disabled={full}
          onClick={() => setCreating(true)}
        >
          <Plus aria-hidden />
        </Button>
      </div>
      {collections.isSuccess && list.length === 0 && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md px-3 py-2 text-left text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Collect something else? Create a collection for it.
        </button>
      )}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToList]}
        // Only a long list scrolls while dragging; the sidebar and the page stay put.
        autoScroll={{ canScroll: (element) => element === listRef.current }}
        onDragEnd={dragEnd}
      >
        <SortableContext items={list.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul
            ref={listRef}
            className="flex min-h-0 flex-col gap-1 overflow-x-hidden overflow-y-auto"
          >
            {list.map((collection) => (
              <SortableCollection key={collection.id} collection={collection} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <CollectionDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(created) => router.push(collectionHref(created.id))}
      />
    </section>
  );
}

function SortableCollection({ collection }: { collection: CustomCollection }) {
  const pathname = usePathname();
  const href = collectionHref(collection.id);
  const active = isNavItemActive(href, pathname);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: collection.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('group relative flex items-center', isDragging && 'z-10 opacity-80')}
    >
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 rounded-md py-2 pr-8 pl-3 text-sm font-medium transition-colors outline-none',
          'text-muted-foreground hover:bg-muted hover:text-foreground',
          'focus-visible:ring-3 focus-visible:ring-ring/50',
          active && 'bg-muted text-foreground',
        )}
      >
        <CollectionIcon icon={collection.icon} className="size-4 shrink-0" />
        <span className="truncate">{collection.name}</span>
      </Link>
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${collection.name}`}
        className={cn(
          'absolute right-1 flex size-6 cursor-grab touch-none items-center justify-center rounded text-muted-foreground outline-none',
          'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50',
          isDragging && 'cursor-grabbing opacity-100',
        )}
      >
        <GripVertical aria-hidden className="size-4" />
      </button>
    </li>
  );
}
