-- Nova tabela: stanja brojila poslana Elektrokrajini emailom.
-- Sluzi da se poslano stanje uporedi sa stanjem koje stigne na racunu.
-- Pokrenuti jednom, prije novog koda aplikacije.

USE racuni_struja;

CREATE TABLE IF NOT EXISTS poslana_stanja (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  poslano   DATETIME NOT NULL,         -- lokalno vrijeme slanja
  vt_stanje DECIMAL(12,2) NOT NULL,    -- skupa struja (AVT)
  mt_stanje DECIMAL(12,2) NOT NULL,    -- jeftina struja (AMT)
  primalac  VARCHAR(120) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
