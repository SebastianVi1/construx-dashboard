import { SkeletonBlock, SkeletonRegion } from '../../components/page'
import './crews.css'

export function CrewSkeleton() {
  return <SkeletonRegion>
    <ul className="crews-list" aria-hidden="true">
      {Array.from({ length: 3 }, (_, i) => <li className="crew-card" key={i}>
        <div className="crew-card__header">
          <div className="page-header__text">
            <SkeletonBlock height={24} width="65%" />
            <SkeletonBlock height={16} width="35%" />
          </div>
          <SkeletonBlock width={72} height={28} />
        </div>
        <div className="crew-members"><SkeletonBlock width={120} height={30} /><SkeletonBlock width={100} height={30} /></div>
        <SkeletonBlock height={44} />
      </li>)}
    </ul>
  </SkeletonRegion>
}

/** Stands in for the whole crews section, header included, while the member list loads. */
export function CrewsSectionSkeleton() {
  return <section className="page-section">
    <div className="page-section__header">
      <div className="page-header__text">
        <SkeletonBlock width={140} height={28} />
        <SkeletonBlock width="min(360px, 70vw)" height={20} />
      </div>
      <SkeletonBlock width={128} height={44} />
    </div>
    <CrewSkeleton />
  </section>
}
