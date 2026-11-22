import { afterEach, beforeEach } from 'bun:test'
import { subscribeGuideSteps, type GuideMark } from '../../features/guide/guideEvents'

/** The guide step marks made during each test of the calling file; empty at the start of every test. */
export function recordGuideMarks(): GuideMark[] {
  const marks: GuideMark[] = []
  let stop = () => {}
  beforeEach(() => {
    marks.length = 0
    stop = subscribeGuideSteps((mark) => marks.push(mark))
  })
  afterEach(() => stop())
  return marks
}
