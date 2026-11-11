type IconProps = { className?: string }

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** A measuring rule: setting the plan's scale. */
export function ScaleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 17 17 3l4 4L7 21z" />
      <path d="m7 13 2 2M10 10l2 2M13 7l2 2" />
    </svg>
  )
}

/** An irregular outline with corner points: drawing a free-form zone. */
export function PolygonIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 8 12 3l7 6-3 11H7z" />
      <circle cx="5" cy="8" r="1.5" fill="currentColor" />
      <circle cx="12" cy="3" r="1.5" fill="currentColor" />
      <circle cx="19" cy="9" r="1.5" fill="currentColor" />
    </svg>
  )
}

export function RectangleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="6" width="16" height="12" rx="1" />
    </svg>
  )
}

/** A map pin: marking an issue or a photo on the plan. */
export function PinIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  )
}
