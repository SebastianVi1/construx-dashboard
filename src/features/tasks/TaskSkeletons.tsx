import { SkeletonBlock, SkeletonRegion, SkeletonRows, SkeletonTable } from '../../components/page'

export function TaskBoardSkeleton({ columns = 3 }: { columns?: number }) {
  return <SkeletonRegion>
    <div className="task-board" data-columns={columns}>
      {Array.from({ length: columns }, (_, i) => <div className="task-column" key={i}>
        <div className="task-column__title"><SkeletonBlock width="60%" height={18} /></div>
        <div className="task-list">{Array.from({ length: 2 }, (_, j) => <div className="task-item" key={j}>
          <div className="task-item__name"><SkeletonBlock width="80%" height={20} /></div>
          <div className="task-item__meta"><SkeletonBlock width="65%" height={18} /></div>
          <div className="task-item__actions"><SkeletonBlock width="45%" height={24} /></div>
        </div>)}</div>
      </div>)}
    </div>
  </SkeletonRegion>
}

export function TaskFactsSkeleton({ count = 6 }: { count?: number }) {
  return <SkeletonRegion>
    <dl className="task-detail__facts">{Array.from({ length: count }, (_, i) => <div key={i}>
      <dt><SkeletonBlock width="50%" height={20} /></dt>
      <dd><SkeletonBlock width="75%" height={22} /></dd>
    </div>)}</dl>
  </SkeletonRegion>
}

export function TaskDetailSkeleton() {
  return <div className="page-section">
    <SkeletonRegion className="page-header__text">
      <SkeletonBlock width="50%" height={36} /><SkeletonBlock width={90} height={22} />
    </SkeletonRegion>
    <div className="page-section">
      <SkeletonBlock width="75%" height={22} />
      <TaskFactsSkeleton count={4} />
    </div>
    <div className="page-section">
      <SkeletonBlock width={180} height={28} />
      <SkeletonRows avatar rows={3} />
    </div>
  </div>
}

export function TaskSpendingSkeleton({ canManage }: { canManage: boolean }) {
  return <div className="page-section">
    <TaskFactsSkeleton count={3} />
    <SkeletonTable columns={canManage ? 5 : 4} compact />
  </div>
}
