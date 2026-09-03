-- Migración 0002: Storage bucket y políticas RLS para evidencias fotográficas
-- Se ejecuta sobre el esquema de Supabase Storage

-- Bucket privado para evidencias (solo accesible mediante service_role o URL firmada)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidencias',
  'evidencias',
  false,
  20971520, -- 20 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Política: usuarios autenticados pueden subir a su propia carpeta
create policy "Usuarios autenticados pueden subir evidencias"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'evidencias');

-- Política: lectura solo con service_role (las URL públicas se generan firmadas desde el servidor)
create policy "Solo service_role puede leer evidencias"
  on storage.objects for select
  to service_role
  using (bucket_id = 'evidencias');
