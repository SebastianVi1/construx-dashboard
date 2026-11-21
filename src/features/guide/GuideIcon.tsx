import type { SVGProps } from 'react'

/** A compass: finding your way around. Decorative; a visible label always sits beside it. */
export function GuideIcon(props: Omit<SVGProps<SVGSVGElement>, 'children'>) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5Z" />
    </svg>
  )
}
