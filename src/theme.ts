export const theme = {
  primary: '#785E9E',
  secondary: '#8FC74A',
  // Boje tarifa (provjerene za daltonizam i kontrast na bijeloj podlozi)
  skupa: '#785E9E',
  jeftina: '#1B998B',
  ukupno: '#374151',
};

// Bijela zona je namjerno neutralno siva, a svaka zona uvijek ima i tekstualnu oznaku
export const ZONE = [
  { kljuc: 'bijela', naziv: 'Bijela', opseg: 'do 500 kWh', boja: '#9CA5B4' },
  { kljuc: 'plava', naziv: 'Plava', opseg: '501–1.500 kWh', boja: '#1F66A8' },
  { kljuc: 'crvena', naziv: 'Crvena', opseg: 'od 1.501 kWh', boja: '#C8372D' },
] as const;

export const zonaPoKljucu = (kljuc: (typeof ZONE)[number]['kljuc']) => ZONE.find((z) => z.kljuc === kljuc)!;
