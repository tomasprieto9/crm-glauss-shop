-- Lista de precios Glauss del 19/10/2026: 15 modelos con precio efectivo, transferencia, promo x3 y sabores.
-- Se puede volver a correr: actualiza precios y promo, y agrega los sabores que falten (no duplica).
-- No trae precio en dólares: se carga a mano en cada producto.
with lista (marca, nombre, efectivo, transferencia, promo_x3, sabores) as (values
  ('Luffbar', '55K', 26000, 28000, 72000, array['Blue Razz Watermelon', 'Strawberry B Pop', 'Strawnana', 'Fruticool Strawberry', 'Fruticool Watermelon']),
  ('Elfbar', '15K', 21000, 23000, 58000, array['Watermelon Ice', 'Strawberry Watermelon', 'Strawberry Kiwi', 'Strawberry Ice', 'Sakura Grape', 'Pineapple Ice', 'Peach Mango Watermelon', 'Miami Mint', 'Mango Magic', 'Green Apple Ice', 'Bubbaloo Grape', 'Blueberry Ice', 'Blue Razz Ice', 'Americano Ice']),
  ('Ignite', 'V150', 24000, 25000, 66000, array['Green Apple Peach Kiwi', 'Dragon Fruit Lemonade', 'Blueberry Ice', 'Aloe Grape']),
  ('Lost Mary', '20K MO20000 Pro', 22000, 24000, 60000, array['Pure Ice']),
  ('Geek Bar', 'Skyview 25K', 22000, 24000, 60000, array['Sour Apple Ice', 'Miami Mint']),
  ('Elfbar', '30K', 26000, 28000, 75000, array['Watermelon Ice', 'Acai Banana Ice', 'Blueberry Ice', 'Bubbaloo Grape', 'Bubbaloo Tutti Frutti', 'Cherry Strazz', 'Dragon Strawnana', 'Menthol', 'Pineapple Ice', 'Pineapple Mango', 'Strawberry Ice', 'Strawberry Watermelon Ice']),
  ('Lost Mary', '35K Dura', 25000, 26000, 70000, array['Strawberry Watermelon', 'Grape Passion Guava', 'Menthol', 'Strawberry Kiwi', 'Miami Mint', 'Green Apple Ice']),
  ('Elfbar', 'Ice King Summer Edition', 24000, 26000, 66000, array['Cola Slush', 'Triple Berry']),
  ('Elfbar', 'Ice King', 28000, 30000, 81000, array['Cherry Strazz', 'Peach +', 'Strawberry Ice', 'Sour Lush Gummy', 'Blue Razz Ice', 'Strawberry Watermelon', 'Grape Ice', 'Tiger Blood', 'Bubbaloo Tutti Frutti', 'Miami Mint', 'Green Apple Ice', 'Sour Strawberry Dragon', 'Mango Magic', 'Watermelon Ice', 'Cranberry Pineapple Juice', 'Melon Grape Menthol', 'Peach Mango Watermelon']),
  ('Ignite', 'V500', 34000, 35000, 96000, array['Strawberry Banana', 'Kiwi Strawberry', 'Grape Ice', 'Pineapple Ice', 'Strawberry Watermelon', 'Pineapple Mango', 'Strawberry Ice', 'Watermelon Mix', 'Watermelon Ice', 'Peach Grape', 'Banana Cherry', 'Blueberry Ice']),
  ('Black Sheep', '55K', 32000, 34000, 90000, array['Passion Fruit']),
  ('Packman', '2.0', 60000, 65000, 160000, array['Strawberry Cough / Forbidden Fruit', 'Apple Fritter / Coconut Milk', 'Mochi Gelato / Mango Kush', 'Blueberry Boosted / Bubba Kush', 'Jolly Rancher / Cherry Zkittlez', 'Lemon Lime / Fruity Pebblez', 'Grapefruit Romulan / Pineapple Express', 'Starburst / Orange Punch', 'Watermelon Kiss / Banana Sundae', 'Snow Caps / Texas Codeine']),
  ('Packman', 'Halloween Edition', 60000, 65000, 160000, array['Jack O'' Lantern / Skull Candy', 'Pumpkin Spice / Zombie Kush', 'Spooky Watermelon / Bloody Blackberry Pie', 'Lemon Cherry / Orange Sorbet', 'Vampire Sunrise / Vampire Kiss', 'Trick Or Tropical / Creepy Cotton Candy', 'Ghostly Pineapple Express / Zombie Citrus Blast', 'Moonlight / Mango Mist']),
  ('Roar', '2.5', 58000, 62000, 165000, array['Honey Bun / Rolex OG', 'Rainbow Gushers / Zkittlez', 'Dragon Fruit / Georgia Pie', 'Tropical Slushy / Pixie Dust']),
  ('Roar', '3.5', 62000, 68000, 180000, array['Maui Wowie', 'Caviar Sauce', 'Gelato Cream', 'Moon Rocks', 'Pineapple Go', 'Cookie Dough', 'Gunpowder', 'Strawberry Zkittlez', 'Blueberry Muffin', 'Mango Mimosa'])
), cargados as (
  insert into productos (marca, nombre, precio_efectivo, precio_transferencia, promo_x3)
  select marca, nombre, efectivo, transferencia, promo_x3 from lista
  on conflict (marca, nombre) do update set
    precio_efectivo = excluded.precio_efectivo,
    precio_transferencia = excluded.precio_transferencia,
    promo_x3 = excluded.promo_x3
  returning id, marca, nombre
)
insert into sabores (producto_id, nombre)
select cargados.id, unnest(lista.sabores)
  from cargados join lista using (marca, nombre)
on conflict (producto_id, nombre) do nothing;
