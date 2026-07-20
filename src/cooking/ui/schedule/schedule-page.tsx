import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { useTRPC } from '#/integrations/trpc/react'
import { ErrorState, LoadingState } from '../shared-states'
import { ShortfallFlag } from './shortfall-flag'
import { SlotSheet } from './slot-sheet'
import {
  addDays,
  currentWeekStart,
  dayLabel,
  isPastDay,
  isToday,
  weekRangeLabel,
} from '#/cooking/schedule/date-utils'
import type { MealSlot, SlotAssignment } from '#/cooking/server/schedule/types'

export function SchedulePage() {
  const trpc = useTRPC()
  const [weekStart, setWeekStart] = useState(currentWeekStart())
  const [selected, setSelected] = useState<MealSlot | null>(null)

  const weekQuery = useQuery(trpc.schedule.getWeek.queryOptions({ weekStart }))

  const todayRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (weekQuery.data && !weekQuery.data.readonly) {
      todayRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [weekQuery.data])

  const nextWeekStart = addDays(currentWeekStart(), 7)
  const canGoForward = weekStart < nextWeekStart
  const inCurrentWeek = weekStart === currentWeekStart()

  if (weekQuery.isLoading) return <LoadingState />
  if (weekQuery.error) {
    return (
      <ErrorState
        title="Couldn't load your schedule"
        message={weekQuery.error.message}
        onRetry={() => weekQuery.refetch()}
      />
    )
  }

  const week = weekQuery.data

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Schedule
          </h1>
          <p className="text-sm text-muted-foreground">
            {week?.readonly ? 'Browsing a past week — read only.' : 'Plan your week, one slot at a time.'}
          </p>
        </div>
      </header>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous week"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 text-center">
          <p className="font-medium">{weekRangeLabel(weekStart)}</p>
          {!inCurrentWeek && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setWeekStart(currentWeekStart())}
            >
              Back to this week
            </button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next week"
          disabled={!canGoForward}
          onClick={() => setWeekStart(addDays(weekStart, 7))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-4">
        {week?.days.map((day) => {
          const today = isToday(day.date)
          const past = isPastDay(day.date)
          return (
            <section
              key={day.date}
              ref={today ? todayRef : undefined}
              className={
                past && !today
                  ? 'opacity-60 transition-opacity'
                  : 'transition-opacity'
              }
            >
              <div className="mb-2 flex items-baseline gap-2">
                <span
                  className={`text-sm font-semibold ${
                    today ? 'text-primary' : ''
                  }`}
                >
                  {dayLabel(day.date).weekday}
                </span>
                <span className="text-xs text-muted-foreground">
                  {dayLabel(day.date).month} {dayLabel(day.date).day}
                </span>
                {today && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    Today
                  </span>
                )}
              </div>
              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                <SlotRow
                  label="Lunch"
                  slot={day.lunch}
                  readonly={week.readonly}
                  onOpen={() => setSelected(day.lunch)}
                />
                <SlotRow
                  label="Dinner"
                  slot={day.dinner}
                  readonly={week.readonly}
                  onOpen={() => setSelected(day.dinner)}
                />
              </div>
            </section>
          )
        })}
      </div>

      <SlotSheet slot={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  )
}

function SlotRow({
  label,
  slot,
  readonly,
  onOpen,
}: {
  label: string
  slot: MealSlot
  readonly: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={readonly ? undefined : onOpen}
      disabled={readonly}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
    >
      <span className="w-14 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <SlotContent assignment={slot.assignment} />
      </div>
      {slot.shortfall != null && slot.shortfall > 0 && (
        <ShortfallFlag count={slot.shortfall} className="shrink-0" />
      )}
    </button>
  )
}

function SlotContent({ assignment }: { assignment: SlotAssignment | null }) {
  if (!assignment) {
    return <span className="text-sm text-muted-foreground">Not planned</span>
  }
  if (assignment.type === 'recipe') {
    return (
      <span className="block">
        <span className="block truncate text-sm font-medium">
          {assignment.recipeName ?? 'Recipe'}
        </span>
      </span>
    )
  }
  if (assignment.type === 'adhoc') {
    return (
      <span className="block truncate text-sm font-medium">
        {assignment.adhocName?.trim() ? assignment.adhocName : 'Ad-hoc meal'}
      </span>
    )
  }
  if (assignment.type === 'nocook') {
    return <span className="text-sm italic text-muted-foreground">No cook</span>
  }
  return <span className="text-sm text-muted-foreground">From the Food Bank</span>
}
