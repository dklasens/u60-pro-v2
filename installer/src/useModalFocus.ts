import { useEffect, useRef } from 'react'

/** Keyboard containment and focus restoration for all installer dialogs. */
export function useModalFocus(active: boolean, close: () => void) {
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    if (!active) return
    const previous = document.activeElement as HTMLElement | null
    const dialog = document.querySelector<HTMLElement>('[role="alertdialog"], [role="dialog"]')
    if (!dialog) return
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, a[href], [tabindex="0"]'))
    dialog.tabIndex = -1
    const focusFirst = () => (controls()[0] ?? dialog).focus()
    focusFirst()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const items = controls()
      const first = items[0] ?? dialog, last = items.at(-1) ?? dialog
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus() }
    }
    const focusin = (event: FocusEvent) => { if (!dialog.contains(event.target as Node)) focusFirst() }
    document.addEventListener('keydown', keydown)
    document.addEventListener('focusin', focusin)
    return () => { document.removeEventListener('keydown', keydown); document.removeEventListener('focusin', focusin); previous?.focus() }
  }, [active])
}
