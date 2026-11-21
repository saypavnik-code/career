'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

type Option<Value extends string> = { value: Value; label: string }

export function Listbox<Value extends string>({ label, value, options, onChange, variant = 'field' }: {
  label: string
  variant?: 'field' | 'status'
  value: Value
  options: readonly Option<Value>[]
  onChange: (value: Value) => void
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const search = useRef({ text: '', time: 0 })
  const [placement, setPlacement] = useState<CSSProperties | null>(null)
  const [active, setActive] = useState(0)
  const selected = options.findIndex((option) => option.value === value)
  const open = placement !== null

  const reposition = useCallback(() => {
    const anchor = trigger.current
    if (!anchor) return
    const box = anchor.getBoundingClientRect()
    if (box.bottom <= 0 || box.top >= window.innerHeight) {
      setPlacement(null)
      return
    }
    const below = window.innerHeight - box.bottom - 12
    const above = box.top - 12
    const upward = below < Math.min(260, options.length * (window.matchMedia('(pointer: coarse)').matches ? 40 : 32) + 8) && above > below
    const width = Math.min(Math.max(box.width, 192), window.innerWidth - 16)
    setPlacement({
      width,
      left: Math.max(8, Math.min(box.left, window.innerWidth - width - 8)),
      top: upward ? undefined : box.bottom + 5,
      bottom: upward ? window.innerHeight - box.top + 5 : undefined,
      maxHeight: Math.min(280, Math.max(48, upward ? above : below)),
    })
  }, [options.length])

  function show(index = Math.max(selected, 0)) {
    setActive(index)
    reposition()
  }

  function choose(index: number) {
    setPlacement(null)
    const option = options[index]
    if (option && option.value !== value) onChange(option.value)
  }

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (!trigger.current?.contains(event.target) && !popup.current?.contains(event.target)) setPlacement(null)
    }
    window.addEventListener('pointerdown', closeOutside)
    window.addEventListener('resize', reposition)
    const onScroll = (event: Event) => {
      if (!(event.target instanceof Node) || !popup.current?.contains(event.target)) reposition()
    }
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('pointerdown', closeOutside)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, reposition])

  useEffect(() => {
    if (!open || !popup.current) return
    const row = popup.current.children[active] as HTMLElement | undefined
    if (!row) return
    const menu = popup.current.getBoundingClientRect()
    const bounds = row.getBoundingClientRect()
    if (bounds.top < menu.top) popup.current.scrollTop -= menu.top - bounds.top
    if (bounds.bottom > menu.bottom) popup.current.scrollTop += bounds.bottom - menu.bottom
  }, [active, open])

  function handleKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.altKey || event.metaKey || event.ctrlKey) return
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault()
        if (!open) show()
        else setActive((index) => Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
        break
      }
      case 'Home':
      case 'End':
        event.preventDefault()
        show(event.key === 'Home' ? 0 : options.length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (open) choose(active)
        else show()
        break
      case 'Escape':
        if (open) {
          event.preventDefault()
          event.stopPropagation()
          setPlacement(null)
        }
        break
      case 'Tab':
        if (open) choose(active)
        break
      default: {
        if (event.key.length !== 1) break
        const now = Date.now()
        const letter = event.key.toLocaleLowerCase('ru')
        let text = now - search.current.time < 550 ? search.current.text + letter : letter
        let index = options.findIndex((option) => option.label.toLocaleLowerCase('ru').startsWith(text))
        if (index < 0 && text !== letter) {
          text = letter
          index = options.findIndex((option) => option.label.toLocaleLowerCase('ru').startsWith(text))
        }
        search.current = { text, time: now }
        if (index >= 0) {
          event.preventDefault()
          show(index)
        }
      }
    }
  }

  return (
    <>
      <button ref={trigger} className="escada-listbox-trigger" data-variant={variant} data-status={variant === 'status' ? value : undefined} type="button" role="combobox" aria-label={label}
        aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="listbox"
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => { if (open) setPlacement(null); else show() }} onKeyDown={handleKey}
        onBlur={() => setPlacement(null)}>
        {variant === 'status' && <i className="escada-status-dot" aria-hidden="true" />}
        <span>{options[selected]?.label}</span><Icon name="chevron" />
      </button>
      {placement && createPortal(
        <div ref={popup} id={id} className="escada-listbox-popup" role="listbox" aria-label={label} style={placement}>
          {options.map((option, index) => (
            <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={index === selected} data-status={variant === 'status' ? option.value : undefined}
              data-active={index === active} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
              {variant === 'status' && <i className="escada-status-dot" aria-hidden="true" />}
              <span>{option.label}</span>{index === selected && <Icon name="check" />}
            </div>
          ))}
        </div>, document.body,
      )}
    </>
  )
}
