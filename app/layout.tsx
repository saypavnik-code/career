import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'
const isUserSite = repository.endsWith('.github.io')
const basePath = isGitHubActions && repository && !isUserSite ? `/${repository}` : ''

export const metadata: Metadata = {
  title: {
    default: 'Эскада',
    template: '%s · Эскада',
  },
  description: 'Персональная система профессионального роста: идеи, работа, wins и отчёты.',
  applicationName: 'Эскада',
  icons: { apple: `${basePath}/icons/apple-touch-icon.png` },
  appleWebApp: {
    capable: true,
    title: 'Эскада',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f7f8fc',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ru"><body style={{ margin: 0 }}>{children}</body></html>
}
