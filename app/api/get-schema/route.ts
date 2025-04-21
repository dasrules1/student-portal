import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET() {
  try {
    // Path to the schema.sql file
    const schemaPath = path.join(process.cwd(), "lib", "supabase", "schema.sql")

    // Check if the file exists
    if (!fs.existsSync(schemaPath)) {
      return NextResponse.json({ error: "Schema file not found" }, { status: 404 })
    }

    // Read the schema file
    const sql = fs.readFileSync(schemaPath, "utf8")

    return NextResponse.json({ sql })
  } catch (error) {
    console.error("Error reading schema file:", error)
    return NextResponse.json({ error: "Failed to read schema file" }, { status: 500 })
  }
}
