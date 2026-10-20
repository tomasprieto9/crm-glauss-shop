-- Stock como en las planillas de Glauss: código por sabor, costo por unidad del producto,
-- defectuosos, desglose de movimientos por sabor y umbral de "bajo stock".

alter table sabores add column codigo text;
create unique index sabores_codigo on sabores (codigo) where codigo is not null;

alter table productos add column costo_usd numeric(12,2) check (costo_usd >= 0);
comment on column productos.costo_usd is 'Costo por unidad en US$. Se actualiza con cada ingreso de mercadería y se puede editar.';
update productos p set costo_usd = c.costo_unitario_usd
from (select distinct on (producto_id) producto_id, costo_unitario_usd from compras order by producto_id, numero desc) c
where c.producto_id = p.id;

alter table configuracion add column stock_bajo integer not null default 4 check (stock_bajo >= 0);

alter table stock_movimientos drop constraint stock_movimientos_motivo_check;
alter table stock_movimientos add constraint stock_movimientos_motivo_check check (motivo in ('compra', 'venta', 'ajuste', 'defectuoso'));

-- Stock actual = ajustes (stock inicial / conteos) + entradas (compras) - salidas (ventas) - defectuosos.
drop view sabores_con_stock;
create view sabores_con_stock with (security_invoker = true) as
select s.id, s.producto_id, s.nombre, s.codigo, s.activo, s.created_at,
       coalesce(sum(m.cantidad), 0)::integer as stock,
       coalesce(sum(m.cantidad) filter (where m.motivo = 'compra'), 0)::integer as entradas,
       coalesce(-sum(m.cantidad) filter (where m.motivo = 'venta'), 0)::integer as salidas,
       coalesce(-sum(m.cantidad) filter (where m.motivo = 'defectuoso'), 0)::integer as defectuosos,
       coalesce(sum(m.cantidad) filter (where m.motivo = 'ajuste'), 0)::integer as ajustes
from sabores s
left join stock_movimientos m on m.sabor_id = s.id
group by s.id;

-- Ingreso de mercadería: además del stock, deja el costo por unidad como costo actual del producto.
create or replace function registrar_compra(
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

  update productos set costo_usd = p_costo_unitario_usd where id = p_producto_id;
  return v_numero;
end;
$$;

-- Ajuste de stock de un producto. p_motivo 'defectuoso': p_items trae cuántas unidades se descartan.
-- p_motivo 'conteo': p_items trae cuántas unidades se contaron y se registra la diferencia como ajuste.
-- Devuelve cuántos sabores cambiaron.
create function ajustar_stock(p_producto_id uuid, p_motivo text, p_items jsonb) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cambios integer;
begin
  if p_motivo not in ('defectuoso', 'conteo') then
    raise exception 'Motivo de ajuste inválido.';
  end if;
  if exists (
    select 1
      from jsonb_to_recordset(p_items) as i(sabor_id uuid, cantidad integer)
      left join sabores s on s.id = i.sabor_id and s.producto_id = p_producto_id
     where s.id is null or i.cantidad is null or i.cantidad < 0
  ) then
    raise exception 'Revisá los sabores y las cantidades.';
  end if;

  if p_motivo = 'defectuoso' then
    insert into stock_movimientos (sabor_id, cantidad, motivo)
    select i.sabor_id, -i.cantidad, 'defectuoso'
      from jsonb_to_recordset(p_items) as i(sabor_id uuid, cantidad integer)
     where i.cantidad > 0;
  else
    insert into stock_movimientos (sabor_id, cantidad, motivo)
    select i.sabor_id, i.cantidad - v.stock, 'ajuste'
      from jsonb_to_recordset(p_items) as i(sabor_id uuid, cantidad integer)
      join sabores_con_stock v on v.id = i.sabor_id
     where i.cantidad <> v.stock;
  end if;
  get diagnostics v_cambios = row_count;
  return v_cambios;
end;
$$;

revoke execute on function ajustar_stock from public, anon;
grant execute on function ajustar_stock to authenticated;
