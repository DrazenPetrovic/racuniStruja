import * as OcitanjaService from '../services/ocitanja.service.js';
import * as RacuniService from '../services/racuni.service.js';
import * as EmailService from '../services/email.service.js';
import { uporediPoslana } from '../services/poslanaStanja.js';
import { kretanjePotrosnje, procijeni, provjeriOcitanje, zadnjePoznatoStanje } from '../services/procjena.js';

// "YYYY-MM-DD HH:MM" po lokalnom vremenu
const sadasnjiTrenutak = () =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Sarajevo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());

const ispravnoVrijeme = (vrijeme) => typeof vrijeme === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(vrijeme);

const ispravanDatum = (datum) =>
  typeof datum === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(datum) &&
  !Number.isNaN(Date.parse(`${datum}T00:00:00Z`)) &&
  new Date(`${datum}T00:00:00Z`).toISOString().startsWith(datum);

const ispravnoStanje = (broj) => typeof broj === 'number' && Number.isFinite(broj) && broj >= 0 && broj < 1e9;

const ucitajSve = async () => {
  const [{ racuni }, ocitanja, poslana] = await Promise.all([
    RacuniService.ucitajEvidenciju(),
    OcitanjaService.listaOcitanja(),
    OcitanjaService.listaPoslanih(),
  ]);
  return { racuni, ocitanja, poslana };
};

const stanjeZaPrikaz = ({ racuni, ocitanja, poslana }) => ({
  ocitanja: [...ocitanja].reverse(),
  poslana: uporediPoslana(poslana, racuni),
  zadnjePoznato: zadnjePoznatoStanje(racuni, ocitanja),
  procjena: procijeni(racuni, ocitanja),
  kretanje: kretanjePotrosnje(racuni, ocitanja),
  slanje: EmailService.postavkeSlanja(),
});

// Salje stanja koja je korisnik potvrdio u modalu. Poslano se biljezi, a ako je moguce upisuje i kao ocitanje.
export const posalji = async (req, res) => {
  const { vt, mt } = req.body ?? {};
  if (!ispravnoStanje(vt) || !ispravnoStanje(mt)) {
    return res.status(400).json({ success: false, message: 'Unesi oba stanja brojila' });
  }
  if (!EmailService.podesenoSlanje()) {
    return res.status(503).json({ success: false, message: 'Slanje emaila nije podešeno na serveru (.env).' });
  }
  if (!EmailService.dozvoljenoSlanje()) {
    const { od, do: doDana } = EmailService.PERIOD_SLANJA;
    return res.status(403).json({
      success: false,
      message: `Stanje se može poslati samo od ${od}. u mjesecu do ${doDana}. u sljedećem mjesecu.`,
    });
  }

  let primalac;
  try {
    ({ primalac } = await EmailService.posaljiStanje({ vt, mt }));
  } catch (error) {
    console.error('Greska pri slanju emaila:', error);
    const prijava = error?.code === 'EAUTH';
    return res.status(502).json({
      success: false,
      message: prijava ? 'Gmail nije prihvatio prijavu. Provjeri GMAIL_APP_PASSWORD.' : 'Email nije poslan. Pokušaj ponovo.',
    });
  }

  // Email je otisao. Greska u biljezenju ne smije izgledati kao neuspjelo slanje.
  const napomene = [];
  const sada = sadasnjiTrenutak();
  try {
    await OcitanjaService.zabiljeziPoslano({ poslano: sada, vt, mt, primalac });
  } catch (error) {
    console.error('Greska pri biljezenju poslanog stanja:', error);
    napomene.push('Email je poslan, ali nije zabilježen u aplikaciji.');
  }

  try {
    const { racuni, ocitanja } = await ucitajSve();
    const ocitanje = { datum: sada.slice(0, 10), vrijeme: sada.slice(11, 16), vt, mt };
    const provjera = racuni.length ? provjeriOcitanje(ocitanje, racuni, ocitanja, sada) : { greska: 'nema računa' };
    if (provjera.greska) {
      napomene.push(`Stanje nije upisano kao očitanje: ${provjera.greska}`);
    } else {
      await OcitanjaService.sacuvajOcitanje(ocitanje);
    }
  } catch (error) {
    console.error('Greska pri upisu poslanog ocitanja:', error);
    napomene.push('Stanje nije upisano kao očitanje.');
  }

  try {
    return res.json({ success: true, primalac, napomene, ...stanjeZaPrikaz(await ucitajSve()) });
  } catch (error) {
    console.error('Greska pri citanju nakon slanja:', error);
    return res.json({ success: true, primalac, napomene });
  }
};

export const obrisiPoslano = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ success: false, message: 'Neispravan zapis' });
  }

  try {
    const obrisano = await OcitanjaService.obrisiPoslano(id);
    if (!obrisano) return res.status(404).json({ success: false, message: 'Zapis nije pronađen' });
    return res.json({ success: true, ...stanjeZaPrikaz(await ucitajSve()) });
  } catch (error) {
    console.error('Greska pri brisanju poslanog stanja:', error);
    return res.status(500).json({ success: false, message: 'Greška pri brisanju' });
  }
};

export const lista = async (req, res) => {
  try {
    return res.json({ success: true, ...stanjeZaPrikaz(await ucitajSve()) });
  } catch (error) {
    console.error('Greska pri citanju ocitanja:', error);
    return res.status(500).json({ success: false, message: 'Greška pri čitanju očitanja' });
  }
};

export const sacuvaj = async (req, res) => {
  const { vt, mt } = req.body ?? {};
  // Bez datuma i vremena u zahtjevu ocitanje se biljezi sa trenutnim vremenom servera
  const sada = sadasnjiTrenutak();
  const datum = req.body?.datum ?? sada.slice(0, 10);
  const vrijeme = req.body?.vrijeme ?? sada.slice(11, 16);
  if (!ispravanDatum(datum) || !ispravnoVrijeme(vrijeme) || !ispravnoStanje(vt) || !ispravnoStanje(mt)) {
    return res.status(400).json({ success: false, message: 'Unesi oba stanja brojila' });
  }

  try {
    const { racuni, ocitanja } = await ucitajSve();
    if (racuni.length === 0) {
      return res.status(422).json({ success: false, message: 'Prvo uvezi bar jedan račun, zbog cijena i početnog stanja.' });
    }

    const provjera = provjeriOcitanje({ datum, vrijeme, vt, mt }, racuni, ocitanja, sada);
    if (provjera.greska) {
      return res.status(422).json({ success: false, message: provjera.greska });
    }

    await OcitanjaService.sacuvajOcitanje({ datum, vrijeme, vt, mt });
    return res.json({ success: true, upozorenja: provjera.upozorenja, ...stanjeZaPrikaz(await ucitajSve()) });
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
    return res.json({ success: true, ...stanjeZaPrikaz(await ucitajSve()) });
  } catch (error) {
    console.error('Greska pri brisanju ocitanja:', error);
    return res.status(500).json({ success: false, message: 'Greška pri brisanju očitanja' });
  }
};
