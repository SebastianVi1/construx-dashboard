import { formatMessage, useLocale } from '../../i18n'
import type { Pin, PinFilters, PinKind } from './pinsApi'
import type { Zone } from './zonesApi'
import { pinVariant } from './pinForm'

export type PinListFilters = PinFilters & { showClosed: boolean }

interface PinListPanelProps {
  /** Pins already narrowed by the filters. */
  pins: Pin[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  zones: Zone[]
  filters: PinListFilters
  onFiltersChange: (filters: PinListFilters) => void
  onSelect: (pin: Pin) => void
  onRetry: () => void
}

const KINDS: Array<PinKind | undefined> = [undefined, 'ISSUE', 'PHOTO']

/** The plan's pins as a list with filters; choosing one opens it and centres the plan on it. */
export function PinListPanel({ pins, status, zones, filters, onFiltersChange, onSelect, onRetry }: PinListPanelProps) {
  const { messages: m } = useLocale()
  const t = m.floorPlans.pins
  const filtered = Boolean(filters.kind || filters.assignee || filters.zoneId)
  const kindLabel = (kind: PinKind | undefined) =>
    kind === 'ISSUE' ? t.filterIssues : kind === 'PHOTO' ? t.filterPhotos : t.filterAll

  return (
    <aside className="zone-panel pin-list" aria-label={t.listTitle}>
      <div className="fp-panel-header">
        <h2 className="fp-panel-header__title">{t.listTitle}</h2>
        <p className="fp-panel-header__hint">{t.listHint}</p>
      </div>

      <div className="fp-segmented" role="group" aria-label={t.filterKind}>
        {KINDS.map((kind) => (
          <button
            key={kind ?? 'all'}
            type="button"
            className="fp-segmented__option"
            aria-pressed={filters.kind === kind}
            onClick={() => onFiltersChange({ ...filters, kind })}
          >
            {kindLabel(kind)}
          </button>
        ))}
      </div>

      <div className="pin-list__filters">
        <label className="pin-list__check">
          <input
            type="checkbox"
            checked={filters.assignee === 'me'}
            onChange={(e) => onFiltersChange({ ...filters, assignee: e.target.checked ? 'me' : undefined })}
          />
          {t.filterMine}
        </label>
        <label className="pin-list__check">
          <input
            type="checkbox"
            checked={filters.showClosed}
            onChange={(e) => onFiltersChange({ ...filters, showClosed: e.target.checked })}
          />
          {t.filterClosed}
        </label>
        {zones.length > 0 ? (
          <select
            className="form-field__control zone-panel__select"
            aria-label={t.filterZone}
            value={filters.zoneId ?? ''}
            onChange={(e) => onFiltersChange({ ...filters, zoneId: e.target.value || undefined })}
          >
            <option value="">{t.filterAnyZone}</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {status === 'error' ? (
        <div role="alert">
          <p className="error-text">{t.loadError}</p>
          <button type="button" className="button button--small" onClick={onRetry}>
            {m.floorPlans.retry}
          </button>
        </div>
      ) : status === 'loading' && pins.length === 0 ? (
        <p className="zone-panel__loading">{m.floorPlans.audit.loading}</p>
      ) : pins.length === 0 ? (
        <p className="zone-panel__empty">{filtered || !filters.showClosed ? t.listEmptyFiltered : t.listEmpty}</p>
      ) : (
        <ul className="pin-list__items">
          {pins.map((pin) => (
            <li key={pin.id}>
              <button type="button" className="pin-row" onClick={() => onSelect(pin)}>
                {pin.coverUrl ? (
                  <img className="pin-row__thumb" src={pin.coverUrl} alt="" loading="lazy" />
                ) : (
                  <span className={`pin-row__thumb pin-row__thumb--empty plan-pin--${pinVariant(pin)}`} aria-hidden />
                )}
                <span className="pin-row__text">
                  <span className="pin-row__title">{pin.title ?? t.untitledPhoto}</span>
                  <span className="pin-row__meta">
                    {pin.kind === 'ISSUE' && pin.status ? (
                      <span className={`pin-status pin-status--${pin.status.toLowerCase()}`}>{t.status[pin.status]}</span>
                    ) : (
                      <span>{t.kind.PHOTO}</span>
                    )}
                    {pin.zoneName ? <span>{pin.zoneName}</span> : null}
                    {pin.assignee?.fullName ? <span>{pin.assignee.fullName}</span> : null}
                    {pin.photoCount > 0 ? (
                      <span>
                        {formatMessage(pin.photoCount === 1 ? t.photoCount.one : t.photoCount.other, {
                          count: pin.photoCount,
                        })}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
