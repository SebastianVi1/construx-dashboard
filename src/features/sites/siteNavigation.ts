const tabs = ['overview', 'details', 'list', 'gantt', 'plans', 'reports'] as const
export type SiteTab = typeof tabs[number]

export function siteTab(params: URLSearchParams): SiteTab {
  return tabs.find((tab) => tab === params.get('tab')) ?? 'overview'
}

export function siteTabSearch(params: URLSearchParams, tab: SiteTab): URLSearchParams {
  const next = new URLSearchParams(params)
  next.set('tab', tab)
  return next
}

export function siteSectionUrl(siteId: string, tab: SiteTab, anchor?: string): string {
  return `/sites/${encodeURIComponent(siteId)}?tab=${tab}${anchor ? `#${encodeURIComponent(anchor)}` : ''}`
}
