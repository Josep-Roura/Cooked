import PDFDocument from "pdfkit"
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function groupItems(items: Array<{ name: string; quantity: number | null; unit: string | null; category: string | null }>) {
  const grouped = new Map<string, typeof items>()
  items.forEach((item) => {
    const category = item.category?.trim() || "other"
    if (!grouped.has(category)) grouped.set(category, [])
    grouped.get(category)?.push(item)
  })
  return grouped
}

function formatItemLine(item: { name: string; quantity: number | null; unit: string | null }) {
  if (item.quantity === null) return item.name
  const unit = item.unit ? ` ${item.unit}` : ""
  return `${item.quantity}${unit} ${item.name}`
}

async function buildPdfBuffer(payload: {
  title: string
  subtitle: string
  items: Array<{ name: string; quantity: number | null; unit: string | null; category: string | null }>
}) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "LETTER" })
    const chunks: Buffer[] = []

    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", (err) => reject(err))

    doc.fontSize(20).fillColor("#0f172a").text(payload.title)
    doc.moveDown(0.5)
    doc.fontSize(11).fillColor("#475569").text(payload.subtitle)
    doc.moveDown(1)

    const grouped = groupItems(payload.items)
    Array.from(grouped.keys())
      .sort()
      .forEach((category) => {
        const items = grouped.get(category) ?? []
        doc.fontSize(13).fillColor("#0f172a").text(category.toUpperCase())
        doc.moveDown(0.4)
        items.forEach((item) => {
          doc
            .fontSize(11)
            .fillColor("#1f2937")
            .text(`☐ ${formatItemLine(item)}`, {
              indent: 8,
            })
        })
        doc.moveDown(0.8)
      })

    doc.end()
  })
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const start = searchParams.get("start")
    const end = searchParams.get("end")

    if (!start || !end || !DATE_REGEX.test(start) || !DATE_REGEX.test(end)) {
      return NextResponse.json({ error: "Invalid date range." }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated", details: authError?.message ?? null },
        { status: 401 },
      )
    }

    const { data, error } = await supabase
      .from("grocery_items")
      .select("name, quantity, unit, category")
      .eq("user_id", user.id)
      .gte("date_range_start", start)
      .lte("date_range_end", end)
      .order("category", { ascending: true })
      .order("name", { ascending: true })

    if (error) {
      return NextResponse.json({ error: "Failed to load grocery list", details: error.message }, { status: 400 })
    }

    const pdfBuffer = await buildPdfBuffer({
      title: "Grocery List",
      subtitle: `${start} → ${end}`,
      items: data ?? [],
    })

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="grocery-list-${start}-to-${end}.pdf"`,
      },
    })
  } catch (error) {
    console.error("GET /api/v1/grocery/pdf error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
