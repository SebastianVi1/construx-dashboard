import { SkeletonBlock, SkeletonRegion, SkeletonTable } from '../../components/page'

function SectionHeadingSkeleton() {
  return <div className="page-section__header">
    <div className="page-header__text"><SkeletonBlock width={180} height={28} /><SkeletonBlock width={240} height={20} /></div>
  </div>
}

export function FinanceChartSkeleton() {
  return <SkeletonRegion className="org-burn__body">
    <SkeletonBlock width="70%" height={18} />
    <SkeletonBlock height={220} />
    <SkeletonBlock width="85%" height={18} />
  </SkeletonRegion>
}

export function FinanceDashboardSkeleton() {
  return <div className="page-section skeleton-screen">
    <SkeletonRegion className="org-kpis">
      {Array.from({ length: 4 }, (_, i) => <div className="org-kpis__item" key={i}>
        <SkeletonBlock width="65%" height={18} />
        <SkeletonBlock width="85%" height={30} />
        <SkeletonBlock width="75%" height={18} />
      </div>)}
    </SkeletonRegion>
    <div className="page-section"><SectionHeadingSkeleton /><SkeletonTable columns={6} /></div>
    <div className="org-finance__charts">
      <div className="page-section org-panel"><SectionHeadingSkeleton /><FinanceChartSkeleton /></div>
      <div className="page-section org-panel">
        <SectionHeadingSkeleton />
        <SkeletonRegion className="org-category__body">
          <div className="org-category__donut"><SkeletonBlock height={200} className="skeleton-avatar" /></div>
          <SkeletonBlock height={80} />
        </SkeletonRegion>
      </div>
    </div>
  </div>
}
