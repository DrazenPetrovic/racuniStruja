import { withConnection } from './db.service.js';
import { dopuniMjesece } from './racunAnaliza.js';

const TARIFE = ['vt', 'mt'];
const ZONE = ['bijela', 'plava', 'crvena'];

const zoneIzReda = (red, t) =>
  Object.fromEntries(
    ZONE.map((z) => [
      z,
      { kwh: red[`${t}_${z}_kwh`], cijena: red[`${t}_${z}_cijena`], iznos: red[`${t}_${z}_iznos`] },
    ]),
  );

const mapirajRed = (red) => ({
  id: red.id,
  mjesec: red.mjesec,
  brojRacuna: red.broj_racuna,
  zone: { vt: zoneIzReda(red, 'vt'), mt: zoneIzReda(red, 'mt') },
  vtMrezaKm: red.vt_mreza_km,
  mtMrezaKm: red.mt_mreza_km,
  fiksnoKm: red.fiksno_km,
  pdvStopa: red.pdv_stopa,
  pdvKm: red.pdv_km,
  ukupnoKm: red.ukupno_km,
  brojilo: { datum: red.datum_ocitanja, vt: red.vt_stanje, mt: red.mt_stanje },
});

export const ucitajEvidenciju = async () => {
  const redovi = await withConnection(async (connection) => {
    const [rows] = await connection.execute('SELECT * FROM potrosnja');
    return rows;
  });
  return dopuniMjesece(redovi.map(mapirajRed));
};

const kolicineZona = TARIFE.flatMap((t) => ZONE.flatMap((z) => [`${t}_${z}_kwh`, `${t}_${z}_cijena`, `${t}_${z}_iznos`]));
const kolone = ['mjesec', 'broj_racuna', ...kolicineZona, 'vt_mreza_km', 'mt_mreza_km', 'fiksno_km', 'pdv_stopa', 'pdv_km', 'ukupno_km', 'datum_ocitanja', 'vt_stanje', 'mt_stanje'];

export const redZaUpis = (racun) => {
  const { vt, mt, snaga } = racun.obracun;
  const { iznosi, zone } = racun;
  return [
    `${racun.periodDo.slice(0, 7)}-01`,
    racun.brojRacuna,
    ...TARIFE.flatMap((t) => ZONE.flatMap((z) => [zone[t][z].kwh, zone[t][z].cijena, zone[t][z].iznos])),
    Number((vt.prenos + vt.distribucija + vt.oiee).toFixed(2)),
    Number((mt.prenos + mt.distribucija + mt.oiee).toFixed(2)),
    Number((snaga.prenos + snaga.distribucija + iznosi.snabdijevanje + iznosi.zajednicka).toFixed(2)),
    iznosi.pdvStopa,
    iznosi.pdv,
    iznosi.saPdv,
    racun.datumOcitanja,
    racun.brojilo.vt.novo,
    racun.brojilo.mt.novo,
  ];
};

// Vraca false ako je potrosnja za taj mjesec vec uvezena
export const sacuvajRacun = async (racun) =>
  withConnection(async (connection) => {
    try {
      await connection.execute(
        `INSERT INTO potrosnja (${kolone.join(', ')}) VALUES (${kolone.map(() => '?').join(', ')})`,
        redZaUpis(racun),
      );
      return true;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return false;
      throw error;
    }
  });

export const obrisiMjesec = async (id) =>
  withConnection(async (connection) => {
    const [result] = await connection.execute('DELETE FROM potrosnja WHERE id = ?', [id]);
    return result.affectedRows > 0;
  });
