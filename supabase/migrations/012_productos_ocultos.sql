-- Productos ocultos (pedido de Tomás, 13/11/2026): los que no tienen stock y quizás no vuelvan se pueden ocultar
-- de las listas sin borrarlos. Se vuelven a mostrar a mano o solos cuando entra mercadería.

alter table productos add column oculto boolean not null default false;

-- Movimientos: registra quién ocultó o volvió a mostrar un producto (además de los cambios de siempre).
create or replace function actividad_producto() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cambios text[] := '{}';
  v_nombre text;
begin
  if tg_op = 'INSERT' then
    perform registrar_actividad('producto', 'Creó el producto ' || new.marca || ' ' || new.nombre,
      concat_ws(' · ', 'Efectivo ' || formato_importe(new.precio_efectivo), 'Transferencia ' || formato_importe(new.precio_transferencia),
        'Promo x3 ' || formato_importe(new.promo_x3), 'Dólares ' || formato_importe(new.precio_usd, 'dolares'), 'Costo ' || formato_importe(new.costo_usd, 'dolares')),
      jsonb_build_object('producto_id', new.id));
    return null;
  elsif tg_op = 'DELETE' then
    perform registrar_actividad('producto', 'Borró el producto ' || old.marca || ' ' || old.nombre, null);
    return null;
  end if;

  v_nombre := new.marca || ' ' || new.nombre;
  if new.oculto is distinct from old.oculto then
    perform registrar_actividad('producto', case when new.oculto then 'Ocultó el producto ' else 'Volvió a mostrar el producto ' end || v_nombre, null, jsonb_build_object('producto_id', new.id));
  end if;
  if (new.marca, new.nombre) is distinct from (old.marca, old.nombre) then v_cambios := v_cambios || ('nombre ' || old.marca || ' ' || old.nombre || ' → ' || v_nombre); end if;
  if new.precio_efectivo is distinct from old.precio_efectivo then v_cambios := v_cambios || ('efectivo ' || coalesce(formato_importe(old.precio_efectivo), '—') || ' → ' || coalesce(formato_importe(new.precio_efectivo), '—')); end if;
  if new.precio_transferencia is distinct from old.precio_transferencia then v_cambios := v_cambios || ('transferencia ' || coalesce(formato_importe(old.precio_transferencia), '—') || ' → ' || coalesce(formato_importe(new.precio_transferencia), '—')); end if;
  if new.promo_x3 is distinct from old.promo_x3 then v_cambios := v_cambios || ('promo x3 ' || coalesce(formato_importe(old.promo_x3), '—') || ' → ' || coalesce(formato_importe(new.promo_x3), '—')); end if;
  if new.precio_usd is distinct from old.precio_usd then v_cambios := v_cambios || ('dólares ' || coalesce(formato_importe(old.precio_usd, 'dolares'), '—') || ' → ' || coalesce(formato_importe(new.precio_usd, 'dolares'), '—')); end if;
  if new.costo_usd is distinct from old.costo_usd then v_cambios := v_cambios || ('costo ' || coalesce(formato_importe(old.costo_usd, 'dolares'), '—') || ' → ' || coalesce(formato_importe(new.costo_usd, 'dolares'), '—')); end if;
  if new.foto_url is distinct from old.foto_url then v_cambios := v_cambios || 'foto'::text; end if;
  if cardinality(v_cambios) > 0 then
    perform registrar_actividad('producto', 'Modificó el producto ' || v_nombre, array_to_string(v_cambios, ' · '), jsonb_build_object('producto_id', new.id));
  end if;
  return null;
end;
$$;
revoke execute on function actividad_producto from public, anon, authenticated;
