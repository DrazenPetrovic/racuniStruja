-- Izmjena za vec napravljenu tabelu potrosnja: dodaje stanje brojila.
-- Pokrenuti jednom, prije novog koda aplikacije. Postojeci podaci ostaju.

USE racuni_struja;

ALTER TABLE potrosnja
  ADD COLUMN datum_ocitanja DATE NULL AFTER ukupno_km,
  ADD COLUMN vt_stanje DECIMAL(12,2) NULL AFTER datum_ocitanja,
  ADD COLUMN mt_stanje DECIMAL(12,2) NULL AFTER vt_stanje;

-- Stanje brojila za vec uvezene mjesece, sa racuna 7-9/2026.
-- Mjesec koji jos nije uvezen se samo preskace.
UPDATE potrosnja SET datum_ocitanja = '2026-06-30', vt_stanje = 7496, mt_stanje = 8119 WHERE mjesec = '2026-06-01';
UPDATE potrosnja SET datum_ocitanja = '2026-07-31', vt_stanje = 7899, mt_stanje = 8563 WHERE mjesec = '2026-07-01';
UPDATE potrosnja SET datum_ocitanja = '2026-08-31', vt_stanje = 8295, mt_stanje = 8825 WHERE mjesec = '2026-08-01';
UPDATE potrosnja SET datum_ocitanja = '2026-09-30', vt_stanje = 8565, mt_stanje = 9111 WHERE mjesec = '2026-09-01';
