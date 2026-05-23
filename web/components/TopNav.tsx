import Link from 'next/link'
import Image from 'next/image'

export function TopNav({ label }: { label: string }) {
  return (
    <header className="border-b border-cck-line bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/cck-logo.png"
            alt="Canadian College of Kuwait"
            width={1124}
            height={186}
            priority
            style={{ height: 36, width: 'auto' }}
          />
          <span
            aria-hidden
            style={{ width: 1, height: 24, background: 'var(--cck-line, #e5e7eb)' }}
          />
          <span style={{ fontWeight: 700, fontSize: 15 }}>AI Scheduler</span>
        </Link>
        <span className="badge muted">{label}</span>
        <Link href="/" className="nav-link text-cck-muted ml-auto">
          ← All schedules
        </Link>
      </div>
    </header>
  )
}
