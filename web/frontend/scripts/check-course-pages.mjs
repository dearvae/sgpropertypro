#!/usr/bin/env node

import { spawn } from 'child_process'
import { mkdir } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PORT = Number(process.env.COURSE_PREVIEW_PORT || 4173)
const BASE_URL = process.env.COURSE_BASE_URL || `http://127.0.0.1:${PORT}`
const EVIDENCE_DIR = resolve(process.env.COURSE_EVIDENCE_DIR || join(ROOT, 'validation', 'course-pages'))

const expectedInstall = 'npx skills add dearvae/agentos-sg-course-skills --skill propnex-forms --skill agent-shot --skill pg-cobroke -g -a codex -y'
const errors = []

function assert(condition, message) {
  if (!condition) errors.push(message)
}

async function waitForServer(maxAttempts = 40) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/ai-agent-codex/`, { method: 'HEAD' })
      if (response.ok) return true
    } catch (_) {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
  }
  return false
}

function luminance([r, g, b]) {
  const values = [r, g, b].map((value) => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]
}

function contrast(a, b) {
  const light = Math.max(luminance(a), luminance(b))
  const dark = Math.min(luminance(a), luminance(b))
  return (light + 0.05) / (dark + 0.05)
}

async function run() {
  await mkdir(EVIDENCE_DIR, { recursive: true })
  const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, FORCE_COLOR: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let previewLog = ''
  preview.stdout.on('data', (chunk) => { previewLog += chunk.toString() })
  preview.stderr.on('data', (chunk) => { previewLog += chunk.toString() })

  try {
    assert(await waitForServer(), `Preview did not start. ${previewLog}`)
    if (errors.length) return

    const { chromium } = await import('playwright')
    const browser = await chromium.launch({ headless: true })
    try {
      const desktop = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        locale: 'zh-CN',
        permissions: ['clipboard-read', 'clipboard-write'],
      })
      const page = await desktop.newPage()
      const pageErrors = []
      page.on('pageerror', (error) => pageErrors.push(error.message))
      page.on('console', (message) => { if (message.type() === 'error') pageErrors.push(message.text()) })

      let response = await page.goto(`${BASE_URL}/ai-agent-codex/`, { waitUntil: 'networkidle' })
      assert(response?.status() === 200, 'Pre-class page did not return HTTP 200')
      assert(await page.locator('#step-1-title').isVisible(), 'Pre-class main content is not visible')
      assert(await page.locator('input[type="password"]').count() === 0, 'Pre-class page asks for a password')
      assert(await page.locator('a[href="/ai-agent-codex/class/"]').count() >= 1, 'Pre-class page does not link to class page')

      await page.locator('[data-set-os="win"]').click()
      assert(await page.locator('.win-only').isVisible(), 'Windows guidance did not appear')
      assert(!(await page.locator('.mac-only').isVisible()), 'Mac guidance remained visible in Windows mode')
      await page.locator('[data-set-lang="en"]').click()
      assert(await page.locator('#page-title [data-lang="en"]').isVisible(), 'English pre-class heading did not appear')
      await page.locator('button[data-copy="tools-win"]').click()
      await page.waitForTimeout(200)
      assert((await page.locator('button[data-copy="tools-win"]').innerText()).includes('Copied'), 'Windows copy control did not confirm success')
      await page.screenshot({ path: join(EVIDENCE_DIR, 'preclass-desktop-windows-en.png'), fullPage: true })

      await page.locator('[data-set-os="mac"]').click()
      await page.locator('[data-set-lang="zh"]').click()
      assert(await page.locator('.mac-only').isVisible(), 'Mac guidance did not appear')
      await page.screenshot({ path: join(EVIDENCE_DIR, 'preclass-desktop-mac-zh.png'), fullPage: true })

      response = await page.goto(`${BASE_URL}/ai-agent-codex/class/`, { waitUntil: 'networkidle' })
      assert(response?.status() === 200, 'Class page did not return HTTP 200')
      assert(await page.locator('#setup-title').isVisible(), 'Class setup content is not visible')
      assert(await page.locator('input[type="password"]').count() === 0, 'Class page asks for a password')
      assert(await page.locator('text=5 分钟退路').count() >= 3, 'Chinese recovery paths are missing')
      assert(await page.locator('text=MiniMax 不是今天成功的必要条件').count() === 1, 'Optional MiniMax boundary is missing')

      await page.locator('button[data-copy="install-command"]').click()
      const clipboard = await page.evaluate(() => navigator.clipboard.readText())
      assert(clipboard === expectedInstall, 'Install command copied from class page does not match the public repository command')

      const setupCheck = page.locator('input[data-progress="setup"]')
      await setupCheck.check()
      assert(await page.evaluate(() => JSON.parse(localStorage.getItem('agentos-course-progress-v1') || '{}').setup === true), 'Progress was not saved locally')
      assert(await page.locator('#forms').evaluate((element) => element.classList.contains('expanded')), 'Route did not advance to the Documents station')
      assert(!(await page.locator('#setup .install-stack').isVisible()), 'Completed Setup station did not collapse')
      assert(!(await page.locator('#video .bench').isVisible()), 'Upcoming Video station did not stay compact')
      assert(await page.locator('#progress-track').getAttribute('aria-valuenow') === '1', 'Persistent progress summary did not update')
      await page.reload({ waitUntil: 'networkidle' })
      assert(await page.locator('input[data-progress="setup"]').isChecked(), 'Progress did not persist after reload')

      await page.locator('[data-set-lang="en"]').click()
      assert(await page.locator('text=One route today:').isVisible(), 'English class heading did not appear')
      assert(await page.locator('text=Blocked: 5-minute fallback').count() >= 3, 'English recovery paths are missing')
      await page.locator('[data-route="forms"] a').click()
      await page.waitForTimeout(900)
      await page.screenshot({ path: join(EVIDENCE_DIR, 'class-desktop-forms-en.png') })
      await page.locator('button[data-copy="forms-recovery"]').focus()
      await page.keyboard.press('Enter')
      await page.waitForTimeout(200)
      assert((await page.locator('button[data-copy="forms-recovery"]').innerText()).includes('Copied'), 'Keyboard copy activation failed')
      const focusOutline = await page.locator('button[data-copy="forms-recovery"]').evaluate((element) => getComputedStyle(element).outlineWidth)
      assert(focusOutline !== '0px', 'Keyboard focus is not visibly outlined')

      const bodyColors = await page.locator('body').evaluate((element) => {
        const style = getComputedStyle(element)
        return { color: style.color, background: style.backgroundColor }
      })
      assert(bodyColors.color === 'rgb(26, 26, 26)', 'Body foreground token changed unexpectedly')
      assert(bodyColors.background === 'rgb(250, 246, 238)', 'Body background token changed unexpectedly')
      assert(contrast([26, 26, 26], [250, 246, 238]) >= 4.5, 'Primary body contrast is below WCAG AA')
      assert(contrast([85, 80, 74], [250, 246, 238]) >= 4.5, 'Secondary body contrast is below WCAG AA')
      assert(contrast([255, 255, 255], [184, 94, 0]) >= 4.5, 'Primary button hover contrast is below WCAG AA')
      assert(pageErrors.length === 0, `Desktop pages emitted errors: ${pageErrors.join(' | ')}`)
      await page.screenshot({ path: join(EVIDENCE_DIR, 'class-desktop-en.png'), fullPage: true })
      await desktop.close()

      const heroContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' })
      const heroPage = await heroContext.newPage()
      await heroPage.goto(`${BASE_URL}/ai-agent-codex/class/`, { waitUntil: 'networkidle' })
      await heroPage.locator('[data-set-lang="en"]').click()
      await heroPage.screenshot({ path: join(EVIDENCE_DIR, 'class-desktop-hero-en.png') })
      await heroContext.close()

      const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' })
      const mobilePage = await mobile.newPage()
      await mobilePage.goto(`${BASE_URL}/ai-agent-codex/class/`, { waitUntil: 'networkidle' })
      const classOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert(classOverflow <= 1, `Class page has ${classOverflow}px horizontal overflow at 390px`)
      assert(await mobilePage.locator('#setup-title').isVisible(), 'Mobile class setup is not visible')
      await mobilePage.screenshot({ path: join(EVIDENCE_DIR, 'class-mobile-hero-zh.png') })
      await mobilePage.screenshot({ path: join(EVIDENCE_DIR, 'class-mobile-zh.png'), fullPage: true })
      await mobilePage.goto(`${BASE_URL}/ai-agent-codex/`, { waitUntil: 'networkidle' })
      const preclassOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert(preclassOverflow <= 1, `Pre-class page has ${preclassOverflow}px horizontal overflow at 390px`)
      await mobilePage.locator('[data-set-lang="en"]').click()
      await mobilePage.locator('[data-set-os="win"]').click()
      assert(await mobilePage.locator('.win-only').isVisible(), 'Mobile Windows guidance did not appear')
      await mobilePage.screenshot({ path: join(EVIDENCE_DIR, 'preclass-mobile-windows-en.png'), fullPage: true })
      await mobile.close()
    } finally {
      await browser.close()
    }
  } finally {
    preview.kill('SIGTERM')
  }
}

await run()

if (errors.length) {
  console.error(`\nCourse page checks failed (${errors.length}):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Course page checks passed:')
console.log(`- HTTP 200 and no login on both public routes`)
console.log(`- Chinese/English and Mac/Windows controls`)
console.log(`- Exact install command, copy controls, keyboard focus, and local progress`)
console.log(`- Recovery states, MiniMax boundary, WCAG AA token contrast, and 390px overflow`)
console.log(`- Screenshots: ${EVIDENCE_DIR}`)
