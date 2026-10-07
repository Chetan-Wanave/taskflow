import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from './restrictToVerticalAxis'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { IconCircleCheckLarge } from '../../components/icons'
import { Kbd } from '../../components/Kbd'
import { useAppStore } from '../../store/useAppStore'
import { selectVisibleTasks } from '../../store/selectors'
import { TaskRow } from './TaskRow'
import styles from './TaskList.module.css'

export function TaskList() {
  const tasks = useAppStore((s) => s.tasks)
  const filter = useAppStore((s) => s.filter)
  const search = useAppStore((s) => s.search)
  const tagFilterId = useAppStore((s) => s.tagFilterId)
  const tags = useAppStore((s) => s.tags)
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const setSearch = useAppStore((s) => s.setSearch)
  const moveTask = useAppStore((s) => s.moveTask)

  const visible = selectVisibleTasks({ tasks, tags, filter, search, tagFilterId })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      void moveTask(String(active.id), String(over.id))
    }
  }

  if (visible.length === 0) {
    return <ListEmptyState hasTasks={tasks.length > 0} search={search} onClearSearch={() => setSearch('')} />
  }

  const tabStopId =
    selectedTaskId !== null && visible.some((t) => t.id === selectedTaskId)
      ? selectedTaskId
      : visible[0].id

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={visible.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className={styles.list} aria-label="Tasks">
          {visible.map((task) => (
            <TaskRow key={task.id} task={task} isTabStop={task.id === tabStopId} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function ListEmptyState({
  hasTasks,
  search,
  onClearSearch,
}: {
  hasTasks: boolean
  search: string
  onClearSearch: () => void
}) {
  const filter = useAppStore((s) => s.filter)

  if (search.trim().length > 0) {
    return (
      <EmptyState
        title={`No matches for “${search.trim()}”`}
        action={
          <Button variant="ghost" onClick={onClearSearch}>
            Clear search
          </Button>
        }
      />
    )
  }

  if (!hasTasks) {
    return (
      <EmptyState
        title={
          <>
            Press <Kbd>N</Kbd> or type below to add your first task
          </>
        }
        subtitle="Tasks stay on this device until you connect the API."
      />
    )
  }

  if (filter === 'completed') {
    return (
      <EmptyState
        title="Nothing completed yet."
        subtitle="Finished tasks land here — go check something off."
      />
    )
  }

  return (
    <EmptyState
      icon={<IconCircleCheckLarge />}
      title="All clear."
      subtitle="Nothing due — take a breath."
    />
  )
}
