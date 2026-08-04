import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Career OS',
  description: 'Система развития профессиональных компетенций',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ru"><body style={{ margin: 0 }}>{children}</body></html>
}
