import { SkeletonBlock, SkeletonRegion } from '../../components/page'

export function PhaseListSkeleton() {
  return <SkeletonRegion className="phase-timeline">
    {Array.from({ length: 6 }, (_, i) => <div className="phase" key={i}>
      <div className="phase__rail"><span className="phase__node" /></div>
      <div className="phase__body">
        <div className="phase__header">
          <div className="phase__title" style={{ width: '65%' }}>
            <SkeletonBlock width="70%" height={24} />
            <SkeletonBlock height={20} />
          </div>
          <SkeletonBlock width={80} height={24} />
        </div>
      </div>
    </div>)}
  </SkeletonRegion>
}

/** Whole phases page while the site loads: header, view tabs, then the chart. */
export function PhasesPageSkeleton() {
  return <>
    <div className="page-header">
      <div className="page-header__text">
        <SkeletonBlock width="min(320px, 60vw)" height={36} />
        <SkeletonBlock width="min(420px, 80vw)" height={22} />
      </div>
    </div>
    <div className="filter-tabs" aria-hidden="true">
      {[64, 40].map((width, i) => <span className="filter-tabs__tab" key={i}>
        <SkeletonBlock width={width} height={18} />
      </span>)}
    </div>
    <ScheduleSkeleton />
  </>
}

export function ScheduleSkeleton() {
  return <SkeletonRegion className="gantt">
    <div className="gantt__toolbar"><SkeletonBlock width={220} height={36} /></div>
    <ul className="gantt__legend" aria-hidden="true">
      {[66, 54, 58, 50, 44].map((width, i) => <li key={i}><SkeletonBlock width={width} height={16} /></li>)}
    </ul>
    <p className="gantt__hint"><SkeletonBlock width="min(520px, 80%)" height={16} /></p>
    <div className="gantt__scroll">
      <div className="gantt__sheet gantt__sheet--skeleton">
        <div className="gantt__head">
          <div className="gantt__corner"><SkeletonBlock width="70%" height={18} /></div>
          <SkeletonBlock height={48} />
        </div>
        {Array.from({ length: 10 }, (_, i) => <div className="gantt__row" data-kind={i % 3 === 0 ? 'phase' : 'task'} key={i}>
          <div className="gantt__name"><SkeletonBlock width="75%" height={18} /></div>
          <div className="gantt__name" style={{ paddingLeft: `${24 + (i % 3) * 80}px` }}><SkeletonBlock width="45%" height={18} /></div>
        </div>)}
      </div>
    </div>
  </SkeletonRegion>
}
