-- Cierre de caja (pedido de Tomás, 19/11/2026).
-- 1) Cada venta guarda el dólar del día y cada producto vendido su costo: cambiar la cotización o el costo de un
--    producto ya no cambia la ganancia de lo que se vendió antes.
-- 2) Caja Glauss: la caja del negocio, además de las de Lucas y Gonzalo.
-- 3) Cierres: al cerrar, cada socio se lleva su ganancia (retiro) y lo demás que tiene en su caja pasa a la Caja Glauss.
--    El cierre queda guardado tal cual se vio. Lo cargado antes de un cierre ya no se puede cambiar ni borrar
--    (para corregir algo se deshace el último cierre).

-- 1) Costo y dólar congelados en cada venta --------------------------------------------------------------------
alter table ventas add column cotizacion_usd numeric(12,2);
alter table venta_items add column costo_usd numeric(12,2);

update ventas set cotizacion_usd = (select cotizacion_usd from configuracion where id = 1);
update venta_items i set costo_usd = p.costo_usd from productos p where p.id = i.producto_id;

create function congelar_cotizacion_venta() returns trigger language plpgsql set search_path = public as $$
begin
  if new.cotizacion_usd is null then
    new.cotizacion_usd := (select cotizacion_usd from configuracion where id = 1);
  end if;
  return new;
end;
$$;
create trigger congelar_cotizacion_venta before insert on ventas for each row execute function congelar_cotizacion_venta();

create function congelar_costo_item() returns trigger language plpgsql set search_path = public as $$
begin
  if new.costo_usd is null and new.producto_id is not null then
    new.costo_usd := (select costo_usd from productos where id = new.producto_id);
  end if;
  return new;
end;
$$;
create trigger congelar_costo_item before insert on venta_items for each row execute function congelar_costo_item();

-- 2) Caja Glauss -------------------------------------------------------------------------------------------------
alter table movimientos_caja drop constraint movimientos_caja_persona_check;
alter table movimientos_caja add constraint movimientos_caja_persona_check check (persona in ('lucas', 'gonzalo', 'glauss'));
alter table movimientos_caja drop constraint movimientos_caja_destino_persona_check;
alter table movimientos_caja add constraint movimientos_caja_destino_persona_check check (destino_persona in ('lucas', 'gonzalo', 'glauss'));
-- Un retiro es un socio que se lleva plata: no sale de la Caja Glauss.
alter table movimientos_caja add constraint movimientos_caja_retiro_de_socio check (tipo <> 'retiro' or persona in ('lucas', 'gonzalo'));

-- 3) Cierres -------------------------------------------------------------------------------------------------------
create table cierres_caja (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  cotizacion_usd numeric(12,2),
  datos jsonb not null,                                   -- los números tal como se vieron al cerrar
  cerrado_por_email text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now()
);
alter table cierres_caja enable row level security;
create policy "autenticados leen" on cierres_caja for select to authenticated using (true);
create policy "autenticados escriben" on cierres_caja for insert to authenticated with check (true);
create policy "autenticados borran" on cierres_caja for delete to authenticated using (true);

-- Los retiros y pases que hace el cierre quedan atados a él: si se deshace el cierre, se borran con él.
alter table movimientos_caja add column cierre_id uuid references cierres_caja(id) on delete cascade;

create function ultimo_cierre_en() returns timestamptz language sql stable set search_path = public as $$
  select max(created_at) from cierres_caja
$$;

-- Lo cargado antes del último cierre no se cambia ni se borra.
create function controlar_caja_cerrada() returns trigger language plpgsql set search_path = public as $$
declare
  v_cierre timestamptz := ultimo_cierre_en();
begin
  if tg_table_name = 'movimientos_caja' then
    if old.cierre_id is not null then
      if exists (select 1 from cierres_caja where id = old.cierre_id) then
        raise exception 'Este movimiento es parte de un cierre de caja: para cambiarlo, deshacé el cierre.';
      end if;
      return old;  -- se está deshaciendo el cierre
    end if;
  end if;
  if v_cierre is not null and old.created_at <= v_cierre then
    raise exception 'La caja ya se cerró después de cargar esto (cierre del %): no se puede cambiar ni borrar. Si hace falta, deshacé el último cierre en Finanzas.',
      to_char(v_cierre at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI');
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger controlar_caja_cerrada before update or delete on ventas for each row execute function controlar_caja_cerrada();
create trigger controlar_caja_cerrada before delete on movimientos_caja for each row execute function controlar_caja_cerrada();

-- Cierra la caja: guarda el cierre y sus retiros y pases, todo junto. p_ultimo_cierre es el último cierre que vio
-- quien cierra (null si no había): si otro cerró mientras tanto, no se guarda nada.
create function registrar_cierre(p_ultimo_cierre uuid, p_datos jsonb, p_movimientos jsonb) returns bigint
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
  insert into cierres_caja (cotizacion_usd, datos) values ((select cotizacion_usd from configuracion where id = 1), p_datos)
  returning id, numero into v_cierre_id, v_numero;
  insert into movimientos_caja (fecha, tipo, persona, medio, monto, destino_persona, destino_medio, monto_destino, descripcion, cierre_id)
  select hoy_argentina(), m.tipo, m.persona, m.medio, m.monto, m.destino_persona, m.destino_medio,
         case when m.tipo = 'pase' then m.monto end, m.descripcion || ' (cierre #' || v_numero || ')', v_cierre_id
    from jsonb_to_recordset(coalesce(p_movimientos, '[]')) as m(tipo text, persona text, medio text, monto numeric, destino_persona text, destino_medio text, descripcion text)
   where m.monto > 0;
  return v_numero;
end;
$$;

-- Deshace el último cierre: se borran el cierre y sus retiros y pases.
create function deshacer_cierre(p_cierre_id uuid) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_numero bigint;
begin
  if p_cierre_id is distinct from (select id from cierres_caja order by created_at desc limit 1) then
    raise exception 'Solo se puede deshacer el último cierre.';
  end if;
  delete from cierres_caja where id = p_cierre_id returning numero into v_numero;
  return v_numero;
end;
$$;

revoke execute on function registrar_cierre, deshacer_cierre from public, anon;
grant execute on function registrar_cierre, deshacer_cierre to authenticated;

-- Movimientos (registro de actividad) ------------------------------------------------------------------------------
-- Los retiros y pases de un cierre no se anotan uno por uno: los describe el cierre.
create or replace function actividad_caja() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.cierre_id is not null then return null; end if;
    perform registrar_actividad('caja',
      case new.tipo when 'egreso' then 'Registró un egreso' when 'pase' then 'Registró un pase entre cajas' when 'retiro' then 'Registró un retiro'
                    when 'aporte' then 'Registró un aporte' else 'Hizo un arqueo con diferencia' end || ' (#' || new.numero || ')',
      describir_movimiento_caja(new), jsonb_build_object('movimiento_id', new.id));
  else
    if old.cierre_id is not null then return null; end if;
    perform registrar_actividad('caja', 'Borró el movimiento de caja #' || old.numero, etiqueta(old.tipo) || ' · ' || describir_movimiento_caja(old));
  end if;
  return null;
end;
$$;

create function actividad_cierre() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_detalle text;
begin
  select concat_ws(' · ',
           'Ganancia ' || formato_importe((d->>'ganancia')::numeric),
           (select string_agg(etiqueta(p->>'persona') || ' se llevó ' || formato_importe((p->>'seLlevaPesos')::numeric)
                              || ' y rindió ' || formato_importe((p->>'rindePesos')::numeric), ' · ')
              from jsonb_array_elements(d->'personas') p),
           'Caja Glauss queda en ' || formato_importe((d->>'glaussDespuesPesos')::numeric))
    into v_detalle
    from (select case when tg_op = 'DELETE' then old.datos else new.datos end as d) x;
  if tg_op = 'INSERT' then
    perform registrar_actividad('caja', 'Cerró la caja (cierre #' || new.numero || ')', v_detalle, jsonb_build_object('cierre_id', new.id));
  else
    perform registrar_actividad('caja', 'Deshizo el cierre de caja #' || old.numero, v_detalle || ' · se borraron sus retiros y pases');
  end if;
  return null;
end;
$$;
create trigger actividad_cierre after insert or delete on cierres_caja for each row execute function actividad_cierre();

revoke execute on function actividad_caja, actividad_cierre, controlar_caja_cerrada, congelar_cotizacion_venta, congelar_costo_item from public, anon, authenticated;
