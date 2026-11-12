-- Izmjena za vec napravljenu tabelu ocitanja: dodaje vrijeme ocitanja,
-- da se isti dan moze unijeti vise puta (npr. ujutro i uvece).
-- Pokrenuti jednom, prije novog koda aplikacije. Postojeci unosi ostaju bez vremena
-- i racunaju se kao stanje na kraju dana, isto kao do sada.

USE racuni_struja;

ALTER TABLE ocitanja
  ADD COLUMN vrijeme TIME NULL AFTER datum,
  DROP INDEX uq_datum,
  ADD UNIQUE KEY uq_trenutak (datum, vrijeme);
