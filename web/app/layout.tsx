import './globals.css'
import type { Metadata } from 'next'
import { ToastProvider } from '@/components/ui'

export const metadata: Metadata = {
  title: 'CCK AI Scheduler',
  description: 'Academic schedule planning for the Canadian College of Kuwait.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
