export type NutritionBlock = {
  label: string; // "Pre-entreno", "Post-entreno", "Recuperación tarde", etc.
  advice: string; // "Batido whey + carbo rápido en 30 min", etc.
};

export type WeeklyWorkout = {
  id: string;
  day: number; // 0 = Lunes, 6 = Domingo
  start: string; // "07:30"
  end: string; // "08:30"
  type: string; // "Fuerza tren superior", "Rodaje Z2", "HIIT", etc.
  intensity?: "baja" | "media" | "alta";
  nutrition: NutritionBlock[];
};
