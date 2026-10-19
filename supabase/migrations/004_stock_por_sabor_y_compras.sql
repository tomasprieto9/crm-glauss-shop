-- Productos sin categoría, con precio US$ opcional y promo x3; sabores con stock;
-- compras de mercadería (con costo en US$) y movimientos de stock; cotización del dólar.

alter table productos drop column categoria;
alter table productos alter column precio_usd drop not null;
alter table productos add column promo_x3 numeric(12,2) check (promo_x3 >= 0);
comment on column productos.promo_x3 is 'Precio en pesos por 3 unidades del modelo (efectivo o transferencia). Null si no hay promo.';

create table sabores (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  activo boolean not null default true,  -- los sabores que se sacan de la lista quedan inactivos (conservan su historial)
  created_at timestamptz not null default now(),
  unique (producto_id, nombre)
);

create table compras (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  producto_id uuid not null references productos(id),
  fecha date not null,
  costo_unitario_usd numeric(12,2) not null check (costo_unitario_usd >= 0),
  notas text,
  creada_por uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

-- El stock de cada sabor es la suma de sus movimientos: compras (+), ventas (-) y ajustes.
create table stock_movimientos (
  id uuid primary key default gen_random_uuid(),
  sabor_id uuid not null references sabores(id),
  cantidad integer not null check (cantidad <> 0),
  motivo text not null check (motivo in ('compra','venta','ajuste')),
  compra_id uuid references compras(id) on delete cascade,
  venta_id uuid references ventas(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index stock_movimientos_sabor_id on stock_movimientos(sabor_id);
create index sabores_producto_id on sabores(producto_id);

create view sabores_con_stock with (security_invoker = true) as
  select s.*, coalesce((select sum(m.cantidad) from stock_movimientos m where m.sabor_id = s.id), 0)::integer as stock
  from sabores s;

alter table ventas alter column total_lista drop not null;
alter table venta_items add column sabor_id uuid references sabores(id);
alter table venta_items alter column precio_lista drop not null;
alter table venta_items alter column precio_lista drop default;

create table configuracion (
  id smallint primary key default 1 check (id = 1),  -- una sola fila
  cotizacion_usd numeric(12,2) check (cotizacion_usd > 0),
  actualizada_en timestamptz not null default now()
);
insert into configuracion (id) values (1);

alter table sabores enable row level security;
alter table compras enable row level security;
alter table stock_movimientos enable row level security;
alter table configuracion enable row level security;
create policy "autenticados leen" on sabores for select to authenticated using (true);
create policy "autenticados escriben" on sabores for insert to authenticated with check (true);
create policy "autenticados actualizan" on sabores for update to authenticated using (true);
create policy "autenticados leen" on compras for select to authenticated using (true);
create policy "autenticados escriben" on compras for insert to authenticated with check (true);
create policy "autenticados leen" on stock_movimientos for select to authenticated using (true);
create policy "autenticados escriben" on stock_movimientos for insert to authenticated with check (true);
create policy "autenticados leen" on configuracion for select to authenticated using (true);
create policy "autenticados actualizan" on configuracion for update to authenticated using (true);

drop function registrar_venta(uuid, text, text, date, text, text, numeric, jsonb);

-- Registra una venta en una transacción, con los permisos del usuario (RLS incluido).
-- p_items: [{ "sabor_id": uuid, "cantidad": int }]. Precio de lista según el medio de pago; la promo x3
-- se aplica por modelo (cada 3 unidades, en efectivo o transferencia). Si p_total viene, es el total
-- cobrado y se reparte en proporción al precio de cada producto. Descuenta el stock de cada sabor.
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
  v_unidades_pedidas integer;
  v_unidades integer;
  v_falta_precio boolean;
  v_sin_promo numeric;
  v_total_lista numeric(12,2);
  v_total numeric(12,2);
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos.';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_items) as i(sabor_id uuid, cantidad integer) where i.cantidad is null or i.cantidad < 1) then
    raise exception 'Revisá las cantidades.';
  end if;
  select sum(i.cantidad) into v_unidades_pedidas from jsonb_to_recordset(p_items) as i(sabor_id uuid, cantidad integer);

  with items as (
    select i.cantidad, p.id as producto_id,
           case p_metodo_pago when 'efectivo' then p.precio_efectivo when 'transferencia' then p.precio_transferencia else p.precio_usd end as precio,
           case when p_metodo_pago in ('efectivo', 'transferencia') then p.promo_x3 end as promo
      from jsonb_to_recordset(p_items) as i(sabor_id uuid, cantidad integer)
      join sabores s on s.id = i.sabor_id
      join productos p on p.id = s.producto_id
  ), por_producto as (
    select producto_id, precio, promo, sum(cantidad)::integer as u from items group by producto_id, precio, promo
  )
  select (select sum(cantidad) from items),
         (select bool_or(precio is null) from items),
         (select sum(cantidad * precio) from items),
         (select sum(case when promo is not null then (u / 3) * promo + (u % 3) * precio else u * precio end) from por_producto)
    into v_unidades, v_falta_precio, v_sin_promo, v_total_lista;

  if v_unidades is distinct from v_unidades_pedidas then
    raise exception 'Algún sabor de la venta no existe.';
  end if;
  if v_falta_precio then
    v_total_lista := null;
    if p_total is null then
      raise exception 'Falta el precio en dólares de algún producto: cargalo en Productos o escribí el total cobrado.';
    end if;
  end if;

  v_total := coalesce(p_total, v_total_lista);
  if v_total < 0 then
    raise exception 'El total no puede ser negativo.';
  end if;

  if v_cliente_id is null then
    insert into clientes (nombre, telefono, segmento)
    values (trim(p_nuevo_nombre), p_nuevo_telefono, 'cliente')
    returning id into v_cliente_id;
  end if;

  insert into ventas (cliente_id, fecha, metodo_pago, recibio, total, total_lista)
  values (v_cliente_id, p_fecha, p_metodo_pago, p_recibio, v_total, v_total_lista)
  returning id, numero into v_venta_id, v_numero;

  insert into venta_items (venta_id, producto_id, sabor_id, descripcion, cantidad, precio_lista, precio_unitario)
  select v_venta_id, p.id, s.id, p.marca || ' ' || p.nombre || ' · ' || s.nombre, i.cantidad, l.precio,
         round(case when not v_falta_precio and v_sin_promo > 0 then l.precio * v_total / v_sin_promo else v_total / v_unidades end, 2)
    from jsonb_to_recordset(p_items) as i(sabor_id uuid, cantidad integer)
    join sabores s on s.id = i.sabor_id
    join productos p on p.id = s.producto_id
    cross join lateral (select case p_metodo_pago when 'efectivo' then p.precio_efectivo when 'transferencia' then p.precio_transferencia else p.precio_usd end as precio) l;

  insert into stock_movimientos (sabor_id, cantidad, motivo, venta_id)
  select i.sabor_id, -i.cantidad, 'venta', v_venta_id
    from jsonb_to_recordset(p_items) as i(sabor_id uuid, cantidad integer);

  update clientes set
    fecha_ultima_compra = greatest(coalesce(fecha_ultima_compra, p_fecha), p_fecha),
    segmento = case when segmento = 'no_compro' then 'cliente' else segmento end,
    estado_campana = case when estado_campana in ('escrito', 'respondio') then 'compro' else estado_campana end
  where id = v_cliente_id;

  return v_numero;
end;
$$;

-- Registra un ingreso de mercadería de un modelo: suma stock a cada sabor y guarda el costo por unidad en US$.
-- p_items: [{ "sabor_id": uuid, "cantidad": int }], todos sabores del producto.
create function registrar_compra(
  p_producto_id uuid,
  p_fecha date,
  p_costo_unitario_usd numeric,
  p_notas text,
  p_items jsonb
) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_compra_id uuid;
  v_numero bigint;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cargá la cantidad de al menos un sabor.';
  end if;
  if exists (
    select 1
      from jsonb_to_recordset(p_items) as i(sabor_id uuid, cantidad integer)
      left join sabores s on s.id = i.sabor_id and s.producto_id = p_producto_id
     where s.id is null or i.cantidad is null or i.cantidad < 1
  ) then
    raise exception 'Revisá los sabores y las cantidades.';
  end if;

  insert into compras (producto_id, fecha, costo_unitario_usd, notas)
  values (p_producto_id, p_fecha, p_costo_unitario_usd, nullif(trim(p_notas), ''))
  returning id, numero into v_compra_id, v_numero;

  insert into stock_movimientos (sabor_id, cantidad, motivo, compra_id)
  select i.sabor_id, i.cantidad, 'compra', v_compra_id
    from jsonb_to_recordset(p_items) as i(sabor_id uuid, cantidad integer);

  return v_numero;
end;
$$;

revoke execute on function registrar_venta, registrar_compra from public, anon;
grant execute on function registrar_venta, registrar_compra to authenticated;
