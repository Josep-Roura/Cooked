"use client"

import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { useSession } from "@/hooks/use-session"
import { getDateRange } from "@/lib/db/queries"
import { importWorkouts } from "@/lib/db/tpWorkouts"
import {
  parseTrainingPeaksCsv,
  runTrainingPeaksCsvDiagnostics,
  type TrainingPeaksCsvParseResult,
} from "@/lib/integrations/trainingpeaks/csv"
import { ensureNutritionPlanRange, writeEnsuredRange } from "@/lib/nutrition/ensure"
import { useWorkoutImportStatus } from "@/lib/db/hooks"

const PREVIEW_LIMIT = 10

export function TrainingPeaksCsvImport() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = useSession()
  const importStatusQuery = useWorkoutImportStatus(user?.id)
  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<TrainingPeaksCsvParseResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.info("TrainingPeaks CSV diagnostics", runTrainingPeaksCsvDiagnostics())
    }
  }, [])

  useEffect(() => {
    setParseResult(null)
    setParseError(null)
    setProgress(0)
  }, [file])

  const stats = parseResult?.stats

  const previewRows = useMemo(() => parseResult?.preview ?? [], [parseResult])
  const duplicateRows = useMemo(() => {
    if (!parseResult?.rows.length) return []
    const seen = new Set<string>()
    const duplicates: TrainingPeaksCsvParseResult["rows"] = []
    parseResult.rows.forEach((row) => {
      const key = `${row.workout_day}-${row.title}-${row.workout_type}`
      if (seen.has(key)) {
        duplicates.push(row)
      } else {
        seen.add(key)
      }
    })
    return duplicates
  }, [parseResult?.rows])

  const handleParse = async () => {
    if (!file) return
    setIsParsing(true)
    setParseError(null)
    try {
      const text = await file.text()
      const result = parseTrainingPeaksCsv(text)
      setParseResult(result)
      if (result.rows.length === 0) {
        setParseError("No valid workouts were found in this CSV.")
      }
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Unable to parse CSV file.")
    } finally {
      setIsParsing(false)
    }
  }

  const handleImport = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to import workouts." })
      return
    }
    if (!parseResult?.rows.length) {
      return
    }
    setIsImporting(true)
    setProgress(0)
    try {
      await importWorkouts(user.id, parseResult.rows, setProgress)
      const now = new Date()
      const { start, end } = getDateRange("month", now)
      try {
        await ensureNutritionPlanRange({
          start: format(start, "yyyy-MM-dd"),
          end: format(end, "yyyy-MM-dd"),
          force: true,
        })
        writeEnsuredRange(user.id, format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"))
      } catch (error) {
        console.error("Failed to ensure nutrition plan after import", error)
        toast({
          title: "Nutrition update failed",
          description: error instanceof Error ? error.message : "Unable to update nutrition plan.",
          variant: "destructive",
        })
      }
      toast({ title: "Import complete", description: "Your TrainingPeaks workouts are now available." })
      await importStatusQuery.refetch()
      await queryClient.invalidateQueries({ queryKey: ["db"] })
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unable to import workouts.",
      })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-foreground">TrainingPeaks CSV Import</h3>
        <p className="text-sm text-muted-foreground">
          Upload a TrainingPeaks CSV export to import workouts into your calendar and training dashboard.
        </p>
        <a className="text-xs text-primary underline" href="/sample-trainingpeaks.csv" download>
          Download sample CSV
        </a>
        {importStatusQuery.data && (
          <div className="text-xs text-muted-foreground">
            Last import: {importStatusQuery.data.last_import_at
              ? format(new Date(importStatusQuery.data.last_import_at), "PPpp")
              : "No imports yet"}{" "}
            · Total workouts: {importStatusQuery.data.total_workouts}
          </div>
        )}
      </div>

      {!user && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Sign in required</AlertTitle>
          <AlertDescription>You need to be logged in to import TrainingPeaks workouts.</AlertDescription>
        </Alert>
      )}

      <div className="mt-4 space-y-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={!file || isParsing} onClick={handleParse}>
            {isParsing ? "Parsing..." : "Parse & Preview"}
          </Button>
          <Button disabled={!parseResult?.rows.length || isImporting || !user} onClick={handleImport}>
            {isImporting ? "Importing..." : "Import Workouts"}
          </Button>
          {stats && (
            <span className="text-xs text-muted-foreground">
              {stats.validRows} valid / {stats.totalRows} rows ({stats.invalidRows} invalid)
            </span>
          )}
        </div>
      </div>

      {parseError && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>CSV error</AlertTitle>
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {parseResult?.errors.length ? (
        <Alert className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Rows skipped</AlertTitle>
          <AlertDescription>
            {parseResult.errors.slice(0, 3).map((error) => (
              <p key={`${error.row}-${error.message}`} className="text-xs text-muted-foreground">
                Row {error.row}: {error.message}
              </p>
            ))}
            {parseResult.errors.length > 3 && (
              <p className="text-xs text-muted-foreground">+{parseResult.errors.length - 3} more rows</p>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {duplicateRows.length > 0 && (
        <Alert className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Duplicates detected</AlertTitle>
          <AlertDescription>
            {duplicateRows.slice(0, 3).map((row) => (
              <p key={`${row.workout_day}-${row.title}-${row.workout_type}`} className="text-xs text-muted-foreground">
                {row.workout_day} · {row.title ?? row.workout_type ?? "Workout"}
              </p>
            ))}
            {duplicateRows.length > 3 && (
              <p className="text-xs text-muted-foreground">+{duplicateRows.length - 3} more duplicates</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {progress > 0 && (
        <div className="mt-4">
          <Progress value={progress} />
          <p className="mt-1 text-xs text-muted-foreground">{progress}% imported</p>
        </div>
      )}

      {previewRows.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-foreground mb-2">Preview (first {PREVIEW_LIMIT})</h4>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Planned (h)</TableHead>
                  <TableHead className="text-right">Actual (h)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, index) => (
                  <TableRow key={`${row.workout_day}-${row.title}-${index}`}>
                    <TableCell>{row.workout_day}</TableCell>
                    <TableCell>{row.title}</TableCell>
                    <TableCell>{row.workout_type}</TableCell>
                    <TableCell className="text-right">{row.planned_hours?.toFixed(2) ?? "-"}</TableCell>
                    <TableCell className="text-right">{row.actual_hours?.toFixed(2) ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
