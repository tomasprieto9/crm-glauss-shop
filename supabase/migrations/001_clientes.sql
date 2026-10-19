create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text not null unique,          -- formato E.164, ej. +5492214383399
  segmento text not null check (segmento in ('cliente','no_compro','publicidad','comercio','comercio_prospecto')),
  zona text check (zona in ('la_plata','amba','interior','exterior')),
  notas text,
  nombre_original text,                   -- cómo estaba agendado en el celular
  consentimiento text not null default 'sin_definir' check (consentimiento in ('sin_definir','si','no')),
  edad_verificada boolean not null default false,
  estado_campana text not null default 'pendiente' check (estado_campana in ('pendiente','escrito','respondio','compro','no_interesa')),
  fecha_ultimo_contacto timestamptz,
  fecha_ultima_compra date,
  created_at timestamptz not null default now()
);
alter table clientes enable row level security;
create policy "autenticados leen" on clientes for select to authenticated using (true);
create policy "autenticados escriben" on clientes for insert to authenticated with check (true);
create policy "autenticados actualizan" on clientes for update to authenticated using (true);
