import { useState, useMemo, useCallback } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import Refs from '../components/Refs.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import { T } from '../components/svg/theme.js'
import { colorFor } from '../lib/figure.js'
import { seededMatrix } from '../lib/synth.js'
import { swiglu, swish, relu } from '../lib/ffn.js'

const D = 4 // 模型维度
const DFF = 8 // 升维后的隐藏维(真实约 2.7×d;toy 取 2×d)
const SEQ = 'the cat sat on mat'.split(' ')

export default function Ch06FFN({ prev, next }) {
  const [n, setN] = useState(4)
  const [ti, setTi] = useState(2) // 聚焦哪个 token
  const onPageStep = useCallback((d) => setN((v) => Math.min(5, Math.max(2, v + d))), [])
  const f = Math.min(ti, n - 1)

  const tokens = useMemo(() => Array.from({ length: n }, (_, i) => SEQ[i] ?? `t${i}`), [n])
  const X = useMemo(() => seededMatrix(n, D, 7), [n])
  const Wg = useMemo(() => seededMatrix(D, DFF, 21), [])
  const Wu = useMemo(() => seededMatrix(D, DFF, 22), [])
  const Wd = useMemo(() => seededMatrix(DFF, D, 23), [])
  const sw = useMemo(() => swiglu(X[f], Wg, Wu, Wd), [X, f, Wg, Wu, Wd])

  // ───────── 图 1:SwiGLU 一个 token 的前向(两支 + 门控) ─────────
  const renderSwiGLU = (cell) => {
    const C = cell
    const cy = 96
    const rg = C * 1.7 // 两支的上下偏移
    const x = X[f]
    const vmaxD = Math.max(1e-6, ...[...x, ...sw.out].map(Math.abs))
    const vmaxF = Math.max(1e-6, ...[...sw.up, ...sw.hidden].map(Math.abs))
    const els = []
    let cx = 24
    const blk = (row, yc, { title, vmax, dec = 1, stroke }) => {
      const y = yc - C / 2
      row.forEach((v, j) => {
        els.push(
          <g key={`${title}-${j}`}>
            <rect x={cx + j * C} y={y} width={C} height={C} fill={colorFor(v, vmax)} stroke={stroke || T.c.border} strokeWidth={stroke ? 2 : 1} />
            <text x={cx + j * C + C / 2} y={y + C * 0.66} textAnchor="middle" fontFamily={T.font} fontSize={T.fs} fill="#fff">{v.toFixed(dec)}</text>
          </g>
        )
      })
      els.push(<text key={`${title}-t`} x={cx + (row.length * C) / 2} y={y + C + 13} textAnchor="middle" fontFamily={T.font} fontSize={10} fill={stroke || T.c.accent}>{title}</text>)
      return { cx0: cx, cx1: cx + row.length * C, cyc: yc, w: row.length * C }
    }
    const lineTo = (x1, y1, x2, y2, col) => els.push(<line key={`ln${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={col || T.c.border} strokeWidth={1} />)

    // 输入 x
    const xB = blk(x, cy, { title: `x「${tokens[f]}」(${D}维)`, vmax: vmaxD, stroke: T.c.accent })
    cx = xB.cx1 + 44
    // 两支:门(上) / 值(下)
    const gateX = cx
    const gB = blk(sw.gate, cy - rg, { title: '门 = Swish(x·W_g)', vmax: 1.2, dec: 2, stroke: T.c.warn })
    const uB = blk(sw.up, cy + rg, { title: '值 = x·W_u', vmax: vmaxF })
    // x 到两支的连线
    lineTo(xB.cx1, cy, gateX - 4, cy - rg, T.c.warn)
    lineTo(xB.cx1, cy, gateX - 4, cy + rg)
    cx = uB.cx1 + 30
    // ⊙
    els.push(<text key="odot" x={cx - 15} y={cy} textAnchor="middle" dominantBaseline="middle" fontFamily={T.font} fontSize={16} fill={T.c.accent2}>⊙</text>)
    lineTo(gB.cx1, cy - rg, cx - 4, cy - C, T.c.warn)
    lineTo(uB.cx1, cy + rg, cx - 4, cy + C)
    // 门 ⊙ 值 = 隐藏
    const hB = blk(sw.hidden, cy, { title: '门 ⊙ 值 = 隐藏(升维)', vmax: vmaxF, stroke: T.c.accent2 })
    cx = hB.cx1 + 12
    els.push(<text key="wd" x={cx + 22} y={cy} textAnchor="middle" dominantBaseline="middle" fontFamily={T.font} fontSize={10} fill={T.c.dim}>×W_d→</text>)
    cx += 46
    blk(sw.out, cy, { title: '输出(降回 d)= Δ', vmax: vmaxD, stroke: T.c.accent2 })
    cx += D * C + 16
    return <svg width={cx} height={cy + rg + C + 16} style={{ display: 'block', minWidth: cx }}>{els}</svg>
  }

  // ───────── 图 2:Swish vs ReLU 激活曲线 ─────────
  const renderActivation = () => {
    const w = 300, h = 170, ox = 36, oy = 20
    const xmin = -5, xmax = 5, ymin = -1.5, ymax = 5
    const px = (z) => ox + ((z - xmin) / (xmax - xmin)) * w
    const py = (v) => oy + (1 - (v - ymin) / (ymax - ymin)) * h
    const curve = (fn, col) => {
      const pts = []
      for (let z = xmin; z <= xmax; z += 0.2) pts.push(`${px(z)},${py(fn(z))}`)
      return <polyline points={pts.join(' ')} fill="none" stroke={col} strokeWidth={2} />
    }
    return (
      <svg width={w + 90} height={h + 50} style={{ display: 'block' }}>
        <line x1={ox} y1={py(0)} x2={ox + w} y2={py(0)} stroke={T.c.border} strokeWidth={1} />
        <line x1={px(0)} y1={oy} x2={px(0)} y2={oy + h} stroke={T.c.border} strokeWidth={1} />
        {curve(relu, T.c.dim)}
        {curve(swish, T.c.accent2)}
        <text x={ox + w + 6} y={py(swish(5)) + 4} fontFamily={T.font} fontSize={11} fill={T.c.accent2}>Swish</text>
        <text x={ox + w + 6} y={py(relu(4.2)) + 4} fontFamily={T.font} fontSize={11} fill={T.c.dim}>ReLU</text>
        <text x={px(-3.5)} y={py(-1.1)} fontFamily={T.font} fontSize={9} fill={T.c.accent2}>负区有小幅泄漏(不像 ReLU 直接归零)</text>
        <text x={ox} y={oy + h + 22} fontFamily={T.font} fontSize={9} fill={T.c.dim}>Swish(z)=z·σ(z),平滑可导;门控用它当"软开关"</text>
      </svg>
    )
  }

  // ───────── 图 3:逐 token 独立(对比注意力的跨 token) ─────────
  const renderContrast = () => {
    const C = 30, gap = 18, top = 26
    const cols = ['the', 'cat', 'sat']
    const box = (x, y, label, col) => [
      <rect key={`b${x}-${y}-${label}`} x={x} y={y} width={C} height={C} rx={4} fill="none" stroke={col} strokeWidth={1.5} />,
      <text key={`t${x}-${y}-${label}`} x={x + C / 2} y={y + C * 0.64} textAnchor="middle" fontFamily={T.font} fontSize={9} fill={col}>{label}</text>,
    ]
    const els = []
    // 左:注意力 跨 token
    let x0 = 20
    els.push(<text key="al" x={x0} y={14} fontFamily={T.font} fontSize={11} fill={T.c.accent}>注意力:跨 token 混合</text>)
    cols.forEach((t, i) => els.push(...box(x0 + i * (C + gap), top, t, T.c.dim)))
    cols.forEach((t, i) => els.push(...box(x0 + i * (C + gap), top + 70, t, T.c.accent)))
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
      els.push(<line key={`a${i}-${j}`} x1={x0 + i * (C + gap) + C / 2} y1={top + C} x2={x0 + j * (C + gap) + C / 2} y2={top + 70} stroke={T.c.accent} strokeWidth={0.6} opacity={0.5} />)
    // 右:FFN 逐 token
    const x1 = x0 + 3 * (C + gap) + 60
    els.push(<text key="fl" x={x1} y={14} fontFamily={T.font} fontSize={11} fill={T.c.accent2}>FFN:逐 token 独立</text>)
    cols.forEach((t, i) => els.push(...box(x1 + i * (C + gap), top, t, T.c.dim)))
    cols.forEach((t, i) => els.push(...box(x1 + i * (C + gap), top + 70, t, T.c.accent2)))
    cols.forEach((t, i) => els.push(<line key={`f${i}`} x1={x1 + i * (C + gap) + C / 2} y1={top + C} x2={x1 + i * (C + gap) + C / 2} y2={top + 70} stroke={T.c.accent2} strokeWidth={1.2} />))
    els.push(<text key="fn" x={x1} y={top + 70 + C + 16} fontFamily={T.font} fontSize={9} fill={T.c.dim}>同一个 FFN,各 token 各过各的,互不影响</text>)
    return <svg width={x1 + 3 * (C + gap) + 20} height={top + 70 + C + 26} style={{ display: 'block' }}>{els}</svg>
  }

  const controls = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 64 }}>聚焦 token</span>
        <input type="range" min={0} max={n - 1} step={1} value={f}
          onChange={(e) => setTi(Math.round(+e.target.value))} style={{ width: 120 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{tokens[f]}</b>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 64 }}>序列长度</span>
        <input type="range" min={2} max={5} step={1} value={n}
          onChange={(e) => setN(Math.round(+e.target.value))} style={{ width: 120 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{n}</b>
      </label>
    </div>
  )

  return (
    <ChapterLayout kicker="第 6 章 · 前馈 FFN / SwiGLU" title="前馈网络 FFN / SwiGLU" prev={prev} next={next}>
      <>
        <p>
          一层 Transformer 有两个子层:<b>注意力</b>(跨 token 搬运信息)和 <b>FFN</b>(逐 token 加工)。
          上一章讲了它们怎么挂在残差流上,这章看 FFN <b>里面</b>在算什么。
        </p>
        <h2>FFN 的本质:逐 token、先升维再降维</h2>
        <p>
          FFN <b>不跨 token</b>——每个 token 的向量<b>独立</b>过同一个小网络(右下对比图)。
          标准 FFN 是 <code>W₂·relu(W₁·x)</code>:先把 d 维<b>升到更大的 d_ff</b>,
          过激活,再<b>降回 d</b>。这里 toy:{D} → {DFF} → {D}。
        </p>
        <div className="note">
          <b>升维到底图什么?</b> d_ff(通常 4d)= 这一层能同时<b>检测 / 存储多少种模式</b>:
          隐藏层每个单元都是一个独立的<b>特征检测器</b>——<code>W₁</code> 的每行检测输入里的某种模式,
          激活决定它「<b>触发多强</b>」,<code>W₂</code> 的每列再把触发单元的<b>存储内容</b>加回去。
          维度越宽 = 检测器越多 = 能识别/记住的越多。有个经典视角:FFN 像一张<b>键-值记忆表</b>
          (W₁ 行=键、W₂ 列=值),<b>事实和规则大多存在这</b>,所以 FFN 占了模型大部分参数。
          直觉:<b>升维 = 展开来仔细想,降维 = 把想法收拢成一笔更新</b>。
        </div>
        <h2>SwiGLU:带"门"的 FFN(LLaMA / DeepSeek 用)</h2>
        <p>
          SwiGLU 把升维拆成<b>两支</b>,用一支当<b>门</b>去调另一支:
        </p>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent-2)' }}>
          SwiGLU(x) = ( Swish(x·W_g) ⊙ (x·W_u) ) · W_d
        </p>
        <ul>
          <li><b>值支</b> <code>x·W_u</code>:候选信息。</li>
          <li><b>门支</b> <code>Swish(x·W_g)</code>:每个隐藏单元的<b>软开关</b>(Swish 曲线见右),
            决定值支<b>放行多少</b>。</li>
          <li><b>⊙ 逐元素相乘</b> → 升维隐藏,再 <code>·W_d</code> 降回 d,作为 Δ 加回残差流。</li>
        </ul>
        <div className="note">
          为什么是 3 个矩阵还更好:门控比单纯 ReLU 表达力强,SwiGLU 在同等算力下稳定更优。
          因为多了一支,d_ff 通常取约 <b>(2/3)·4d</b> 让参数量与标准 FFN 持平。
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          接 Ch12:<b>MoE</b> 就是把这个 FFN 复制成很多个"专家",每个 token 只路由到少数几个——
          FFN 是 MoE 的<b>单专家原型</b>。
        </div>
        <Refs ids={['1706.03762', '2002.05202', '1710.05941', '2012.14913', '1701.06538']} />
      </>
      <>
        <h3>SwiGLU:一个 token 的前向(门 ⊙ 值 → 降维)</h3>
        <FigureBoard renderSvg={renderSwiGLU} baseCell={28} fullCell={42}
          controls={controls} onPageStep={onPageStep} />

        <h3 style={{ marginTop: 14 }}>激活:Swish vs ReLU</h3>
        <div style={{ overflowX: 'auto', paddingBottom: 8, background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
          {renderActivation()}
        </div>

        <h3 style={{ marginTop: 16 }}>关键对比:FFN 逐 token,注意力跨 token</h3>
        <div style={{ overflowX: 'auto', paddingBottom: 8, background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
          {renderContrast()}
        </div>
      </>
    </ChapterLayout>
  )
}
