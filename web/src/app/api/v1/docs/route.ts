import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const openapiPath = path.join(process.cwd(), '..', 'docs', 'openapi.json')
  let openapiSpec = {}

  if (fs.existsSync(openapiPath)) {
    openapiSpec = JSON.parse(fs.readFileSync(openapiPath, 'utf-8'))
  }

  const html = `<!doctype html>
<html>
  <head>
    <title>Slowvan Radar API v1 — Documentación Oficial</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220%22%3E<text y=%2226%22 font-size=%2226%22>🚐</text></svg>">
  </head>
  <body>
    <script
      id="api-reference"
      type="application/json"
    >${JSON.stringify(openapiSpec)}</script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
