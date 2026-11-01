-- Nova tabela za procjenu potrosnje u tekucem mjesecu. Postojece tabele se ne mijenjaju.

USE racuni_struja;

CREATE TABLE IF NOT EXISTS ocitanja (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  datum     DATE NOT NULL,
  vt_stanje DECIMAL(12,2) NOT NULL,   -- skupa struja (AVT)
  mt_stanje DECIMAL(12,2) NOT NULL,   -- jeftina struja (AMT)
  uneseno   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_datum (datum)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
