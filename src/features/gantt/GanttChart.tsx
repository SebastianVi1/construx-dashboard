import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { FilterTabs } from '../../components/filter'
import { formatMessage, intlLocales, useLocale } from '../../i18n'
import type { Goal } from '../goals/goalsApi'
import {
  clampPhaseResize,
  clampTaskMove,
  clampTaskResize,
  createClickGuard,
  pxToDays,
  shiftInstant,
  type Edge,
} from './drag'
import type { GanttRow, PhaseRow, TaskRow } from './ganttRows'
import {
  barPosition,
  buildRange,
  chartWidth,
  endsAfterSite,
  siteWindow,
  ticks,
  xOf,
  zooms,
  type Dated,
  type SiteDates,
  type Zoom,
} from './timeline'
import { barInk } from './barColor'
import './gantt.css'

/** What a finished drag asks the page to save. */
export type Reschedule =
  | { kind: 'task'; row: TaskRow; startAt: string; dueAt: string }
  | { kind: 'shift'; row: PhaseRow; days: number }
  | { kind: 'phase'; row: PhaseRow; startAt: string; dueAt: string }

type GanttChartProps = {
  rows: GanttRow[]
  site: SiteDates
  today: Date
  /** MANAGE_ACTIVITY and ASSIGN_ACTIVITY: each phase row offers "Add task". */
  canAddTask: boolean
  /** The viewer may open this bar's edit dialog. */
  canOpen: (row: GanttRow) => boolean
  onAddTask: (goal: Goal) => void
  onOpen: (row: GanttRow) => void
  /** Saves the new dates; the bar holds its preview until it settles, then follows the data. */
  onReschedule: (change: Reschedule) => Promise<void>
  /** The page's primary action, shown at the end of the toolbar. */
  action?: ReactNode
}

type Mode = 'move' | Edge

type Drag = { row: GanttRow; mode: Mode; originX: number; days: number; moved: boolean; pending: boolean }

/** Pointer travel below this is a click, not a drag. */
const CLICK_SLOP_PX = 4

/** Days the drag really moves, after the same clamps the server applies. */
function clampedDays(row: GanttRow, mode: Mode, days: number): number {
  if (row.kind === 'task') {
    return mode === 'move' ? clampTaskMove(row, row.goal, days) : clampTaskResize(row, row.goal, mode, days)
  }
  return mode === 'move' ? days : clampPhaseResize(row, row.tasks, mode, days)
}

/** Dates a row shows while a drag is in progress; tasks follow a moved phase. */
function previewDates(row: GanttRow, drag: Drag | null): Dated {
  const dates = { startAt: row.startAt, dueAt: row.dueAt }
  if (!drag || drag.days === 0) return dates
  const followsPhase = drag.row.kind === 'phase' && drag.mode === 'move' && row.kind === 'task' && row.goal.id === drag.row.id
  if (drag.row.id !== row.id && !followsPhase) return dates
  const mode = followsPhase ? 'move' : drag.mode
  return {
    startAt: mode === 'end' ? dates.startAt : shiftInstant(dates.startAt, drag.days),
    dueAt: mode === 'start' ? dates.dueAt : shiftInstant(dates.dueAt, drag.days),
  }
}

/**
 * The schedule of a site: one bold row per phase with its tasks beneath, bars
 * from start day to due day. Managers drag a bar to move it and its ends to
 * change one date, snapped to days; a click (or Enter) opens its dialog.
 */
export function GanttChart({
  rows,
  site,
  today,
  canAddTask,
  canOpen,
  onAddTask,
  onOpen,
  onReschedule,
  action,
}: GanttChartProps) {
  const { messages: m, locale } = useLocale()
  const t = m.gantt
  const intl = intlLocales[locale]
  const [zoom, setZoom] = useState<Zoom>('week')
  const [drag, setDrag] = useState<Drag | null>(null)
  const clicks = useRef(createClickGuard())

  const range = buildRange(
    rows.filter((row) => row.kind === 'phase'),
    site,
    today,
  )
  const width = chartWidth(range, zoom)
  const frame = siteWindow(site, range, zoom)
  const todayX = xOf(today.getTime(), range, zoom)
  const dayFormat = new Intl.DateTimeFormat(intl, { month: 'short', day: 'numeric', year: 'numeric' })
  const dayText = (instant: string) => dayFormat.format(new Date(instant))
  const canDragAny = rows.some((row) => row.canDrag)

  function pointerDown(event: PointerEvent<HTMLElement>, row: GanttRow) {
    if (!row.canDrag || event.button !== 0 || drag?.pending) return
    clicks.current.press()
    const edge = (event.target as HTMLElement).dataset.edge as Edge | undefined
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ row, mode: edge ?? 'move', originX: event.clientX, days: 0, moved: false, pending: false })
  }

  function pointerMove(event: PointerEvent<HTMLElement>) {
    if (!drag || drag.pending) return
    const dx = event.clientX - drag.originX
    const moved = drag.moved || Math.abs(dx) > CLICK_SLOP_PX
    setDrag({ ...drag, moved, days: clampedDays(drag.row, drag.mode, pxToDays(dx, zoom)) })
  }

  async function pointerUp() {
    if (!drag || drag.pending) return
    if (!drag.moved) {
      setDrag(null)
      return
    }
    clicks.current.dragged()
    if (drag.days === 0) {
      setDrag(null)
      return
    }
    setDrag({ ...drag, pending: true })
    const dates = previewDates(drag.row, drag)
    const row = drag.row
    try {
      if (row.kind === 'task') await onReschedule({ kind: 'task', row, ...dates })
      else if (drag.mode === 'move') await onReschedule({ kind: 'shift', row, days: drag.days })
      else await onReschedule({ kind: 'phase', row, ...dates })
    } finally {
      setDrag(null)
    }
  }

  function click(row: GanttRow, detail: number) {
    if (clicks.current.swallow(detail)) return
    if (canOpen(row)) onOpen(row)
  }

  function bar(row: GanttRow) {
    const dates = previewDates(row, drag)
    const position = barPosition(dates.startAt, dates.dueAt, range, zoom)
    const label =
      row.kind === 'phase'
        ? formatMessage(t.phaseBar, { name: row.label, start: dayText(dates.startAt), due: dayText(dates.dueAt) })
        : formatMessage(t.taskBar, {
            name: row.label,
            status: m.tasks.status[row.status],
            start: dayText(dates.startAt),
            due: dayText(dates.dueAt),
          })
    const active = drag?.row.id === row.id
    const color = row.kind === 'phase' ? row.goal.color : row.task.color
    const style = { left: position.left, width: position.width, '--bar-color': color ?? undefined } as CSSProperties
    const data = {
      'data-ink': color ? barInk(color) : undefined,
      'data-kind': row.kind,
      'data-status': row.kind === 'task' ? row.status : row.goal.completed ? 'DONE' : undefined,
      'data-late': row.kind === 'phase' && endsAfterSite(dates, site) ? 'true' : undefined,
      'data-draggable': row.canDrag ? 'true' : undefined,
      'data-active': active && drag?.moved ? 'true' : undefined,
      'data-pending': active && drag?.pending ? 'true' : undefined,
    }
    const content = (
      <>
        {row.kind === 'task' ? (
          <span className="gantt__bar-text">
            {row.status === 'DONE' ? <span className="gantt__done-mark">✓</span> : null}
            {row.label}
          </span>
        ) : null}
        {row.canDrag ? (
          <>
            <span className="gantt__handle" data-edge="start" />
            <span className="gantt__handle" data-edge="end" />
          </>
        ) : null}
        {active && drag?.moved ? (
          <span className="gantt__drag-tag data-mono">
            {dayText(dates.startAt)} – {dayText(dates.dueAt)}
          </span>
        ) : null}
      </>
    )
    if (!row.canDrag && !canOpen(row)) {
      return (
        <span className="gantt__bar" style={style} {...data} tabIndex={0} role="img" aria-label={label} title={label}>
          {content}
        </span>
      )
    }
    return (
      <button
        type="button"
        className="gantt__bar"
        style={style}
        {...data}
        aria-label={label}
        title={label}
        onPointerDown={(event) => pointerDown(event, row)}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={() => setDrag(null)}
        onClick={(event) => click(row, event.detail)}
      >
        {content}
      </button>
    )
  }

  const sheetStyle = { '--gantt-width': `${width}px` } as CSSProperties
  const gridTicks = ticks(range, zoom, intl)

  return (
    <div className="gantt">
      <div className="gantt__toolbar">
        <FilterTabs
          label={t.zoomLabel}
          options={zooms.map((value) => ({ value, label: t.zoom[value] }))}
          value={zoom}
          onChange={setZoom}
        />
        {action}
      </div>

      <ul className="gantt__legend" aria-label={t.legendLabel}>
        <li>
          <span className="gantt__swatch" data-kind="phase" aria-hidden="true" />
          {t.phase}
        </li>
        {(['TODO', 'IN_PROGRESS', 'DONE'] as const).map((status) => (
          <li key={status}>
            <span className="gantt__swatch" data-kind="task" data-status={status} aria-hidden="true">
              {status === 'DONE' ? '✓' : null}
            </span>
            {m.tasks.status[status]}
          </li>
        ))}
        {frame ? (
          <li>
            <span className="gantt__swatch" data-kind="frame" aria-hidden="true" />
            {t.siteWindow}
          </li>
        ) : null}
        <li>
          <span className="gantt__swatch" data-kind="today" aria-hidden="true" />
          {t.today}
        </li>
      </ul>
      <p className="gantt__hint">{canDragAny ? `${t.manageHint} ${t.colorHint}` : t.viewHint}</p>

      <div className="gantt__scroll">
        <div className="gantt__sheet" style={sheetStyle}>
          <div className="gantt__head">
            <div className="gantt__corner">{t.nameColumn}</div>
            <div className="gantt__scale" aria-hidden="true">
              {gridTicks.map((tick) => (
                <span key={tick.left} className="gantt__tick data-mono" style={{ left: tick.left }}>
                  {tick.label}
                </span>
              ))}
              {frame && site.startDate ? (
                <span className="gantt__flag" data-edge="start" style={{ left: frame.left }}>
                  {t.siteStart}
                </span>
              ) : null}
              {frame && site.expectedEndDate ? (
                <span className="gantt__flag" data-edge="end" style={{ left: frame.left + frame.width }}>
                  {t.siteEnd}
                </span>
              ) : null}
              <span className="gantt__flag" data-edge="today" style={{ left: todayX }}>
                {t.today}
              </span>
            </div>
          </div>

          <div className="gantt__body">
            <div className="gantt__plot" aria-hidden="true">
              {gridTicks.map((tick) => (
                <span key={tick.left} className="gantt__gridline" style={{ left: tick.left }} />
              ))}
              {frame ? <span className="gantt__window" style={{ left: frame.left, width: frame.width }} /> : null}
              <span className="gantt__today" style={{ left: todayX }} />
            </div>
            <ol className="gantt__rows">
              {rows.map((row) => (
                <li key={`${row.kind}-${row.id}`} className="gantt__row" data-kind={row.kind}>
                  <div className="gantt__name">
                    <span className="gantt__label" title={row.label}>
                      {row.label}
                    </span>
                    {row.kind === 'phase' && endsAfterSite(row, site) ? (
                      <span
                        className="badge"
                        data-tone="warning"
                        title={formatMessage(t.endsAfterSiteLabel, { name: row.label })}
                      >
                        {t.endsAfterSite}
                      </span>
                    ) : null}
                    {row.kind === 'phase' && canAddTask ? (
                      <button
                        type="button"
                        className="task-link gantt__add"
                        aria-label={formatMessage(m.tasks.addLabel, { phase: row.label })}
                        onClick={() => onAddTask(row.goal)}
                      >
                        + {m.tasks.add}
                      </button>
                    ) : null}
                  </div>
                  <div className="gantt__track">{bar(row)}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
