#!/usr/bin/env node
/**
 * 发布前页面路由健康检查
 * 访问每个路由，捕获控制台错误和崩溃，避免白屏/报错上线
 *
 * 用法：
 *   npm run check:routes        # 先 build，再检查（发布前推荐）
 *   npm run check:routes:only   # 仅检查，不 build（需已运行 vite preview）
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PREVIEW_PORT = process.env.PREVIEW_PORT || 4173
const BASE_URL = process.env.BASE_URL || `http://localhost:${PREVIEW_PORT}`

const ROUTES = [
  { path: '/', name: '首页' },
  { path: '/ai-agent/', name: 'AI 课前准备 (Claude)', static: true, selector: '#langToggle' },
  { path: '/ai-agent-codex/', name: 'AI 课前准备 (Codex)', static: true, selector: '#step-1-title' },
  { path: '/ai-agent-codex/class/', name: 'AI 课堂跟做 (Codex)', static: true, selector: '#setup-title' },
  { path: '/login', name: '登录' },
  { path: '/register', name: '注册' },
  { path: '/invite', name: '邀请' },
  { path: '/admin', name: '管理' },
  { path: '/home/agent', name: '中介工作台' },
  { path: '/home/user', name: '客户工作台' },
  { path: '/view/smoke-test', name: '客户查看 (view)' },
  { path: '/playground', name: 'Playground' },
  { path: '/tools/floorplan', name: '户型图测量工具' },
  { path: '/nonexistent-route-xyz', name: '404 重定向' },
]

async function waitForServer(url, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, { method: 'HEAD' })
      if (res.ok) return true
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function checkRoute(page, { path, name, static: isStatic = false, selector = '#root' }) {
  const url = BASE_URL + path
  const errors = []

  page.on('console', (msg) => {
    const text = msg.text()
    const type = msg.type()
    if (type === 'error' || text.includes('Uncaught') || text.includes('TypeError') || text.includes('ReferenceError')) {
      errors.push({ type, text })
    }
  })

  page.on('pageerror', (err) => {
    errors.push({ type: 'pageerror', text: err.message })
  })

  try {
    const resp = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 15000,
    })
    if (!resp) {
      return { ok: false, path, name, error: '页面无响应' }
    }
    if (resp.status() >= 500) {
      return { ok: false, path, name, error: `HTTP ${resp.status()}` }
    }
    await new Promise((r) => setTimeout(r, 500))
    const expectedSelector = isStatic ? selector : '#root'
    const hasExpectedRoot = await page.locator(expectedSelector).count() > 0
    if (!hasExpectedRoot) {
      return { ok: false, path, name, error: `未找到 ${expectedSelector}` }
    }
    if (errors.length > 0) {
      return {
        ok: false,
        path,
        name,
        error: '控制台/运行时错误',
        details: errors.map((e) => e.text),
      }
    }
    return { ok: true, path, name }
  } catch (e) {
    return { ok: false, path, name, error: e.message || String(e) }
  }
}

async function run(previewProcess) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const results = []

  try {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await ctx.newPage()

    for (const route of ROUTES) {
      process.stdout.write(`检查 ${route.name} (${route.path}) ... `)
      const r = await checkRoute(page, route)
      results.push(r)
      if (r.ok) {
        console.log('✓')
      } else {
        console.log('✗', r.error)
        if (r.details?.length) {
          r.details.forEach((d) => console.log('   ', d))
        }
      }
    }

    await ctx.close()
  } finally {
    await browser.close()
  }

  if (previewProcess) {
    previewProcess.kill('SIGTERM')
  }

  const failed = results.filter((r) => !r.ok)
  if (failed.length > 0) {
    console.error('\n❌', failed.length, '个页面检查失败：')
    failed.forEach((r) => console.error('  -', r.path, r.name, ':', r.error))
    process.exit(1)
  }
  console.log('\n✓ 所有', ROUTES.length, '个路由检查通过')
  process.exit(0)
}

async function main() {
  const skipBuild = process.argv.includes('--only') || process.env.CHECK_ONLY === '1'
  let previewProcess = null

  if (!skipBuild) {
    const dist = join(ROOT, 'dist')
    if (!existsSync(dist) || !existsSync(join(dist, 'index.html'))) {
      console.log('正在执行 build...')
      await new Promise((resolve, reject) => {
        const build = spawn('npm run build', {
          cwd: ROOT,
          stdio: 'inherit',
          shell: true,
        })
        build.on('close', (code) => (code === 0 ? resolve() : reject(new Error('build failed'))))
      })
    }

    console.log('启动 vite preview...')
    previewProcess = spawn('npm run preview', {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0' },
    })

    let resolved = false
    previewProcess.on('error', (e) => {
      if (!resolved) {
        resolved = true
        console.error('无法启动 preview:', e.message)
        process.exit(1)
      }
    })
    previewProcess.on('exit', (code) => {
      if (!resolved && code !== 0 && code !== null) {
        resolved = true
        console.error('preview 进程异常退出')
        process.exit(1)
      }
    })

    const ready = await waitForServer(BASE_URL)
    if (!ready) {
      console.error('vite preview 未能就绪，请确认端口', PREVIEW_PORT, '未被占用')
      if (previewProcess) previewProcess.kill('SIGTERM')
      process.exit(1)
    }
  } else {
    const ready = await waitForServer(BASE_URL)
    if (!ready) {
      console.error('请先运行 npm run preview，或确保', BASE_URL, '可访问')
      process.exit(1)
    }
  }

  console.log('\n开始检查', ROUTES.length, '个路由...\n')
  await run(previewProcess)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
