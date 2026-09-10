import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

describe('quality workspace tabs', () => {
  it('aligns the tabs to the right and makes the active tab prominent', () => {
    expect(styles).toContain('.quality-clean-page .quality-workspace-tabs {')
    expect(styles).toContain('margin-left: auto;')
    expect(styles).toContain('justify-content: flex-end;')
    expect(styles).toContain('background: #2f7d4c;')
    expect(styles).toContain('color: #fff;')
  })
})
