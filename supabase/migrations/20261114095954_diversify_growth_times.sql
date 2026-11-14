update public.garden_catalog as catalog
set grow_seconds = times.grow_seconds
from (values
 ('carrot',1800),
 ('rice',3600),
 ('onion',5400),
 ('lettuce',2700),
 ('potato',7200),
 ('cabbage',10800),
 ('corn',14400),
 ('tomato',18000),
 ('eggplant',21600),
 ('pumpkin',54000),
 ('strawberry',36000),
 ('cucumber',28800),
 ('chili',43200),
 ('bell_pepper',64800),
 ('sweet_potato',86400),
 ('pineapple',129600),
 ('watermelon',172800),
 ('peanut',108000),
 ('mango',259200),
 ('apple',237600),
 ('banana',201600)
) as times(id, grow_seconds)
where catalog.id = times.id and catalog.kind = 'seed' and not catalog.retired;
