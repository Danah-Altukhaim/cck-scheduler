import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CCK AI Scheduler',
  description: 'Academic schedule planning for CCK',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
