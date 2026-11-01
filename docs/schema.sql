-- Baza aplikacije Racuni Struja. Nezavisna je od ostalih baza na serveru.
-- Pokrenuti jednom:  mysql -u root -p < docs/schema.sql
-- Ako je ranije napravljena tabela `racuni`, ona se vise ne koristi: DROP TABLE racuni;

CREATE DATABASE IF NOT EXISTS racuni_struja CHARACTER SET utf8mb4;
USE racuni_struja;

-- Jedan red je jedan mjesec potrosnje.
-- vt = skupa struja (AVT), mt = jeftina struja (AMT)
-- Zone po ukupnoj mjesecnoj potrosnji: bijela do 500 kWh, plava 501-1.500 kWh, crvena od 1.501 kWh
CREATE TABLE IF NOT EXISTS potrosnja (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  mjesec           DATE NOT NULL,            -- prvi dan mjeseca, npr. 2026-07-01
  broj_racuna      VARCHAR(40) NOT NULL,

  vt_bijela_kwh    DECIMAL(10,2) NOT NULL,
  vt_bijela_cijena DECIMAL(8,4)  NOT NULL,
  vt_bijela_iznos  DECIMAL(10,2) NOT NULL,
  vt_plava_kwh     DECIMAL(10,2) NOT NULL,
  vt_plava_cijena  DECIMAL(8,4)  NOT NULL,
  vt_plava_iznos   DECIMAL(10,2) NOT NULL,
  vt_crvena_kwh    DECIMAL(10,2) NOT NULL,
  vt_crvena_cijena DECIMAL(8,4)  NOT NULL,
  vt_crvena_iznos  DECIMAL(10,2) NOT NULL,

  mt_bijela_kwh    DECIMAL(10,2) NOT NULL,
  mt_bijela_cijena DECIMAL(8,4)  NOT NULL,
  mt_bijela_iznos  DECIMAL(10,2) NOT NULL,
  mt_plava_kwh     DECIMAL(10,2) NOT NULL,
  mt_plava_cijena  DECIMAL(8,4)  NOT NULL,
  mt_plava_iznos   DECIMAL(10,2) NOT NULL,
  mt_crvena_kwh    DECIMAL(10,2) NOT NULL,
  mt_crvena_cijena DECIMAL(8,4)  NOT NULL,
  mt_crvena_iznos  DECIMAL(10,2) NOT NULL,

  vt_mreza_km      DECIMAL(10,2) NOT NULL,   -- mrezarina i OIEE za skupu struju, bez PDV-a
  mt_mreza_km      DECIMAL(10,2) NOT NULL,   -- mrezarina i OIEE za jeftinu struju, bez PDV-a
  fiksno_km        DECIMAL(10,2) NOT NULL,   -- dio koji ne zavisi od kWh, bez PDV-a
  pdv_stopa        DECIMAL(5,2)  NOT NULL,
  pdv_km           DECIMAL(10,2) NOT NULL,
  ukupno_km        DECIMAL(10,2) NOT NULL,   -- iznos sa PDV-om, bez zatezne kamate

  datum_ocitanja   DATE NULL,                -- stanje brojila na kraju mjeseca
  vt_stanje        DECIMAL(12,2) NULL,
  mt_stanje        DECIMAL(12,2) NULL,

  -- Zbirovi koje MySQL sam racuna
  vt_kwh     DECIMAL(10,2) AS (vt_bijela_kwh + vt_plava_kwh + vt_crvena_kwh) STORED,
  mt_kwh     DECIMAL(10,2) AS (mt_bijela_kwh + mt_plava_kwh + mt_crvena_kwh) STORED,
  bijela_kwh DECIMAL(10,2) AS (vt_bijela_kwh + mt_bijela_kwh) STORED,
  plava_kwh  DECIMAL(10,2) AS (vt_plava_kwh + mt_plava_kwh) STORED,
  crvena_kwh DECIMAL(10,2) AS (vt_crvena_kwh + mt_crvena_kwh) STORED,
  ukupno_kwh DECIMAL(10,2) AS (vt_bijela_kwh + vt_plava_kwh + vt_crvena_kwh
                               + mt_bijela_kwh + mt_plava_kwh + mt_crvena_kwh) STORED,

  uvezeno    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mjesec (mjesec)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Rucno upisana stanja brojila, za procjenu potrosnje u tekucem mjesecu
CREATE TABLE IF NOT EXISTS ocitanja (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  datum     DATE NOT NULL,
  vt_stanje DECIMAL(12,2) NOT NULL,   -- skupa struja (AVT)
  mt_stanje DECIMAL(12,2) NOT NULL,   -- jeftina struja (AMT)
  uneseno   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_datum (datum)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Poseban MySQL korisnik koji ima pristup samo ovoj bazi.
-- Pokrenuti rucno, sa svojom lozinkom:
--
-- CREATE USER 'struja'@'localhost' IDENTIFIED BY 'OVDJE_UPISITE_LOZINKU';
-- GRANT SELECT, INSERT, DELETE ON racuni_struja.* TO 'struja'@'localhost';
