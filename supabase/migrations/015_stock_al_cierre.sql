-- Stock al cierre (pedido de Tomás, 25/11/2026): cada cierre de caja guarda una foto del stock de cada sabor en el
-- momento de cerrar, para poder revisarlo después aunque se siga vendiendo o entre mercadería.

alter table cierres_caja add column stock jsonb;
comment on column cierres_caja.stock is 'Stock de cada sabor en el momento del cierre (con el costo del producto en US$).';

-- Stock de cada sabor sumando los movimientos cargados hasta p_hasta (ventas, ingresos, ajustes y defectuosos).
create function foto_stock(p_hasta timestamptz) returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'marca', p.marca, 'producto', p.nombre, 'puffs', p.puffs, 'oculto', p.oculto, 'costo_usd', p.costo_usd,
           'codigo', s.codigo, 'sabor', s.nombre, 'activo', s.activo, 'stock', coalesce(m.stock, 0))
         order by p.marca, p.nombre, s.codigo nulls last, s.nombre), '[]'::jsonb)
    from sabores s
    join productos p on p.id = s.producto_id
    left join (select sabor_id, sum(cantidad)::integer as stock from stock_movimientos where created_at <= p_hasta group by sabor_id) m on m.sabor_id = s.id
   where s.created_at <= p_hasta
$$;

-- Al cerrar, además del cierre y sus retiros y pases, se guarda la foto del stock.
create or replace function registrar_cierre(p_ultimo_cierre uuid, p_datos jsonb, p_movimientos jsonb) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cierre_id uuid;
  v_numero bigint;
begin
  if p_ultimo_cierre is distinct from (select id from cierres_caja order by created_at desc limit 1) then
    raise exception 'Alguien cerró la caja recién. Recargá la página y fijate antes de cerrar de nuevo.';
  end if;
  insert into cierres_caja (cotizacion_usd, datos, stock) values ((select cotizacion_usd from configuracion where id = 1), p_datos, foto_stock(now()))
  returning id, numero into v_cierre_id, v_numero;
  insert into movimientos_caja (fecha, tipo, persona, medio, monto, destino_persona, destino_medio, monto_destino, descripcion, cierre_id)
  select hoy_argentina(), m.tipo, m.persona, m.medio, m.monto, m.destino_persona, m.destino_medio,
         case when m.tipo = 'pase' then m.monto end, m.descripcion || ' (cierre #' || v_numero || ')', v_cierre_id
    from jsonb_to_recordset(coalesce(p_movimientos, '[]')) as m(tipo text, persona text, medio text, monto numeric, destino_persona text, destino_medio text, descripcion text)
   where m.monto > 0;
  return v_numero;
end;
$$;

revoke execute on function foto_stock from public, anon;
grant execute on function foto_stock to authenticated;

-- Los cierres que ya estaban: se arma la foto con lo cargado hasta la hora de cada cierre.
update cierres_caja set stock = foto_stock(created_at) where stock is null;
