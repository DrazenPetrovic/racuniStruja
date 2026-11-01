import * as OcitanjaService from '../services/ocitanja.service.js';
import * as RacuniService from '../services/racuni.service.js';
import { procijeni, provjeriOcitanje, zadnjePoznatoStanje } from '../services/procjena.js';

const danasnjiDatum = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sarajevo' }).format(new Date());

const ispravanDatum = (datum) =>
  typeof datum === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(datum) &&
  !Number.isNaN(Date.parse(`${datum}T00:00:00Z`)) &&
  new Date(`${datum}T00:00:00Z`).toISOString().startsWith(datum);

const ispravnoStanje = (broj) => typeof broj === 'number' && Number.isFinite(broj) && broj >= 0 && broj < 1e9;

const stanjeZaPrikaz = (racuni, ocitanja) => ({
  ocitanja: [...ocitanja].reverse(),
  zadnjePoznato: zadnjePoznatoStanje(racuni, ocitanja),
  procjena: procijeni(racuni, ocitanja),
});

export const lista = async (req, res) => {
  try {
    const [{ racuni }, ocitanja] = await Promise.all([
      RacuniService.ucitajEvidenciju(),
      OcitanjaService.listaOcitanja(),
    ]);
    return res.json({ success: true, ...stanjeZaPrikaz(racuni, ocitanja) });
  } catch (error) {
    console.error('Greska pri citanju ocitanja:', error);
    return res.status(500).json({ success: false, message: 'Greška pri čitanju očitanja' });
  }
};

export const sacuvaj = async (req, res) => {
  const { datum, vt, mt } = req.body ?? {};
  if (!ispravanDatum(datum) || !ispravnoStanje(vt) || !ispravnoStanje(mt)) {
    return res.status(400).json({ success: false, message: 'Unesi ispravan datum i oba stanja brojila' });
  }

  try {
    const [{ racuni }, ocitanja] = await Promise.all([
      RacuniService.ucitajEvidenciju(),
      OcitanjaService.listaOcitanja(),
    ]);
    if (racuni.length === 0) {
      return res.status(422).json({ success: false, message: 'Prvo uvezi bar jedan račun, zbog cijena i početnog stanja.' });
    }

    const provjera = provjeriOcitanje({ datum, vt, mt }, racuni, ocitanja, danasnjiDatum());
    if (provjera.greska) {
      return res.status(422).json({ success: false, message: provjera.greska });
    }

    await OcitanjaService.sacuvajOcitanje({ datum, vt, mt });
    const nova = await OcitanjaService.listaOcitanja();
    return res.json({ success: true, upozorenja: provjera.upozorenja, ...stanjeZaPrikaz(racuni, nova) });
  } catch (error) {
    console.error('Greska pri upisu ocitanja:', error);
    return res.status(500).json({ success: false, message: 'Greška pri upisu očitanja' });
  }
};

export const obrisi = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ success: false, message: 'Neispravno očitanje' });
  }

  try {
    const obrisano = await OcitanjaService.obrisiOcitanje(id);
    if (!obrisano) return res.status(404).json({ success: false, message: 'Očitanje nije pronađeno' });
    const [{ racuni }, ocitanja] = await Promise.all([
      RacuniService.ucitajEvidenciju(),
      OcitanjaService.listaOcitanja(),
    ]);
    return res.json({ success: true, ...stanjeZaPrikaz(racuni, ocitanja) });
  } catch (error) {
    console.error('Greska pri brisanju ocitanja:', error);
    return res.status(500).json({ success: false, message: 'Greška pri brisanju očitanja' });
  }
};
