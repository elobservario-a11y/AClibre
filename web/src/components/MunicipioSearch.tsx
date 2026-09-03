'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function MunicipioSearch({
  value,
  onChange,
}: {
  value: { codigo_ine: string; nombre: string; provincia: string } | null
  onChange: (m: { codigo_ine: string; nombre: string; provincia: string } | null) => void
}) {
  const [query, setQuery] = useState(value?.nombre ?? '')
  const [results, setResults] = useState<
    { codigo_ine: string; nombre: string; provincia: string }[]
  >([])
  const [open, setOpen] = useState(false)
  const supabase = createClient()

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([])
        setOpen(false)
        return
      }
      const { data } = await supabase
        .from('municipios')
        .select('codigo_ine, nombre, provincia')
        .ilike('nombre', `${q}%`)
        .order('nombre')
        .limit(10)
      setResults(data ?? [])
      setOpen(true)
    },
    [supabase]
  )

  return (
    <div className="relative">
      <input
        type="text"
        autoComplete="off"
        placeholder="Nombre del municipio"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange(null)
          search(e.target.value)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
        required
        aria-label="Municipio"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {results.map((m) => (
            <li
              key={m.codigo_ine}
              onMouseDown={() => {
                onChange(m)
                setQuery(`${m.nombre} (${m.provincia})`)
                setOpen(false)
              }}
              className="cursor-pointer px-4 py-3 text-sm hover:bg-orange-50"
            >
              <span className="font-medium">{m.nombre}</span>
              <span className="ml-2 text-gray-400">{m.provincia}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
