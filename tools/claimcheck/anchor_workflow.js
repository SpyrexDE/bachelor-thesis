export const meta = {
  name: 'anchor-support-finder',
  description: 'Per citation, find the verbatim source passage that supports the thesis statement',
  phases: [{ title: 'Find', detail: 'one agent per cite reads its source excerpts and quotes the supporting passage' }],
}

const a = typeof args === 'string' ? JSON.parse(args) : args
const dir = a.dir
const N = a.count
// a.only = [indices] -> only re-run these tasks (cheaper resume)
const TARGET = Array.isArray(a.only) && a.only.length ? a.only : Array.from({ length: N }, (_, i) => i)
const SCHEMA = {
  type: 'object',
  properties: {
    i: { type: 'number' },
    supported: { enum: ['yes', 'partial', 'no'] },
    quote: { type: 'string', description: 'VERBATIM contiguous span copied exactly from source_excerpts, ~8-25 words, no ellipses/paraphrase; empty if not supported' },
    why: { type: 'string', description: 'one sentence' },
  },
  required: ['i', 'supported', 'quote'],
}

phase('Find')
const results = await parallel(TARGET.map(i => () => {
  const f = `${dir}/task_${String(i).padStart(3, '0')}.json`
  return agent(
    `Read the JSON file at ${f}. It has: label (the cited source), statement (a sentence from a thesis that cites this source), and source_excerpts (text extracted from the source PDF).\n\n` +
    `Your job: find the SINGLE passage in source_excerpts that most directly supports the specific point the statement makes about THIS source — the passage a reader should read to check the citation.\n\n` +
    `Rules:\n` +
    `- Copy the passage VERBATIM into "quote": one contiguous span, exactly as written in source_excerpts, character for character, roughly 8-25 words. Do NOT paraphrase, do NOT stitch parts together, do NOT insert "..." or ellipses.\n` +
    `- If the excerpts genuinely do not contain support for the statement, set supported="no" (or "partial" if only loosely related) and leave quote empty. Do not invent a quote.\n` +
    `- Return via StructuredOutput with i=${i}.`,
    { label: `cite:${i}`, phase: 'Find', schema: SCHEMA, model: 'sonnet', agentType: 'general-purpose' }
  )
}))

const done = results.filter(Boolean)
const yes = done.filter(r => r.supported === 'yes').length
const partial = done.filter(r => r.supported === 'partial').length
const no = done.filter(r => r.supported === 'no').length
log(`done: ${done.length}/${N} · yes ${yes} · partial ${partial} · no ${no}`)
return { results: done }