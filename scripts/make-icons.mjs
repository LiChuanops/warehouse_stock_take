/**
 * 产生 app 图标。
 *
 * 图案全部用几何路径画,不依赖任何字体 —— 字体在不同机器上会渲染成不一样的东西。
 * 跑法:node scripts/make-icons.mjs
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')
const previewDir = join(root, '..', 'icon-候选')

const INK = '#0f172a' // 跟 app header 同一个深蓝
const CHECK = '#22c55e'

/**
 * 方案 A:纸箱 + 勾。
 * @param {boolean} maskable 安卓会把图标裁成圆形,maskable 版要把图案缩到中间 80% 内
 */
function boxCheck(maskable = false) {
  const s = maskable ? 0.72 : 0.88 // 图案占画布比例
  const o = (1 - s) / 2
  const vb = 100
  // 箱子:上盖梯形 + 箱身,再加一条中缝
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}">
  <rect width="${vb}" height="${vb}" rx="${maskable ? 0 : 22}" fill="${INK}"/>
  <g transform="translate(${o * vb} ${o * vb}) scale(${s})">
    <g fill="none" stroke="#ffffff" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
      <path d="M14 32 L50 18 L86 32 L86 76 L50 90 L14 76 Z"/>
      <path d="M14 32 L50 46 L86 32"/>
      <path d="M50 46 L50 90"/>
    </g>
    <g transform="translate(76 74)">
      <circle r="21" fill="${INK}"/>
      <circle r="17" fill="${CHECK}"/>
      <path d="M-8 0 L-2 6 L8 -6" fill="none" stroke="#ffffff" stroke-width="5"
            stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
</svg>`
}

/** 方案 B:公司的厨师 logo,右下角加一个绿色勾角标。 */
async function chefCheck(size, maskable = false) {
  const pad = maskable ? Math.round(size * 0.16) : Math.round(size * 0.06)
  const inner = size - pad * 2

  const chef = await sharp(join(root, '..', 'Scanner', 'icon-512x512.png'))
    .resize(inner, inner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer()

  const badge = Math.round(size * 0.32)
  const badgeSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${badge}" height="${badge}" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="46" fill="${CHECK}" stroke="#ffffff" stroke-width="8"/>
  <path d="M28 52 L44 68 L73 36" fill="none" stroke="#ffffff" stroke-width="12"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`)

  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : Math.round(size * 0.22)}" fill="#ffffff"/>
</svg>`)

  return sharp(bg)
    .composite([
      { input: chef, top: pad, left: pad },
      {
        input: await sharp(badgeSvg).png().toBuffer(),
        top: size - badge - Math.round(size * 0.02),
        left: size - badge - Math.round(size * 0.02),
      },
    ])
    .png()
    .toBuffer()
}

async function svgToPng(svg, size) {
  return sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer()
}

async function main() {
  mkdirSync(outDir, { recursive: true })
  mkdirSync(previewDir, { recursive: true })

  const jobs = [
    ['A-箱子勾-192.png', await svgToPng(boxCheck(false), 192)],
    ['A-箱子勾-512.png', await svgToPng(boxCheck(false), 512)],
    ['A-箱子勾-maskable.png', await svgToPng(boxCheck(true), 512)],
    ['B-厨师勾-192.png', await chefCheck(192)],
    ['B-厨师勾-512.png', await chefCheck(512)],
    ['B-厨师勾-maskable.png', await chefCheck(512, true)],
  ]

  for (const [name, buf] of jobs) {
    writeFileSync(join(previewDir, name), buf)
  }
  console.log(`候选图标已产生:${previewDir}`)
}

/** 选定之后跑这支,把选中的方案写进 public/icons。 */
export async function apply(choice = 'A') {
  mkdirSync(outDir, { recursive: true })
  if (choice === 'A') {
    writeFileSync(join(outDir, 'icon-192.png'), await svgToPng(boxCheck(false), 192))
    writeFileSync(join(outDir, 'icon-512.png'), await svgToPng(boxCheck(false), 512))
    writeFileSync(join(outDir, 'icon-maskable.png'), await svgToPng(boxCheck(true), 512))
  } else {
    writeFileSync(join(outDir, 'icon-192.png'), await chefCheck(192))
    writeFileSync(join(outDir, 'icon-512.png'), await chefCheck(512))
    writeFileSync(join(outDir, 'icon-maskable.png'), await chefCheck(512, true))
  }
  console.log(`已套用方案 ${choice}`)
}

if (process.argv[2] === 'apply') {
  await apply(process.argv[3] || 'A')
} else {
  await main()
}
