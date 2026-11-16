-- Borrar una venta (pedido de Tomás, 16/11/2026): por si se cargó mal. Devuelve las unidades al stock (los
-- movimientos de stock y los productos de la venta se borran en cascada), saca el cobro de la caja (la caja
-- se calcula desde las ventas) y recalcula la última compra del cliente. Queda en Movimientos quién la borró.

create policy "autenticados borran" on ventas for delete to authenticated using (true);

-- Movimientos: se registra antes de borrar, así todavía se pueden leer el cliente y los productos.
drop trigger actividad_venta_borrada on ventas;
create or replace function actividad_venta_borrada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform registrar_actividad('venta', 'Borró la venta #' || old.numero,
    concat_ws(' · ', describir_venta(old.id), 'fecha ' || formato_fecha(old.fecha), 'las unidades volvieron al stock'),
    jsonb_build_object('venta_id', old.id));
  return old;
end;
$$;
revoke execute on function actividad_venta_borrada from public, anon, authenticated;
create trigger actividad_venta_borrada before delete on ventas for each row execute function actividad_venta_borrada();

create function borrar_venta(p_venta_id uuid) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_numero bigint;
begin
  delete from ventas where id = p_venta_id returning cliente_id, numero into v_cliente_id, v_numero;
  if not found then
    raise exception 'La venta no existe (quizás ya la borró otra persona).';
  end if;
  update clientes c set fecha_ultima_compra = (select max(v.fecha) from ventas v where v.cliente_id = c.id)
  where c.id = v_cliente_id;
  return v_numero;
end;
$$;
revoke execute on function borrar_venta from public, anon;
grant execute on function borrar_venta to authenticated;
