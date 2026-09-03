import fs from 'fs'
import path from 'path'

export const metadata = { title: 'Cómo se decide aquí — Slowvan' }

export default function ComoSeDecidePage() {
  const filePath = path.join(process.cwd(), '..', 'docs', 'como_se_decide_aqui.md')
  const content = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, 'utf-8')
    : 'Criterios de decisión en elaboración.'

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
