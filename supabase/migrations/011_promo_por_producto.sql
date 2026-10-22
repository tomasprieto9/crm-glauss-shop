-- La promo x3 se descuenta solo del producto que la tiene. Antes el descuento de la promo se repartía entre
-- todos los productos de la venta (ej. 3 Ice King con promo + 1 Black Sheep sin promo: el Black Sheep quedaba
-- más barato que su precio). El total de la venta no cambia; cambia cuánto se le asigna a cada producto.
-- Si se carga un total cobrado distinto (descuento a mano), ese ajuste sí se reparte en proporción entre todos.
create or replace function guardar_items_venta(p_venta_id uuid, p_metodo_pago text, p_total numeric, p_items jsonb, out total numeric, out total_lista numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_unidades_pedidas integer;
  v_unidades integer;
  v_falta_precio boolean;
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
         (select sum(case when promo is not null then (u / 3) * promo + (u % 3) * precio else u * precio end) from por_producto)
    into v_unidades, v_falta_precio, total_lista;

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

  -- Precio por unidad de cada producto: lo que sale ese producto (con su promo) dividido sus unidades;
  -- después, si el total cobrado es distinto del de lista, se ajusta en la misma proporción.
  insert into venta_items (venta_id, producto_id, sabor_id, descripcion, cantidad, precio_lista, precio_unitario)
  select p_venta_id, p.id, s.id, p.marca || ' ' || p.nombre || ' · ' || s.nombre, i.cantidad, l.precio,
         round(case when not v_falta_precio and total_lista > 0 then pp.unitario * total / total_lista else total / v_unidades end, 2)
    from jsonb_to_recordset(p_items) as i(sabor_id uuid, cantidad integer)
    join sabores s on s.id = i.sabor_id
    join productos p on p.id = s.producto_id
    cross join lateral (select case p_metodo_pago when 'efectivo' then p.precio_efectivo when 'transferencia' then p.precio_transferencia else p.precio_usd end as precio) l
    left join lateral (
      select (case when x.promo is not null then (x.u / 3) * x.promo + (x.u % 3) * x.precio else x.u * x.precio end)::numeric / x.u as unitario
        from (select l.precio as precio,
                     case when p_metodo_pago in ('efectivo', 'transferencia') then p.promo_x3 end as promo,
                     (select sum(j.cantidad)::integer from jsonb_to_recordset(p_items) as j(sabor_id uuid, cantidad integer) join sabores s2 on s2.id = j.sabor_id where s2.producto_id = p.id) as u) x
    ) pp on true;

  insert into stock_movimientos (sabor_id, cantidad, motivo, venta_id)
  select i.sabor_id, -i.cantidad, 'venta', p_venta_id
    from jsonb_to_recordset(p_items) as i(sabor_id uuid, cantidad integer);
end;
$$;
