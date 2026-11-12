const MJESECI = [
  'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
  'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar',
];

const broj = (vrijednost: number, decimale: number) =>
  new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimale,
    maximumFractionDigits: decimale,
  }).format(vrijednost);

export const km = (vrijednost: number) => `${broj(vrijednost, 2)} KM`;
export const kwh = (vrijednost: number) => `${broj(vrijednost, 0)} kWh`;
export const cijena = (vrijednost: number) => broj(vrijednost, 4);
export const procenat = (vrijednost: number) => `${broj(vrijednost, 1)}%`;
export const cijeliBroj = (vrijednost: number) => broj(vrijednost, 0);

// "2026-09-30" -> "Septembar 2026"
export const mjesecGodina = (datum: string) => {
  const [godina, mjesec] = datum.split('-');
  return `${MJESECI[Number(mjesec) - 1]} ${godina}`;
};

export const kratakMjesec = (datum: string) => MJESECI[Number(datum.split('-')[1]) - 1].slice(0, 3);

export const datumIspis = (vrijednost: string) => {
  const [godina, mjesec, dan] = vrijednost.split('-');
  return `${dan}.${mjesec}.${godina}.`;
};

// "2026-09-01" -> "Sep 26"
export const kratakMjesecGodina = (datum: string) => `${kratakMjesec(datum)} ${datum.slice(2, 4)}`;

export const decimalni = (vrijednost: number, decimale = 1) =>
  new Intl.NumberFormat('de-DE', { maximumFractionDigits: decimale }).format(vrijednost);

// "2026-11-12", "07:30" -> "12.11. 07:30"; bez vremena samo "12.11."
export const trenutakKratko = (datum: string, vrijeme: string | null) => {
  const [, mjesec, dan] = datum.split('-');
  return vrijeme ? `${dan}.${mjesec}. ${vrijeme}` : `${dan}.${mjesec}.`;
};
