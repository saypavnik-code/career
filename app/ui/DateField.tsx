import { useId, useRef } from 'react'
import { Icon } from './Icon'

export function DateField({ label, value, onChange }: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="escada-date-field">
      <label htmlFor={id}>{label}</label>
      <div>
        <input id={id} ref={input} type="date" value={value} onChange={(event) => onChange(event.target.value)} />
        <button type="button" aria-label={`Календарь · ${label}`} onClick={() => {
          const field = input.current
          field?.focus()
          try { field?.showPicker?.() } catch { /* The field stays focused for keyboard entry in embedded previews. */ }
        }}>
          <Icon name="calendar" />
        </button>
      </div>
    </div>
  )
}
