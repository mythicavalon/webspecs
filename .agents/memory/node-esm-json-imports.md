---
name: Node ESM JSON imports
description: Packaging constraint for TypeScript libraries that ship local JSON data in Node ESM.
---

When a TypeScript library emits ESM for Node 24 and imports checked-in JSON,
the source import must include an import attribute such as `with { type:
"json" }`. TypeScript can typecheck the JSON without it, but the emitted
runtime module otherwise fails before the library exports load.

**Why:** The classifier's published runtime imports versioned local signature
and range JSON files, so this failure only appeared when executing the built
package rather than during typechecking.

**How to apply:** Keep `resolveJsonModule` enabled, include the JSON files in
the composite project, emit them alongside the JavaScript, and use the import
attribute in ESM source.