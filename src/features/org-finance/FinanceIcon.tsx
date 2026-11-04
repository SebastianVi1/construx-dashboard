import type { SVGProps } from 'react'

/** Bar chart on a baseline: company finances. Same 24px stroke grid as `components/icons`. */
export function FinanceIcon(props: Omit<SVGProps<SVGSVGElement>, 'children'>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M3 21h18" />
      <path d="M6 17v-5M11 17V7M16 17v-8M20 17V4" />
    </svg>
  )
}
