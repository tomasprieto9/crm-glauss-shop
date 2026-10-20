-- Fotos de los 15 productos de la lista del 19/10/2026 (sacadas del PDF, en public/productos/).
update productos p set foto_url = f.foto_url
from (values
  ('Luffbar', '55K', '/productos/luffbar-55k.webp'),
  ('Elfbar', '15K', '/productos/elfbar-15k.webp'),
  ('Ignite', 'V150', '/productos/ignite-v150.webp'),
  ('Lost Mary', '20K MO20000 Pro', '/productos/lost-mary-20k.webp'),
  ('Geek Bar', 'Skyview 25K', '/productos/geek-bar-skyview-25k.webp'),
  ('Elfbar', '30K', '/productos/elfbar-30k.webp'),
  ('Lost Mary', '35K Dura', '/productos/lost-mary-35k-dura.webp'),
  ('Elfbar', 'Ice King Summer Edition', '/productos/elfbar-ice-king-summer.webp'),
  ('Elfbar', 'Ice King', '/productos/elfbar-ice-king.webp'),
  ('Ignite', 'V500', '/productos/ignite-v500.webp'),
  ('Black Sheep', '55K', '/productos/black-sheep-55k.webp'),
  ('Packman', '2.0', '/productos/packman-2-0.webp'),
  ('Packman', 'Halloween Edition', '/productos/packman-halloween.webp'),
  ('Roar', '2.5', '/productos/roar-2-5.webp'),
  ('Roar', '3.5', '/productos/roar-3-5.webp')
) as f(marca, nombre, foto_url)
where p.marca = f.marca and p.nombre = f.nombre;
