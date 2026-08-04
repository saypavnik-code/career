import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: {
    default: 'Эскада',
    template: '%s · Эскада',
  },
  description: 'Персональная система профессионального роста: идеи, работа, wins и отчёты.',
  applicationName: 'Эскада',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ru"><body style={{ margin: 0 }}>{children}</body></html>
}
