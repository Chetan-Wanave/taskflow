import type { Modifier } from '@dnd-kit/core'

/** Keep dragged rows on the vertical axis (list is a single column). */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
})
