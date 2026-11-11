import { SkeletonBlock, SkeletonRegion } from '../../components/page'

export function PlanGridSkeleton() {
  return (
    <SkeletonRegion>
      <ul className="site-plans__grid skeleton-screen" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="plan-card">
            <div className="plan-card__thumb"><SkeletonBlock height="100%" /></div>
            <SkeletonBlock width="75%" height={20} />
            <SkeletonBlock width="50%" height={16} />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  )
}
