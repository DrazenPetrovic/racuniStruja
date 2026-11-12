import { withConnection } from './db.service.js';

const mapirajRed = (red) => ({
  id: red.id,
  datum: red.datum,
  // TIME dolazi kao "07:30:00", a prikazuje se "07:30"
  vrijeme: red.vrijeme ? red.vrijeme.slice(0, 5) : null,
  vt: red.vt_stanje,
  mt: red.mt_stanje,
});

export const listaOcitanja = async () =>
  withConnection(async (connection) => {
    const [rows] = await connection.execute(
      'SELECT id, datum, vrijeme, vt_stanje, mt_stanje FROM ocitanja ORDER BY datum, vrijeme IS NULL, vrijeme',
    );
    return rows.map(mapirajRed);
  });

// Novo stanje za isti dan i isto vrijeme zamjenjuje prethodno
export const sacuvajOcitanje = async ({ datum, vrijeme, vt, mt }) =>
  withConnection(async (connection) => {
    await connection.execute(
      'REPLACE INTO ocitanja (datum, vrijeme, vt_stanje, mt_stanje) VALUES (?, ?, ?, ?)',
      [datum, vrijeme, vt, mt],
    );
  });

export const nadjiOcitanje = async (id) =>
  withConnection(async (connection) => {
    const [rows] = await connection.execute(
      'SELECT id, datum, vrijeme, vt_stanje, mt_stanje FROM ocitanja WHERE id = ?',
      [id],
    );
    return rows.length ? mapirajRed(rows[0]) : null;
  });

export const obrisiOcitanje = async (id) =>
  withConnection(async (connection) => {
    const [result] = await connection.execute('DELETE FROM ocitanja WHERE id = ?', [id]);
    return result.affectedRows > 0;
  });
