export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      {/* Hero */}
      <div className="mb-12 text-center">
        <span className="text-6xl">🚐</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900">
          Las ordenanzas que prohíben tu vehículo vivienda,{' '}
          <span className="text-orange-500">documentadas y combatidas.</span>
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Slowvan detecta automáticamente las normativas municipales que restringen el caravaning
          en España. Los datos son abiertos. La acción es tuya.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="/reportar"
            className="rounded-xl bg-orange-500 px-6 py-3 font-bold text-white shadow hover:bg-orange-600"
          >
            📍 Reportar incidencia
          </a>
          <a
            href="/mapa"
            className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 hover:border-orange-300"
          >
            🗺️ Ver el mapa
          </a>
        </div>
      </div>

      {/* Cómo funciona */}
      <section className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            emoji: '📡',
            titulo: 'Radar normativo',
            desc: 'Monitorizamos los 52 boletines provinciales. Si un ayuntamiento aprueba una ordenanza que te afecta, lo sabrás antes de que entre en vigor.',
          },
          {
            emoji: '📸',
            titulo: 'Incidencias verificadas',
            desc: 'Las señales ilegales, las multas sin base y los desalojos injustificados tienen que quedar registrados con foto, fecha y ubicación.',
          },
          {
            emoji: '✍️',
            titulo: 'Acción administrativa',
            desc: 'El sistema prepara la alegación o el escrito. Tú lo firmas y lo presentas en el registro del ayuntamiento. La responsabilidad es tuya, el trabajo es nuestro.',
          },
        ].map((item) => (
          <div key={item.titulo} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <span className="text-3xl">{item.emoji}</span>
            <h3 className="mt-3 font-bold text-gray-900">{item.titulo}</h3>
            <p className="mt-2 text-sm text-gray-600">{item.desc}</p>
          </div>
        ))}
      </section>

      {/* Transparencia */}
      <section className="rounded-2xl border border-orange-100 bg-orange-50 p-6">
        <h2 className="font-bold text-gray-900">Esto es un proyecto personal, con nombre y apellidos.</h2>
        <p className="mt-2 text-sm text-gray-700">
          Slowvan lo lleva Jose Montero. El código es público y está bajo licencia AGPL-3.0. Los datos
          se publican en abierto. Las decisiones sobre qué es estratégico y qué no están documentadas
          en la página{' '}
          <a href="/como-se-decide" className="font-semibold text-orange-600 underline">
            Cómo se decide aquí
          </a>.
        </p>
      </section>
    </main>
  )
}
