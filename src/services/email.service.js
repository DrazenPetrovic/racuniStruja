import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const e = env.EMAIL;

// Slanje je moguce tek kad su u .env upisani svi podaci
export const podesenoSlanje = () =>
  Boolean(e.GMAIL_USER && e.GMAIL_APP_PASSWORD && e.PRIMALAC && e.BROJ_BROJILA && e.IME_PREZIME && e.ADRESA);

// Stanje se salje samo od 28. u mjesecu do 3. u sljedecem, po lokalnom vremenu
export const PERIOD_SLANJA = { od: 28, do: 3 };

const danUMjesecu = (trenutak) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Sarajevo', day: 'numeric' }).format(trenutak));

export const dozvoljenoSlanje = (trenutak = new Date()) => {
  const dan = danUMjesecu(trenutak);
  return dan >= PERIOD_SLANJA.od || dan <= PERIOD_SLANJA.do;
};

export const postavkeSlanja = () => ({
  podeseno: podesenoSlanje(),
  dozvoljeno: dozvoljenoSlanje(),
  period: PERIOD_SLANJA,
  primalac: e.PRIMALAC || null,
  brojBrojila: e.BROJ_BROJILA || null,
});

// Stanje bez separatora hiljada, da se ne pomijesa sa decimalama: 9111 ili 9111,5
const stanjeTekst = (broj) => (Number.isInteger(broj) ? String(broj) : String(broj).replace('.', ','));

const html = (s) =>
  String(s).replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[z]);

// Datum ocitanja se ne navodi, Elektrokrajina uzima trenutak slanja
export const sastaviPoruku = ({ vt, mt }) => {
  const svrha = `U SVRHU OČITANJA BROJILA ${e.BROJ_BROJILA}`;
  const avt = stanjeTekst(vt);
  const amt = stanjeTekst(mt);

  const tekst = [
    'Poštovani,',
    '',
    'dostavljam stanje brojila:',
    '',
    `Broj brojila: ${e.BROJ_BROJILA}`,
    `Ime i prezime: ${e.IME_PREZIME}`,
    `Adresa: ${e.ADRESA}`,
    '',
    `AVT stanje: ${avt}`,
    '',
    `AMT stanje: ${amt}`,
    '',
    'Ove podatke šaljem u svrhu očitanja brojila.',
    '',
    'S poštovanjem,',
    e.IME_PREZIME,
  ].join('\n');

  const stanjeRed = (oznaka, vrijednost) =>
    `<p style="margin:16px 0;font-size:22px">${oznaka} stanje: <strong style="font-size:26px">${html(vrijednost)}</strong></p>`;

  const htmlTekst = [
    '<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">',
    '<p>Poštovani,</p>',
    '<p>dostavljam stanje brojila:</p>',
    `<p style="margin:0">Broj brojila: <strong>${html(e.BROJ_BROJILA)}</strong></p>`,
    `<p style="margin:0">Ime i prezime: ${html(e.IME_PREZIME)}</p>`,
    `<p style="margin:0">Adresa: ${html(e.ADRESA)}</p>`,
    stanjeRed('AVT', avt),
    stanjeRed('AMT', amt),
    '<p>Ove podatke šaljem u svrhu očitanja brojila.</p>',
    `<p>S poštovanjem,<br>${html(e.IME_PREZIME)}</p>`,
    '</div>',
  ].join('\n');

  return { naslov: svrha, tekst, html: htmlTekst };
};

let transporter;
const dajTransporter = () => {
  transporter ??= nodemailer.createTransport({
    service: 'gmail',
    auth: { user: e.GMAIL_USER, pass: e.GMAIL_APP_PASSWORD },
  });
  return transporter;
};

export const posaljiStanje = async (ocitanje) => {
  const { naslov, tekst, html: htmlTekst } = sastaviPoruku(ocitanje);
  await dajTransporter().sendMail({
    from: { name: e.IME_PREZIME, address: e.GMAIL_USER },
    to: e.PRIMALAC,
    subject: naslov,
    text: tekst,
    html: htmlTekst,
  });
  return { primalac: e.PRIMALAC };
};
