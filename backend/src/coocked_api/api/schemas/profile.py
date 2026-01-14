from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, EmailStr


class UserProfile(BaseModel):
    # Personal
    full_name: str
    email: EmailStr
    gender: Optional[str] = None
    birthdate: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: float
    country: Optional[str] = None
    timezone: Optional[str] = None
    units: str

    # Goals
    primary_goal: str
    target_weight_kg: Optional[float] = None
    event_name: Optional[str] = None
    event_date: Optional[str] = None
    weekly_training_hours_target: Optional[float] = None
    experience_level: str

    # Training profile
    sports: List[str]
    weekly_sessions_swim: Optional[int] = None
    weekly_sessions_bike: Optional[int] = None
    weekly_sessions_run: Optional[int] = None
    weekly_sessions_gym: Optional[int] = None
    intensity_preference: str
    long_session_day: Optional[str] = None
    typical_workout_time: str
    days_off_preference: List[str]

    # Nutrition preferences
    diet_type: str
    allergies: List[str]
    dislikes: Optional[str] = None
    meals_per_day: int
    caffeine: str
    hydration_focus: bool

    # Constraints
    cooking_time_per_day: str
    budget_level: str
    kitchen_access: str
    travel_frequency: str

    # App usage
    connect_trainingpeaks: bool
    accept_terms: bool
    data_processing_consent: bool

    class Config:
        extra = "ignore"
