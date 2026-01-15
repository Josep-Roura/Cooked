import { format, isValid, parse } from "date-fns"

export type TrainingPeaksCsvRow = {
  workout_day: string
  start_time: string | null
  workout_type: string
  title: string
  description: string | null
  coach_comments: string | null
  athlete_comments: string | null
  planned_hours: number | null
  planned_km: number | null
  actual_hours: number | null
  actual_km: number | null
  if: number | null
  tss: number | null
  power_avg: number | null
  hr_avg: number | null
  rpe: number | null
  feeling: number | null
  has_actual: boolean
  week: string | null
  dow: string | null
  source: string
}

export type TrainingPeaksCsvRowError = {
  row: number
  message: string
}

export type TrainingPeaksCsvParseResult = {
  rows: TrainingPeaksCsvRow[]
  preview: TrainingPeaksCsvRow[]
  errors: TrainingPeaksCsvRowError[]
  stats: {
    totalRows: number
    validRows: number
    invalidRows: number
  }
}

type HeaderMapping = Record<string, keyof TrainingPeaksCsvRow>

const HEADER_ALIASES: Record<keyof TrainingPeaksCsvRow, string[]> = {
  workout_day: ["date", "workoutday", "day", "workoutdate"],
  start_time: ["starttime", "start time", "start_time"],
  workout_type: ["workouttype", "workout type", "type", "sport"],
  title: ["title", "workouttitle", "session", "name"],
  description: ["description", "details", "workoutdescription", "notes"],
  coach_comments: ["coachcomments", "coach comments", "coachcomment"],
  athlete_comments: ["athletecomments", "athlete comments", "athletecomment"],
  planned_hours: ["plannedtime", "planned time", "planned duration", "plannedtime/duration", "plannedtimeduration"],
  planned_km: ["planneddistance", "planned distance", "planneddistancekm", "plannedkm", "planneddistance(km)"],
  actual_hours: ["actualtime", "actual time", "actual duration", "actualtime/duration", "actualtimeduration"],
  actual_km: ["actualdistance", "actual distance", "actualdistancekm", "actualkm", "actualdistance(km)"],
  if: ["if", "intensityfactor", "intensity factor"],
  tss: ["tss"],
  power_avg: ["avgpower", "averagepower", "avg power", "average power"],
  hr_avg: ["avghr", "avg hr", "averagehr", "average hr", "avg heartrate", "average heartrate"],
  rpe: ["rpe"],
  feeling: ["feeling"],
  has_actual: ["hasactual", "has actual", "completed"],
  week: ["week"],
  dow: ["dow", "dayofweek", "day of week"],
  source: ["source"],
}

const DATE_FORMATS = ["yyyy-MM-dd", "MM/dd/yyyy", "dd/MM/yyyy", "M/d/yyyy", "d/M/yyyy", "yyyy/MM/dd"]

function normalizeHeader(header: string) {
  return header.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function buildHeaderMapping(headers: string[]): HeaderMapping {
  const mapping: HeaderMapping = {}
  const aliasLookup: Record<string, keyof TrainingPeaksCsvRow> = {}

  Object.entries(HEADER_ALIASES).forEach(([key, aliases]) => {
    aliases.forEach((alias) => {
      aliasLookup[normalizeHeader(alias)] = key as keyof TrainingPeaksCsvRow
    })
  })

  const inferKey = (normalized: string): keyof TrainingPeaksCsvRow | null => {
    if (aliasLookup[normalized]) return aliasLookup[normalized]
    if (normalized.startsWith("plannedtime")) return "planned_hours"
    if (normalized.startsWith("actualtime")) return "actual_hours"
    if (normalized.startsWith("planneddistance")) return "planned_km"
    if (normalized.startsWith("actualdistance")) return "actual_km"
    if (normalized.startsWith("avgpower") || normalized.startsWith("averagepower")) return "power_avg"
    if (normalized.startsWith("avghr") || normalized.startsWith("averagehr") || normalized.startsWith("avgheartrate") || normalized.startsWith("averageheartrate")) {
      return "hr_avg"
    }
    if (normalized.startsWith("coachcomment")) return "coach_comments"
    if (normalized.startsWith("athletecomment")) return "athlete_comments"
    if (normalized.startsWith("workouttype")) return "workout_type"
    if (normalized.startsWith("workoutday") || normalized === "date") return "workout_day"
    if (normalized.startsWith("starttime")) return "start_time"
    return null
  }

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header)
    const target = inferKey(normalized)
    if (target) {
      mapping[String(index)] = target
    }
  })

  return mapping
}

function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        currentValue += "\""
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentValue)
      currentValue = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i += 1
      }
      currentRow.push(currentValue)
      if (currentRow.some((value) => value.trim() !== "")) {
        rows.push(currentRow)
      }
      currentRow = []
      currentValue = ""
      continue
    }

    currentValue += char
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue)
    if (currentRow.some((value) => value.trim() !== "")) {
      rows.push(currentRow)
    }
  }

  return rows
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null
  const cleaned = value.trim().replace(/[^\d,.-]/g, "")
  if (!cleaned) return null

  const normalized = cleaned.includes(".") && cleaned.includes(",")
    ? cleaned.replace(/,/g, "")
    : cleaned.replace(",", ".")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDurationToHours(value: string | undefined): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map((part) => Number(part))
    if (parts.some((part) => Number.isNaN(part))) {
      return null
    }
    const [hours, minutes, seconds] = parts.length === 2 ? [parts[0], parts[1], 0] : [parts[0], parts[1], parts[2] ?? 0]
    return hours + minutes / 60 + seconds / 3600
  }

  return parseNumber(trimmed)
}

function parseDateValue(value: string | undefined) {
  if (!value) return { date: null, time: null }
  const trimmed = value.trim()
  if (!trimmed) return { date: null, time: null }

  let datePart = trimmed
  let timePart: string | null = null

  if (trimmed.includes("T")) {
    const [dateCandidate, timeCandidate] = trimmed.split("T", 2)
    datePart = dateCandidate
    timePart = timeCandidate ?? null
  } else if (trimmed.includes(" ")) {
    const [dateCandidate, timeCandidate] = trimmed.split(" ", 2)
    datePart = dateCandidate
    timePart = timeCandidate ?? null
  }

  const parsedDate = DATE_FORMATS.reduce<Date | null>((acc, formatString) => {
    if (acc) return acc
    const result = parse(datePart, formatString, new Date())
    return isValid(result) ? result : null
  }, null)

  const date = parsedDate ? format(parsedDate, "yyyy-MM-dd") : null

  const timeMatch = timePart?.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i)
  let time: string | null = null
  if (timeMatch) {
    let hours = Number(timeMatch[1])
    const minutes = timeMatch[2]
    const meridiem = timeMatch[3]?.toLowerCase()
    if (meridiem === "pm" && hours < 12) {
      hours += 12
    }
    if (meridiem === "am" && hours === 12) {
      hours = 0
    }
    time = `${String(hours).padStart(2, "0")}:${minutes}`
  }

  return { date, time }
}

function parseTimeValue(value: string | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = trimmed.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i)
  if (!match) return null
  let hours = Number(match[1])
  const meridiem = match[3]?.toLowerCase()
  if (meridiem === "pm" && hours < 12) {
    hours += 12
  }
  if (meridiem === "am" && hours === 12) {
    hours = 0
  }
  return `${String(hours).padStart(2, "0")}:${match[2]}`
}

export function parseTrainingPeaksCsv(text: string): TrainingPeaksCsvParseResult {
  const rows = parseCsvText(text)
  const [headerRow, ...dataRows] = rows
  if (!headerRow) {
    return {
      rows: [],
      preview: [],
      errors: [{ row: 0, message: "CSV appears to be empty." }],
      stats: { totalRows: 0, validRows: 0, invalidRows: 0 },
    }
  }

  const mapping = buildHeaderMapping(headerRow)
  const errors: TrainingPeaksCsvRowError[] = []
  const parsedRows: TrainingPeaksCsvRow[] = []

  dataRows.forEach((rowValues, index) => {
    const rowData: Partial<TrainingPeaksCsvRow> = {}
    Object.entries(mapping).forEach(([colIndex, target]) => {
      const value = rowValues[Number(colIndex)]?.trim()
      if (!value) return
      rowData[target] = value as never
    })

    const { date, time: dateTime } = parseDateValue(rowData.workout_day)
    if (!date) {
      errors.push({ row: index + 2, message: "Missing or invalid workout date." })
      return
    }

    const plannedHours = parseDurationToHours(rowData.planned_hours as string | undefined)
    const actualHours = parseDurationToHours(rowData.actual_hours as string | undefined)
    const plannedKm = parseNumber(rowData.planned_km as string | undefined)
    const actualKm = parseNumber(rowData.actual_km as string | undefined)
    const hasActualField = rowData.has_actual ? rowData.has_actual.toString().trim().toLowerCase() : ""
    const hasActualFlag = ["true", "yes", "1"].includes(hasActualField)

    const parsed: TrainingPeaksCsvRow = {
      workout_day: date,
      start_time: parseTimeValue(rowData.start_time as string | undefined) ?? dateTime,
      workout_type: (rowData.workout_type ?? "").toString().trim(),
      title: (rowData.title ?? "").toString().trim(),
      description: rowData.description ? rowData.description.toString().trim() : null,
      coach_comments: rowData.coach_comments ? rowData.coach_comments.toString().trim() : null,
      athlete_comments: rowData.athlete_comments ? rowData.athlete_comments.toString().trim() : null,
      planned_hours: plannedHours,
      planned_km: plannedKm,
      actual_hours: actualHours,
      actual_km: actualKm,
      if: parseNumber(rowData.if as string | undefined),
      tss: parseNumber(rowData.tss as string | undefined),
      power_avg: parseNumber(rowData.power_avg as string | undefined),
      hr_avg: parseNumber(rowData.hr_avg as string | undefined),
      rpe: parseNumber(rowData.rpe as string | undefined),
      feeling: parseNumber(rowData.feeling as string | undefined),
      has_actual: hasActualFlag || actualHours !== null || actualKm !== null,
      week: rowData.week ? rowData.week.toString().trim() : null,
      dow: rowData.dow ? rowData.dow.toString().trim() : null,
      source: rowData.source ? rowData.source.toString().trim() : "trainingpeaks_csv",
    }

    parsed.workout_type = parsed.workout_type || "Training"
    parsed.title = parsed.title || parsed.workout_type || "Training"

    parsedRows.push(parsed)
  })

  return {
    rows: parsedRows,
    preview: parsedRows.slice(0, 10),
    errors,
    stats: {
      totalRows: dataRows.length,
      validRows: parsedRows.length,
      invalidRows: errors.length,
    },
  }
}

export function runTrainingPeaksCsvDiagnostics() {
  const sample = `Date,Workout Type,Title,Planned Time,Actual Time,Planned Distance,Actual Distance,IF,TSS
2024-05-01,Run,Easy Run,1:00:00,0:55:00,10,9,0.72,45`
  return parseTrainingPeaksCsv(sample)
}
