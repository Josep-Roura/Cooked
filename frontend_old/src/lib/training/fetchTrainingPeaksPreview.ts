const SAMPLE_WORKOUTS = [
  {
    day: 0,
    start: "07:00",
    end: "08:15",
    type: "Rodaje Z2",
    intensity: "media",
    nutrition: [
      {
        label: "Pre",
        advice: "30g crema de arroz + banana + electrolitos 30min antes"
      },
      {
        label: "Post",
        advice: "Batido whey 35g + 70g carbo rápido + sodio"
      }
    ]
  },
  {
    day: 2,
    start: "19:00",
    end: "20:00",
    type: "Fuerza tren superior",
    intensity: "alta",
    nutrition: [
      {
        label: "Pre",
        advice: "Cafeína ligera + snack de arroz + miel"
      },
      {
        label: "Cena",
        advice: "Pescado blanco + patata asada + verduras salteadas"
      }
    ]
  },
  {
    day: 4,
    start: "12:30",
    end: "13:15",
    type: "HIIT en pista",
    intensity: "alta",
    nutrition: [
      {
        label: "Pre",
        advice: "Isotónico + 20g de carbo muy rápido"
      },
      {
        label: "Post",
        advice: "Recovery shake 3:1 carbo/proteína"
      }
    ]
  },
  {
    day: 5,
    start: "09:00",
    end: "10:30",
    type: "Tirada larga",
    intensity: "media",
    nutrition: [
      {
        label: "Pre",
        advice: "Tostada blanca + mantequilla de almendra + café"
      },
      {
        label: "Snack",
        advice: "Yogur alto en proteína + fruta post entreno"
      }
    ]
  }
] as const;

function generateId(index: number): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tp-${index}-${Date.now()}`;
}

export async function fetchTrainingPeaksPreview() {
  await new Promise((resolve) => setTimeout(resolve, 600));

  return SAMPLE_WORKOUTS.map((workout, idx) => ({
    id: generateId(idx),
    ...workout
  }));
}
