import { SkeletonBlock, SkeletonRegion } from '../../components/page'

export function FloorPlanGallerySkeleton() {
  return (
    <SkeletonRegion>
      <ul className="floor-plan-list" aria-hidden="true">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="floor-plan-card">
            <div className="floor-plan-card__thumb"><SkeletonBlock height="100%" /></div>
            <div className="floor-plan-card__info">
              <SkeletonBlock width="75%" height={20} />
              <SkeletonBlock width="45%" height={18} />
              <div className="button-row"><SkeletonBlock width={100} height={44} /></div>
            </div>
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  )
}

export function FloorPlanWorkspaceSkeleton() {
  return (
    <SkeletonRegion className="floor-plan-workspace">
      <div className="floor-plan-toolbar" aria-hidden="true">
        <SkeletonBlock width={100} height={36} />
        <SkeletonBlock width={100} height={36} />
      </div>
      <div className="floor-plan-canvas" aria-hidden="true"><SkeletonBlock height="100%" /></div>
      <div className="zone-panel" aria-hidden="true">
        <div className="fp-panel-header"><SkeletonBlock width="70%" height={24} /></div>
        <PanelSkeleton kind="pins" />
      </div>
    </SkeletonRegion>
  )
}

/** Preserve each panel's own row height, thumbnail size, and wrapping rules. */
export function PanelSkeleton({ kind }: { kind: 'roster' | 'pins' | 'audit' | 'assignments' }) {
  const listClass = kind === 'pins' ? 'pin-list__items' : kind === 'audit' ? 'audit-list' : kind === 'assignments' ? 'assignment-list' : 'assignment-panel__list'
  const rowClass = kind === 'pins' ? 'pin-row' : kind === 'audit' ? 'audit-list__item' : kind === 'assignments' ? 'assignment-list__item' : 'assignment-chip'
  return (
    <SkeletonRegion>
      <ul className={listClass} aria-hidden="true" style={{ listStyle: 'none' }}>
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className={rowClass}>
            {kind === 'assignments' ? <>
              <div className="assignment-list__info"><SkeletonBlock width="75%" height={32} /></div>
              <div className="assignment-list__actions"><SkeletonBlock height={36} /></div>
            </> : <>
              <SkeletonBlock width={kind === 'audit' ? 60 : kind === 'pins' ? 44 : 32} height={kind === 'audit' ? 24 : kind === 'pins' ? 44 : 32} />
              <span className={kind === 'pins' ? 'pin-row__text' : 'assignment-chip__text'} style={{ flex: 1, width: '100%' }}>
                <SkeletonBlock width="80%" height={18} />
                <SkeletonBlock width="55%" height={14} />
              </span>
            </>}
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  )
}
