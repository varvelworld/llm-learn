import { useState, useMemo, useCallback } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import Refs from '../components/Refs.jsx'
import MatMul from '../components/svg/MatMul.jsx'
import Edge from '../components/svg/Edge.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import { T } from '../components/svg/theme.js'
import { matmulLayout } from '../lib/figure.js'
import { seededMatrix } from '../lib/synth.js'
import { matmul } from '../lib/tensor.js'
import { useLang, useT } from '../i18n/lang.jsx'

const DM = 4 // K/V 维度(toy)
const DC = 2 // 潜向量维度(toy,远小于 2·DM)
const WORDS = 'the cat sat on the mat and dog ran fast over hills'.split(' ')

// 估算文本像素宽(CJK≈11、ASCII≈6.4),给 SVG 留够宽度、防英文更长时裁切
const estTextW = (s) => [...String(s)].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 11 : 6.4), 0)

export default function Ch11MLA({ prev, next }) {
  const t = useT()
  const { lang } = useLang()
  const [n, setN] = useState(6)
  const [row, setRow] = useState(2)
  const r = Math.min(row, n - 1)
  const setR = useCallback((i) => setRow(i), [])
  const onPageStep = useCallback((d) => setN((v) => Math.min(12, Math.max(3, v + d))), [])

  const tokens = useMemo(() => Array.from({ length: n }, (_, i) => WORDS[i] ?? `t${i}`), [n])
  const X = useMemo(() => seededMatrix(n, DM, 7), [n])
  const WDKV = useMemo(() => seededMatrix(DM, DC, 5), [])
  const WUK = useMemo(() => seededMatrix(DC, DM, 11), [])
  const WUV = useMemo(() => seededMatrix(DC, DM, 13), [])
  const C = useMemo(() => matmul(X, WDKV), [X, WDKV]) // 潜向量(被缓存)
  const K = useMemo(() => matmul(C, WUK), [C, WUK])
  const V = useMemo(() => matmul(C, WUV), [C, WUV])

  // 缓存对比
  const mhaPer = 2 * DM
  const mlaPer = DC
  const saving = Math.round((1 - mlaPer / mhaPer) * 100)
  const mhaGB = 604

  // 按格子尺寸生成整块图板:三个矩阵乘交叉网格(下投影 + 两个上投影)
  const renderSvg = (cell) => {
    const lw = T.labelW
    const L1 = matmulLayout({ m: n, k: DM, p: DC, cell, labelW: lw, colLabelH: T.colLabelH, gap: T.gap })
    const L2 = matmulLayout({ m: n, k: DC, p: DM, cell, labelW: lw, colLabelH: T.colLabelH, gap: T.gap })
    const y0 = 30
    const xUp = L1.w + 88
    const yK = y0
    const yV = y0 + L2.h + 54
    const mh = n * cell
    const show = n <= 8
    // c_KV 出现的三处:下投影结果 + 两个上投影的输入
    const c1 = { x: L1.result.x, y: y0 + L1.result.y }
    const a2 = { x: xUp + L2.A.x, y: yK + L2.A.y }
    const a3 = { x: xUp + L2.A.x, y: yV + L2.A.y }
    const cacheBox = (p, key) => (
      <rect key={key} x={p.x - 2} y={p.y - 2} width={DC * cell + 4} height={mh + 4}
        fill="none" stroke={T.c.accent2} strokeWidth={1.5} strokeDasharray="3 2" />
    )
    const cap1 = t('① 下投影(压缩):x · W_DKV = c_KV ★缓存', '① Down-projection (compress): x · W_DKV = c_KV ★cached')
    const cap2 = t('② 上投影(还原):c_KV · W_U = K / V', '② Up-projection (restore): c_KV · W_U = K / V')
    const svgW = Math.max(xUp + L2.w + 14, estTextW(cap1) + 14, xUp + estTextW(cap2) + 14)
    const svgH = yV + L2.h + 28
    const mmProps = { cell, selRow: r, selCol: -1, onHoverCell: (i) => setR(i), onHoverARow: setR, showValues: show }
    return (
      <svg width={svgW} height={svgH} style={{ display: 'block', minWidth: svgW }}>
        <text x={0} y={16} fontFamily={T.font} fontSize={12} fill={T.c.accent}>{cap1}</text>
        <text x={xUp} y={16} fontFamily={T.font} fontSize={12} fill={T.c.accent}>{cap2}</text>

        <MatMul x={0} y={y0} A={X} Bt={WDKV} result={C} rowLabels={tokens}
          aLabel="x" bLabel="W_DKV" resultLabel="c_KV" {...mmProps} />
        <MatMul x={xUp} y={yK} A={C} Bt={WUK} result={K}
          aLabel="c_KV" bLabel="W_UK" resultLabel="K" {...mmProps} />
        <MatMul x={xUp} y={yV} A={C} Bt={WUV} result={V}
          aLabel="c_KV" bLabel="W_UV" resultLabel="V" {...mmProps} />

        {cacheBox(c1, 'c1')}{cacheBox(a2, 'a2')}{cacheBox(a3, 'a3')}

        <Edge from={{ x: c1.x + DC * cell, y: c1.y + mh / 2 }} to={{ x: a2.x, y: a2.y + mh / 2 }} label={t('缓存\n复用', 'cache\nreuse')} />
        <Edge from={{ x: c1.x + DC * cell, y: c1.y + mh / 2 }} to={{ x: a3.x, y: a3.y + mh / 2 }} label={t('缓存\n复用', 'cache\nreuse')} />
      </svg>
    )
  }

  const controls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)' }}>{t('序列长度', 'Sequence length')}</span>
      <input type="range" min={3} max={12} step={1} value={n}
        onChange={(e) => setN(Math.round(+e.target.value))} style={{ width: 150 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{n}</b>
    </div>
  )

  return (
    <ChapterLayout
      kicker={t('第 11 章 · MLA · DeepSeek-V2 提出,V3 沿用', 'Ch. 11 · MLA · introduced in DeepSeek-V2, kept in V3')}
      title={t('MLA 潜变量注意力', 'MLA Latent Attention')}
      prev={prev}
      next={next}
      translated
    >
      <>
        {lang === 'en' ? (
          <>
            <p>
              Ch. 4 showed: during generation you must cache each token's <b>K, V</b>; it grows linearly with the
              sequence and, at long context, can eat <b>hundreds of GB</b> of VRAM. MLA is the cure.
            </p>
            <h2>The key trick: cache a "latent vector", not the full K/V</h2>
            <p>
              Instead of storing K, V directly, MLA first <b>down-projects</b> each token vector into a
              <b> tiny latent vector c_KV</b> (dimension d_c ≪ the total dimension of K, V) and <b>caches only this latent vector</b>.
              When attention is needed, it <b>up-projects</b> to restore K and V from c_KV on the fly.
            </p>
            <p>
              Both down- and up-projection <b>are matrix multiplications</b>, so the figure on the right draws them as
              <b> crossing grids</b> (same as Ch. 4: upright input on the left · reclining W on top = result at the crossing):
            </p>
            <ul>
              <li>① <code>x · W_DKV = c_KV</code> (W is tall &amp; thin → dimension pressed down; ★cache this small block)</li>
              <li>② <code>c_KV · W_UK = K</code>, <code>c_KV · W_UV = V</code> (W is short &amp; wide → dimension pushed back up)</li>
            </ul>
            <p>
              Note that <b>c_KV is computed once, cached, and reused by both up-projections</b> (three dashed boxes + links in the figure).
              Hover any token row to trace the whole chain; click "Fullscreen" to zoom and drag.
            </p>
            <div className="note">
              Detail: the positional encoding RoPE cannot be "absorbed" into this compression, so MLA keeps a small
              decoupled RoPE key to carry position information separately (omitted here; the focus is latent-vector compression).
            </div>
            <h2>How much is saved</h2>
            <p>
              In the toy: standard MHA stores K+V = <b>{mhaPer}</b> numbers per token, MLA stores only <b>{mlaPer}</b>
              → a <b>{saving}%</b> saving. Real DeepSeek uses a relatively tiny latent dimension, compressing the KV cache by about
              <b> 93% (≈ 1/14)</b>.
            </p>
          </>
        ) : (
          <>
            <p>
              第 4 章看到:生成时要把每个 token 的 <b>K、V 缓存</b>下来,它随序列线性增长、
              在长上下文下能吃掉<b>几百 GB</b> 显存。MLA 就是来治这个的。
            </p>
            <h2>核心一招:缓存"潜向量",而不是完整 K/V</h2>
            <p>
              MLA 不直接存 K、V,而是先把 token 向量<b>下投影</b>成一个<b>很小的潜向量 c_KV</b>
              (维度 d_c ≪ K、V 的总维度),<b>只缓存这个潜向量</b>。
              需要注意力时,再用<b>上投影</b>从 c_KV 现场还原出 K 和 V。
            </p>
            <p>
              下投影、上投影<b>都是矩阵乘法</b>,所以右边图板把它们画成<b>交叉网格</b>(同第 4 章:
              立左的输入 · 躺上的 W = 交叉处的结果):
            </p>
            <ul>
              <li>① <code>x · W_DKV = c_KV</code>(W 高瘦 → 维度压下去,★缓存这一小块)</li>
              <li>② <code>c_KV · W_UK = K</code>、<code>c_KV · W_UV = V</code>(W 矮宽 → 维度撑回来)</li>
            </ul>
            <p>
              注意 <b>c_KV 算一次、缓存、被两个上投影复用</b>(图中三处虚线框 + 连线)。
              悬停任意 token 行可追踪整条链;点「全屏画布」放大、拖拽缩放。
            </p>
            <div className="note">
              细节:位置编码 RoPE 没法被这套压缩"吸收",所以 MLA 另留一小段解耦的 RoPE 键
              单独携带位置信息(这里先略,重点是潜向量压缩)。
            </div>
            <h2>省了多少</h2>
            <p>
              toy 里:标准 MHA 每 token 存 K+V = <b>{mhaPer}</b> 个数,MLA 只存 <b>{mlaPer}</b> 个
              → 省 <b>{saving}%</b>。真实 DeepSeek 的潜向量维度相对很小,KV 缓存压缩约
              <b>93%(≈ 1/14)</b>。
            </p>
          </>
        )}
        <Refs ids={['2405.04434', '2412.19437']} />
      </>
      <>
        <FigureBoard renderSvg={renderSvg} baseCell={26} fullCell={44}
          controls={controls} onPageStep={onPageStep} />

        <h3 style={{ marginTop: 18 }}>{t('KV 缓存对比(每 token × 序列长度)', 'KV cache comparison (per token × sequence length)')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { name: t('标准 MHA', 'Standard MHA'), per: mhaPer, color: 'var(--hot)' },
            { name: t('MLA(潜向量)', 'MLA (latent)'), per: mlaPer, color: 'var(--accent-2)' },
          ].map((b) => (
            <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 110, fontSize: 13, color: 'var(--text-dim)' }}>{b.name}</div>
              <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 6, height: 24, overflow: 'hidden' }}>
                <div style={{ width: `${(b.per / mhaPer) * 100}%`, height: '100%', background: b.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8,
                  fontFamily: 'var(--mono)', fontSize: 12, color: '#0f1115' }}>{b.per * n}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="cost-panel" style={{ marginTop: 12 }}>
          <div className="cost-row"><span>{t('toy:每 token 缓存的数字个数', 'Toy: numbers cached per token')}</span><b>MHA {mhaPer} → MLA {mlaPer}</b></div>
          <div className="cost-row"><span>{t('节省', 'Saving')}</span><b style={{ color: 'var(--accent-2)' }}>{saving}%</b></div>
          <div className="cost-divider" />
          <div className="cost-row" style={{ fontSize: 12 }}>
            <span>{t('真实参照:GPT-3 规模 · 128K 上下文(第 4 章)', 'Real reference: GPT-3 scale · 128K context (Ch. 4)')}</span>
            <b style={{ color: 'var(--warn)' }}>MHA ≈ {mhaGB} GB → MLA ≈ {Math.round(mhaGB / 14)} GB</b>
          </div>
        </div>
      </>
    </ChapterLayout>
  )
}
