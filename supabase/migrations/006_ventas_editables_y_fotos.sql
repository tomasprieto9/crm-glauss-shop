-- Quién cargó/editó cada venta, edición de ventas (rehace ítems y stock) y foto de cada producto.

alter table ventas add column cargada_por_email text default (auth.jwt() ->> 'email');
alter table ventas add column editada_por_email text;
alter table ventas add column editada_en timestamptz;
update ventas v set cargada_por_email = u.email from auth.users u where u.id = v.creada_por and v.cargada_por_email is null;

alter table productos add column foto_url text;

create policy "autenticados actualizan" on ventas for update to authenticated using (true);
create policy "autenticados borran" on venta_items for delete to authenticated using (true);
create policy "autenticados borran" on stock_movimientos for delete to authenticated using (true);

-- Carga los ítems de una venta y descuenta el stock. Precio de lista según el medio de pago, promo x3
-- por modelo (efectivo o transferencia) y, si viene p_total, el total cobrado se reparte en proporción.
-- Devuelve el total cobrado y el total de lista (null si a algún producto le falta el precio).
create function guardar_items_venta(p_venta_id uuid, p_metodo_pago text, p_total numeric, p_items jsonb, out total numeric, out total_lista numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_unidades_pedidas integer;
  v_unidades integer;
  v_falta_precio boolean;
  v_sin_promo numeric;
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
    into v_unidades, v_falta_precio, v_sin_promo, total_lista;

  if v_unidades is distinct from v_unidades_pedidas then
    raise exception 'Algún sabor de la venta no existe.';
  end if;
  if v_falta_precio then
    total_lista := null;
    if p_total is null then
      raise exception 'Falta el precio en dólares de algún producto: cargalo en Productos o escribí el total cobrado.';
    end if;
  end if;
  total := round(coalesce(p_total, total_lista), 2);
  if total < 0 then
    raise exception 'El total no puede ser negativo.';
  end if;

  insert into venta_items (venta_id, producto_id, sabor_id, descripcion, cantidad, precio_lista, precio_unitario)
  select p_venta_id, p.id, s.id, p.marca || ' ' || p.nombre || ' · ' || s.nombre, i.cantidad, l.precio,
         round(case when not v_falta_precio and v_sin_promo > 0 then l.precio * total / v_sin_promo else total / v_unidades end, 2)
    from jsonb_to_recordset(p_items) as i(sabor_id uuid, cantidad integer)
    join sabores s on s.id = i.sabor_id
    join productos p on p.id = s.producto_id
    cross join lateral (select case p_metodo_pago when 'efectivo' then p.precio_efectivo when 'transferencia' then p.precio_transferencia else p.precio_usd end as precio) l;

  insert into stock_movimientos (sabor_id, cantidad, motivo, venta_id)
  select i.sabor_id, -i.cantidad, 'venta', p_venta_id
    from jsonb_to_recordset(p_items) as i(sabor_id uuid, cantidad integer);
end;
$$;

drop function registrar_venta(uuid, text, text, date, text, text, numeric, jsonb);

create function registrar_venta(
  p_cliente_id uuid, p_nuevo_nombre text, p_nuevo_telefono text, p_fecha date,
  p_metodo_pago text, p_recibio text, p_total numeric, p_items jsonb
) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cliente_id uuid := p_cliente_id;
  v_venta_id uuid;
  v_numero bigint;
  v_totales record;
begin
  if v_cliente_id is null then
    insert into clientes (nombre, telefono, segmento) values (trim(p_nuevo_nombre), p_nuevo_telefono, 'cliente')
    returning id into v_cliente_id;
  end if;

  insert into ventas (cliente_id, fecha, metodo_pago, recibio, total, total_lista)
  values (v_cliente_id, p_fecha, p_metodo_pago, p_recibio, 0, null)
  returning id, numero into v_venta_id, v_numero;

  select * into v_totales from guardar_items_venta(v_venta_id, p_metodo_pago, p_total, p_items);
  update ventas set total = v_totales.total, total_lista = v_totales.total_lista where id = v_venta_id;

  update clientes set
    fecha_ultima_compra = greatest(coalesce(fecha_ultima_compra, p_fecha), p_fecha),
    segmento = case when segmento = 'no_compro' then 'cliente' else segmento end,
    estado_campana = case when estado_campana in ('escrito', 'respondio') then 'compro' else estado_campana end
  where id = v_cliente_id;

  return v_numero;
end;
$$;

-- Corrige una venta: reemplaza cliente, fecha, pago, quién cobró, productos y total; devuelve al stock
-- lo que se había descontado y descuenta lo nuevo. Recalcula la última compra de los clientes afectados.
create function editar_venta(
  p_venta_id uuid, p_cliente_id uuid, p_nuevo_nombre text, p_nuevo_telefono text, p_fecha date,
  p_metodo_pago text, p_recibio text, p_total numeric, p_items jsonb
) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cliente_id uuid := p_cliente_id;
  v_cliente_anterior uuid;
  v_numero bigint;
  v_totales record;
begin
  select cliente_id, numero into v_cliente_anterior, v_numero from ventas where id = p_venta_id for update;
  if not found then
    raise exception 'La venta no existe.';
  end if;

  if v_cliente_id is null then
    insert into clientes (nombre, telefono, segmento) values (trim(p_nuevo_nombre), p_nuevo_telefono, 'cliente')
    returning id into v_cliente_id;
  end if;

  delete from stock_movimientos where venta_id = p_venta_id;
  delete from venta_items where venta_id = p_venta_id;
  select * into v_totales from guardar_items_venta(p_venta_id, p_metodo_pago, p_total, p_items);

  update ventas set
    cliente_id = v_cliente_id, fecha = p_fecha, metodo_pago = p_metodo_pago, recibio = p_recibio,
    total = v_totales.total, total_lista = v_totales.total_lista,
    editada_en = now(), editada_por_email = auth.jwt() ->> 'email'
  where id = p_venta_id;

  update clientes c set fecha_ultima_compra = (select max(v.fecha) from ventas v where v.cliente_id = c.id)
  where c.id in (v_cliente_anterior, v_cliente_id);
  update clientes set segmento = 'cliente' where id = v_cliente_id and segmento = 'no_compro';

  return v_numero;
end;
$$;

revoke execute on function guardar_items_venta, registrar_venta, editar_venta from public, anon;
grant execute on function guardar_items_venta, registrar_venta, editar_venta to authenticated;
