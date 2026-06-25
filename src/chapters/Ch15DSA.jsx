import { useState, useMemo, useCallback } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Refs from '../components/Refs.jsx'
import { T } from '../components/svg/theme.js'
import { colorFor } from '../lib/figure.js'
import { seededMatrix } from '../lib/synth.js'
import { matmul, transpose } from '../lib/tensor.js'
import { attention } from '../lib/attention.js'
import { softmax } from '../lib/softmax.js'

const DM = 4 // 注意力维度(toy)
const WORDS = 'the cat sat on a warm mat and the dog ran fast over green hills today'.split(' ')

const CTX = 128 * 1024
const TOPK_REAL = 2048
const fmt = (x) => x.toLocaleString('en-US')

export default function Ch15DSA({ prev, next }) {
  const [n, setN] = useState(10)
  const [qpos, setQpos] = useState(9)
  const [k, setK] = useState(3)
  const [didx, setDidx] = useState(2) // 闪电索引器维度(远小于 DM)
  const onPageStep = useCallback((d) => setN((v) => Math.min(16, Math.max(4, v + d))), [])
  const qp = Math.min(qpos, n - 1)
  const m = qp + 1 // 因果可见的键数
  const kk = Math.min(k, m)

  const tokens = useMemo(() => Array.from({ length: n }, (_, i) => WORDS[i] ?? `t${i}`), [n])
  const X = useMemo(() => seededMatrix(n, DM, 7), [n])
  const WQ = useMemo(() => seededMatrix(DM, DM, 3), [])
  const WK = useMemo(() => seededMatrix(DM, DM, 5), [])
  const WV = useMemo(() => seededMatrix(DM, DM, 9), [])
  // 索引器的投影:把 token 压到 didx 维得到索引键。toy 里取注意力 WK 的前 didx 列,
  // 这样 kI = X·W_I 恰好等于 K 的前 didx 维,和评分图对得上。
  const WI = useMemo(() => WK.map((r) => r.slice(0, didx)), [WK, didx])
  const Q = useMemo(() => matmul(X, WQ), [X, WQ])
  const K = useMemo(() => matmul(X, WK), [X, WK])
  const V = useMemo(() => matmul(X, WV), [X, WV])
  const att = useMemo(() => attention(Q, K, V, true), [Q, K, V])

  // 闪电索引器(toy):只在 q、k 的前 didx 个维度上做点积 —— 完整打分的低维近似,
  // 维度越多越接近真值,didx=DM 时与真实打分完全一致。比完整 q·k 便宜 didx/DM。
  const idx = useMemo(
    () => Array.from({ length: m }, (_, j) => {
      let s = 0
      for (let d = 0; d < didx; d++) s += Q[qp][d] * K[j][d]
      return s
    }),
    [Q, K, qp, m, didx]
  )

  // 索引器据此选 top-k(因果范围内)
  const selSet = useMemo(() => {
    const order = idx.map((s, j) => ({ s, j })).sort((a, b) => b.s - a.s)
    return new Set(order.slice(0, kk).map((o) => o.j))
  }, [idx, kk])
  const selIdx = useMemo(() => [...selSet].sort((a, b) => a - b), [selSet])

  // 真实注意力(参照):用来衡量"廉价索引器猜得准不准"
  const trueW = att.weights[qp] // 完整 softmax 后的权重(0..qp)
  const oracle = useMemo(() => {
    const order = Array.from({ length: m }, (_, j) => ({ w: trueW[j], j })).sort((a, b) => b.w - a.w)
    return new Set(order.slice(0, kk).map((o) => o.j))
  }, [trueW, m, kk])
  const recall = useMemo(() => selIdx.reduce((s, j) => s + trueW[j], 0), [selIdx, trueW])
  const hit = selIdx.filter((j) => oracle.has(j)).length // 与"理想 top-k"重合个数

  // 成本对照(打分用的乘法次数)
  const fullScore = m * DM
  const dsaScore = m * didx + kk * DM
  const idxMax = Math.max(1e-6, ...idx.map((v) => Math.abs(v)))

  // ───────── 图 A:闪电索引器筛选 ─────────
  const renderIndexer = (cell) => {
    const C = cell
    const gx = 132
    const yTok = 26
    const y1 = yTok + 8 // 索引器分数行
    const y2 = y1 + C + 30 // 真实注意力行
    const W = gx + m * C + 20
    const H = y2 + C + 24
    const cells = []
    for (let j = 0; j < m; j++) {
      const x = gx + j * C
      const picked = selSet.has(j)
      const isHit = picked && oracle.has(j)
      // token 标签
      cells.push(
        <text key={`tk${j}`} x={x + C / 2} y={yTok} textAnchor="middle" fontFamily={T.font}
          fontSize={10} fill={j === qp ? T.c.accent : T.c.dim}>{tokens[j]}</text>
      )
      // 索引器分数(用于选择)
      cells.push(
        <g key={`i${j}`}>
          <rect x={x} y={y1} width={C} height={C} fill={colorFor(idx[j], idxMax)}
            stroke={picked ? T.c.accent2 : T.c.border} strokeWidth={picked ? 2.5 : 1} />
          {picked && (
            <text x={x + C - 4} y={y1 + 11} textAnchor="end" fontFamily={T.font} fontSize={10}
              fill={isHit ? T.c.accent2 : T.c.warn}>{isHit ? '✓' : '?'}</text>
          )}
          <text x={x + C / 2} y={y1 + C * 0.62} textAnchor="middle" fontFamily={T.font}
            fontSize={T.fs} fill="#fff" pointerEvents="none">{idx[j].toFixed(1)}</text>
        </g>
      )
      // 真实注意力权重(参照,不参与选择)
      cells.push(
        <g key={`w${j}`}>
          <rect x={x} y={y2} width={C} height={C} fill={colorFor(trueW[j], 1)}
            stroke={oracle.has(j) ? T.c.accent : T.c.border} strokeWidth={oracle.has(j) ? 2 : 1} />
          <text x={x + C / 2} y={y2 + C * 0.62} textAnchor="middle" fontFamily={T.font}
            fontSize={T.fs} fill="#fff" pointerEvents="none">{trueW[j].toFixed(2)}</text>
        </g>
      )
    }
    return (
      <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>
        <text x={4} y={yTok} fontFamily={T.font} fontSize={10} fill={T.c.accent}>q「{tokens[qp]}」对每个键:</text>
        <text x={gx - 8} y={y1 + C * 0.62} textAnchor="end" fontFamily={T.font} fontSize={10} fill={T.c.accent2}>闪电索引器(廉价)</text>
        <text x={gx - 8} y={y2 + C * 0.62} textAnchor="end" fontFamily={T.font} fontSize={10} fill={T.c.dim}>真实注意力(参照)</text>
        <text x={gx - 8} y={y1 - 12} textAnchor="end" fontFamily={T.font} fontSize={9} fill={T.c.dim}>↓选 top-{kk}</text>
        {cells}
      </svg>
    )
  }

  // ───────── 图 A.4:投影 —— X · W_I = kI(每个 token 压到 didx 维得到索引键) ─────────
  const renderIndexerProj = (cell) => {
    const C = cell
    const Xm = X.slice(0, m)
    const kI = matmul(Xm, WI) // m×didx
    const ioMax = Math.max(1e-6, ...[...Xm.flat(), ...WI.flat(), ...kI.flat()].map(Math.abs))
    const maxRows = Math.max(m, DM)
    const topPad = 22
    const cy = topPad + (maxRows * C) / 2

    const blk = (x, data, { vmax, title, rowLabels, rowHi }) => {
      const rows = data.length
      const cols = data[0].length
      const h = rows * C
      const y = cy - h / 2
      const els = []
      data.forEach((rowArr, i) =>
        rowArr.forEach((v, j) => {
          const cx = x + j * C
          const cyy = y + i * C
          const hi = rowHi && rowHi.has(i)
          els.push(
            <g key={`${title}-${i}-${j}`}>
              <rect x={cx} y={cyy} width={C} height={C} fill={colorFor(v, vmax)}
                stroke={hi ? T.c.accent2 : T.c.border} strokeWidth={hi ? 2 : 1} />
              <text x={cx + C / 2} y={cyy + C * 0.66} textAnchor="middle" fontFamily={T.font}
                fontSize={T.fs} fill="#fff" pointerEvents="none">{v.toFixed(1)}</text>
            </g>
          )
        })
      )
      if (rowLabels) rowLabels.forEach((rl, i) =>
        els.push(<text key={`${title}-rl${i}`} x={x - 4} y={y + i * C + C * 0.66} textAnchor="end"
          fontFamily={T.font} fontSize={9} fill={rowHi && rowHi.has(i) ? T.c.accent2 : T.c.dim}>{rl}</text>))
      els.push(<text key={`${title}-t`} x={x + (cols * C) / 2} y={y + h + 14} textAnchor="middle"
        fontFamily={T.font} fontSize={11} fill={T.c.accent}>{title}</text>)
      return { els, w: cols * C }
    }
    const op = (x, sym, w) => (
      <text x={x + w / 2} y={cy} textAnchor="middle" dominantBaseline="middle"
        fontFamily={T.font} fontSize={12} fill={T.c.dim}>{sym}</text>
    )
    const parts = []
    let x = 52
    const add = (b, opSym, opW) => { parts.push(...b.els); x += b.w; if (opSym) { parts.push(op(x, opSym, opW)); x += opW } }
    add(blk(x, Xm, { vmax: ioMax, title: `X 前 ${m} 个 token(${DM}维)`, rowLabels: tokens.slice(0, m), rowHi: selSet }), '·', 20)
    add(blk(x, WI, { vmax: ioMax, title: `W_I 索引投影(${DM}×${didx})` }), '=', 24)
    add(blk(x, kI, { vmax: ioMax, title: `kI 索引键(压到 ${didx} 维)`, rowLabels: tokens.slice(0, m), rowHi: selSet }), null, 0)
    const W = x + 16
    const H = topPad + maxRows * C + 26
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{parts}</svg>
  }

  // ───────── 图 A.5:索引器内部 —— qI · kIᵀ = 索引分数(摊开"分数怎么来") ─────────
  // kIᵀ(索引键)= 每个 token 投到 d_idx 维;toy 里取注意力 K 的前 d_idx 维来近似。
  const renderIndexerMath = (cell) => {
    const C = cell
    const qI = [Q[qp].slice(0, didx)]
    const kI = Array.from({ length: m }, (_, j) => K[j].slice(0, didx))
    const kIt = transpose(kI) // d_idx×m
    const sc = [idx]
    const ioMax = Math.max(1e-6, ...[...qI.flat(), ...kIt.flat()].map(Math.abs))
    const topPad = 22
    const cy = topPad + (didx * C) / 2

    const blk = (x, data, { vmax, dec = 1, title, colLabels, picked }) => {
      const rows = data.length
      const cols = data[0].length
      const h = rows * C
      const y = cy - h / 2
      const els = []
      data.forEach((rowArr, i) =>
        rowArr.forEach((v, j) => {
          const cx = x + j * C
          const cyy = y + i * C
          const sel = picked && picked.has(j)
          els.push(
            <g key={`${title}-${i}-${j}`}>
              <rect x={cx} y={cyy} width={C} height={C} fill={colorFor(v, vmax)}
                stroke={sel ? T.c.accent2 : T.c.border} strokeWidth={sel ? 2.5 : 1} />
              <text x={cx + C / 2} y={cyy + C * 0.66} textAnchor="middle" fontFamily={T.font}
                fontSize={T.fs} fill="#fff" pointerEvents="none">{v.toFixed(dec)}</text>
            </g>
          )
        })
      )
      if (colLabels) colLabels.forEach((c, j) =>
        els.push(<text key={`${title}-cl${j}`} x={x + j * C + C / 2} y={y - 4} textAnchor="middle"
          fontFamily={T.font} fontSize={9} fill={picked && picked.has(j) ? T.c.accent2 : T.c.dim}>{c}</text>))
      els.push(<text key={`${title}-t`} x={x + (cols * C) / 2} y={y + h + 14} textAnchor="middle"
        fontFamily={T.font} fontSize={11} fill={T.c.accent}>{title}</text>)
      return { els, w: cols * C }
    }
    const op = (x, sym, w) => (
      <text x={x + w / 2} y={cy} textAnchor="middle" dominantBaseline="middle"
        fontFamily={T.font} fontSize={12} fill={T.c.dim}>{sym}</text>
    )
    const parts = []
    let x = 56
    const add = (b, opSym, opW) => { parts.push(...b.els); x += b.w; parts.push(op(x, opSym, opW)); x += opW }
    add(blk(x, qI, { vmax: ioMax, title: `qI「${tokens[qp]}」(${didx}维)` }), '·', 20)
    add(blk(x, kIt, { vmax: ioMax, title: `kIᵀ 索引键(${didx}维 ≪ ${DM})`, colLabels: tokens.slice(0, m) }), '=', 24)
    const last = blk(x, sc, { vmax: idxMax, title: '索引分数(=上图那行)', colLabels: tokens.slice(0, m), picked: selSet })
    parts.push(...last.els); x += last.w
    const W = x + 16
    const H = topPad + didx * C + 26
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{parts}</svg>
  }

  // ───────── 图 B:只对选中的 k 个做真正注意力(复用第14章链路) ─────────
  const renderTrace = (cell) => {
    const C = cell
    const ms = selIdx.length
    const qv = [Q[qp]]
    const Kt = transpose(selIdx.map((j) => K[j])) // D×ms
    const scSel = selIdx.map((j) => att.scaled[qp][j])
    const sc = [scSel]
    const wt = [softmax(scSel)] // DSA 在"选中子集"上重新归一化 softmax
    const Vr = selIdx.map((j) => V[j])
    const ov = [matmul(wt, Vr)[0]]
    const ioMax = Math.max(1e-6, ...[...qv.flat(), ...Kt.flat(), ...Vr.flat(), ...ov.flat()].map(Math.abs))
    const scMax = Math.max(1e-6, ...scSel.map(Math.abs))
    const maxRows = Math.max(DM, ms)
    const topPad = 22
    const cy = topPad + (maxRows * C) / 2
    const lbl = selIdx.map((j) => tokens[j])

    const blk = (x, data, { vmax, dec = 1, title, colLabels, rowLabels }) => {
      const rows = data.length
      const cols = data[0].length
      const h = rows * C
      const y = cy - h / 2
      const els = []
      data.forEach((rowArr, i) =>
        rowArr.forEach((v, j) => {
          const cx = x + j * C
          const cyy = y + i * C
          els.push(
            <g key={`${title}-${i}-${j}`}>
              <rect x={cx} y={cyy} width={C} height={C} fill={colorFor(v, vmax)} stroke={T.c.border} strokeWidth={1} />
              <text x={cx + C / 2} y={cyy + C * 0.66} textAnchor="middle" fontFamily={T.font}
                fontSize={T.fs} fill="#fff" pointerEvents="none">{v.toFixed(dec)}</text>
            </g>
          )
        })
      )
      if (colLabels) colLabels.forEach((c, j) =>
        els.push(<text key={`${title}-cl${j}`} x={x + j * C + C / 2} y={y - 4} textAnchor="middle"
          fontFamily={T.font} fontSize={9} fill={T.c.accent2}>{c}</text>))
      if (rowLabels) rowLabels.forEach((rl, i) =>
        els.push(<text key={`${title}-rl${i}`} x={x - 4} y={y + i * C + C * 0.66} textAnchor="end"
          fontFamily={T.font} fontSize={9} fill={T.c.accent2}>{rl}</text>))
      els.push(<text key={`${title}-t`} x={x + (cols * C) / 2} y={y + h + 14} textAnchor="middle"
        fontFamily={T.font} fontSize={11} fill={T.c.accent}>{title}</text>)
      return { els, w: cols * C }
    }
    const op = (x, sym, w) => (
      <text x={x + w / 2} y={cy} textAnchor="middle" dominantBaseline="middle"
        fontFamily={T.font} fontSize={12} fill={T.c.dim}>{sym}</text>
    )
    const parts = []
    let x = 44
    const add = (b, gap, opSym, opW) => {
      parts.push(...b.els); x += b.w
      if (opSym) { parts.push(op(x, opSym, opW)); x += opW } else { x += gap }
    }
    add(blk(x, qv, { vmax: ioMax, title: `q「${tokens[qp]}」` }), 0, '·', 20)
    add(blk(x, Kt, { vmax: ioMax, title: `Kᵀ(只取选中 ${ms} 键)`, colLabels: lbl }), 0, '=', 24)
    add(blk(x, sc, { vmax: scMax, title: '分数(只算选中)' }), 0, 'softmax→', 66)
    add(blk(x, wt, { vmax: 1, dec: 2, title: '权重(子集内归一)' }), 0, '·', 20)
    add(blk(x, Vr, { vmax: ioMax, title: `V(只取选中 ${ms} 值)`, rowLabels: lbl }), 0, '=', 24)
    add(blk(x, ov, { vmax: ioMax, title: '输出→预测下个词' }), 16)
    const W = x + 16
    const H = topPad + maxRows * C + 26
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{parts}</svg>
  }

  const controls = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 76 }}>序列长度</span>
        <input type="range" min={4} max={16} step={1} value={n}
          onChange={(e) => setN(Math.round(+e.target.value))} style={{ width: 120 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{n}</b>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 76 }}>query 位置</span>
        <input type="range" min={0} max={n - 1} step={1} value={qp}
          onChange={(e) => setQpos(Math.round(+e.target.value))} style={{ width: 120 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{tokens[qp]}</b>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 76 }}>选 top-k</span>
        <input type="range" min={1} max={Math.max(1, m)} step={1} value={k}
          onChange={(e) => setK(Math.round(+e.target.value))} style={{ width: 120 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent-2)' }}>{kk}</b>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 76 }}>索引器维度</span>
        <input type="range" min={1} max={4} step={1} value={didx}
          onChange={(e) => setDidx(Math.round(+e.target.value))} style={{ width: 120 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--warn)' }}>{didx}/{DM}</b>
      </label>
    </div>
  )

  return (
    <ChapterLayout
      kicker="第 15 章 · DSA + 闪电索引器 · DeepSeek-V3.2(V4 在此基础上演进为 CSA)"
      title="DSA + 闪电索引器"
      prev={prev}
      next={next}
    >
      <>
        <p>
          第 14 章留了个死结:稀疏注意力想「只算 top-k 个 key」,可<b>要知道哪几个 key 重要,
          就得先把所有权重算出来</b>——而那正是我们想省掉的。这是<b>循环</b>。
        </p>
        <h2>破解:先用廉价的"索引器"猜,再精算</h2>
        <p>
          DSA(DeepSeek 稀疏注意力)用<b>两段式</b>:
        </p>
        <ul>
          <li>① <b>闪电索引器</b>:给每个 key 打一个<b>近似相关分</b>,但只用<b>极低的维度 d_idx</b>
            (≪ 注意力维度)。这里 toy 把它建成「<b>只在前 d_idx 个维度上做点积</b>」——完整打分的低维近似,
            便宜在维度小、还能用低精度跑。<b>真实公式更复杂</b>:是<b>多头 ReLU 门控的加权点积</b>
            <code>I = Σ_h w_h·ReLU(q_h·k_h)</code>,且是被<b>专门蒸馏训练</b>去模仿完整注意力分布的小模块
            (复用 MLA 表示)。</li>
          <li>② <b>选 top-k</b>:只挑分最高的 k 个 key。</li>
          <li>③ <b>精算注意力</b>:只对这 k 个 key 做<b>完整</b>的 q·Kᵀ→softmax→·V(右下链路)。
            注意 softmax 在<b>选中子集内重新归一化</b>。</li>
        </ul>
        <p>
          关键问题:廉价索引器<b>猜得准吗?</b>右上图把它和「真实注意力(参照)」并排放:
          <b style={{ color: 'var(--accent-2)' }}>✓</b> = 索引器选中的也确实在真实 top-k 里;
          <b style={{ color: 'var(--warn)' }}>?</b> = 选错了。当前 q「<b style={{ color: 'var(--accent)' }}>{tokens[qp]}</b>」:
          索引器选中的 {kk} 个,命中真实 top-{kk} 中 <b>{hit}</b> 个,
          覆盖了真实注意力 <b style={{ color: 'var(--accent-2)' }}>{Math.round(recall * 100)}%</b> 的质量。
        </p>
        <p>
          拖「<b>索引器维度</b>」滑块:维度越小越便宜,但猜得越糙(命中率/覆盖率会掉)。
          真实 DSA 里索引器又准又便宜,是因为它是被<b>专门训练</b>去模仿"完整注意力会看哪里"的。
        </p>
        <div className="note">
          省的是什么:索引器把<b>打分</b>从 O(n·d) 降到 O(n·d_idx),精算只在 k 个键上 O(k·d)。
          长上下文(n 很大)下,这是从<b>平方级</b>逼近<b>线性级</b>的关键。
          注意——这省的是<b>算力 / 读取带宽</b>;KV 缓存条目本身还得全留着(下一步可能选别的键)。
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          版本归属:<b>DSA(token 级)+ 闪电索引器是 DeepSeek-V3.2</b> 的方案,对<b>单个 token</b> 选 top-k。
          <b>V4 不直接用它</b>,而是把同一思想搬到<b>压缩块</b>上,并补一条滑动窗口 —— 这就是下一章的
          <b> CSA</b>(闪电索引器沿用,打分对象从 token 变成压缩块)。
        </div>
        <Refs ids={['2512.02556', '2606.19348', '1706.03762']} />
      </>
      <>
        <FigureBoard renderSvg={renderIndexer} baseCell={34} fullCell={50}
          controls={controls} onPageStep={onPageStep} />

        <h3 style={{ marginTop: 14 }}>那行「索引器分数」是怎么算出来的?</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          <b>① 投影出索引键</b>:每个 token(<code>X</code> 的一行,{DM} 维)经一个<b>小投影矩阵 <code>W_I</code></b>
          (<code>{DM}×{didx}</code>)压到 <b>{didx} 维</b>,得到<b>索引键 kI</b>。这就是「token 经小投影压到 {didx} 维」
          ——投影矩阵 <code>W_I</code> 把维度从 {DM} 砍到 {didx},正是索引器便宜的来源。
        </p>
        <div style={{ overflowX: 'auto', paddingBottom: 8, background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
          {renderIndexerProj(28)}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '10px 0 10px' }}>
          <b>② 打分</b>:query 同理经投影得到 <code>qI</code>({didx} 维),再 <code>qI · kIᵀ</code>
          (kIᵀ 就是上面 kI 的转置)= 上图那行索引分数。它比注意力的 <code>q·Kᵀ</code> 窄得多
          ({didx} 维 vs {DM} 维),所以便宜。(toy 里 <code>W_I</code> 取注意力 <code>WK</code> 的前 {didx} 列,
          使 kI 和真实 K 对得上;真实 DSA 用独立训练的小投影,并单独缓存索引键——但很小。)
        </p>
        <div style={{ overflowX: 'auto', paddingBottom: 8, background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
          {renderIndexerMath(30)}
        </div>

        <div className="cost-panel" style={{ marginTop: 14 }}>
          <div className="cost-row">
            <span>索引器命中真实 top-{kk}</span>
            <b style={{ color: 'var(--accent-2)' }}>{hit}/{kk} · 覆盖 {Math.round(recall * 100)}% 注意力</b>
          </div>
          <div className="cost-row">
            <span>打分乘法:满 vs DSA(索引 + 精算)</span>
            <b>{fullScore} → {dsaScore}</b>
          </div>
        </div>

        <h3 style={{ marginTop: 16 }}>③ 只对选中的 {selIdx.length} 个键做真正注意力</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          这就是第 14 章那条链路,但 Kᵀ / V <b>只保留索引器选中的列 / 行</b>——其余从不进入计算。
          softmax 在这个小子集内重新归一化。
        </p>
        <div style={{ overflowX: 'auto', paddingBottom: 8, background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
          {renderTrace(30)}
        </div>

        <div className="cost-panel" style={{ marginTop: 14 }}>
          <div className="cost-row" style={{ fontSize: 12 }}>
            <span>真实参照:128K 上下文,索引器选 top-{fmt(TOPK_REAL)}</span>
            <b style={{ color: 'var(--warn)' }}>精算只碰 {fmt(TOPK_REAL)} / {fmt(CTX)} 个键</b>
          </div>
          <div className="cost-row" style={{ fontSize: 12 }}>
            <span>复杂度</span>
            <b>打分 O(n·d_idx) + 精算 O(k·d) ⇒ 近似线性</b>
          </div>
        </div>
      </>
    </ChapterLayout>
  )
}
