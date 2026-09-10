import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const qualityWorkspace = readFileSync(new URL('../src/pages/operations/QualityWorkspace.tsx', import.meta.url), 'utf8')
const qualityHistory = readFileSync(new URL('../src/pages/operations/QualityHistory.tsx', import.meta.url), 'utf8')

describe('quality workspace tabs', () => {
  it('aligns the tabs to the right and makes the active tab prominent', () => {
    expect(styles).toContain('.quality-clean-page .quality-workspace-tabs {')
    expect(styles).toContain('margin-left: auto;')
    expect(styles).toContain('justify-content: flex-end;')
    expect(styles).toContain('background: #2f7d4c;')
    expect(styles).toContain('color: #fff;')
  })

  it('does not show the shared page refresh button above both quality tabs', () => {
    expect(qualityWorkspace).not.toContain('RefreshButton')
  })

  it('loads only completed assessment batches for history from the API', () => {
    expect(qualityHistory).toContain("useApiList<AssessmentBatch>('/assessment-batches?status=completed')")
  })
})
