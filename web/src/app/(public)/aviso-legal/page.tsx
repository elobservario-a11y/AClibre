import fs from 'fs'
import path from 'path'

export const metadata = { title: 'Aviso Legal — Slowvan' }

export default function AvisoLegalPage() {
  const filePath = path.join(process.cwd(), '..', 'docs', 'aviso_legal.md')
  const content = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, 'utf-8')
    : 'Aviso legal en elaboración.'

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <article className="prose prose-orange max-w-none text-gray-700 whitespace-pre-wrap font-sans text-sm leading-relaxed">
          {content}
        </article>
      </div>
    </main>
  )
}
