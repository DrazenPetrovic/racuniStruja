// Poredi stanja poslana Elektrokrajini sa stanjem koje je stiglo na racunu.
// Stanje se salje oko kraja mjeseca (28. do 3.), a racun nosi stanje na datum ocitanja,
// pa se poslano stanje vezuje za racun ciji je datum ocitanja najblizi, najvise MAX_DANA udaljen.

export const MAX_DANA = 7;
// Razlika manja od ovoga se smatra istim stanjem (zaokruzivanje na racunu)
const TOLERANCIJA_KWH = 1;

const dan = (datum) => Date.parse(`${datum.slice(0, 10)}T00:00:00Z`) / 86400000;

export const uporediPoslana = (poslana, racuni) =>
  poslana.map((p) => {
    const dPoslano = dan(p.poslano);
    let najblizi = null;
    for (const r of racuni) {
      const b = r.brojilo;
      if (!b?.datum || b.vt === null || b.vt === undefined || b.mt === null || b.mt === undefined) continue;
      const razmak = Math.abs(dan(b.datum) - dPoslano);
      if (razmak <= MAX_DANA && (!najblizi || razmak < najblizi.razmak)) najblizi = { r, razmak };
    }

    if (!najblizi) return { ...p, status: 'ceka', racun: null };

    const { r } = najblizi;
    const razlikaVt = Math.round((r.brojilo.vt - p.vt) * 100) / 100;
    const razlikaMt = Math.round((r.brojilo.mt - p.mt) * 100) / 100;
    const isto = Math.abs(razlikaVt) < TOLERANCIJA_KWH && Math.abs(razlikaMt) < TOLERANCIJA_KWH;
    return {
      ...p,
      status: isto ? 'isto' : 'razlika',
      racun: { id: r.id, mjesec: r.mjesec, datum: r.brojilo.datum, vt: r.brojilo.vt, mt: r.brojilo.mt, razlikaVt, razlikaMt },
    };
  });
