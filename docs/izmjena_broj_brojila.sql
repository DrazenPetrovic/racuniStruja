-- Izmjena za vec napravljenu tabelu potrosnja: dodaje broj brojila sa racuna.
-- Pokrenuti jednom, prije novog koda aplikacije. Postojeci podaci ostaju.

USE racuni_struja;

ALTER TABLE potrosnja
  ADD COLUMN broj_brojila VARCHAR(20) NULL AFTER broj_racuna;

-- Vec uvezeni mjeseci nemaju broj brojila. Upisati ga rucno (kao root, jer korisnik
-- aplikacije nema UPDATE pravo), sa broja koji pise na racunu:
-- UPDATE potrosnja SET broj_brojila = 'BROJ_SA_RACUNA' WHERE broj_brojila IS NULL;
