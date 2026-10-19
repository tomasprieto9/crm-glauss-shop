-- Tablas que generó V0 con Prisma y que la app nunca usó. Estaban vacías y con una
-- política que dejaba leer y escribir a cualquiera (rol anon). Las reemplazan las
-- tablas de la Fase 2 (productos, ventas, venta_items, movimientos).
drop table if exists sale_items;
drop table if exists sales;
drop table if exists products;
drop table if exists clients;
drop table if exists expenses;
