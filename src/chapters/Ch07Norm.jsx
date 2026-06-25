import { useState, useMemo, useCallback } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import Refs from '../components/Refs.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import { T } from '../components/svg/theme.js'
import { colorFor } from '../lib/figure.js'
import { seededMatrix } from '../lib/synth.js'
import { matmul, dot, addVec, norm } from '../lib/tensor.js'
import { rms, rmsNorm } from '../lib/norm.js'
import { attention } from '../lib/attention.js'

const SEQ = 'the cat sat on'.split(' ')
const NB = SEQ.length

const D = 6 // toy 维度
const MAXL = 12
const SUB = 0.6 // 子层贡献的缩放(让"无归一化"时能看出爆炸)

const cos = (a, b) => dot(a, b) / (norm(a) * norm(b) || 1)

// 跑残差流:x ← x + 子层(norm(x)),可关掉残差 / 归一化
function runStream(x0, g, Wsub, L, resid, useNorm) {
  let x = x0.slice()
  const xs = [x.slice()]
  const rmsArr = [rms(x)]
  const cosArr = [1]
  for (let l = 0; l < L; l++) {
    const normed = useNorm ? rmsNorm(x, g) : x
    const delta = matmul([normed], Wsub[l])[0].map((v) => v * SUB)
    x = resid ? addVec(x, delta) : delta
    xs.push(x.slice())
    rmsArr.push(rms(x))
    cosArr.push(cos(x, x0))
  }
  const vmax = Math.max(1e-6, ...xs.flat().map(Math.abs))
  return { xs, rmsArr, cosArr, vmax }
}

export default function Ch07Norm({ prev, next }) {
  const [L, setL] = useState(6)
  const [resid, setResid] = useState(true)
  const [useNorm, setUseNorm] = useState(true)
  const onPageStep = useCallback((d) => setL((v) => Math.min(MAXL, Math.max(1, v + d))), [])

  const x0 = useMemo(() => seededMatrix(1, D, 7)[0], [])
  const g = useMemo(() => seededMatrix(1, D, 50)[0].map((r) => +(1 + 0.25 * r).toFixed(2)), [])
  const Wsub = useMemo(() => Array.from({ length: MAXL }, (_, l) => seededMatrix(D, D, 100 + l)), [])

  // 真实注意力作为"子层":接线图用(把抽象的 Δ 换成真注意力输出)
  const Xseq = useMemo(() => seededMatrix(NB, D, 7), [])
  const WQa = useMemo(() => seededMatrix(D, D, 3), [])
  const WKa = useMemo(() => seededMatrix(D, D, 5), [])
  const WVa = useMemo(() => seededMatrix(D, D, 9), [])
  const block = useMemo(() => {
    const normed = Xseq.map((r) => rmsNorm(r, g))
    const Q = matmul(normed, WQa), K = matmul(normed, WKa), V = matmul(normed, WVa)
    const att = attention(Q, K, V, true)
    const f = NB - 1
    return { x: Xseq[f], xhat: normed[f], q: Q[f], weights: att.weights[f], attn: att.output[f], xout: addVec(Xseq[f], att.output[f]) }
  }, [Xseq, g, WQa, WKa, WVa])

  // 主流:受开关控制(给条带图 + 提示用)
  const stream = useMemo(() => runStream(x0, g, Wsub, L, resid, useNorm), [x0, g, Wsub, L, resid, useNorm])
  // 对比流:始终算"有/无"两种,给诊断曲线常驻对比
  const cmpNorm = useMemo(() => ({
    on: runStream(x0, g, Wsub, L, true, true).rmsArr,
    off: runStream(x0, g, Wsub, L, true, false).rmsArr,
  }), [x0, g, Wsub, L])
  const cmpResid = useMemo(() => ({
    on: runStream(x0, g, Wsub, L, true, true).cosArr,
    off: runStream(x0, g, Wsub, L, false, true).cosArr,
  }), [x0, g, Wsub, L])

  const finalRms = stream.rmsArr[L]
  const ratio = finalRms / stream.rmsArr[0]
  const finalCos = stream.cosArr[L]

  // ───────── 图 0:Transformer Block 接线(残差 + RMSNorm + 真实注意力) ─────────
  const renderBlock = (cell) => {
    const C = cell
    const cy = 104
    const vmaxX = Math.max(1e-6, ...[...block.x, ...block.xhat, ...block.xout, ...block.attn].map(Math.abs))
    const els = []
    let x = 28
    const hb = (row, { title, vmax, dec = 1, labels, stroke }) => {
      const y = cy - C / 2
      const sub = []
      row.forEach((v, j) => {
        sub.push(
          <g key={`${title}-${j}`}>
            <rect x={x + j * C} y={y} width={C} height={C} fill={colorFor(v, vmax)} stroke={stroke || T.c.border} strokeWidth={stroke ? 2 : 1} />
            <text x={x + j * C + C / 2} y={y + C * 0.64} textAnchor="middle" fontFamily={T.font} fontSize={T.fs} fill="#fff">{v.toFixed(dec)}</text>
          </g>
        )
      })
      if (labels) labels.forEach((l, j) => sub.push(<text key={`${title}-lb${j}`} x={x + j * C + C / 2} y={y - 4} textAnchor="middle" fontFamily={T.font} fontSize={8} fill={T.c.dim}>{l}</text>))
      sub.push(<text key={`${title}-t`} x={x + (row.length * C) / 2} y={y + C + 13} textAnchor="middle" fontFamily={T.font} fontSize={10} fill={T.c.accent}>{title}</text>)
      els.push(...sub)
      const w = row.length * C
      x += w
      return { cx: x - w / 2, w }
    }
    const op = (sym, wd) => { els.push(<text key={`op${x}`} x={x + wd / 2} y={cy} textAnchor="middle" dominantBaseline="middle" fontFamily={T.font} fontSize={10} fill={T.c.dim}>{sym}</text>); x += wd }

    const xBlk = hb(block.x, { title: `残差流 x「${SEQ[NB - 1]}」`, vmax: vmaxX, stroke: T.c.accent })
    op('RMSNorm→', 66)
    hb(block.xhat, { title: 'x̂ = RMSNorm(x)', vmax: Math.max(...block.xhat.map(Math.abs)) })
    op('×W_Q→', 50)
    hb(block.q, { title: 'q = x̂·W_Q', vmax: Math.max(...block.q.map(Math.abs)), stroke: T.c.accent })
    op('q·Kᵀ,softmax→', 86)
    hb(block.weights, { title: '注意力权重(对各 token)', vmax: 1, dec: 2, labels: SEQ })
    op('·V →', 34)
    hb(block.attn, { title: '注意力输出 = Δ', vmax: vmaxX, stroke: T.c.warn })
    op('', 16)
    const plusX = x + 12
    els.push(<circle key="plus" cx={plusX} cy={cy} r={12} fill="none" stroke={T.c.accent2} strokeWidth={2} />)
    els.push(<text key="plustx" x={plusX} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontFamily={T.font} fontSize={14} fill={T.c.accent2}>＋</text>)
    x = plusX + 12
    op('=', 24)
    hb(block.xout, { title: 'x + Δ = 新残差', vmax: vmaxX, stroke: T.c.accent2 })

    // 残差直连:从 x 顶部绕到 + 节点
    const arcY = 26
    els.push(<polyline key="skip" points={`${xBlk.cx},${cy - C / 2 - 2} ${xBlk.cx},${arcY} ${plusX},${arcY} ${plusX},${cy - 14}`}
      fill="none" stroke={T.c.accent2} strokeWidth={1.5} strokeDasharray="4 3" />)
    els.push(<text key="skiptx" x={(xBlk.cx + plusX) / 2} y={arcY - 5} textAnchor="middle" fontFamily={T.font} fontSize={10} fill={T.c.accent2}>残差直连(skip):原始 x 原样加回</text>)
    const W = x + 16
    return <svg width={W} height={cy + C / 2 + 28} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  // ───────── 图 1:RMSNorm 一步 ─────────
  const renderNorm = (cell) => {
    const C = cell
    const r = rms(x0)
    const normed = x0.map((v) => v / r)
    const out = normed.map((v, i) => v * g[i])
    const cy = 44
    const hb = (cx, row, { title, vmax, dec = 2, accent }) => {
      const els = []
      row.forEach((v, j) => {
        const x = cx + j * C
        els.push(
          <g key={`${title}-${j}`}>
            <rect x={x} y={cy} width={C} height={C} fill={colorFor(v, vmax)}
              stroke={accent || T.c.border} strokeWidth={accent ? 2 : 1} />
            <text x={x + C / 2} y={cy + C * 0.62} textAnchor="middle" fontFamily={T.font}
              fontSize={T.fs} fill="#fff">{v.toFixed(dec)}</text>
          </g>
        )
      })
      els.push(<text key={`${title}-t`} x={cx + (row.length * C) / 2} y={cy + C + 14} textAnchor="middle"
        fontFamily={T.font} fontSize={11} fill={T.c.accent}>{title}</text>)
      return { els, w: row.length * C }
    }
    const op = (x, sym, w) => (
      <text key={`op${x}`} x={x + w / 2} y={cy + C / 2} textAnchor="middle" dominantBaseline="middle"
        fontFamily={T.font} fontSize={11} fill={T.c.dim}>{sym}</text>)
    const parts = []
    let x = 20
    const add = (b, sym, w) => { parts.push(...b.els); x += b.w; if (sym) { parts.push(op(x, sym, w)); x += w } }
    add(hb(x, x0, { title: '输入 x', vmax: stream.vmax }), `÷RMS=${r.toFixed(2)}`, 88)
    add(hb(x, normed, { title: '幅度归一(RMS=1)', vmax: Math.max(...normed.map(Math.abs)) }), '⊙', 22)
    add(hb(x, g, { title: '增益 g(可学习)', vmax: Math.max(...g) }), '=', 22)
    add(hb(x, out, { title: 'RMSNorm 输出', vmax: Math.max(...out.map(Math.abs)), accent: T.c.accent2 }), null, 0)
    return <svg width={x + 16} height={cy + C + 28} style={{ display: 'block', minWidth: x + 16 }}>{parts}</svg>
  }

  // ───────── 图 2:残差流逐层累加(主图) ─────────
  const renderStream = (cell) => {
    const C = cell
    const gapX = C * 1.9
    const marginL = 36
    const top = 28
    const stripH = D * C
    const xAt = (i) => marginL + i * (C + gapX)
    const els = []
    stream.xs.forEach((vec, i) => {
      const x = xAt(i)
      vec.forEach((v, j) =>
        els.push(<rect key={`c${i}-${j}`} x={x} y={top + j * C} width={C} height={C}
          fill={colorFor(v, stream.vmax)} stroke={T.c.border} strokeWidth={1} />))
      els.push(<text key={`l${i}`} x={x + C / 2} y={top + stripH + 14} textAnchor="middle"
        fontFamily={T.font} fontSize={10} fill={i === 0 ? T.c.accent : T.c.dim}>{i === 0 ? 'x₀' : `x${i}`}</text>)
      if (i > 0) {
        const mx = xAt(i - 1) + C + gapX / 2
        els.push(<text key={`p${i}`} x={mx} y={top + stripH / 2 - 4} textAnchor="middle" fontFamily={T.font}
          fontSize={12} fill={resid ? T.c.accent2 : T.c.warn}>{resid ? '+Δ' : '→Δ'}</text>)
        els.push(<text key={`pl${i}`} x={mx} y={top + stripH / 2 + 12} textAnchor="middle" fontFamily={T.font}
          fontSize={8} fill={T.c.dim}>层{i - 1}</text>)
      }
    })
    els.push(<text key="lab" x={marginL} y={16} fontFamily={T.font} fontSize={11} fill={T.c.dim}>
      一个 token 的向量(纵向 {D} 维),逐层{resid ? '累加 Δ' : '被 Δ 替换'} →</text>)
    const W = xAt(L) + C + 16
    return <svg width={W} height={top + stripH + 26} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  // ───────── 图 3:两条曲线(各自常驻 有/无 对比) ─────────
  const renderCharts = () => {
    const w = 240, h = 130, pad = 24
    const chart = (series, { ox, title, yMin, yMax, onLabel, offLabel }) => {
      const all = series.flatMap((s) => s.vals)
      const lo = yMin != null ? yMin : 0
      const hi = yMax != null ? yMax : Math.max(...all) * 1.12 || 1
      const px = (i) => ox + pad + (i / Math.max(1, L)) * (w - pad - 10)
      const py = (v) => 22 + (h - pad - 22) * (1 - (v - lo) / (hi - lo || 1))
      const els = [
        <text key={`${title}-t`} x={ox + pad} y={12} fontFamily={T.font} fontSize={10} fill={T.c.text}>{title}</text>,
        <line key={`${title}-ax`} x1={ox + pad} y1={py(lo)} x2={ox + w - 10} y2={py(lo)} stroke={T.c.border} strokeWidth={1} />,
        <text key={`${title}-ymax`} x={ox + pad - 4} y={py(hi) + 8} textAnchor="end" fontFamily={T.font} fontSize={8} fill={T.c.dim}>{hi.toFixed(1)}</text>,
        <text key={`${title}-ymin`} x={ox + pad - 4} y={py(lo) + 3} textAnchor="end" fontFamily={T.font} fontSize={8} fill={T.c.dim}>{lo.toFixed(1)}</text>,
      ]
      series.forEach((s, si) => {
        els.push(<polyline key={`${title}-pl${si}`} points={s.vals.map((v, i) => `${px(i)},${py(v)}`).join(' ')}
          fill="none" stroke={s.color} strokeWidth={2} />)
        s.vals.forEach((v, i) => els.push(<circle key={`${title}-d${si}-${i}`} cx={px(i)} cy={py(v)} r={1.8} fill={s.color} />))
      })
      // 图例
      els.push(<text key={`${title}-lg1`} x={ox + w - 10} y={22} textAnchor="end" fontFamily={T.font} fontSize={9} fill={T.c.accent2}>{onLabel}</text>)
      els.push(<text key={`${title}-lg2`} x={ox + w - 10} y={34} textAnchor="end" fontFamily={T.font} fontSize={9} fill={T.c.hot}>{offLabel}</text>)
      return els
    }
    return (
      <svg width={2 * w + 30} height={h + 10} style={{ display: 'block', minWidth: 2 * w + 30 }}>
        {chart([
          { vals: cmpNorm.on, color: T.c.accent2 },
          { vals: cmpNorm.off, color: T.c.hot },
        ], { ox: 0, title: '向量幅度 RMS(x):归一化管它', onLabel: '有 RMSNorm', offLabel: '无 → 爆炸' })}
        {chart([
          { vals: cmpResid.on, color: T.c.accent2 },
          { vals: cmpResid.off, color: T.c.hot },
        ], { ox: w + 30, title: '原始信息 cos(x,x₀):残差管它', yMin: -0.2, yMax: 1, onLabel: '有残差', offLabel: '无 → 丢失' })}
      </svg>
    )
  }

  const controls = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 56 }}>层数</span>
        <input type="range" min={1} max={MAXL} step={1} value={L}
          onChange={(e) => setL(Math.round(+e.target.value))} style={{ width: 130 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{L}</b>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={resid} onChange={(e) => setResid(e.target.checked)} />
        <span>残差连接(x ← <b>x +</b> Δ)</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={useNorm} onChange={(e) => setUseNorm(e.target.checked)} />
        <span>RMSNorm(子层前先归一)</span>
      </label>
    </div>
  )

  return (
    <ChapterLayout kicker="第 7 章 · 残差 & RMSNorm" title="残差流 & RMSNorm" prev={prev} next={next}>
      <>
        <p>
          这是 Transformer 的<b>主干</b>:每个 token 有一个向量,从第 0 层一路流到最后一层。
          每个子层(注意力、FFN)<b>不替换它,而是往上面"加"一笔</b>:
        </p>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent-2)' }}>
          x ← x + 子层( RMSNorm(x) )
        </p>
        <p>
          这条不断被累加的向量就是<b>残差流(residual stream)</b>。把它想成一块<b>共享白板</b>:
          每层<b>读</b>当前白板 → <b>算</b>一笔更新 Δ → <b>加</b>回去,谁都不擦掉前面的。
        </p>
        <h2>两个开关,看清它们各管什么</h2>
        <p>
          右图右上有<b>残差</b>和<b>RMSNorm</b>两个开关,关掉就能看到后果:
        </p>
        <ul>
          <li><b>关掉 RMSNorm</b>:每层 Δ 正比于当前向量大小,<b>幅度逐层爆炸</b>(左下曲线冲上天)。
            归一化先把输入幅度拉回 <b>1</b>,子层每次看到的尺度都一样 → 稳。</li>
          <li><b>关掉残差</b>:变成 <code>x ← 子层(x)</code>,原始 token 被反复改写,
            <b>原始信息很快丢光</b>(右下 cos 掉到 0)。有残差时 <code>x = x₀ + ΣΔ</code>,原始永远在。</li>
        </ul>
        <div className="note">
          当前(层数 {L} · 残差{resid ? '开' : '关'} · 归一{useNorm ? '开' : '关'}):
          幅度 RMS <b style={{ color: ratio > 4 ? 'var(--hot)' : 'var(--accent-2)' }}>×{ratio.toFixed(1)}</b>
          (×4 以上算失控);原始信息保留 <b style={{ color: finalCos > 0.5 ? 'var(--accent-2)' : 'var(--hot)' }}>
          {finalCos.toFixed(2)}</b>(越接近 1 越好)。
        </div>
        <h2>为什么用 RMSNorm(而不是 LayerNorm)</h2>
        <p>
          RMSNorm 只按<b>均方根</b>缩放,<b>不减均值、没有偏置</b>,比 LayerNorm 更省、几乎不掉效果——
          所以 LLaMA、DeepSeek 都用它。公式:<code>x_i / rms(x) · g_i</code>,
          其中 <code>rms = √(mean(x²)+ε)</code>,<code>g</code> 是逐维可学习增益(下图)。
        </p>
        <div className="note">
          术语:这种<b>归一化加在子层输入上、残差直连绕过子层</b>的接法叫 <b>pre-norm(前置归一化)</b>,
          是现代大模型的标准配方(<b>Pre-LN + RMSNorm + SwiGLU + RoPE</b>,LLaMA 起、DeepSeek 沿用)。
          原始 Transformer 用的是 <b>post-norm</b>(在残差相加<b>之后</b>才归一),深层更难训、梯度更差。
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          铺垫 Ch17:V4 的 <b>mHC</b> 就是把这条"<b>单条</b>残差流"扩成<b>多路通道</b>再混合——
          先懂残差流,mHC 才看得懂。
        </div>
        <Refs ids={['1910.07467', '1512.03385', '2002.04745', '1706.03762', '2104.09864']} />
      </>
      <>
        <h3>一个 Transformer Block:残差流怎么接到注意力</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          这就是 <code>x ← x + 注意力(RMSNorm(x))</code> 的接线(真实注意力,聚焦最后一个 token「{SEQ[NB - 1]}」):
          残差流 <b>x</b> 先 <b>RMSNorm</b> 成 x̂ → x̂ 再 <b>×W_Q</b> 得到查询 <b>q</b> → 跑第 4 章的注意力
          (<code>q·Kᵀ→softmax→·V</code>)→ <b>Δ</b> → 沿
          <b style={{ color: 'var(--accent-2)' }}>残差直连</b>把原始 x 原样加回 = 新残差。
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 10px' }}>
          <b>RMSNorm 和 q 的关系</b>:x̂ <b>不是</b> q —— <code>q = RMSNorm(x)·W_Q</code>。
          同一个 x̂ 还会 <b>×W_K</b>、<b>×W_V</b> 得到 k、v(第 4 章那三个投影)。
          所以 <b>RMSNorm 是"喂给 Q/K/V 投影之前"的标准化</b>:先把残差向量的幅度拉到 1,投影出来的 q/k/v 才稳定。
          而那个加回残差流的 <b>Δ,就是注意力的输出</b>。
        </p>
        <div style={{ overflowX: 'auto', paddingBottom: 8, background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
          {renderBlock(30)}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '8px 0 0' }}>
          一层其实有<b>两个</b>这样的 add:先 <code>+注意力(·)</code>,再 <code>+FFN(·)</code>(FFN 是第 6 章,结构同理)。
        </p>

        <h3 style={{ marginTop: 18 }}>残差流:逐层累加(把子层简化成一个 Δ,看清趋势)</h3>
        <FigureBoard renderSvg={renderStream} baseCell={22} fullCell={34}
          controls={controls} onPageStep={onPageStep} />

        <h3 style={{ marginTop: 8 }}>两条诊断曲线(随开关实时变)</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 8px' }}>
          左:向量幅度(归一化管它)。右:原始信息保留(残差管它)。绿色=健康,红色=失控。
        </p>
        <div style={{ overflowX: 'auto', paddingBottom: 8, background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
          {renderCharts()}
        </div>

        <h3 style={{ marginTop: 16 }}>RMSNorm 一步:÷RMS,再 ×增益</h3>
        <div style={{ overflowX: 'auto', paddingBottom: 8, background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
          {renderNorm(30)}
        </div>
      </>
    </ChapterLayout>
  )
}
