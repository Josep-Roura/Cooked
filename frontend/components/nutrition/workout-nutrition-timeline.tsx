"use client"

import { useState } from "react"
import { ChevronDown, Clock, Droplet, Zap, Flame, Apple, AlertCircle, Download, Maximize2, Minimize2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { exportNutritionToPDF, exportNutritionAsTextPDF } from "@/lib/nutrition/export-pdf"

// Helper function to safely get a macro value from an item
function getMacroValue(item: any, macroType: "carbs" | "protein" | "sodium" | "fat"): number {
  // Spanish field names mapping
  const spanishMap = {
    carbs: "carbohidratos_g",
    protein: "proteina_g",
    fat: "grasas_g",
    sodium: "sodio_mg",
  }
  
  const englishFieldName = macroType
  const spanishFieldName = spanishMap[macroType]
  
  // Try direct fields first
  if (item[englishFieldName] !== undefined && item[englishFieldName] !== null) {
    return Number(item[englishFieldName]) || 0
  }
  
  // Try nested macronutrientes fields
  if (item.macronutrientes?.[spanishFieldName] !== undefined) {
    return Number(item.macronutrientes[spanishFieldName]) || 0
  }
  
  // Try Spanish top-level fields
  const spanishTopLevel = item[spanishFieldName]
  if (spanishTopLevel !== undefined && spanishTopLevel !== null) {
    return Number(spanishTopLevel) || 0
  }
  
  return 0
}

// Calculate recommended during-workout carbs based on ACSM/ISSN guidelines
function calculateDuringWorkoutMacros(workoutDurationMin: number, intensity: string = "high") {
  // ACSM/ISSN Guidelines:
  // - <60 min: water/electrolytes only
  // - 60-90 min: 30-60g carbs/hour
  // - >90 min: 60-90g carbs/hour (high intensity) or 30-60g (moderate)
  // - Hydration: 500-1000ml/hour depending on sweat rate
  // - Sodium: 300-700mg/hour to maintain hyponatremia
  
  const durationHours = workoutDurationMin / 60
  
  let carbsPerHour = 0
  if (workoutDurationMin >= 90) {
    carbsPerHour = intensity === "high" ? 90 : 60
  } else if (workoutDurationMin >= 60) {
    carbsPerHour = 45
  } else {
    return { carbsPerHour: 0, hydrationPerHour: 500, sodiumPerHour: 0, intervalMinutes: 30 }
  }
  
  return {
    carbsPerHour,
    hydrationPerHour: 750,
    sodiumPerHour: 500,
    intervalMinutes: 30,
  }
}

// Calculate recommended pre-workout macros
function calculatePreWorkoutMacros(workoutDurationMin: number, weightKg: number = 70) {
  // ACSM Guidelines: 1-4g carbs/kg depending on session duration
  // 60-90 min: 1g/kg, >90 min: 1.5-2g/kg, very long: 2-4g/kg
  // Pre: 30-60 min before, include protein for satiety
  
  let carbsPerKg = 1.5
  if (workoutDurationMin > 120) {
    carbsPerKg = 2
  } else if (workoutDurationMin > 90) {
    carbsPerKg = 1.5
  }
  
  const carbsG = Math.round(carbsPerKg * weightKg)
  const proteinG = Math.round(0.25 * weightKg) // 0.25g/kg for satiety
  
  return {
    carbsG,
    proteinG,
    timing: "30-60 minutes before",
  }
}

// Calculate recommended post-workout macros  
function calculatePostWorkoutMacros(workoutDurationMin: number, weightKg: number = 70) {
  // ACSM Recovery Window: 1.2g carbs/kg + 0.25-0.4g protein/kg
  // Within 30-60 minutes for optimal recovery
  
  const carbsG = Math.round(1.2 * weightKg)
  const proteinG = Math.round(0.3 * weightKg)
  
  return {
    carbsG,
    proteinG,
    timing: "30-60 minutes after workout",
  }
}

// Calculate total carbs from items
function calculateTotalCarbs(items: any[]): number {
  if (!Array.isArray(items)) return 0
  return items.reduce((sum, item) => sum + getMacroValue(item, "carbs"), 0)
}

// Calculate total protein from items
function calculateTotalProtein(items: any[]): number {
  if (!Array.isArray(items)) return 0
  return items.reduce((sum, item) => sum + getMacroValue(item, "protein"), 0)
}

// Calculate total fat from items
function calculateTotalFat(items: any[]): number {
  if (!Array.isArray(items)) return 0
  return items.reduce((sum, item) => sum + getMacroValue(item, "fat"), 0)
}

// Calculate total sodium from items
function calculateTotalSodium(items: any[]): number {
  if (!Array.isArray(items)) return 0
  return items.reduce((sum, item) => sum + getMacroValue(item, "sodium"), 0)
}

// Calculate total hydration (ml) from items
function calculateTotalHydration(items: any[]): number {
  if (!Array.isArray(items)) return 0
  return items.reduce((sum, item) => {
    const quantity = Number(item.quantity || item.cantidad) || 0
    const unit = (item.unit || item.unidad || "").toLowerCase()
    
    // Assume ml for most items, but convert liters if needed
    if (unit.includes("l") && !unit.includes("ml")) {
      return sum + (quantity * 1000)
    }
    return sum + quantity
  }, 0)
}

// Helper function to convert Spanish keys to English
function convertSpanishToEnglish(plan: any): any {
  if (!plan || typeof plan !== "object") return plan
  
  // Map Spanish keys to English - comprehensive mapping
  const keyMap: Record<string, string> = {
    // Top-level sections
    pre_entrenamiento: "preWorkout",
    durante_entrenamiento: "duringWorkout",
    post_entrenamiento: "postWorkout",
    
    // Nutrition metrics (Spanish)
    carbohidratos_por_hora_g: "carbsPerHour",
    hidratacion_por_hora_ml: "hydrationPerHour",
    sodio_por_hora_mg: "sodiumPerHour",
    
    // Common fields (keep as-is or map if needed)
    timing: "timing",
    timing_minutos: "timing",
    items: "items",
    totalCarbs: "totalCarbs",
    totalProtein: "totalProtein",
    totalCalories: "totalCalories",
    totalHydration: "totalHydration",
    totalSodium: "totalSodium",
    rationale: "rationale",
    warnings: "warnings",
    interval: "interval",
    intervalo_minutos: "interval",
    
    // Item-level fields
    time: "time",
    product: "product",
    quantity: "quantity",
    cantidad: "quantity",
    unit: "unit",
    unidad: "unit",
    carbs: "carbs",
    protein: "protein",
    sodium: "sodium",
    sodio: "sodium",
    notes: "notes",
    frecuencia: "frequency",
    frequency: "frequency",
    macronutrientes: "macronutrientes",
    
    // During workout specific fields
    productos_intervalo: "items",
    productos_especificos: "items",
  }
  
  const converted: any = {}
  
  for (const [key, value] of Object.entries(plan)) {
    const newKey = keyMap[key] || key
    
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // Recursively convert nested objects
      converted[newKey] = convertSpanishToEnglish(value)
    } else if (Array.isArray(value)) {
      // Handle arrays
      converted[newKey] = value.map((item: any) =>
        typeof item === "object" && item !== null ? convertSpanishToEnglish(item) : item
      )
    } else {
      converted[newKey] = value
    }
  }
  
  return converted
}

interface WorkoutNutritionPlanProps {
  plan: {
    preWorkout?: {
      timing: string
      items: Array<{
        time: string
        product: string
        quantity: number
        unit: string
        carbs?: number
        protein?: number
        sodium?: number
        notes?: string
      }>
      totalCarbs: number
      totalProtein: number
      totalCalories: number
      rationale?: string
    }
    duringWorkout?: {
      timing: string
      interval: number
      items: Array<{
        time: string
        product: string
        quantity: number
        unit: string
        carbs?: number
        sodium?: number
        notes?: string
      }>
      totalCarbs: number
      totalHydration: number
      totalSodium: number
      rationale?: string
      warnings?: string[]
    }
    postWorkout?: {
      timing: string
      items: Array<{
        time: string
        product: string
        quantity: number
        unit: string
        carbs?: number
        protein?: number
        sodium?: number
        notes?: string
      }>
      totalCarbs: number
      totalProtein: number
      totalCalories: number
      rationale?: string
    }
    recommendations?: string
    rationale?: string
    warnings?: string[]
  }
  workoutDuration?: number
  workoutStartTime?: string
  recordId?: string
  onSave?: (updates: Record<string, unknown>) => Promise<void>
}

export function WorkoutNutritionTimeline({
  plan,
  workoutDuration = 0,
  workoutStartTime = "06:00",
  recordId,
  onSave,
}: WorkoutNutritionPlanProps) {
  const { toast } = useToast()
  const [expandedSection, setExpandedSection] = useState<"pre" | "during" | "post" | null>("pre")
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Handle if plan is a string instead of object
  let parsedPlan = plan
  if (typeof plan === "string") {
    try {
      parsedPlan = JSON.parse(plan)
    } catch {
      console.error("Could not parse plan string:", plan)
      return <div className="text-red-600">Error parsing nutrition plan</div>
    }
  }

  // Convert Spanish keys to English if needed
  parsedPlan = convertSpanishToEnglish(parsedPlan)

  // Validate plan structure
  if (!parsedPlan || typeof parsedPlan !== "object") {
    return <div className="text-red-600">Invalid nutrition plan format</div>
  }

  const handleSave = async () => {
    if (!recordId || !onSave) return
    setIsSaving(true)
    try {
      await onSave({ during_workout_recommendation: JSON.stringify(plan) })
      toast({ title: "Success", description: "Nutrition plan saved" })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await exportNutritionToPDF("nutrition-timeline-export", {
        filename: `nutrition-plan-${new Date().toISOString().split("T")[0]}.pdf`,
        workoutDuration,
        workoutStartTime,
      })
      toast({ title: "Success", description: "Nutrition plan exported to PDF" })
    } catch (error) {
      // Fallback to text PDF if canvas export fails
      try {
        exportNutritionAsTextPDF(parsedPlan, {
          filename: `nutrition-plan-${new Date().toISOString().split("T")[0]}.pdf`,
          workoutDuration,
          workoutStartTime,
        })
        toast({ title: "Success", description: "Nutrition plan exported to PDF (text format)" })
      } catch (fallbackError) {
        toast({
          title: "Error",
          description: "Failed to export nutrition plan",
          variant: "destructive",
        })
      }
    } finally {
      setIsExporting(false)
    }
  }

  // Parse start time to calculate actual times
  // Handle 'TBD' or invalid time formats gracefully
  const parseStartTime = (timeStr: string) => {
    if (!timeStr || timeStr === "TBD" || !timeStr.includes(":")) {
      // Default to current time if TBD
      const now = new Date()
      return {
        hour: now.getHours(),
        minute: now.getMinutes(),
        isValid: false
      }
    }
    try {
      const [hour, minute] = timeStr.split(":").map(Number)
      if (isNaN(hour) || isNaN(minute)) {
        throw new Error("Invalid time format")
      }
      return {
        hour,
        minute,
        isValid: true
      }
    } catch (e) {
      const now = new Date()
      return {
        hour: now.getHours(),
        minute: now.getMinutes(),
        isValid: false
      }
    }
  }

  const { hour: startHour, minute: startMin, isValid: isTimeValid } = parseStartTime(workoutStartTime)
  
  const calculateTime = (minutesOffset: number) => {
    const date = new Date()
    date.setHours(startHour, startMin)
    date.setMinutes(date.getMinutes() + minutesOffset)
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
  }

  // Show warning if time is not valid
  const timeWarning = !isTimeValid ? `(Using current time as workout start time was ${workoutStartTime === "TBD" ? "not set" : "invalid"})` : null

   return (
      <div className="space-y-3">
        {/* Fixed Panel Modal */}
        {isFullscreen && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-end sm:justify-center p-2 sm:p-4">
            <div className="bg-white rounded-lg w-full sm:w-[90%] md:w-[80%] lg:w-2/3 max-w-4xl h-[90vh] sm:h-[85vh] flex flex-col shadow-2xl">
              {/* Fixed Panel Header */}
              <div className="sticky top-0 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Nutrition Plan</h2>
                  <p className="text-xs text-slate-600 mt-0.5">Complete fueling strategy for your workout</p>
                </div>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="p-2 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0"
                  title="Close panel"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              {/* Fixed Panel Content - Scrollable */}
              <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
                {/* Science Breakdown Section */}
                {(parsedPlan?.rationale || (parsedPlan?.warnings && parsedPlan.warnings.length > 0)) && (
                  <ScienceBreakdownSection
                    rationale={parsedPlan.rationale}
                    warnings={parsedPlan.warnings}
                  />
                )}

                {/* Pre-Workout Section */}
                {parsedPlan?.preWorkout && (
                  <PreWorkoutSection
                    data={parsedPlan.preWorkout}
                    isExpanded={expandedSection === "pre"}
                    onToggle={() => setExpandedSection(expandedSection === "pre" ? null : "pre")}
                  />
                )}

                {/* During-Workout Section */}
                {parsedPlan?.duringWorkout && (
                  <DuringWorkoutSection
                    data={parsedPlan.duringWorkout}
                    workoutDuration={workoutDuration}
                    workoutStartTime={workoutStartTime}
                    calculateTime={calculateTime}
                    isExpanded={expandedSection === "during"}
                    onToggle={() => setExpandedSection(expandedSection === "during" ? null : "during")}
                  />
                )}

                {/* Post-Workout Section */}
                {parsedPlan?.postWorkout && (
                  <PostWorkoutSection
                    data={parsedPlan.postWorkout}
                    workoutDuration={workoutDuration}
                    workoutStartTime={workoutStartTime}
                    calculateTime={calculateTime}
                    isExpanded={expandedSection === "post"}
                    onToggle={() => setExpandedSection(expandedSection === "post" ? null : "post")}
                  />
                )}

                {/* Recommendations */}
                {parsedPlan?.recommendations && (
                  <div className="bg-white rounded-lg p-3 border border-amber-200">
                    <div className="flex gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-900">{parsedPlan.recommendations}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Fixed Panel Footer */}
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex gap-2 flex-wrap flex-shrink-0">
                {recordId && onSave && (
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                )}
                <Button
                  onClick={handleExport}
                  disabled={isExporting}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? "Exporting..." : "Export PDF"}
                </Button>
                <Button
                  onClick={() => setIsFullscreen(false)}
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

         {/* Export Container - Scrollable and Better Layout */}
         <div id="nutrition-timeline-export" className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 overflow-hidden max-h-[70vh] flex flex-col">
            {/* Fixed Header */}
            <div className="sticky top-0 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200 px-4 py-3 z-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Nutrition Plan</h2>
                  <p className="text-xs text-slate-600 mt-0.5">Complete fueling strategy for your workout</p>
                  {timeWarning && (
                    <p className="text-xs text-amber-600 mt-1.5 font-medium">{timeWarning}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full whitespace-nowrap">
                    {workoutDuration} min workout
                  </span>
                  <button
                    onClick={() => setIsFullscreen(true)}
                    className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                    title="Expand to fullscreen"
                  >
                    <Maximize2 className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>
            </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
            {/* Science Breakdown Section */}
             {(parsedPlan?.rationale || (parsedPlan?.warnings && parsedPlan.warnings.length > 0)) && (
              <ScienceBreakdownSection
                rationale={parsedPlan.rationale}
                warnings={parsedPlan.warnings}
              />
            )}

            {/* Pre-Workout Section */}
            {parsedPlan?.preWorkout && (
              <PreWorkoutSection
                data={parsedPlan.preWorkout}
                isExpanded={expandedSection === "pre"}
                onToggle={() => setExpandedSection(expandedSection === "pre" ? null : "pre")}
              />
            )}

            {/* During-Workout Section */}
            {parsedPlan?.duringWorkout && (
              <DuringWorkoutSection
                data={parsedPlan.duringWorkout}
                workoutDuration={workoutDuration}
                workoutStartTime={workoutStartTime}
                calculateTime={calculateTime}
                isExpanded={expandedSection === "during"}
                onToggle={() => setExpandedSection(expandedSection === "during" ? null : "during")}
              />
            )}

            {/* Post-Workout Section */}
            {parsedPlan?.postWorkout && (
              <PostWorkoutSection
                data={parsedPlan.postWorkout}
                workoutDuration={workoutDuration}
                workoutStartTime={workoutStartTime}
                calculateTime={calculateTime}
                isExpanded={expandedSection === "post"}
                onToggle={() => setExpandedSection(expandedSection === "post" ? null : "post")}
              />
            )}

            {/* Recommendations */}
            {parsedPlan?.recommendations && (
              <div className="bg-white rounded-lg p-3 border border-amber-200">
                <div className="flex gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-900">{parsedPlan.recommendations}</p>
                </div>
              </div>
            )}
          </div>

          {/* Fixed Action Buttons */}
          <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-4 py-3 flex gap-2 flex-wrap">
            {recordId && onSave && (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSaving ? "Saving..." : "Save Nutrition Plan"}
              </Button>
            )}
            <Button
              onClick={handleExport}
              disabled={isExporting}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Exporting..." : "Export to PDF"}
            </Button>
          </div>
        </div>
     </div>
   )
}

interface SectionProps {
  isExpanded: boolean
  onToggle: () => void
}

function PreWorkoutSection({
  data,
  isExpanded,
  onToggle,
}: SectionProps & { data: any }) {
  let totalCarbs = data.totalCarbs !== undefined ? data.totalCarbs : calculateTotalCarbs(data.items)
  let totalProtein = data.totalProtein !== undefined ? data.totalProtein : calculateTotalProtein(data.items)
  
  // If no macros provided by AI, show calculated values with note
  const hasAIData = totalCarbs > 0 || totalProtein > 0
  
  return (
    <div className="bg-white rounded-lg border border-emerald-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between hover:bg-emerald-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 text-left min-w-0">
          <div className="w-8 h-8 rounded bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Apple className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-emerald-900 text-sm">Pre-Workout</h3>
            <p className="text-xs text-emerald-700">{data.timing || "30-60 min before"}</p>
          </div>
          <div className="hidden sm:flex gap-2 flex-shrink-0">
            <NutrientBadge icon={Flame} label="Carbs" value={`${totalCarbs || "?"}g`} color="orange" />
            <NutrientBadge icon={Zap} label="Protein" value={`${totalProtein || "?"}g`} color="purple" />
          </div>
        </div>
        <ChevronDown
          className={cn("w-5 h-5 text-emerald-600 transition-transform flex-shrink-0", isExpanded && "rotate-180")}
        />
      </button>

      {isExpanded && (
        <div className="border-t border-emerald-200 bg-emerald-50 p-3">
          {!hasAIData && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-3">
              <p className="text-xs text-amber-700">
                <strong>Guideline:</strong> Eat {totalCarbs}g carbs + {totalProtein}g protein 30-60 min before for optimal fueling
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            {data.items && data.items.length > 0 ? (
              data.items.map((item: any, idx: number) => (
                <div key={idx} className="bg-white rounded p-2.5 border border-emerald-200 hover:shadow-sm transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-900">
                        {item.product || item.producto}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        <strong>{item.quantity || item.cantidad}</strong> {item.unit || item.unidad}
                      </p>
                      {(item.notes || item.notas) && (
                        <p className="text-xs text-slate-500 italic mt-1">{item.notes || item.notas}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(item.carbs !== undefined || item.macronutrientes?.carbohidratos_g !== undefined) && (
                        <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-1 rounded">
                          {item.carbs || item.macronutrientes?.carbohidratos_g}g carbs
                        </span>
                      )}
                      {(item.protein !== undefined || item.macronutrientes?.proteina_g !== undefined) && (
                        <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          {item.protein || item.macronutrientes?.proteina_g}g protein
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">No specific items. Eat easily digestible food with carbs and protein.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DuringWorkoutSection({
  data,
  workoutDuration,
  workoutStartTime,
  calculateTime,
  isExpanded,
  onToggle,
}: SectionProps & {
  data: any
  workoutDuration: number
  workoutStartTime: string
  calculateTime: (offset: number) => string
}) {
  const numIntervals = Math.ceil(workoutDuration / data.interval)
  
  // Get carbs per hour from AI data (this should be set by AI based on duration/intensity)
  const carbsPerHour = data.carbohidratos_por_hora_g || data.carbs_per_hour || 0
  
  // Get hydration per hour from AI data
  const hydrationPerHour = data.hidratacion_por_hora_ml || data.hydration_per_hour || 0
  
  // Get sodium per hour from AI data
  const sodiumPerHour = data.sodio_por_hora_mg || data.sodium_per_hour || 0
  
  // Calculate totals from items if no per-hour values provided
  let totalCarbs = data.totalCarbs !== undefined ? data.totalCarbs : calculateTotalCarbs(data.items)
  let totalHydration = data.totalHydration !== undefined ? data.totalHydration : calculateTotalHydration(data.items)
  let totalSodium = data.totalSodium !== undefined ? data.totalSodium : calculateTotalSodium(data.items)
  
  // If we have per-hour data, use it to calculate totals
  if (carbsPerHour > 0) {
    const hours = workoutDuration / 60
    totalCarbs = Math.round(carbsPerHour * hours)
  }
  
  if (hydrationPerHour > 0) {
    const hours = workoutDuration / 60
    totalHydration = Math.round(hydrationPerHour * hours)
  }
  
  if (sodiumPerHour > 0) {
    const hours = workoutDuration / 60
    totalSodium = Math.round(sodiumPerHour * hours)
  }

  return (
    <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between hover:bg-blue-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 text-left min-w-0">
          <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Droplet className="w-4 h-4 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-blue-900 text-sm">During Workout</h3>
            <p className="text-xs text-blue-700">Every {data.interval} min • {numIntervals} times</p>
          </div>
           <div className="hidden sm:flex gap-2 flex-shrink-0">
              <NutrientBadge icon={Flame} label="Carbs" value={`${carbsPerHour > 0 ? carbsPerHour : totalCarbs}${carbsPerHour > 0 ? 'g/h' : 'g'}`} color="orange" />
              <NutrientBadge icon={Droplet} label="Hydration" value={`${hydrationPerHour > 0 ? hydrationPerHour : totalHydration}${hydrationPerHour > 0 ? 'ml/h' : 'ml'}`} color="cyan" />
            </div>
         </div>
         <ChevronDown
           className={cn("w-5 h-5 text-blue-600 transition-transform flex-shrink-0", isExpanded && "rotate-180")}
         />
       </button>

       {isExpanded && (
         <div className="border-t border-blue-200 bg-blue-50 p-3 space-y-3">
           {/* Macro Summary */}
           <div className="grid grid-cols-3 gap-2">
             {carbsPerHour > 0 && (
               <div className="bg-white rounded border border-orange-200 p-2 text-center">
                 <div className="text-sm font-bold text-orange-900">{carbsPerHour}g/h</div>
                 <div className="text-xs text-orange-600">Carbs/Hour</div>
                 <div className="text-xs text-orange-500 mt-1">({totalCarbs}g total)</div>
               </div>
             )}
             {hydrationPerHour > 0 && (
               <div className="bg-white rounded border border-cyan-200 p-2 text-center">
                 <div className="text-sm font-bold text-cyan-900">{hydrationPerHour}ml/h</div>
                 <div className="text-xs text-cyan-600">Fluids/Hour</div>
                 <div className="text-xs text-cyan-500 mt-1">({totalHydration}ml total)</div>
               </div>
             )}
             {sodiumPerHour > 0 && (
               <div className="bg-white rounded border border-blue-200 p-2 text-center">
                 <div className="text-sm font-bold text-blue-900">{sodiumPerHour}mg/h</div>
                 <div className="text-xs text-blue-600">Sodium/Hour</div>
                 <div className="text-xs text-blue-500 mt-1">({totalSodium}mg total)</div>
               </div>
             )}
           </div>

           {/* Timeline Grid */}
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
             {Array.from({ length: numIntervals }).map((_, idx) => {
               const offset = idx * data.interval
               const time = calculateTime(offset)
               return (
                 <div
                   key={idx}
                   className="bg-white rounded border border-blue-200 p-2 text-center hover:shadow-md transition-shadow"
                 >
                   <div className="flex items-center justify-center gap-1 mb-2">
                     <Clock className="w-3 h-3 text-blue-600" />
                     <span className="text-xs font-bold text-blue-900">{time}</span>
                   </div>
                   <div className="text-xs text-blue-600 font-medium border-t border-blue-100 pt-2">
                     Consume items
                   </div>
                 </div>
               )
             })}
           </div>

           {/* Products List */}
           {data.items && data.items.length > 0 && (
             <div className="bg-white rounded border border-blue-200 p-3 mt-3">
               <p className="text-xs font-semibold text-blue-900 mb-2">🍷 Each Interval:</p>
               <div className="space-y-2">
                 {data.items.map((item: any, idx: number) => (
                   <div key={idx} className="flex items-start justify-between gap-2 p-2 bg-blue-50 rounded border border-blue-100">
                     <div className="flex-1 min-w-0">
                       <p className="font-semibold text-xs text-slate-900">
                         {item.product || item.producto}
                       </p>
                       <p className="text-xs text-slate-600 mt-0.5">
                         <strong>{item.quantity || item.cantidad}</strong> {item.unit || item.unidad}
                       </p>
                       {(item.frecuencia || item.frequency) && (
                         <p className="text-xs text-blue-600 font-medium mt-1">
                           {item.frecuencia || item.frequency}
                         </p>
                       )}
                     </div>
                     {item.macronutrientes && (
                       <div className="flex gap-1 flex-shrink-0">
                         {item.macronutrientes.carbohidratos_g && (
                           <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-semibold">
                             {item.macronutrientes.carbohidratos_g}g
                           </span>
                         )}
                         {item.macronutrientes.sodio_mg && (
                           <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">
                             {item.macronutrientes.sodio_mg}Na
                           </span>
                         )}
                       </div>
                     )}
                   </div>
                 ))}
               </div>
             </div>
           )}
         </div>
       )}
     </div>
   )
 }

function PostWorkoutSection({
  data,
  workoutDuration,
  workoutStartTime,
  calculateTime,
  isExpanded,
  onToggle,
}: SectionProps & {
  data: any
  workoutDuration: number
  workoutStartTime: string
  calculateTime: (offset: number) => string
}) {
  const postTime = calculateTime(workoutDuration + 10)
  
  // Calculate totals from items if not provided
  let totalCarbs = data.totalCarbs !== undefined ? data.totalCarbs : calculateTotalCarbs(data.items)
  let totalProtein = data.totalProtein !== undefined ? data.totalProtein : calculateTotalProtein(data.items)
  
  // If no macros from AI, use calculated guidelines
  const hasAIData = totalCarbs > 0 || totalProtein > 0

  return (
    <div className="bg-white rounded-lg border border-pink-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between hover:bg-pink-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 text-left min-w-0">
          <div className="w-8 h-8 rounded bg-pink-100 flex items-center justify-center flex-shrink-0">
            <Flame className="w-4 h-4 text-pink-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-pink-900 text-sm">Post-Workout</h3>
            <p className="text-xs text-pink-700">{data.timing || "30-60 min after"} (~{postTime})</p>
          </div>
           <div className="hidden sm:flex gap-2 flex-shrink-0">
             <NutrientBadge icon={Flame} label="Carbs" value={`${totalCarbs || "?"}g`} color="orange" />
             <NutrientBadge icon={Zap} label="Protein" value={`${totalProtein || "?"}g`} color="purple" />
           </div>
         </div>
         <ChevronDown
           className={cn("w-5 h-5 text-pink-600 transition-transform flex-shrink-0", isExpanded && "rotate-180")}
         />
       </button>

       {isExpanded && (
         <div className="border-t border-pink-200 bg-pink-50 p-3">
           {!hasAIData && (
             <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-3">
               <p className="text-xs text-amber-700">
                 <strong>Recovery guideline:</strong> Consume {totalCarbs}g carbs + {totalProtein}g protein within 30-60 min for optimal recovery
               </p>
             </div>
           )}
           
           <div className="space-y-2">
             {data.items && data.items.length > 0 ? (
               data.items.map((item: any, idx: number) => (
                 <div key={idx} className="bg-white rounded p-2.5 border border-pink-200 hover:shadow-sm transition-shadow">
                   <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                     <div className="flex-1 min-w-0">
                       <p className="font-semibold text-sm text-slate-900">
                         {item.product || item.producto}
                       </p>
                       <p className="text-xs text-slate-600 mt-1">
                         <strong>{item.quantity || item.cantidad}</strong> {item.unit || item.unidad}
                       </p>
                       {(item.timing || item.tiempo_minutos) && (
                         <p className="text-xs text-pink-600 font-medium mt-1">
                           Within {item.timing || item.tiempo_minutos} minutes
                         </p>
                       )}
                       {(item.notes || item.notas) && (
                         <p className="text-xs text-slate-500 italic mt-1">{item.notes || item.notas}</p>
                       )}
                     </div>
                     <div className="flex flex-wrap gap-1">
                       {(item.carbs !== undefined || item.macronutrientes?.carbohidratos_g !== undefined) && (
                         <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-1 rounded">
                           {item.carbs || item.macronutrientes?.carbohidratos_g}g carbs
                         </span>
                       )}
                       {(item.protein !== undefined || item.macronutrientes?.proteina_g !== undefined) && (
                         <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-1 rounded">
                           {item.protein || item.macronutrientes?.proteina_g}g protein
                         </span>
                       )}
                     </div>
                   </div>
                 </div>
               ))
             ) : (
               <p className="text-xs text-slate-500 italic">No specific items. Eat balanced meal with carbs (80-100g) and protein (30-40g).</p>
             )}
           </div>
         </div>
       )}
     </div>
   )
 }

function NutritionItem({ item }: { item: any }) {
  return (
    <div className="bg-white rounded p-2 md:p-3 border border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-xs md:text-sm text-slate-900">{item.product}</p>
          <p className="text-xs text-slate-600">
            <strong>{item.quantity}</strong> {item.unit}
          </p>
          {item.notes && <p className="text-xs text-slate-500 italic mt-1">{item.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-1 sm:gap-2">
          {item.carbs !== undefined && (
            <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded whitespace-nowrap">
              {item.carbs}g
            </span>
          )}
          {item.protein !== undefined && (
            <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded whitespace-nowrap">
              {item.protein}g
            </span>
          )}
          {item.sodium !== undefined && (
            <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded whitespace-nowrap">
              {item.sodium}mg
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function NutrientBadge({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any
  label: string
  value: string
  color: string
}) {
  const bgClass = {
    orange: "bg-orange-50 text-orange-700",
    purple: "bg-purple-50 text-purple-700",
    cyan: "bg-cyan-50 text-cyan-700",
  }[color] || "bg-slate-50 text-slate-700"

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded ${bgClass}`}>
      <Icon className="w-3 h-3" />
      <span className="text-xs font-semibold">{value}</span>
    </div>
  )
}

function ScienceBreakdownSection({
  rationale,
  warnings,
}: {
  rationale?: string
  warnings?: string[]
}) {
  return (
    <div className="bg-white rounded-lg border border-indigo-200 p-3 md:p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Zap className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-xs md:text-sm font-semibold text-indigo-900 mb-2">
            Science Behind Your Plan
          </h4>
          {rationale && (
            <p className="text-xs md:text-sm text-indigo-800 leading-relaxed whitespace-pre-wrap break-words">
              {rationale}
            </p>
          )}
        </div>
      </div>

      {warnings && warnings.length > 0 && (
        <div className="border-t border-indigo-200 pt-3">
          <div className="space-y-2">
            {warnings.map((warning, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs md:text-sm text-amber-800">{warning}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
