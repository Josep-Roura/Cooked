def classify_day(planned_hours: float | None) -> str:
    if planned_hours is None or planned_hours == 0:
        return "REST"
    if planned_hours < 1.0:
        return "EASY"
    if planned_hours < 2.0:
        return "MODERATE"
    return "HARD"
