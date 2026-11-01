import { parsirajRacun, RacunParseError } from '../services/racunParser.js';
import * as RacuniService from '../services/racuni.service.js';

export const lista = async (req, res) => {
  try {
    const evidencija = await RacuniService.ucitajEvidenciju();
    return res.json({ success: true, ...evidencija });
  } catch (error) {
    console.error('Greska pri citanju potrosnje:', error);
    return res.status(500).json({ success: false, message: 'Greška pri čitanju potrošnje' });
  }
};

export const uvezi = async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ success: false, message: 'PDF fajl nije poslan' });
  }

  try {
    const racun = await parsirajRacun(req.body);
    const novi = await RacuniService.sacuvajRacun(racun);
    return res.status(novi ? 201 : 200).json({
      success: true,
      status: novi ? 'dodan' : 'postoji',
      mjesec: `${racun.periodDo.slice(0, 7)}-01`,
    });
  } catch (error) {
    if (error instanceof RacunParseError) {
      return res.status(422).json({ success: false, message: error.message, detalji: error.detalji });
    }
    console.error('Greska pri uvozu racuna:', error);
    return res.status(500).json({ success: false, message: 'Greška pri uvozu računa' });
  }
};

export const obrisi = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ success: false, message: 'Neispravan mjesec' });
  }

  try {
    const obrisan = await RacuniService.obrisiMjesec(id);
    if (!obrisan) return res.status(404).json({ success: false, message: 'Mjesec nije pronađen' });
    return res.json({ success: true });
  } catch (error) {
    console.error('Greska pri brisanju mjeseca:', error);
    return res.status(500).json({ success: false, message: 'Greška pri brisanju' });
  }
};
