// Ecoequivalencias de impacto: traduce la huella de carbono evitada y el papel/cartón reciclado a términos
// cotidianos (árboles, kilómetros en auto, hogares, agua, energía). Son estimaciones orientativas a partir de
// factores de conversión públicos de uso común; se ajustan en Administración → Metas y segmentos → Factores
// (avanzado), igual que los factores de CO2 por material.
export function computeImpact(records, co2Total, equiv) {
  const paperKg = records.filter((r) => (r.m === 'carton' || r.m === 'papel') && r.t === 'reciclaje').reduce((s, r) => s + r.kg, 0);
  const paperT = paperKg / 1000;
  return {
    co2: co2Total,
    trees: equiv.tCo2PerTree10y > 0 ? co2Total / equiv.tCo2PerTree10y : 0,
    carKm: equiv.kgCo2PerCarKm > 0 ? (co2Total * 1000) / equiv.kgCo2PerCarKm : 0,
    homesYear: equiv.tCo2PerHomeYear > 0 ? co2Total / equiv.tCo2PerHomeYear : 0,
    paperT,
    paperTrees: paperT * (equiv.treesPerTonPaper || 0),
    paperWaterL: paperT * (equiv.litersWaterPerTonPaper || 0),
    paperKwh: paperT * (equiv.kwhPerTonPaper || 0),
  };
}
