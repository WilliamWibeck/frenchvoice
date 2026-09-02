const FR_DAYS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
const FR_COUNT = [
  "zéro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
];

export function frenchDayLabel(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return FR_DAYS[new Date(y, m - 1, d).getDay()];
}

export function streakHeadline(n) {
  if (!n) return "Pas encore de série";
  if (n === 1) return "Un jour de suite";
  const word = FR_COUNT[n];
  if (word) return `${word.charAt(0).toUpperCase()}${word.slice(1)} jours de suite`;
  return `${n} jours de suite`;
}

export function streakAside(n) {
  if (!n) return "Une petite séance et Margot commence le compte.";
  const untilToast = 7 - n;
  if (untilToast > 0) {
    const word = FR_COUNT[untilToast] || String(untilToast);
    const capped = word.charAt(0).toUpperCase() + word.slice(1);
    return `${capped} de plus et Margot sort le champagne.`;
  }
  return "Margot est fière — tu tiens le rythme.";
}

export function recapHeadline(recap, recorded) {
  if (!recorded) return "C'était trop court pour compter.";
  if (recap.corrections === 0 && recap.utterances > 0) return "C'était fluide.";
  if (recap.utterances > 0) return "Tu as tenu la conversation.";
  return "Séance terminée.";
}
