import { withConnection } from './db.service.js';

const mapirajRed = (red) => ({
  id: red.id,
  datum: red.datum,
  vt: red.vt_stanje,
  mt: red.mt_stanje,
});

export const listaOcitanja = async () =>
  withConnection(async (connection) => {
    const [rows] = await connection.execute(
      'SELECT id, datum, vt_stanje, mt_stanje FROM ocitanja ORDER BY datum',
    );
    return rows.map(mapirajRed);
  });

// Novo stanje za isti dan zamjenjuje prethodno
export const sacuvajOcitanje = async ({ datum, vt, mt }) =>
  withConnection(async (connection) => {
    await connection.execute(
      'REPLACE INTO ocitanja (datum, vt_stanje, mt_stanje) VALUES (?, ?, ?)',
      [datum, vt, mt],
    );
  });

export const obrisiOcitanje = async (id) =>
  withConnection(async (connection) => {
    const [result] = await connection.execute('DELETE FROM ocitanja WHERE id = ?', [id]);
    return result.affectedRows > 0;
  });
