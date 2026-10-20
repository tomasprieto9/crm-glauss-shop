-- Finanzas: cajas de Lucas y Gonzalo por medio (efectivo, transferencia, dólares).
-- El saldo de cada caja = ventas que cobró esa persona por ese medio + movimientos de caja.
create table movimientos_caja (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  fecha date not null,
  tipo text not null check (tipo in ('egreso','pase','retiro','aporte','ajuste')),
  persona text not null check (persona in ('lucas','gonzalo')),          -- caja afectada (en un pase, la de origen)
  medio text not null check (medio in ('efectivo','transferencia','dolares')),
  monto numeric(12,2) not null,                                           -- positivo; en un ajuste puede ser negativo
  destino_persona text check (destino_persona in ('lucas','gonzalo')),   -- solo pases
  destino_medio text check (destino_medio in ('efectivo','transferencia','dolares')),
  monto_destino numeric(12,2),                                            -- en un pase, lo que llega (distinto si cambia de moneda)
  categoria text check (categoria in ('mercaderia','alquiler','sueldos','servicios','publicidad','envios','impuestos','otros')),
  descripcion text,
  creado_por uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check ((tipo = 'ajuste' and monto <> 0) or (tipo <> 'ajuste' and monto > 0)),
  check ((tipo = 'egreso') = (categoria is not null)),
  check ((tipo = 'pase') = (destino_persona is not null and destino_medio is not null and monto_destino > 0))
);
create index movimientos_caja_fecha on movimientos_caja(fecha);

alter table movimientos_caja enable row level security;
create policy "autenticados leen" on movimientos_caja for select to authenticated using (true);
create policy "autenticados escriben" on movimientos_caja for insert to authenticated with check (true);
create policy "autenticados borran" on movimientos_caja for delete to authenticated using (true);

-- Saldo de cada caja (persona + medio). Los montos en dólares quedan en dólares.
create view saldos_caja with (security_invoker = true) as
select persona, medio, sum(monto)::numeric(14,2) as saldo
from (
  select recibio as persona, metodo_pago as medio, total as monto from ventas
  union all
  select persona, medio, case when tipo in ('aporte', 'ajuste') then monto else -monto end from movimientos_caja
  union all
  select destino_persona, destino_medio, monto_destino from movimientos_caja where tipo = 'pase'
) movimientos
group by persona, medio;

-- Arqueo: compara lo contado con el saldo calculado y, si hay diferencia, la registra como ajuste.
-- Devuelve la diferencia (contado - calculado).
create function registrar_arqueo(p_persona text, p_medio text, p_contado numeric, p_nota text) returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_saldo numeric;
  v_diferencia numeric(12,2);
begin
  select coalesce(sum(saldo), 0) into v_saldo from saldos_caja where persona = p_persona and medio = p_medio;
  v_diferencia := round(p_contado - v_saldo, 2);
  if v_diferencia <> 0 then
    insert into movimientos_caja (fecha, tipo, persona, medio, monto, descripcion)
    values ((now() at time zone 'America/Argentina/Buenos_Aires')::date, 'ajuste', p_persona, p_medio, v_diferencia,
            coalesce(nullif(trim(p_nota), ''), 'Arqueo de caja'));
  end if;
  return v_diferencia;
end;
$$;

revoke execute on function registrar_arqueo from public, anon;
grant execute on function registrar_arqueo to authenticated;
