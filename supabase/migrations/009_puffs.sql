-- Cantidad de puffs (aspiradas) de cada vaporizador: los productos se ordenan por esto, como en el catálogo de Glauss.
-- Los que no son por puffs (THC: mg o gramos) quedan sin dato y van al final.

alter table productos add column puffs integer check (puffs > 0);

update productos p set puffs = v.puffs
from (values
  ('Elfbar', '15K', 15000), ('Ignite', 'V150', 15000), ('Lost Mary', '20K MO20000 Pro', 20000), ('Elfbar', '23K', 23000),
  ('Geek Bar', 'Skyview 25K', 25000), ('Elfbar', '30K', 30000), ('Oxbar', 'Maze 30K', 30000), ('Lost Mary', '35K Dura', 35000),
  ('Elfbar', 'Ice King Summer Edition', 40000), ('Elfbar', 'Ice King', 40000), ('Elfbar', 'Trio 40K', 40000),
  ('Black Sheep', '40K', 40000), ('Ignite', 'V400', 40000), ('Ignite', 'V500', 50000),
  ('Luffbar', '55K', 55000), ('Black Sheep', '55K', 55000)
) as v(marca, nombre, puffs)
where p.marca = v.marca and p.nombre = v.nombre;
