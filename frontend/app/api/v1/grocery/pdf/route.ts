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

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

async function buildPdfBuffer(payload: {
  title: string
  subtitle: string
  items: Array<{ name: string; quantity: number | null; unit: string | null; category: string | null }>
}) {
  const marginLeft = 72
  let cursorY = 740
  const lineGap = 6
  const lines: Array<{ text: string; size: number; x: number; y: number }> = []

  const addLine = (text: string, size: number, indent = 0, spacing = lineGap) => {
    lines.push({ text, size, x: marginLeft + indent, y: cursorY })
    cursorY -= size + spacing
  }

  addLine(payload.title, 20, 0, 10)
  addLine(payload.subtitle, 11, 0, 14)

  const grouped = groupItems(payload.items)
  Array.from(grouped.keys())
    .sort()
    .forEach((category) => {
      addLine(category.toUpperCase(), 12, 0, 8)
      const items = grouped.get(category) ?? []
      items.forEach((item) => {
        addLine(`[ ] ${formatItemLine(item)}`, 11, 12, 4)
      })
      cursorY -= 6
    })

  const content = lines
    .map(({ text, size, x, y }) => `BT /F1 ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`)
    .join("\n")

  const header = "%PDF-1.4\n%\xFF\xFF\xFF\xFF\n"
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ]

  let offset = header.length
  const xrefEntries = ["0000000000 65535 f \n"]
  objects.forEach((object) => {
    xrefEntries.push(`${String(offset).padStart(10, "0")} 00000 n \n`)
    offset += object.length
  })

  const xrefOffset = offset
  const xref = `xref\n0 ${objects.length + 1}\n${xrefEntries.join("")}`
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  const output = header + objects.join("") + xref + trailer

  return Buffer.from(output, "latin1")
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
