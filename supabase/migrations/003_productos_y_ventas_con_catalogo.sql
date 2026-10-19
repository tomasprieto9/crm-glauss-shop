-- Catálogo de productos con un precio por medio de pago, y ventas que eligen productos del catálogo.
create table productos (
  id uuid primary key default gen_random_uuid(),
  marca text not null check (length(trim(marca)) > 0),
  nombre text not null check (length(trim(nombre)) > 0),
  categoria text not null check (categoria in ('descartables','pods','liquidos','resistencias','baterias_mods','accesorios')),
  precio_efectivo numeric(12,2) not null check (precio_efectivo >= 0),
  precio_transferencia numeric(12,2) not null check (precio_transferencia >= 0),
  precio_usd numeric(12,2) not null check (precio_usd >= 0),
  created_at timestamptz not null default now(),
  unique (marca, nombre)
);
alter table productos enable row level security;
create policy "autenticados leen" on productos for select to authenticated using (true);
create policy "autenticados escriben" on productos for insert to authenticated with check (true);
create policy "autenticados actualizan" on productos for update to authenticated using (true);

-- Ventas: medios de pago efectivo / transferencia / dólares, quién recibió el pago, sin DNI.
-- (La tabla está vacía: las ventas de prueba se borraron.)
alter table ventas drop constraint ventas_metodo_pago_check;
alter table ventas add constraint ventas_metodo_pago_check check (metodo_pago in ('efectivo','transferencia','dolares'));
alter table ventas add column recibio text not null check (recibio in ('lucas','gonzalo'));
alter table ventas add column total_lista numeric(12,2) not null check (total_lista >= 0);  -- total a precio de lista
alter table ventas drop column dni_verificado;
comment on column ventas.total is 'Total cobrado. En dólares si metodo_pago = dolares, si no en pesos.';

alter table venta_items add column producto_id uuid references productos(id);
alter table venta_items add column precio_lista numeric(12,2) not null default 0 check (precio_lista >= 0);
comment on column venta_items.precio_unitario is 'Precio de venta real por unidad: el de lista ajustado por el descuento o recargo sobre el total.';

drop function registrar_venta(uuid, text, text, date, text, jsonb);

-- Registra una venta en una sola transacción, con los permisos del usuario (RLS incluido).
-- p_items: [{ "producto_id": uuid, "cantidad": int }]. Los precios de lista salen del catálogo según
-- el medio de pago. Si p_total viene, es el total cobrado y se reparte proporcionalmente entre los
-- productos (precio de venta promedio por unidad); si es null, se cobra el total de lista.
create function registrar_venta(
  p_cliente_id uuid,
  p_nuevo_nombre text,
  p_nuevo_telefono text,
  p_fecha date,
  p_metodo_pago text,
  p_recibio text,
  p_total numeric,
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
  v_total_lista numeric(12,2);
  v_total numeric(12,2);
  v_unidades integer;
  v_unidades_pedidas integer;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  select sum(i.cantidad) into v_unidades_pedidas from jsonb_to_recordset(p_items) as i(producto_id uuid, cantidad integer);

  select sum(i.cantidad * l.precio), sum(i.cantidad)
    into v_total_lista, v_unidades
    from jsonb_to_recordset(p_items) as i(producto_id uuid, cantidad integer)
    join productos p on p.id = i.producto_id
    cross join lateral (select case p_metodo_pago when 'efectivo' then p.precio_efectivo when 'transferencia' then p.precio_transferencia else p.precio_usd end as precio) l;

  if v_unidades is distinct from v_unidades_pedidas then
    raise exception 'Algún producto de la venta no existe';
  end if;

  v_total := coalesce(p_total, v_total_lista);
  if v_total < 0 then
    raise exception 'El total no puede ser negativo';
  end if;

  if v_cliente_id is null then
    insert into clientes (nombre, telefono, segmento)
    values (trim(p_nuevo_nombre), p_nuevo_telefono, 'cliente')
    returning id into v_cliente_id;
  end if;

  insert into ventas (cliente_id, fecha, metodo_pago, recibio, total, total_lista)
  values (v_cliente_id, p_fecha, p_metodo_pago, p_recibio, v_total, v_total_lista)
  returning id, numero into v_venta_id, v_numero;

  insert into venta_items (venta_id, producto_id, descripcion, cantidad, precio_lista, precio_unitario)
  select v_venta_id, p.id, p.marca || ' ' || p.nombre, i.cantidad, l.precio,
         round(case when v_total_lista > 0 then l.precio * v_total / v_total_lista else v_total / v_unidades end, 2)
    from jsonb_to_recordset(p_items) as i(producto_id uuid, cantidad integer)
    join productos p on p.id = i.producto_id
    cross join lateral (select case p_metodo_pago when 'efectivo' then p.precio_efectivo when 'transferencia' then p.precio_transferencia else p.precio_usd end as precio) l;

  update clientes set
    fecha_ultima_compra = greatest(coalesce(fecha_ultima_compra, p_fecha), p_fecha),
    segmento = case when segmento = 'no_compro' then 'cliente' else segmento end,
    estado_campana = case when estado_campana in ('escrito', 'respondio') then 'compro' else estado_campana end
  where id = v_cliente_id;

  return v_numero;
end;
$$;

revoke execute on function registrar_venta from public, anon;
grant execute on function registrar_venta to authenticated;
