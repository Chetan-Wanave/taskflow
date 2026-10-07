// Custom 1.5px-stroke inline SVG icons. No emoji, no icon font.

import type { SVGProps } from 'react'

function base(props: SVGProps<SVGSVGElement>, size = 16): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  }
}

export function IconPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  )
}

export function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.25 10.25 13.5 13.5" />
    </svg>
  )
}

export function IconCalendar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="2" />
      <path d="M2.25 6.5h11.5M5.5 1.75v3M10.5 1.75v3" />
    </svg>
  )
}

export function IconFlag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 14V2.5c2.8-1.4 5.4 1.4 8.2 0V9c-2.8 1.4-5.4-1.4-8.2 0" />
    </svg>
  )
}

export function IconTag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 7.2V3.5a1 1 0 0 1 1-1h3.7a1 1 0 0 1 .7.3l5.6 5.6a1 1 0 0 1 0 1.4l-3.7 3.7a1 1 0 0 1-1.4 0L2.8 7.9a1 1 0 0 1-.3-.7Z" />
      <circle cx="5.75" cy="5.75" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M2.75 4.25h10.5M6.25 2.25h3.5M4 4.25l.6 8.6a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.6M6.5 7v4M9.5 7v4" />
    </svg>
  )
}

export function IconPencil(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="m9.7 3.2 3.1 3.1-7.2 7.2-3.4.3.3-3.4Z" />
      <path d="m8.5 4.4 3.1 3.1" />
    </svg>
  )
}

export function IconX(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="m4 4 8 8M12 4l-8 8" />
    </svg>
  )
}

export function IconChevronLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M9.75 3.5 5.25 8l4.5 4.5" />
    </svg>
  )
}

export function IconChevronRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="m6.25 3.5 4.5 4.5-4.5 4.5" />
    </svg>
  )
}

export function IconSun(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M12.6 3.4l-1.06 1.06M4.46 11.54 3.4 12.6" />
    </svg>
  )
}

export function IconMoon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M13.5 9.5A5.75 5.75 0 0 1 6.5 2.5a5.75 5.75 0 1 0 7 7Z" />
    </svg>
  )
}

export function IconMonitor(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="3" width="12" height="8.5" rx="1.5" />
      <path d="M6 14h4M8 11.5V14" />
    </svg>
  )
}

export function IconDownload(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M8 2.5v7.5M4.75 7 8 10.25 11.25 7M2.75 13.25h10.5" />
    </svg>
  )
}

export function IconUpload(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M8 10.5V3M4.75 6.25 8 3l3.25 3.25M2.75 13.25h10.5" />
    </svg>
  )
}

/** 44px soft-circle check used by the all-clear empty state. */
export function IconCircleCheckLarge(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={44}
      height={44}
      viewBox="0 0 44 44"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <circle cx="22" cy="22" r="17" opacity="0.5" />
      <path d="m15.5 22.5 4.5 4.5 8.5-9.5" />
    </svg>
  )
}
