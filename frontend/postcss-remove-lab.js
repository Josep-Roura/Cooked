/**
 * PostCSS Plugin to remove unsupported color functions (lab, lch, oklab, oklch)
 * This prevents Turbopack from trying to parse lab() color functions
 * 
 * Solution for: "Attempting to parse an unsupported color function 'lab'"
 * See: https://github.com/vercel/next.js/issues/65179
 */

const postcss = require('postcss')

module.exports = postcss.plugin('remove-lab-colors', function () {
  return (root, result) => {
    const nodesToRemove = []

    // Find and mark all nodes that contain unsupported color functions
    root.walkAtRules('supports', (atRule) => {
      const condition = atRule.params
      
      // Check for unsupported color functions in @supports conditions
      if (
        /lab\s*\(/.test(condition) ||
        /lch\s*\(/.test(condition) ||
        /oklab\s*\(/.test(condition) ||
        /oklch\s*\(/.test(condition)
      ) {
        // Mark entire @supports block for removal
        nodesToRemove.push(atRule)
      }
    })

    // Walk through declarations and replace/remove problematic values
    root.walkDecls((decl) => {
      if (
        /lab\s*\(/.test(decl.value) ||
        /lch\s*\(/.test(decl.value) ||
        /oklab\s*\(/.test(decl.value) ||
        /oklch\s*\(/.test(decl.value)
      ) {
        // For CSS custom properties (variables), convert to safe RGB
        if (decl.prop.startsWith('--')) {
          // Replace with transparent or fallback color
          decl.value = 'rgb(0 0 0 / 0)'
        } else {
          // For regular properties, just remove the declaration
          nodesToRemove.push(decl)
        }
      }
    })

    // Remove all marked nodes
    nodesToRemove.forEach((node) => {
      node.remove()
    })

    // Also handle @keyframes and other at-rules that might contain lab()
    root.walkAtRules((atRule) => {
      if (atRule.name !== 'supports') return

      const condition = atRule.params
      if (
        /lab\s*\(/.test(condition) ||
        /lch\s*\(/.test(condition) ||
        /oklab\s*\(/.test(condition) ||
        /oklch\s*\(/.test(condition)
      ) {
        atRule.remove()
      }
    })
  }
})

