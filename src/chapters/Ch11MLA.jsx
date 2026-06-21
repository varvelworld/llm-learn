import { useState, useMemo, useCallback } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import MatMul from '../components/svg/MatMul.jsx'
import Edge from '../components/svg/Edge.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import { T } from '../components/svg/theme.js'
import { matmulLayout } from '../lib/figure.js'
import { seededMatrix } from '../lib/synth.js'
import { matmul } from '../lib/tensor.js'

const DM = 4 // K/V 维度(toy)
const DC = 2 // 潜向量维度(toy,远小于 2·DM)
const WORDS = 'the cat sat on the mat and dog ran fast over hills'.split(' ')

export default function Ch11MLA({ prev, next }) {
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
    const svgW = xUp + L2.w + 14
    const svgH = yV + L2.h + 28
    const mmProps = { cell, selRow: r, selCol: -1, onHoverCell: (i) => setR(i), onHoverARow: setR, showValues: show }
    return (
      <svg width={svgW} height={svgH} style={{ display: 'block', minWidth: svgW }}>
        <text x={0} y={16} fontFamily={T.font} fontSize={12} fill={T.c.accent}>① 下投影(压缩):x · W_DKV = c_KV ★缓存</text>
        <text x={xUp} y={16} fontFamily={T.font} fontSize={12} fill={T.c.accent}>② 上投影(还原):c_KV · W_U = K / V</text>

        <MatMul x={0} y={y0} A={X} Bt={WDKV} result={C} rowLabels={tokens}
          aLabel="x" bLabel="W_DKV" resultLabel="c_KV" {...mmProps} />
        <MatMul x={xUp} y={yK} A={C} Bt={WUK} result={K}
          aLabel="c_KV" bLabel="W_UK" resultLabel="K" {...mmProps} />
        <MatMul x={xUp} y={yV} A={C} Bt={WUV} result={V}
          aLabel="c_KV" bLabel="W_UV" resultLabel="V" {...mmProps} />

        {cacheBox(c1, 'c1')}{cacheBox(a2, 'a2')}{cacheBox(a3, 'a3')}

        <Edge from={{ x: c1.x + DC * cell, y: c1.y + mh / 2 }} to={{ x: a2.x, y: a2.y + mh / 2 }} label={'缓存\n复用'} />
        <Edge from={{ x: c1.x + DC * cell, y: c1.y + mh / 2 }} to={{ x: a3.x, y: a3.y + mh / 2 }} label={'缓存\n复用'} />
      </svg>
    )
  }

  const controls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)' }}>序列长度</span>
      <input type="range" min={3} max={12} step={1} value={n}
        onChange={(e) => setN(Math.round(+e.target.value))} style={{ width: 150 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{n}</b>
    </div>
  )

  return (
    <ChapterLayout kicker="第 11 章 · MLA · DeepSeek-V2 提出,V3 沿用" title="MLA 潜变量注意力" prev={prev} next={next}>
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
      <>
        <FigureBoard renderSvg={renderSvg} baseCell={26} fullCell={44}
          controls={controls} onPageStep={onPageStep} />

        <h3 style={{ marginTop: 18 }}>KV 缓存对比(每 token × 序列长度)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { name: '标准 MHA', per: mhaPer, color: 'var(--hot)' },
            { name: 'MLA(潜向量)', per: mlaPer, color: 'var(--accent-2)' },
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
          <div className="cost-row"><span>toy:每 token 缓存的数字个数</span><b>MHA {mhaPer} → MLA {mlaPer}</b></div>
          <div className="cost-row"><span>节省</span><b style={{ color: 'var(--accent-2)' }}>{saving}%</b></div>
          <div className="cost-divider" />
          <div className="cost-row" style={{ fontSize: 12 }}>
            <span>真实参照:GPT-3 规模 · 128K 上下文(第 4 章)</span>
            <b style={{ color: 'var(--warn)' }}>MHA ≈ {mhaGB} GB → MLA ≈ {Math.round(mhaGB / 14)} GB</b>
          </div>
        </div>
      </>
    </ChapterLayout>
  )
}
