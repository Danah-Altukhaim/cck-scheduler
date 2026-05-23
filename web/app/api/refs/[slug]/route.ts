import { NextResponse } from 'next/server'
import { contentTypeFor, readRefDoc } from '@/lib/docs'

export const dynamic = 'force-dynamic'

export function GET(_req: Request, ctx: { params: { slug: string } }) {
  const result = readRefDoc(ctx.params.slug)
  if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { buf, doc } = result
  const inline = new URL(_req.url).searchParams.get('download') !== '1'
  // Encode filename for non-ASCII safety (Schedule Process and Rules — em-dash etc.)
  const filenameStar = `filename*=UTF-8''${encodeURIComponent(doc.file)}`
  const body = new Uint8Array(buf)
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentTypeFor(doc.file),
      'Content-Length': String(body.length),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; ${filenameStar}`,
      'Cache-Control': 'private, max-age=60',
    },
  })
}
