import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PlanItemRow } from './PlanItemRow';
import type { PlanItem } from './types';

type SortablePlanListProps = {
  items: PlanItem[];
  onEdit: (id: string, text: string) => Promise<void>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (ids: string[]) => void;
};

type SortableRowProps = Pick<SortablePlanListProps, 'onEdit' | 'onToggle' | 'onDelete'> & {
  item: PlanItem;
};

function SortableRow({ item, onEdit, onToggle, onDelete }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: item.done });

  return (
    <div ref={setNodeRef}>
      <PlanItemRow
        item={item}
        dragAttributes={attributes}
        dragListeners={listeners}
        dragDisabled={item.done}
        isDragging={isDragging}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
        }}
      />
    </div>
  );
}

export function SortablePlanList({ items, onEdit, onToggle, onDelete, onReorder }: SortablePlanListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const ids = items.map((item) => item.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    onReorder(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="plan-list">
          {items.map((item) => (
            <SortableRow key={item.id} item={item} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
