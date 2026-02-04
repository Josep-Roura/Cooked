/**
 * Request user permission for browser notifications
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications")
    return false
  }

  if (Notification.permission === "granted") {
    return true
  }

  if (Notification.permission !== "denied") {
    try {
      const permission = await Notification.requestPermission()
      return permission === "granted"
    } catch (error) {
      console.error("Failed to request notification permission:", error)
      return false
    }
  }

  return false
}

interface ReminderNotificationOptions {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  requireInteraction?: boolean
}

/**
 * Send a browser notification
 */
export function sendNotification(options: ReminderNotificationOptions): Notification | null {
  if (!("Notification" in window)) {
    console.log("Notifications not supported")
    return null
  }

  if (Notification.permission !== "granted") {
    console.log("Notification permission not granted")
    return null
  }

  const notification = new Notification(options.title, {
    body: options.body,
    icon: options.icon || "/logo.png",
    badge: options.badge,
    tag: options.tag || "nutrition-reminder",
    requireInteraction: options.requireInteraction ?? false,
  })

  return notification
}

export interface NutritionReminder {
  id: string
  time: string // HH:MM format
  product: string
  quantity: number
  unit: string
  type: "carbs" | "hydration" | "food" | "electrolytes"
  scheduled: boolean
  notificationId?: number
}

/**
 * Schedule notifications for nutrition reminders
 * Returns array of reminder objects with scheduled timeouts
 */
export function scheduleNutritionReminders(
  items: NutritionReminder[],
  onReminder?: (reminder: NutritionReminder) => void
): { reminders: NutritionReminder[]; cancel: () => void } {
  const scheduledReminders: NutritionReminder[] = []
  const timeoutIds: number[] = []

  items.forEach((item) => {
    const [hours, minutes] = item.time.split(":").map(Number)
    const now = new Date()
    const reminderTime = new Date()
    reminderTime.setHours(hours, minutes, 0, 0)

    // If time has passed today, schedule for tomorrow
    if (reminderTime <= now) {
      reminderTime.setDate(reminderTime.getDate() + 1)
    }

    const delay = reminderTime.getTime() - now.getTime()

    if (delay > 0) {
      const timeoutId = window.setTimeout(() => {
        sendNotification({
          title: "Time to consume nutrition",
          body: `${item.product} (${item.quantity}${item.unit})`,
          tag: `nutrition-${item.id}`,
          requireInteraction: true,
        })

        onReminder?.(item)
      }, delay)

      scheduledReminders.push({
        ...item,
        scheduled: true,
        notificationId: timeoutId,
      })

      timeoutIds.push(timeoutId)
    }
  })

  return {
    reminders: scheduledReminders,
    cancel: () => {
      timeoutIds.forEach((id) => clearTimeout(id))
    },
  }
}

/**
 * Calculate reminders from nutrition plan
 * Converts timing strings to actual times based on workout start time
 */
export function calculateRemindersFromPlan(
  plan: any,
  workoutStartTime: string,
  workoutDuration: number
): NutritionReminder[] {
  const reminders: NutritionReminder[] = []
  let reminderId = 1

  const [startHour, startMin] = workoutStartTime.split(":").map(Number)

  const calculateTime = (minutesOffset: number): string => {
    const date = new Date()
    date.setHours(startHour, startMin)
    date.setMinutes(date.getMinutes() + minutesOffset)
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  }

  // Helper to get product name (supports both Spanish and English)
  const getProductName = (item: any): string | null => {
    return item.product || item.producto || null
  }

  // Helper to get quantity (supports both Spanish and English)
  const getQuantity = (item: any): number => {
    return item.quantity ?? item.cantidad ?? 0
  }

  // Helper to get unit (supports both Spanish and English)
  const getUnit = (item: any): string => {
    return item.unit || item.unidad || ""
  }

  // Pre-workout reminders (2-3 hours before)
  if (plan.preWorkout?.items) {
    plan.preWorkout.items.forEach((item: any) => {
      const product = getProductName(item)
      if (!product) return // Skip if no product name
      
      // Pre-workout is typically 2-3 hours before (use -180 minutes as default)
      reminders.push({
        id: `pre-${reminderId++}`,
        time: calculateTime(-180),
        product,
        quantity: getQuantity(item),
        unit: getUnit(item),
        type: "food",
        scheduled: false,
      })
    })
  }

  // During-workout reminders
  if (plan.duringWorkout?.items && plan.duringWorkout?.interval) {
    const numIntervals = Math.ceil(workoutDuration / plan.duringWorkout.interval)
    for (let i = 0; i < numIntervals; i++) {
      const offset = i * plan.duringWorkout.interval
      plan.duringWorkout.items.forEach((item: any) => {
        const product = getProductName(item)
        if (!product) return // Skip if no product name
        
        const productLower = product.toLowerCase()
        const type = productLower.includes("water") || productLower.includes("agua") 
          ? "hydration" 
          : "carbs"
        
        reminders.push({
          id: `during-${reminderId++}`,
          time: calculateTime(offset),
          product,
          quantity: getQuantity(item),
          unit: getUnit(item),
          type,
          scheduled: false,
        })
      })
    }
  }

  // Post-workout reminders (within 30 minutes after)
  if (plan.postWorkout?.items) {
    plan.postWorkout.items.forEach((item: any) => {
      const product = getProductName(item)
      if (!product) return // Skip if no product name
      
      reminders.push({
        id: `post-${reminderId++}`,
        time: calculateTime(workoutDuration + 15),
        product,
        quantity: getQuantity(item),
        unit: getUnit(item),
        type: "food",
        scheduled: false,
      })
    })
  }

  return reminders
}

/**
 * Format reminder for display
 */
export function formatReminder(reminder: NutritionReminder): string {
  const typeEmoji = {
    carbs: "🍞",
    hydration: "💧",
    food: "🍽️",
    electrolytes: "⚡",
  }[reminder.type]

  return `${typeEmoji} ${reminder.time}: ${reminder.product} (${reminder.quantity}${reminder.unit})`
}
