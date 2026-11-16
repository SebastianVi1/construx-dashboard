import { SkeletonBlock, SkeletonRegion, SkeletonRows, SkeletonTable } from '../../components/page'

export function TaskBoardSkeleton({ columns = 3 }: { columns?: number }) {
  return <SkeletonRegion>
    <div className="task-board skeleton-screen" data-columns={columns}>
      {Array.from({ length: columns }, (_, i) => <div className="task-column" key={i}>
        <div className="task-column__title"><SkeletonBlock width="60%" height={18} /></div>
        <div className="task-list">{Array.from({ length: 5 }, (_, j) => <div className="task-item" key={j}>
          <div className="task-item__name"><SkeletonBlock width="80%" height={20} /></div>
          <div className="task-item__meta"><SkeletonBlock width="65%" height={18} /></div>
          <div className="task-item__actions"><SkeletonBlock width="45%" height={24} /></div>
        </div>)}</div>
      </div>)}
    </div>
  </SkeletonRegion>
}

function TaskMoneySkeleton() {
  return <div className="task-money">{Array.from({ length: 3 }, (_, i) => <div className="task-money__figure" key={i}>
    <SkeletonBlock width={90} height={18} />
    <SkeletonBlock width="65%" height={24} />
  </div>)}</div>
}

export function TaskDetailSkeleton() {
  return <>
    <div className="task-sheet site-sheet">
      <div className="task-sheet__top">
        <SkeletonBlock width={210} height={18} />
      </div>
      <div className="task-sheet__heading">
        <SkeletonBlock width="58%" height={38} />
        <div className="task-sheet__actions"><SkeletonBlock width={168} height={44} /></div>
      </div>
      <div className="site-sheet__facts">{Array.from({ length: 3 }, (_, i) => <div key={i}>
        <SkeletonBlock width={64} height={18} />
        <SkeletonBlock width={112} height={20} />
      </div>)}</div>
    </div>
    <div className="task-detail__body">
      <div className="task-detail__main">
        <SkeletonRegion>
          <SkeletonBlock width={148} height={28} />
          <SkeletonBlock width="72%" height={18} />
        </SkeletonRegion>
        <TaskMoneySkeleton />
        <SkeletonTable columns={4} compact />
      </div>
      <div className="task-detail__aside">
        <SkeletonRegion>
          <SkeletonBlock width={90} height={28} />
          <SkeletonRows avatar rows={2} />
        </SkeletonRegion>
      </div>
    </div>
  </>
}

export function TaskSpendingSkeleton({ canManage }: { canManage: boolean }) {
  return <>
    <SkeletonRegion>
      <SkeletonBlock width={148} height={28} />
      <SkeletonBlock width="72%" height={18} />
    </SkeletonRegion>
    <TaskMoneySkeleton />
    <SkeletonTable columns={canManage ? 5 : 4} compact />
  </>
}
