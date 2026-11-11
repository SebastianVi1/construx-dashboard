import { SkeletonBlock, SkeletonRegion } from '../../components/page'

export function SitesGridSkeleton() {
  return <SkeletonRegion className="sites-grid">
    {Array.from({ length: 3 }, (_, i) => <div className="site-card" key={i}>
      <div className="site-card__header"><SkeletonBlock width={88} height={22} /></div>
      <div className="site-card__name"><SkeletonBlock width="72%" height={26} /></div>
      <div className="site-card__address"><SkeletonBlock width="88%" height={20} /></div>
      <div className="site-card__footer"><SkeletonBlock width="65%" height={20} /></div>
    </div>)}
  </SkeletonRegion>
}

export function BudgetOverviewSkeleton() {
  return <SkeletonRegion className="budget-overview">
    <div className="budget-figures">
      <dl>{Array.from({ length: 5 }, (_, i) => <div key={i}>
        <dt><SkeletonBlock width="60%" height={18} /></dt>
        <dd className="budget-figures__value"><SkeletonBlock width="80%" height={i === 4 ? 30 : 22} /></dd>
      </div>)}</dl>
      <p className="budget-figures__note"><SkeletonBlock height={18} /></p>
    </div>
    <div className="budget-chart">
      <SkeletonBlock width="55%" height={18} />
      <div className="budget-chart__plot"><SkeletonBlock height={20} /></div>
      <SkeletonBlock width="70%" height={18} />
    </div>
  </SkeletonRegion>
}

export function SiteTeamSkeleton() {
  return <SkeletonRegion className="site-team__roster">
    {Array.from({ length: 4 }, (_, i) => <div className="site-team__person" key={i}>
      <SkeletonBlock width={32} height={32} />
      <div className="page-header__text" style={{ flex: 1 }}>
        <SkeletonBlock width="75%" height={20} /><SkeletonBlock width="50%" height={16} />
      </div>
    </div>)}
  </SkeletonRegion>
}

export function SiteDetailSkeleton() {
  return <>
    <SkeletonRegion className="site-sheet">
      <div className="page-header__text">
        <div className="site-sheet__status"><SkeletonBlock width={88} height={22} /></div>
        <SkeletonBlock width="55%" height={36} />
        <SkeletonBlock width="75%" height={22} />
      </div>
      <dl className="site-sheet__facts">{Array.from({ length: 3 }, (_, i) => <div key={i}>
        <dt><SkeletonBlock width={90} height={18} /></dt>
        <dd><SkeletonBlock width={150} height={22} /></dd>
      </div>)}</dl>
    </SkeletonRegion>
    {/* The tab strip is a sibling of the sheet, as in the loaded page. */}
    <div className="filter-tabs" aria-hidden="true">
      {[64, 56, 48, 44, 72].map((width, i) => <span className="filter-tabs__tab" key={i}>
        <SkeletonBlock width={width} height={18} />
      </span>)}
    </div>
  </>
}
