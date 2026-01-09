def nutrition_targets(
    weight_kg: float,
    day_type: str,
    planned_hours: float | None,
) -> dict:
    # Base
    protein_g = 1.6 * weight_kg

    if day_type == "REST":
        kcal = 30 * weight_kg
        carbs_g = 3 * weight_kg
    elif day_type == "EASY":
        kcal = 30 * weight_kg
        carbs_g = 4 * weight_kg
    elif day_type == "MODERATE":
        kcal = 30 * weight_kg + 300
        carbs_g = 5 * weight_kg
    else:  # HARD
        kcal = 30 * weight_kg + 600
        carbs_g = 7 * weight_kg

    fat_g = max((kcal - (protein_g * 4 + carbs_g * 4)) / 9, 0)

    # Intra-training carbs
    if planned_hours is None or planned_hours < 1.0:
        intra_cho = 0
    elif planned_hours < 1.5:
        intra_cho = 30
    elif planned_hours < 2.5:
        intra_cho = 60
    else:
        intra_cho = 75

    return {
        "kcal": round(kcal),
        "protein_g": round(protein_g),
        "carbs_g": round(carbs_g),
        "fat_g": round(fat_g),
        "intra_cho_g_per_h": intra_cho,
    }
