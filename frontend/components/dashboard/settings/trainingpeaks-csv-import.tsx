"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { Upload, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { useSession } from "@/hooks/use-session"
import { CenteredModal } from "@/components/ui/centered-modal"
import { useWorkoutImportStatus } from "@/lib/db/hooks"

const PREVIEW_LIMIT = 10

type PreviewPayload = {
  preview: Array<{
    workout_day: string
    title: string
    workout_type: string
    planned_hours: number | null
    actual_hours: number | null
  }>
  errors: Array<{ row: number; message: string }>
  stats: { totalRows: number; validRows: number; invalidRows: number }
  duplicates: Array<{ workout_day: string; title: string; workout_type: string }>
}

type ImportSummary = {
  created: number
  updated: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}

export function TrainingPeaksCsvImport() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = useSession()
  const importStatusQuery = useWorkoutImportStatus(user?.id)
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewPayload | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)

  const handleParse = async (fileToParse: File) => {
    setIsParsing(true)
    setPreview(null)
    setImportSummary(null)
    try {
      const formData = new FormData()
      formData.append("file", fileToParse)
      const response = await fetch("/api/v1/workouts/import?mode=preview", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Unable to parse CSV")
      }
      const data = (await response.json()) as PreviewPayload
      setPreview(data)
    } catch (error) {
      toast({
        title: "CSV error",
        description: error instanceof Error ? error.message : "Unable to parse CSV file.",
        variant: "destructive",
      })
    } finally {
      setIsParsing(false)
    }
  }

  const handleImport = async () => {
    if (!file) return
    setIsImporting(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await fetch("/api/v1/workouts/import?mode=import", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Import failed")
      }
      const data = (await response.json()) as ImportSummary
      setImportSummary(data)
      toast({ title: "Import complete", description: "Your workouts are now available." })
      await importStatusQuery.refetch()
      await queryClient.invalidateQueries({ queryKey: ["db"] })
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unable to import workouts.",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleFileChange = (nextFile: File | null) => {
    setFile(nextFile)
    if (nextFile) {
      handleParse(nextFile)
    }
  }

  const previewRows = useMemo(() => preview?.preview ?? [], [preview])

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

      <div className="mt-4">
        <Button variant="outline" onClick={() => setOpen(true)}>
          Import CSV
        </Button>
      </div>

      <CenteredModal open={open} onOpenChange={setOpen} title="Import TrainingPeaks CSV">
        {!user && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Sign in required</AlertTitle>
            <AlertDescription>You need to be logged in to import workouts.</AlertDescription>
          </Alert>
        )}

        <div
          className="border border-dashed border-border rounded-2xl p-6 text-center space-y-3"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            const dropped = event.dataTransfer.files?.[0]
            handleFileChange(dropped ?? null)
          }}
        >
          <Upload className="h-6 w-6 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Drag & drop your CSV here, or select a file.</p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
          />
          {file && (
            <p className="text-xs text-muted-foreground">
              Selected: {file.name} {isParsing ? "(validating...)" : ""}
            </p>
          )}
        </div>

        {preview && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{preview.stats.validRows} valid rows</span>
              <span>{preview.stats.invalidRows} invalid rows</span>
              <span>{preview.stats.totalRows} total rows</span>
            </div>

            {preview.errors.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Rows skipped</AlertTitle>
                <AlertDescription>
                  {preview.errors.slice(0, 3).map((error) => (
                    <p key={`${error.row}-${error.message}`} className="text-xs text-muted-foreground">
                      Row {error.row}: {error.message}
                    </p>
                  ))}
                  {preview.errors.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{preview.errors.length - 3} more rows</p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {preview.duplicates.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Duplicates detected</AlertTitle>
                <AlertDescription>
                  {preview.duplicates.slice(0, 3).map((row) => (
                    <p key={`${row.workout_day}-${row.title}-${row.workout_type}`} className="text-xs text-muted-foreground">
                      {row.workout_day} · {row.title ?? row.workout_type ?? "Workout"}
                    </p>
                  ))}
                  {preview.duplicates.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{preview.duplicates.length - 3} more duplicates</p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {previewRows.length > 0 && (
              <div>
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

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!user || isImporting || preview?.stats.validRows === 0}>
                {isImporting ? "Importing..." : "Confirm import"}
              </Button>
            </div>

            {importSummary ? (
              <div className="text-xs text-muted-foreground">
                Imported: {importSummary.created} new, {importSummary.updated} updated · {importSummary.skipped} skipped
              </div>
            ) : null}
          </div>
        )}
      </CenteredModal>
    </div>
  )
}
