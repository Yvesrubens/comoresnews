// Quotas d'envoi sous les limites Gandi (~200/min, 1 000/h, 8 000/j), avec marge.
export const LIMITES = { parMinute: 100, parHeure: 900, parJour: 7000 };

// Nombre d'emails encore autorisés maintenant, d'après les dates des envois récents.
export function quotaDisponible(envoyesLe, now, limites = LIMITES) {
  const t = now.getTime();
  const depuis = (ms) => envoyesLe.filter((d) => t - d.getTime() < ms).length;
  return Math.max(0, Math.min(
    limites.parMinute - depuis(60_000),
    limites.parHeure - depuis(3_600_000),
    limites.parJour - depuis(86_400_000),
  ));
}
