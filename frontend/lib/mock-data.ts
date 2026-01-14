export interface TrainingSession {
  id: string
  type: "swim" | "bike" | "run" | "strength" | "rest"
  title: string
  duration: number // minutes
  intensity: "low" | "moderate" | "high"
  calories: number
  completed: boolean
  time: string
  date: string
}

export interface Meal {
  id: string
  type: "breakfast" | "lunch" | "dinner" | "snack"
  title: string
  calories: number
  protein: number
  carbs: number
  fat: number
  time: string
  linkedTraining?: string
}

export interface Task {
  id: string
  title: string
  category: "training" | "nutrition" | "recovery"
  priority: "low" | "medium" | "high"
  status: "pending" | "completed" | "skipped"
  dueDate: string
  description?: string
}

export interface CalendarEvent {
  id: string
  title: string
  type: "training" | "nutrition" | "meeting" | "rest"
  startTime: string
  endTime: string
  date: string
  color: string
  description?: string
}

export interface UserProfile {
  id: string
  name: string
  email: string
  avatar: string
  role: string
  weight: number
  weightUnit: "kg" | "lbs"
  goal: string
  subscriptionStatus: "free" | "pro" | "team"
  subscriptionExpiry?: string
  preferences: {
    darkMode: boolean
    units: "metric" | "imperial"
    notifications: boolean
  }
}

// Mock Training Data
export const mockTrainingSessions: TrainingSession[] = [
  {
    id: "t1",
    type: "swim",
    title: "Swim training",
    duration: 75,
    intensity: "moderate",
    calories: 650,
    completed: true,
    time: "09:00",
    date: "2024-01-15",
  },
  {
    id: "t2",
    type: "run",
    title: "Easy recovery run",
    duration: 45,
    intensity: "low",
    calories: 400,
    completed: true,
    time: "07:00",
    date: "2024-01-16",
  },
  {
    id: "t3",
    type: "bike",
    title: "Interval cycling",
    duration: 60,
    intensity: "high",
    calories: 550,
    completed: false,
    time: "06:30",
    date: "2024-01-17",
  },
  {
    id: "t4",
    type: "strength",
    title: "Upper body strength",
    duration: 45,
    intensity: "moderate",
    calories: 300,
    completed: false,
    time: "17:00",
    date: "2024-01-17",
  },
  {
    id: "t5",
    type: "rest",
    title: "Active recovery",
    duration: 30,
    intensity: "low",
    calories: 100,
    completed: false,
    time: "10:00",
    date: "2024-01-18",
  },
]

// Mock Meals Data
export const mockMeals: Meal[] = [
  {
    id: "m1",
    type: "breakfast",
    title: "Pre-swim oatmeal",
    calories: 450,
    protein: 15,
    carbs: 70,
    fat: 12,
    time: "07:30",
    linkedTraining: "t1",
  },
  {
    id: "m2",
    type: "snack",
    title: "Post-swim recovery shake",
    calories: 280,
    protein: 30,
    carbs: 35,
    fat: 5,
    time: "10:30",
    linkedTraining: "t1",
  },
  {
    id: "m3",
    type: "lunch",
    title: "Grilled chicken salad",
    calories: 520,
    protein: 45,
    carbs: 25,
    fat: 28,
    time: "13:00",
  },
  {
    id: "m4",
    type: "snack",
    title: "Greek yogurt with berries",
    calories: 180,
    protein: 15,
    carbs: 22,
    fat: 4,
    time: "16:00",
  },
  {
    id: "m5",
    type: "dinner",
    title: "Salmon with quinoa",
    calories: 620,
    protein: 42,
    carbs: 45,
    fat: 30,
    time: "19:00",
  },
]

// Mock Tasks Data
export const mockTasks: Task[] = [
  {
    id: "task1",
    title: "Complete morning swim session",
    category: "training",
    priority: "high",
    status: "completed",
    dueDate: "2024-01-15",
    description: "75 min endurance swim at zone 2",
  },
  {
    id: "task2",
    title: "Log post-workout nutrition",
    category: "nutrition",
    priority: "medium",
    status: "completed",
    dueDate: "2024-01-15",
    description: "Record recovery shake macros",
  },
  {
    id: "task3",
    title: "Foam rolling session",
    category: "recovery",
    priority: "low",
    status: "pending",
    dueDate: "2024-01-15",
    description: "15 min full body foam rolling",
  },
  {
    id: "task4",
    title: "Prepare meal prep for week",
    category: "nutrition",
    priority: "high",
    status: "pending",
    dueDate: "2024-01-16",
  },
  {
    id: "task5",
    title: "Bike maintenance check",
    category: "training",
    priority: "medium",
    status: "pending",
    dueDate: "2024-01-16",
  },
  {
    id: "task6",
    title: "Sleep 8+ hours",
    category: "recovery",
    priority: "high",
    status: "skipped",
    dueDate: "2024-01-14",
  },
]

// Mock Calendar Events
export const mockCalendarEvents: CalendarEvent[] = [
  {
    id: "e1",
    title: "Swim training",
    type: "training",
    startTime: "09:00",
    endTime: "10:15",
    date: "2024-01-15",
    color: "bg-cyan-400",
    description: "Endurance - 75 min",
  },
  {
    id: "e2",
    title: "Nutrition — Post-swim",
    type: "nutrition",
    startTime: "11:00",
    endTime: "11:30",
    date: "2024-01-15",
    color: "bg-green-500",
    description: "60-70g carbs - light digestion",
  },
  {
    id: "e3",
    title: "Recovery run",
    type: "training",
    startTime: "07:00",
    endTime: "07:45",
    date: "2024-01-16",
    color: "bg-cyan-400",
    description: "Easy pace - Zone 1-2",
  },
  {
    id: "e4",
    title: "Meal prep",
    type: "nutrition",
    startTime: "14:00",
    endTime: "15:30",
    date: "2024-01-16",
    color: "bg-green-500",
    description: "Prepare meals for the week",
  },
  {
    id: "e5",
    title: "Interval cycling",
    type: "training",
    startTime: "06:30",
    endTime: "07:30",
    date: "2024-01-17",
    color: "bg-orange-500",
    description: "High intensity intervals",
  },
  {
    id: "e6",
    title: "Rest day",
    type: "rest",
    startTime: "00:00",
    endTime: "23:59",
    date: "2024-01-18",
    color: "bg-gray-400",
    description: "Active recovery only",
  },
]

// Mock User Profile
export const mockUserProfile: UserProfile = {
  id: "u1",
  name: "Mike Thompson",
  email: "mike.t@example.com",
  avatar: "/man-with-sunglasses-professional-headshot.jpg",
  role: "Art Director",
  weight: 75,
  weightUnit: "kg",
  goal: "Complete Ironman 70.3",
  subscriptionStatus: "pro",
  subscriptionExpiry: "2024-12-31",
  preferences: {
    darkMode: false,
    units: "metric",
    notifications: true,
  },
}

// Weekly nutrition summary
export const mockWeeklyNutrition = {
  targetCalories: 2800,
  targetProtein: 160,
  targetCarbs: 350,
  targetFat: 90,
  dailyData: [
    { day: "Mon", calories: 2650, protein: 155, carbs: 320, fat: 85 },
    { day: "Tue", calories: 2780, protein: 162, carbs: 345, fat: 88 },
    { day: "Wed", calories: 2900, protein: 170, carbs: 360, fat: 92 },
    { day: "Thu", calories: 2550, protein: 148, carbs: 310, fat: 82 },
    { day: "Fri", calories: 2820, protein: 165, carbs: 350, fat: 90 },
    { day: "Sat", calories: 3100, protein: 175, carbs: 400, fat: 95 },
    { day: "Sun", calories: 2400, protein: 140, carbs: 280, fat: 78 },
  ],
}

// Weekly training summary
export const mockWeeklyTraining = {
  totalDuration: 480, // minutes
  totalCalories: 3200,
  sessions: [
    { day: "Mon", type: "swim", duration: 75, intensity: "moderate" },
    { day: "Tue", type: "run", duration: 45, intensity: "low" },
    { day: "Wed", type: "bike", duration: 90, intensity: "high" },
    { day: "Thu", type: "strength", duration: 45, intensity: "moderate" },
    { day: "Fri", type: "swim", duration: 60, intensity: "moderate" },
    { day: "Sat", type: "run", duration: 120, intensity: "moderate" },
    { day: "Sun", type: "rest", duration: 0, intensity: "low" },
  ],
}
