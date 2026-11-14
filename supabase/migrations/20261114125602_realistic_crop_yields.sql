-- Each harvest is a game-sized portion; rice and peanuts represent bundles and portions.
update public.garden_catalog as c
set yield_min = v.minimum, yield_max = v.maximum
from (values
 ('carrot',2,5), ('rice',3,6), ('onion',2,5), ('lettuce',1,2),
 ('potato',4,8), ('cabbage',1,2), ('corn',1,2), ('tomato',4,8),
 ('eggplant',2,5), ('pumpkin',1,3), ('strawberry',5,10),
 ('cucumber',3,6), ('chili',6,12), ('bell_pepper',2,5),
 ('sweet_potato',3,6), ('pineapple',1,1), ('watermelon',1,2),
 ('peanut',4,8), ('mango',4,8), ('apple',4,8), ('banana',5,10)
) as v(id, minimum, maximum)
where c.id=v.id and c.kind='seed' and not c.retired;
