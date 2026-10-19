-- Ventas con productos escritos a mano (el catálogo con stock se suma más adelante).
create table ventas (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  cliente_id uuid not null references clientes(id),
  fecha date not null,
  metodo_pago text not null check (metodo_pago in ('efectivo','transferencia','tarjeta')),
  total numeric(12,2) not null check (total >= 0),
  dni_verificado boolean not null check (dni_verificado),  -- no se registra una venta sin verificar el DNI
  creada_por uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table venta_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references ventas(id) on delete cascade,
  descripcion text not null check (length(trim(descripcion)) > 0),
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  subtotal numeric(12,2) generated always as (cantidad * precio_unitario) stored
);
create index venta_items_venta_id on venta_items(venta_id);
create index ventas_cliente_id on ventas(cliente_id);

alter table ventas enable row level security;
alter table venta_items enable row level security;
create policy "autenticados leen" on ventas for select to authenticated using (true);
create policy "autenticados escriben" on ventas for insert to authenticated with check (true);
create policy "autenticados leen" on venta_items for select to authenticated using (true);
create policy "autenticados escriben" on venta_items for insert to authenticated with check (true);

-- Registra una venta completa en una sola transacción. Si p_cliente_id es null, crea el cliente
-- con p_nuevo_nombre / p_nuevo_telefono. Corre con los permisos del usuario (RLS incluido).
-- Al cliente le actualiza la última compra, marca la edad como verificada (la venta exige DNI),
-- lo pasa a segmento 'cliente' si figuraba como 'no_compro', y a 'compro' si estaba en campaña.
create function registrar_venta(
  p_cliente_id uuid,
  p_nuevo_nombre text,
  p_nuevo_telefono text,
  p_fecha date,
  p_metodo_pago text,
  p_items jsonb
) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cliente_id uuid := p_cliente_id;
  v_venta_id uuid;
  v_numero bigint;
  v_total numeric(12,2);
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  if v_cliente_id is null then
    insert into clientes (nombre, telefono, segmento, edad_verificada)
    values (trim(p_nuevo_nombre), p_nuevo_telefono, 'cliente', true)
    returning id into v_cliente_id;
  end if;

  select sum((item->>'cantidad')::integer * (item->>'precio_unitario')::numeric)
    into v_total
    from jsonb_array_elements(p_items) item;

  insert into ventas (cliente_id, fecha, metodo_pago, total, dni_verificado)
  values (v_cliente_id, p_fecha, p_metodo_pago, v_total, true)
  returning id, numero into v_venta_id, v_numero;

  insert into venta_items (venta_id, descripcion, cantidad, precio_unitario)
  select v_venta_id, trim(item->>'descripcion'), (item->>'cantidad')::integer, (item->>'precio_unitario')::numeric
    from jsonb_array_elements(p_items) item;

  update clientes set
    fecha_ultima_compra = greatest(coalesce(fecha_ultima_compra, p_fecha), p_fecha),
    edad_verificada = true,
    segmento = case when segmento = 'no_compro' then 'cliente' else segmento end,
    estado_campana = case when estado_campana in ('escrito', 'respondio') then 'compro' else estado_campana end
  where id = v_cliente_id;

  return v_numero;
end;
$$;

revoke execute on function registrar_venta from public, anon;
grant execute on function registrar_venta to authenticated;
