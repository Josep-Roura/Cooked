#!/usr/bin/env node

/**
 * Post-build CSS cleanup script
 * Removes unsupported color functions from generated CSS files
 * Fixes: "Attempting to parse an unsupported color function 'lab'"
 */

const fs = require('fs')
const path = require('path')
const glob = require('glob')

// Pattern to match @supports rules with lab/lch/oklab/oklch
const UNSUPPORTED_PATTERN = /@supports\s*\([^)]*(?:lab|lch|oklab|oklch)\([^)]*\)\s*\)\s*\{[^}]*\}/gi

// Find all CSS files in .next build directory
const cssFiles = glob.sync(
  path.join(process.cwd(), '.next/**/*.css'),
  { nodir: true }
)

console.log(`🧹 Cleaning up ${cssFiles.length} CSS files...`)

let filesModified = 0

cssFiles.forEach((filePath) => {
  try {
    let content = fs.readFileSync(filePath, 'utf-8')
    const original = content

    // Remove @supports rules for unsupported color functions
    content = content.replace(UNSUPPORTED_PATTERN, '')

    // Also remove @supports for individual color functions
    content = content.replace(/@supports\s*\(color:\s*lab\([^)]*\)\)\s*\{[^}]*\}/gi, '')
    content = content.replace(/@supports\s*\(color:\s*lch\([^)]*\)\)\s*\{[^}]*\}/gi, '')
    content = content.replace(/@supports\s*\(color:\s*oklab\([^)]*\)\)\s*\{[^}]*\}/gi, '')
    content = content.replace(/@supports\s*\(color:\s*oklch\([^)]*\)\)\s*\{[^}]*\}/gi, '')

    // Write back if changed
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf-8')
      filesModified++
      console.log(`  ✅ ${path.relative(process.cwd(), filePath)}`)
    }
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message)
  }
})

console.log(`✨ Done! Modified ${filesModified} files.`)
