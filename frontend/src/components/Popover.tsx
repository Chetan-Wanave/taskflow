import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../lib/classnames'
import styles from './Popover.module.css'

interface PopoverProps {
  anchor: HTMLElement | null
  open: boolean
  onClose: () => void
  children: ReactNode
  width?: number
  align?: 'start' | 'end'
  className?: string
  labelledBy?: string
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Popover({
  anchor,
  open,
  onClose,
  children,
  width = 320,
  align = 'start',
  className,
  labelledBy,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPos(null)
      return
    }
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      const panelH = panelRef.current?.offsetHeight ?? 320
      let left = align === 'end' ? rect.right - width : rect.left
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
      let top = rect.bottom + 6
      if (top + panelH > window.innerHeight - 8) {
        top = Math.max(8, rect.top - panelH - 6)
      }
      setPos({ top, left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchor, width, align])

  // Initial focus — once per open, never on re-render. Keyed on `open` and
  // `placed` only: consumers pass a fresh onClose on every render, and re-running
  // this on that would yank focus out of whatever the user is typing in. It must
  // wait for `placed` because the panel is visibility:hidden until positioned,
  // and browsers ignore .focus() on hidden elements. `placed` flips once per
  // open (pos resets to null on close), so resize/scroll never re-trigger it.
  const placed = pos !== null
  useLayoutEffect(() => {
    if (!open || !placed) return
    const panel = panelRef.current
    if (!panel) return
    const first = panel.querySelector<HTMLElement>('[data-autofocus]') ??
      panel.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel).focus()
  }, [open, placed])

  // Outside-click dismissal. onClose stays in deps on purpose: consumers close
  // over draft state (e.g. the Notes draft), so a stale closure would commit
  // stale values. Re-subscribing a document listener never moves focus.
  useLayoutEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if (anchor?.contains(target)) return
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open, anchor, onClose])

  if (!open) return null

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      anchor?.focus()
      return
    }
    if (event.key === 'Tab') {
      // Focus trap: cycle within the panel.
      const panel = panelRef.current
      if (!panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className={cx(styles.popover, className)}
      style={{
        width,
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        visibility: pos ? 'visible' : 'hidden',
      }}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>,
    document.body,
  )
}
