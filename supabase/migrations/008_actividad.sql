-- Registro de actividad: quién hizo qué y cuándo dentro del CRM (sección "Movimientos").
-- Lo escriben solo los triggers de la base, así no se escapa ninguna acción. Desde el CRM se puede leer,
-- pero no modificar ni borrar (no hay políticas de insert/update/delete).

create table actividad (
  id bigint generated always as identity primary key,
  fecha timestamptz not null default now(),
  usuario_email text default (auth.jwt() ->> 'email'),   -- null = cambio hecho por el sistema (scripts, base)
  tipo text not null check (tipo in ('venta','mercaderia','stock','producto','caja','cliente','configuracion')),
  accion text not null,
  detalle text,
  datos jsonb
);
create index actividad_fecha on actividad(fecha desc);

alter table actividad enable row level security;
create policy "autenticados leen" on actividad for select to authenticated using (true);
revoke insert, update, delete, truncate on actividad from anon, authenticated;

-- Formatos en español: 1.234.567 / 9,50 / $ 28.000 / US$ 9,50 / 21/10/2026.
create function formato_numero(n numeric) returns text language sql immutable as $$
  select case when n = trunc(n) then replace(to_char(abs(n), 'FM999,999,999,990'), ',', '.')
              else translate(to_char(abs(n), 'FM999,999,999,990.00'), ',.', '.,') end
$$;
create function formato_importe(n numeric, medio text default 'efectivo') returns text language sql immutable as $$
  select case when n < 0 then '−' else '' end || case when medio = 'dolares' then 'US$ ' else '$ ' end || formato_numero(n)
$$;
create function formato_fecha(d date) returns text language sql immutable as $$ select to_char(d, 'DD/MM/YYYY') $$;
create function etiqueta(valor text) returns text language sql immutable as $$
  select case valor
    when 'dolares' then 'Dólares' when 'no_compro' then 'No compró' when 'comercio_prospecto' then 'Comercio prospecto'
    when 'la_plata' then 'La Plata' when 'amba' then 'AMBA' when 'sin_definir' then 'Sin definir' when 'si' then 'Sí'
    when 'no_interesa' then 'No le interesa' when 'respondio' then 'Respondió' when 'compro' then 'Compró'
    when 'mercaderia' then 'Mercadería' when 'envios' then 'Envíos'
    else initcap(replace(valor, '_', ' ')) end  -- null queda null
$$;
create function hoy_argentina() returns date language sql stable as $$ select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;

create function registrar_actividad(p_tipo text, p_accion text, p_detalle text, p_datos jsonb default null) returns void
language sql security definer set search_path = public as $$
  insert into actividad (tipo, accion, detalle, datos) values (p_tipo, p_accion, nullif(p_detalle, ''), p_datos)
$$;

-- Ventas ---------------------------------------------------------------------------------------------

create function describir_venta(p_venta_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select concat_ws(' · ',
    formato_importe(v.total, v.metodo_pago), etiqueta(v.metodo_pago), 'cobró ' || etiqueta(v.recibio),
    'cliente ' || c.nombre,
    case when v.fecha <> (v.created_at at time zone 'America/Argentina/Buenos_Aires')::date then 'fecha de venta ' || formato_fecha(v.fecha) end,
    (select string_agg(i.cantidad || ' × ' || i.descripcion, ', ' order by i.descripcion) from venta_items i where i.venta_id = v.id))
  from ventas v left join clientes c on c.id = v.cliente_id
  where v.id = p_venta_id
$$;

-- Se registra al final de la transacción, cuando la venta ya tiene sus productos y su total.
create function actividad_venta() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cambios text[] := '{}';
  v_cliente_antes text;
  v_cliente_ahora text;
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from ventas where id = new.id) then
      perform registrar_actividad('venta', 'Cargó la venta #' || new.numero, describir_venta(new.id), jsonb_build_object('venta_id', new.id));
    end if;
  elsif tg_op = 'UPDATE' then
    -- Solo las correcciones (editar_venta marca editada_en); el ajuste del total al cargarla no cuenta.
    if new.editada_en is distinct from old.editada_en then
      if new.cliente_id is distinct from old.cliente_id then
        select nombre into v_cliente_antes from clientes where id = old.cliente_id;
        select nombre into v_cliente_ahora from clientes where id = new.cliente_id;
        v_cambios := v_cambios || ('cliente ' || coalesce(v_cliente_antes, '—') || ' → ' || coalesce(v_cliente_ahora, '—'));
      end if;
      if new.fecha <> old.fecha then v_cambios := v_cambios || ('fecha ' || formato_fecha(old.fecha) || ' → ' || formato_fecha(new.fecha)); end if;
      if new.metodo_pago <> old.metodo_pago then v_cambios := v_cambios || ('pago ' || etiqueta(old.metodo_pago) || ' → ' || etiqueta(new.metodo_pago)); end if;
      if new.recibio <> old.recibio then v_cambios := v_cambios || ('cobró ' || etiqueta(old.recibio) || ' → ' || etiqueta(new.recibio)); end if;
      if new.total <> old.total then v_cambios := v_cambios || ('total ' || formato_importe(old.total, old.metodo_pago) || ' → ' || formato_importe(new.total, new.metodo_pago)); end if;
      perform registrar_actividad('venta', 'Editó la venta #' || new.numero,
        concat_ws(' · ', nullif(array_to_string(v_cambios, ' · '), ''), 'Ahora: ' || describir_venta(new.id)),
        jsonb_build_object('venta_id', new.id));
    end if;
  end if;
  return null;
end;
$$;
create constraint trigger actividad_venta after insert or update on ventas
  deferrable initially deferred for each row execute function actividad_venta();

create function actividad_venta_borrada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform registrar_actividad('venta', 'Borró la venta #' || old.numero,
    concat_ws(' · ', formato_importe(old.total, old.metodo_pago), etiqueta(old.metodo_pago), 'fecha ' || formato_fecha(old.fecha)));
  return null;
end;
$$;
create trigger actividad_venta_borrada after delete on ventas for each row execute function actividad_venta_borrada();

-- Stock: ingresos de mercadería, defectuosos y conteos (las salidas por venta ya quedan en la venta) -------

create function actividad_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  -- Ingreso de mercadería: una entrada por compra.
  for r in
    select c.numero, c.fecha, c.costo_unitario_usd, c.notas, p.marca || ' ' || p.nombre as producto, c.id as compra_id,
           sum(n.cantidad) as unidades,
           string_agg(s.nombre || ' ' || n.cantidad, ', ' order by s.nombre) as sabores
      from nuevos n join compras c on c.id = n.compra_id join productos p on p.id = c.producto_id join sabores s on s.id = n.sabor_id
     where n.motivo = 'compra'
     group by c.id, c.numero, c.fecha, c.costo_unitario_usd, c.notas, p.marca, p.nombre
  loop
    perform registrar_actividad('mercaderia', 'Ingresó mercadería de ' || r.producto,
      concat_ws(' · ', 'Compra #' || r.numero, formato_numero(r.unidades) || case when r.unidades = 1 then ' unidad (' else ' unidades (' end || r.sabores || ')',
        formato_importe(r.costo_unitario_usd, 'dolares') || ' c/u = ' || formato_importe(r.costo_unitario_usd * r.unidades, 'dolares'),
        case when r.fecha <> hoy_argentina() then 'fecha ' || formato_fecha(r.fecha) end, r.notas),
      jsonb_build_object('compra_id', r.compra_id));
  end loop;

  -- Defectuosos y conteos: una entrada por producto.
  for r in
    select n.motivo, p.marca || ' ' || p.nombre as producto, p.id as producto_id, sum(n.cantidad) as total,
           string_agg(case when n.motivo = 'defectuoso' then s.nombre || ' ' || -n.cantidad
                           else s.nombre || ': ' || (v.stock - n.cantidad) || ' → ' || v.stock || ' (' || case when n.cantidad > 0 then '+' else '−' end || abs(n.cantidad) || ')' end,
                      ', ' order by s.nombre) as sabores
      from nuevos n join sabores s on s.id = n.sabor_id join productos p on p.id = s.producto_id join sabores_con_stock v on v.id = n.sabor_id
     where n.motivo in ('defectuoso', 'ajuste')
     group by n.motivo, p.id, p.marca, p.nombre
  loop
    if r.motivo = 'defectuoso' then
      perform registrar_actividad('stock', 'Registró defectuosos de ' || r.producto, formato_numero(-r.total) || case when r.total = -1 then ' unidad: ' else ' unidades: ' end || r.sabores, jsonb_build_object('producto_id', r.producto_id));
    else
      perform registrar_actividad('stock', 'Corrigió el stock de ' || r.producto, r.sabores, jsonb_build_object('producto_id', r.producto_id));
    end if;
  end loop;
  return null;
end;
$$;
create trigger actividad_stock after insert on stock_movimientos
  referencing new table as nuevos for each statement execute function actividad_stock();

-- Productos y sabores ---------------------------------------------------------------------------------

create function actividad_producto() returns trigger
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
create trigger actividad_producto after insert or update or delete on productos for each row execute function actividad_producto();

create function actividad_sabores_nuevos() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in
    select p.id, p.marca || ' ' || p.nombre as producto, count(*) as cantidad, string_agg(concat_ws(' ', n.nombre, '(' || n.codigo || ')'), ', ' order by n.nombre) as sabores
      from nuevos n join productos p on p.id = n.producto_id group by p.id, p.marca, p.nombre
  loop
    perform registrar_actividad('producto', case when r.cantidad = 1 then 'Agregó un sabor a ' else 'Agregó ' || r.cantidad || ' sabores a ' end || r.producto, r.sabores, jsonb_build_object('producto_id', r.id));
  end loop;
  return null;
end;
$$;
create trigger actividad_sabores_nuevos after insert on sabores
  referencing new table as nuevos for each statement execute function actividad_sabores_nuevos();

create function actividad_sabores_cambiados() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in
    select p.id, p.marca || ' ' || p.nombre as producto,
           string_agg(n.nombre, ', ' order by n.nombre) filter (where a.activo and not n.activo) as sacados,
           string_agg(n.nombre, ', ' order by n.nombre) filter (where not a.activo and n.activo) as vueltos,
           string_agg(a.nombre || ' → ' || n.nombre, ', ' order by n.nombre) filter (where a.nombre <> n.nombre) as renombrados,
           string_agg(n.nombre || ' ' || coalesce(a.codigo, 'sin código') || ' → ' || coalesce(n.codigo, 'sin código'), ', ' order by n.nombre) filter (where a.codigo is distinct from n.codigo) as codigos
      from nuevos n join anteriores a on a.id = n.id join productos p on p.id = n.producto_id
     group by p.id, p.marca, p.nombre
  loop
    if r.sacados is not null then perform registrar_actividad('producto', 'Sacó sabores de ' || r.producto, r.sacados, jsonb_build_object('producto_id', r.id)); end if;
    if r.vueltos is not null then perform registrar_actividad('producto', 'Volvió a agregar sabores a ' || r.producto, r.vueltos, jsonb_build_object('producto_id', r.id)); end if;
    if r.renombrados is not null then perform registrar_actividad('producto', 'Renombró sabores de ' || r.producto, r.renombrados, jsonb_build_object('producto_id', r.id)); end if;
    if r.codigos is not null then perform registrar_actividad('producto', 'Cambió códigos de sabores de ' || r.producto, r.codigos, jsonb_build_object('producto_id', r.id)); end if;
  end loop;
  return null;
end;
$$;
create trigger actividad_sabores_cambiados after update on sabores
  referencing old table as anteriores new table as nuevos for each statement execute function actividad_sabores_cambiados();

-- Caja --------------------------------------------------------------------------------------------------

create function describir_movimiento_caja(m movimientos_caja) returns text language sql stable as $$
  select concat_ws(' · ',
    case when m.tipo = 'pase' then formato_importe(m.monto, m.medio) || ' de ' || etiqueta(m.persona) || ' (' || etiqueta(m.medio) || ') a '
                                   || etiqueta(m.destino_persona) || ' (' || etiqueta(m.destino_medio) || ')'
                                   || case when m.destino_medio <> m.medio then ', llegan ' || formato_importe(m.monto_destino, m.destino_medio) else '' end
         else formato_importe(m.monto, m.medio) || ' · caja ' || etiqueta(m.persona) || ' (' || etiqueta(m.medio) || ')' end,
    'categoría ' || etiqueta(m.categoria),
    case when m.fecha <> hoy_argentina() then 'fecha ' || formato_fecha(m.fecha) end,
    m.descripcion)
$$;

create function actividad_caja() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform registrar_actividad('caja',
      case new.tipo when 'egreso' then 'Registró un egreso' when 'pase' then 'Registró un pase entre cajas' when 'retiro' then 'Registró un retiro'
                    when 'aporte' then 'Registró un aporte' else 'Hizo un arqueo con diferencia' end || ' (#' || new.numero || ')',
      describir_movimiento_caja(new), jsonb_build_object('movimiento_id', new.id));
  else
    perform registrar_actividad('caja', 'Borró el movimiento de caja #' || old.numero, etiqueta(old.tipo) || ' · ' || describir_movimiento_caja(old));
  end if;
  return null;
end;
$$;
create trigger actividad_caja after insert or delete on movimientos_caja for each row execute function actividad_caja();

-- Clientes ----------------------------------------------------------------------------------------------

create function actividad_cliente() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cambios text[] := '{}';
begin
  if tg_op = 'INSERT' then
    perform registrar_actividad('cliente', 'Agregó el cliente ' || new.nombre, concat_ws(' · ', new.telefono, etiqueta(new.segmento)), jsonb_build_object('cliente_id', new.id));
    return null;
  end if;
  if new.nombre <> old.nombre then v_cambios := v_cambios || ('nombre ' || old.nombre || ' → ' || new.nombre); end if;
  if new.telefono <> old.telefono then v_cambios := v_cambios || ('teléfono ' || old.telefono || ' → ' || new.telefono); end if;
  -- Pasar de "no compró" a "cliente" y de campaña a "compró" lo hace solo una venta: ya queda en la venta.
  if new.segmento <> old.segmento and not (old.segmento = 'no_compro' and new.segmento = 'cliente') then v_cambios := v_cambios || ('segmento ' || etiqueta(old.segmento) || ' → ' || etiqueta(new.segmento)); end if;
  if new.zona is distinct from old.zona then v_cambios := v_cambios || ('zona ' || coalesce(etiqueta(old.zona), 'sin zona') || ' → ' || coalesce(etiqueta(new.zona), 'sin zona')); end if;
  if new.notas is distinct from old.notas then v_cambios := v_cambios || ('notas: ' || coalesce(nullif(left(new.notas, 120), ''), '(vacías)')); end if;
  if new.consentimiento <> old.consentimiento then v_cambios := v_cambios || ('consentimiento ' || etiqueta(old.consentimiento) || ' → ' || etiqueta(new.consentimiento)); end if;
  if new.edad_verificada <> old.edad_verificada then v_cambios := v_cambios || ('edad verificada ' || case when new.edad_verificada then 'sí' else 'no' end); end if;
  if new.estado_campana <> old.estado_campana and new.estado_campana <> 'compro' then v_cambios := v_cambios || ('campaña ' || etiqueta(old.estado_campana) || ' → ' || etiqueta(new.estado_campana)); end if;
  if cardinality(v_cambios) > 0 then
    perform registrar_actividad('cliente', 'Modificó el cliente ' || new.nombre, array_to_string(v_cambios, ' · '), jsonb_build_object('cliente_id', new.id));
  end if;
  return null;
end;
$$;
create trigger actividad_cliente after insert or update on clientes for each row execute function actividad_cliente();

-- Configuración ------------------------------------------------------------------------------------------

create function actividad_configuracion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cotizacion_usd is distinct from old.cotizacion_usd then
    perform registrar_actividad('configuracion', 'Cambió la cotización del dólar', coalesce(formato_importe(old.cotizacion_usd), '—') || ' → ' || coalesce(formato_importe(new.cotizacion_usd), '—'));
  end if;
  if new.stock_bajo is distinct from old.stock_bajo then
    perform registrar_actividad('configuracion', 'Cambió el aviso de bajo stock', old.stock_bajo || ' → ' || new.stock_bajo || ' unidades o menos');
  end if;
  return null;
end;
$$;
create trigger actividad_configuracion after update on configuracion for each row execute function actividad_configuracion();

-- Nadie puede llamar estas funciones directamente desde el CRM (solo las usan los triggers).
revoke execute on function registrar_actividad, describir_venta, actividad_venta, actividad_venta_borrada, actividad_stock,
  actividad_producto, actividad_sabores_nuevos, actividad_sabores_cambiados, actividad_caja, actividad_cliente, actividad_configuracion
  from public, anon, authenticated;

-- Lo que ya había: las ventas cargadas antes de este registro (se sabe quién las cargó).
insert into actividad (fecha, usuario_email, tipo, accion, detalle, datos)
select v.created_at, v.cargada_por_email, 'venta', 'Cargó la venta #' || v.numero, describir_venta(v.id), jsonb_build_object('venta_id', v.id)
  from ventas v order by v.created_at;
