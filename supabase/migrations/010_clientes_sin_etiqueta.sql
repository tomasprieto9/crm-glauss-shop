-- Lista completa de contactos (pedido de Tomás, 22/10/2026): se suman los "Sin etiqueta" del celular
-- y los contactos agendados sin teléfono. Los menores de edad siguen sin cargarse (Ley 26.687).

alter table clientes drop constraint clientes_segmento_check;
alter table clientes add constraint clientes_segmento_check
  check (segmento in ('cliente','no_compro','publicidad','comercio','comercio_prospecto','sin_etiqueta'));

-- Un contacto puede no tener teléfono (la unicidad sigue valiendo para los que sí tienen).
alter table clientes alter column telefono drop not null;
