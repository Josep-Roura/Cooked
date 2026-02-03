import jsPDF from "jspdf"
import html2canvas from "html2canvas"

interface NutritionPlanPDFOptions {
  filename?: string
  workoutType?: string
  workoutDate?: string
  workoutDuration?: number
  workoutStartTime?: string
}

/**
 * Export nutrition timeline to PDF
 * Captures the DOM element and converts it to PDF
 */
export async function exportNutritionToPDF(
  elementId: string,
  options: NutritionPlanPDFOptions = {}
): Promise<void> {
  const {
    filename = `nutrition-plan-${new Date().toISOString().split("T")[0]}.pdf`,
    workoutType = "Workout",
    workoutDate = new Date().toISOString().split("T")[0],
    workoutDuration = 0,
    workoutStartTime = "06:00",
  } = options

  try {
    // Get the element to export
    const element = document.getElementById(elementId)
    if (!element) {
      throw new Error(`Element with ID "${elementId}" not found`)
    }

    // Convert HTML to canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
    })

    // Create PDF from canvas
    const imgData = canvas.toDataURL("image/png")
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 10
    const contentWidth = pageWidth - 2 * margin

    // Calculate image dimensions to fit page
    const imgWidth = contentWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight

    let position = margin

    // Add header
    pdf.setFontSize(16)
    pdf.text("Nutrition Plan", margin, position)
    position += 8

    pdf.setFontSize(10)
    pdf.text(`Workout: ${workoutType}`, margin, position)
    position += 6
    pdf.text(`Date: ${workoutDate}`, margin, position)
    position += 6
    pdf.text(`Duration: ${workoutDuration} minutes`, margin, position)
    position += 6
    pdf.text(`Start Time: ${workoutStartTime}`, margin, position)
    position += 10

    // Add content
    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight)
    heightLeft -= pageHeight - position - margin

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    // Save PDF
    pdf.save(filename)
  } catch (error) {
    console.error("Error exporting nutrition plan to PDF:", error)
    throw new Error(
      error instanceof Error ? error.message : "Failed to export nutrition plan"
    )
  }
}

/**
 * Export nutrition data as simple text PDF
 * Alternative lightweight approach without capturing DOM
 */
export function exportNutritionAsTextPDF(
  plan: any,
  options: NutritionPlanPDFOptions = {}
): void {
  const {
    filename = `nutrition-plan-${new Date().toISOString().split("T")[0]}.pdf`,
    workoutType = "Workout",
    workoutDate = new Date().toISOString().split("T")[0],
    workoutDuration = 0,
    workoutStartTime = "06:00",
  } = options

  try {
    const pdf = new jsPDF()
    let yPosition = 20

    // Header
    pdf.setFontSize(18)
    pdf.text("Nutrition Plan", 20, yPosition)
    yPosition += 12

    // Metadata
    pdf.setFontSize(11)
    pdf.text(`Workout: ${workoutType}`, 20, yPosition)
    yPosition += 6
    pdf.text(`Date: ${workoutDate}`, 20, yPosition)
    yPosition += 6
    pdf.text(`Duration: ${workoutDuration} minutes`, 20, yPosition)
    yPosition += 6
    pdf.text(`Start Time: ${workoutStartTime}`, 20, yPosition)
    yPosition += 12

    const pageHeight = pdf.internal.pageSize.getHeight()
    const pageWidth = pdf.internal.pageSize.getWidth()
    const maxWidth = pageWidth - 40

    const addSection = (title: string, items: any[]) => {
      // Check if we need a new page
      if (yPosition > pageHeight - 40) {
        pdf.addPage()
        yPosition = 20
      }

      pdf.setFontSize(13)
      pdf.setTextColor(0, 100, 200)
      pdf.text(title, 20, yPosition)
      yPosition += 10

      pdf.setFontSize(10)
      pdf.setTextColor(0, 0, 0)

      items.forEach((item: any) => {
        if (yPosition > pageHeight - 30) {
          pdf.addPage()
          yPosition = 20
        }

        // Product name
        const productLines = pdf.splitTextToSize(
          `• ${item.product} (${item.quantity}${item.unit})`,
          maxWidth
        )
        pdf.text(productLines, 25, yPosition)
        yPosition += productLines.length * 5

        // Macros
        const macroText = []
        if (item.carbs !== undefined) macroText.push(`Carbs: ${item.carbs}g`)
        if (item.protein !== undefined) macroText.push(`Protein: ${item.protein}g`)
        if (item.sodium !== undefined) macroText.push(`Sodium: ${item.sodium}mg`)

        if (macroText.length > 0) {
          pdf.setTextColor(100, 100, 100)
          pdf.setFontSize(9)
          pdf.text(macroText.join(" | "), 30, yPosition)
          pdf.setTextColor(0, 0, 0)
          pdf.setFontSize(10)
          yPosition += 5
        }

        // Notes
        if (item.notes) {
          const noteLines = pdf.splitTextToSize(`Note: ${item.notes}`, maxWidth - 5)
          pdf.setTextColor(120, 120, 120)
          pdf.setFontSize(9)
          pdf.text(noteLines, 30, yPosition)
          pdf.setTextColor(0, 0, 0)
          pdf.setFontSize(10)
          yPosition += noteLines.length * 4
        }

        yPosition += 3
      })

      yPosition += 5
    }

    // Pre-Workout
    if (plan.preWorkout) {
      addSection("PRE-WORKOUT", plan.preWorkout.items)
    }

    // During-Workout
    if (plan.duringWorkout) {
      addSection(
        `DURING-WORKOUT (Every ${plan.duringWorkout.interval} minutes)`,
        plan.duringWorkout.items
      )
    }

    // Post-Workout
    if (plan.postWorkout) {
      addSection("POST-WORKOUT", plan.postWorkout.items)
    }

    pdf.save(filename)
  } catch (error) {
    console.error("Error exporting nutrition plan as text PDF:", error)
    throw new Error(
      error instanceof Error ? error.message : "Failed to export nutrition plan"
    )
  }
}
