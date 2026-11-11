import { SkeletonBlock, SkeletonRegion } from '../../components/page'

export function DocumentFoldersSkeleton() {
  return (
    <SkeletonRegion>
      <ul className="document-folders-grid skeleton-screen" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="document-folder-card-item">
            <div className="document-folder-card">
              <SkeletonBlock width={40} height={40} />
              <SkeletonBlock width="75%" height={20} />
              <SkeletonBlock width="40%" height={16} />
            </div>
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  )
}

export function DocumentEntriesSkeleton({ search = false }: { search?: boolean } = {}) {
  return (
    <SkeletonRegion className="document-entries-list skeleton-screen">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="document-entry" aria-hidden="true">
          <span className="document-entry__name"><SkeletonBlock width="75%" height={20} /></span>
          <span className="document-entry__meta"><SkeletonBlock width={110} height={16} /></span>
          {!search ? <div className="document-entry__actions"><SkeletonBlock width={100} height={36} /></div> : null}
        </div>
      ))}
    </SkeletonRegion>
  )
}
