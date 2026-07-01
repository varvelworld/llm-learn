import { useState, useMemo, useCallback } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import Refs from '../components/Refs.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import { T } from '../components/svg/theme.js'
import { colorFor } from '../lib/figure.js'
import { seededMatrix } from '../lib/synth.js'
import { matmul, transpose, dot } from '../lib/tensor.js'
import { softmax } from '../lib/softmax.js'
import { useLang, useT } from '../i18n/lang.jsx'

const DM = 4
const WORDS = 'the cat sat on a warm mat and the dog ran fast over green hills today'.split(' ')
const CTX = 1_000_000

const meanRows = (rows) => {
  const d = rows[0].length
  const out = new Array(d).fill(0)
  rows.forEach((r) => r.forEach((v, i) => (out[i] += v)))
  return out.map((v) => v / rows.length)
}
const sqrtD = Math.sqrt(DM)
const blocksOf = (idxArr, m) => {
  const out = []
  for (let i = 0; i < idxArr.length; i += m) out.push(idxArr.slice(i, i + m))
  return out
}

// 水平流水线里画一个带标题/标签的小矩阵块
function pipeBlk(C, cy, x, data, { vmax, dec = 1, title, colLabels, rowLabels, colColors }) {
  const rows = data.length
  const cols = data[0].length
  const h = rows * C
  const y = cy - h / 2
  const els = []
  data.forEach((row, i) =>
    row.forEach((v, j) => {
      const cc = colColors && colColors[j]
      const cx = x + j * C
      const cyy = y + i * C
      els.push(
        <g key={`${title}-${i}-${j}`}>
          <rect x={cx} y={cyy} width={C} height={C} fill={colorFor(v, vmax)}
            stroke={cc || T.c.border} strokeWidth={cc ? 2.5 : 1} />
          <text x={cx + C / 2} y={cyy + C * 0.66} textAnchor="middle" fontFamily={T.font}
            fontSize={T.fs} fill="#fff" pointerEvents="none">{v.toFixed(dec)}</text>
        </g>
      )
    })
  )
  if (colLabels) colLabels.forEach((c, j) =>
    els.push(<text key={`${title}-cl${j}`} x={x + j * C + C / 2} y={y - 4} textAnchor="middle"
      fontFamily={T.font} fontSize={9} fill={(colColors && colColors[j]) || T.c.dim}>{c}</text>))
  if (rowLabels) rowLabels.forEach((rl, i) =>
    els.push(<text key={`${title}-rl${i}`} x={x - 4} y={y + i * C + C * 0.66} textAnchor="end"
      fontFamily={T.font} fontSize={9} fill={T.c.dim}>{rl}</text>))
  els.push(<text key={`${title}-t`} x={x + (cols * C) / 2} y={y + h + 14} textAnchor="middle"
    fontFamily={T.font} fontSize={11} fill={T.c.accent}>{title}</text>)
  return { els, w: cols * C }
}
const pipeOp = (C, cy, x, sym, w) => (
  <text key={`op-${x}-${sym}`} x={x + w / 2} y={cy} textAnchor="middle" dominantBaseline="middle"
    fontFamily={T.font} fontSize={11} fill={T.c.dim}>{sym}</text>
)

export default function Ch16CSAHCA({ prev, next }) {
  const t = useT()
  const { lang } = useLang()
  const [n, setN] = useState(12)
  const [topBlk, setTopBlk] = useState(2) // CSA 选几个压缩块
  const [winW, setWinW] = useState(3) // CSA 滑动窗口(最近几个原始 token)
  const onPageStep = useCallback((d) => setN((v) => Math.min(16, Math.max(6, v + d))), [])
  const mC = 2 // CSA:轻压缩(每 2 token → 1 块),真实 m=4
  const mH = 4 // HCA:重压缩(每 4 token → 1 块),真实 m=128

  const tokens = useMemo(() => Array.from({ length: n }, (_, i) => WORDS[i] ?? `t${i}`), [n])
  const X = useMemo(() => seededMatrix(n, DM, 7), [n])
  const WQ = useMemo(() => seededMatrix(DM, DM, 3), [])
  const WK = useMemo(() => seededMatrix(DM, DM, 5), [])
  const WV = useMemo(() => seededMatrix(DM, DM, 9), [])
  const Q = useMemo(() => matmul(X, WQ), [X, WQ])
  const K = useMemo(() => matmul(X, WK), [X, WK])
  const V = useMemo(() => matmul(X, WV), [X, WV])
  const q = Q[n - 1]

  // ===== CSA:远处压缩历史 + 最近滑窗 =====
  const w = Math.min(winW, n - 1)
  const farN = n - w // 远处(进入压缩+选择);最近 w 个走滑窗
  const blocksC = useMemo(() => blocksOf(Array.from({ length: farN }, (_, i) => i), mC), [farN])
  const KbarC = useMemo(() => blocksC.map((b) => meanRows(b.map((i) => K[i]))), [blocksC, K])
  const VbarC = useMemo(() => blocksC.map((b) => meanRows(b.map((i) => V[i]))), [blocksC, V])
  const coarseC = useMemo(() => KbarC.map((kb) => dot(q, kb) / sqrtD), [KbarC, q])
  const selC = useMemo(() => {
    const tk = Math.min(topBlk, blocksC.length)
    return new Set(coarseC.map((s, b) => ({ s, b })).sort((a, c) => c.s - a.s).slice(0, tk).map((o) => o.b))
  }, [coarseC, topBlk, blocksC.length])
  const winTokens = useMemo(() => Array.from({ length: w }, (_, i) => farN + i), [farN, w])

  // CSA 注意力目标 = 选中压缩块(摘要) ⊕ 滑窗原始 token
  const csaTargets = useMemo(() => {
    const blk = [...selC].sort((a, b) => a - b).map((b) => ({ K: KbarC[b], V: VbarC[b], label: `${t('块', 'blk')}${b}`, kind: 'blk' }))
    const wt = winTokens.map((j) => ({ K: K[j], V: V[j], label: tokens[j], kind: 'win' }))
    return [...blk, ...wt]
  }, [selC, KbarC, VbarC, winTokens, K, V, tokens, t])
  const csa = useMemo(() => {
    const sc = csaTargets.map((tok) => dot(q, tok.K) / sqrtD)
    const wts = softmax(sc)
    const out = matmul([wts], csaTargets.map((tok) => tok.V))[0]
    return { sc, wts, out }
  }, [csaTargets, q])

  // ===== HCA:重压缩 + 稠密(无选择) =====
  const blocksH = useMemo(() => blocksOf(Array.from({ length: n }, (_, i) => i), mH), [n])
  const KbarH = useMemo(() => blocksH.map((b) => meanRows(b.map((i) => K[i]))), [blocksH, K])
  const VbarH = useMemo(() => blocksH.map((b) => meanRows(b.map((i) => V[i]))), [blocksH, V])
  const hca = useMemo(() => {
    const sc = KbarH.map((kb) => dot(q, kb) / sqrtD)
    const wts = softmax(sc)
    const out = matmul([wts], VbarH)[0]
    return { sc, wts, out }
  }, [KbarH, VbarH, q])

  // 真实参照(1M 上下文)
  const realCSA = Math.round(CTX / 4)
  const realHCA = Math.round(CTX / 128)

  // ───────── 图 0:CSA / HCA 逐层交替 ─────────
  const renderLayers = () => {
    const nL = 8
    const bw = lang === 'en' ? 300 : 230
    const bh = 22
    const gap = 6
    const x0 = lang === 'en' ? 168 : 130
    const els = []
    for (let i = 0; i < nL; i++) {
      const csaLayer = i % 2 === 0
      const y = 12 + (nL - 1 - i) * (bh + gap)
      const col = csaLayer ? T.c.accent : T.c.accent2
      els.push(<rect key={`r${i}`} x={x0} y={y} width={bw} height={bh} rx={4}
        fill={col} fillOpacity={0.18} stroke={col} strokeWidth={1} />)
      els.push(<text key={`t${i}`} x={x0 + 10} y={y + bh * 0.68} fontFamily={T.font} fontSize={11} fill={col}>
        {t(`第 ${i} 层`, `Layer ${i}`)} · {csaLayer
          ? t('CSA(压缩+稀疏选择+滑窗)', 'CSA: compress + select + window')
          : t('HCA(重压缩+稠密)', 'HCA: heavy compress, dense')}</text>)
    }
    els.push(<text key="lq" x={x0 - 8} y={12 + (nL * (bh + gap)) / 2} textAnchor="end" fontFamily={T.font}
      fontSize={11} fill={T.c.dim}>{t('61 层逐层交替→', '61 layers alternate →')}</text>)
    const H = 12 + nL * (bh + gap) + 6
    return <svg width={x0 + bw + 16} height={H} style={{ display: 'block' }}>{els}</svg>
  }

  // ───────── 图 1:CSA 压缩 + 选块(+ 标出滑窗 token) ─────────
  const renderCSAcompress = (cell) => {
    const C = cell
    const gapB = C * 0.5
    const lw = 56
    const x0 = lw
    const gyTop = 30
    const farBlocks = blocksC.length
    const farBottomY = gyTop + farN * C + (farBlocks - 1) * gapB
    const yOf = (i) =>
      i < farN
        ? gyTop + i * C + Math.floor(i / mC) * gapB
        : farBottomY + gapB * 2.4 + (i - farN) * C
    const els = []
    K.forEach((row, i) => {
      const inWin = i >= farN
      const b = Math.floor(i / mC)
      const sel = !inWin && selC.has(b)
      row.forEach((v, d) =>
        els.push(<rect key={`k${i}-${d}`} x={x0 + d * C} y={yOf(i)} width={C} height={C}
          fill={colorFor(v, undefined)} stroke={inWin ? T.c.accent : (sel ? T.c.accent2 : T.c.border)}
          strokeWidth={inWin || sel ? 2 : 1} />))
      els.push(<text key={`kl${i}`} x={x0 - 6} y={yOf(i) + C * 0.66} textAnchor="end" fontFamily={T.font}
        fontSize={9} fill={inWin ? T.c.accent : (sel ? T.c.accent2 : T.c.dim)}>{tokens[i]}</text>)
    })
    // 滑窗分组标签
    els.push(<text key="winlbl" x={x0 + DM * C + 8} y={yOf(farN) + (w * C) / 2 + 4} fontFamily={T.font}
      fontSize={10} fill={T.c.accent}>{t('← 滑窗(不压缩,不进选择)', '← window (no compress, no select)')}</text>)
    // 右:压缩块摘要(只有远处块)
    const x1 = x0 + DM * C + 124
    KbarC.forEach((kb, b) => {
      const bk = blocksC[b]
      const yb = (yOf(bk[0]) + yOf(bk[bk.length - 1]) + C) / 2 - C / 2
      const sel = selC.has(b)
      kb.forEach((v, d) =>
        els.push(<rect key={`kb${b}-${d}`} x={x1 + d * C} y={yb} width={C} height={C}
          fill={colorFor(v, undefined)} stroke={sel ? T.c.accent2 : T.c.border} strokeWidth={sel ? 2 : 1} />))
      els.push(<text key={`kbl${b}`} x={x1 - 6} y={yb + C * 0.66} textAnchor="end" fontFamily={T.font}
        fontSize={9} fill={sel ? T.c.accent2 : T.c.dim}>{t('块', 'blk')}{b}{sel ? '✓' : ''}</text>)
      els.push(<line key={`ln${b}`} x1={x0 + DM * C + 4} y1={yb + C / 2} x2={x1 - 10} y2={yb + C / 2}
        stroke={T.c.border} strokeWidth={1} />)
    })
    const midX = (x0 + DM * C + x1) / 2
    els.push(<text key="arr" x={midX} y={16} textAnchor="middle" fontFamily={T.font} fontSize={10}
      fill={T.c.accent2}>{t(`远处:每 ${mC} 个压缩 →`, `Far: every ${mC} → 1 →`)}</text>)
    els.push(<text key="win" x={2} y={16} textAnchor="start" fontFamily={T.font} fontSize={10} fill={T.c.dim}>
      <tspan fill={T.c.accent2}>{t('绿=选中块', 'green=sel')}</tspan> <tspan fill={T.c.accent}>{t('蓝=滑窗', 'blue=win')}</tspan></text>)
    const H = yOf(n - 1) + C + 16
    const W = x1 + DM * C + 16
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  // ───────── 图 2:CSA 注意力 = 选中压缩块 ⊕ 滑窗 token ─────────
  const renderCSAattend = (cell) => {
    const C = cell
    const nt = csaTargets.length
    const maxRows = Math.max(DM, nt)
    const topPad = 24
    const cy = topPad + (maxRows * C) / 2
    const colColors = csaTargets.map((tok) => (tok.kind === 'blk' ? T.c.accent2 : T.c.accent))
    const labels = csaTargets.map((tok) => tok.label)
    const parts = []
    let x = 46
    const add = (b, opSym, opW) => { parts.push(...b.els); x += b.w; if (opSym) { parts.push(pipeOp(C, cy, x, opSym, opW)); x += opW } }
    add(pipeBlk(C, cy, x, [q], { vmax: Math.max(1e-6, ...q.map(Math.abs)), title: t(`q「${tokens[n - 1]}」`, `q "${tokens[n - 1]}"`) }), '·', 18)
    add(pipeBlk(C, cy, x, transpose(csaTargets.map((tok) => tok.K)), { vmax: undefined,
      title: t('注意力目标 = 选中块 ⊕ 滑窗', 'targets = blocks ⊕ window'), colLabels: labels, colColors }), '=', 22)
    add(pipeBlk(C, cy, x, [csa.sc], { vmax: Math.max(1e-6, ...csa.sc.map(Math.abs)), title: t('分数', 'scores'), colLabels: labels, colColors }), 'softmax', 58)
    add(pipeBlk(C, cy, x, [csa.wts], { vmax: 1, dec: 2, title: t('权重', 'weights'), colLabels: labels, colColors }), '·V=', 38)
    add(pipeBlk(C, cy, x, [csa.out], { vmax: Math.max(1e-6, ...csa.out.map(Math.abs)), title: t('输出', 'output') }), null, 0)
    const W = x + 16
    const H = topPad + maxRows * C + 26
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{parts}</svg>
  }

  // ───────── 图 3:HCA 重压缩 + 稠密 ─────────
  const renderHCA = (cell) => {
    const C = cell
    const nb = blocksH.length
    const maxRows = Math.max(DM, nb)
    const topPad = 24
    const cy = topPad + (maxRows * C) / 2
    const labels = blocksH.map((_, b) => `${t('块', 'blk')}${b}`)
    const parts = []
    let x = 46
    const add = (b, opSym, opW) => { parts.push(...b.els); x += b.w; if (opSym) { parts.push(pipeOp(C, cy, x, opSym, opW)); x += opW } }
    add(pipeBlk(C, cy, x, [q], { vmax: Math.max(1e-6, ...q.map(Math.abs)), title: t(`q「${tokens[n - 1]}」`, `q "${tokens[n - 1]}"`) }), '·', 18)
    add(pipeBlk(C, cy, x, transpose(KbarH), { vmax: undefined, title: t(`重压缩块 K̄(每${mH}→1,全注意)`, `heavy blocks K̄ (every ${mH}→1, all)`), colLabels: labels }), '=', 22)
    add(pipeBlk(C, cy, x, [hca.sc], { vmax: Math.max(1e-6, ...hca.sc.map(Math.abs)), title: t('分数(无选择)', 'scores (no select)'), colLabels: labels }), 'softmax', 58)
    add(pipeBlk(C, cy, x, [hca.wts], { vmax: 1, dec: 2, title: t('权重(全部参与)', 'weights (all)'), colLabels: labels }), '·V=', 38)
    add(pipeBlk(C, cy, x, [hca.out], { vmax: Math.max(1e-6, ...hca.out.map(Math.abs)), title: t('输出', 'output') }), null, 0)
    const W = x + 16
    const H = topPad + maxRows * C + 26
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{parts}</svg>
  }

  const controls = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 88 }}>{t('序列长度', 'Seq length')}</span>
        <input type="range" min={6} max={16} step={1} value={n}
          onChange={(e) => setN(Math.round(+e.target.value))} style={{ width: 116 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{n}</b>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 88 }}>{t('CSA 选块数', 'CSA #blocks')}</span>
        <input type="range" min={1} max={Math.max(1, blocksC.length)} step={1} value={topBlk}
          onChange={(e) => setTopBlk(Math.round(+e.target.value))} style={{ width: 116 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent-2)' }}>{Math.min(topBlk, blocksC.length)}</b>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 88 }}>{t('滑窗大小', 'Window size')}</span>
        <input type="range" min={1} max={Math.min(6, n - 1)} step={1} value={winW}
          onChange={(e) => setWinW(Math.round(+e.target.value))} style={{ width: 116 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{w}</b>
      </label>
    </div>
  )

  return (
    <ChapterLayout
      kicker={t('第 16 章 · CSA + HCA 混合注意力 · DeepSeek-V4(2026 技术报告)', 'Ch.16 · CSA + HCA Hybrid Attention · DeepSeek-V4 (2026 tech report)')}
      title={t('CSA + HCA 混合注意力', 'CSA + HCA Hybrid Attention')}
      prev={prev}
      next={next}
      translated
    >
      <>
        {lang === 'en' ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Term alignment (from the V4 tech report): <b>CSA = Compressed Sparse Attention</b>;
              <b> HCA = Heavily Compressed Attention</b>.
            </p>
            <p>
              Chapter 15's DSA saved compute, but didn't shrink the KV cache at all. To save memory under a
              <b> 1M context</b>, V4 <b>alternates two kinds of attention layers</b> — <b>not two levels of one
              method</b>, but different layers doing different jobs.
            </p>
            <h2>CSA (sparse layers): compress + select + window</h2>
            <p>
              CSA can be read as "<b>apply Chapter 15's DSA on compressed blocks, plus a sliding window</b>":
            </p>
            <ul>
              <li><b>Light compression</b>: every <b>4 tokens</b> ({mC} in the toy) are gated-pooled into <b>1 compressed block</b>.</li>
              <li><b>Sparse selection</b>: the lightning indexer scores the compressed blocks and picks the <b>top-1024</b> (the toy picks
                <b style={{ color: 'var(--accent-2)' }}> {Math.min(topBlk, blocksC.length)}</b>). Attention runs only over the <b>selected compressed blocks</b> —
                they are <b>not expanded back to raw tokens</b> (I got this wrong in an earlier version).</li>
              <li><b>Sliding window</b>: the most recent <b>128</b> ({w} in the toy) <b>uncompressed</b> raw tokens always take part, filling in local detail.</li>
            </ul>
            <p>
              So CSA's attention targets = <b style={{ color: 'var(--accent-2)' }}>selected compressed blocks</b> ⊕
              <b style={{ color: 'var(--accent)' }}> sliding-window raw tokens</b> (the two colors on the right).
            </p>
            <h2>HCA (dense layers): heavy compression, but sees everything</h2>
            <p>
              HCA takes another route: it compresses <b>harder</b> (every <b>128 tokens</b> → 1 block, {mH} in the toy) but does
              <b> no selection</b> — it runs <b>dense attention</b> over all compressed blocks. It provides <b>global context</b> at tiny cost.
            </p>
            <div className="note">
              Why alternate the two: CSA keeps detail (selection + window) but compresses lightly; HCA gives a global view but blurry.
              Stacking them alternately → both global and detailed. The V4 report: under a 1M context, versus V3.2 it uses only
              <b> 27% of the FLOPs and 10% of the KV cache</b>.
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              Orthogonal to <b>MLA</b>: MLA compresses the <b>dimension</b> of each entry, CSA/HCA compress the <b>number</b> of entries — they stack.
              (The toy approximates with mean pooling; real CSA uses two overlapping streams + softmax gating to avoid "bad-split" boundary issues.)
            </div>

            <h2>An intuition: the compression step is essentially a "convolution"</h2>
            <p>
              Pooling B consecutive tokens into one summary is exactly a <b>1D convolution sliding along the sequence with kernel=B, stride=B</b>
              (the same operation ViT uses to cut an image into patches); CSA's overlapping windows are <b>overlapping convolutions with stride &lt; kernel</b>.
              But its aggregation weights are <b>computed from the block's content (softmax gating)</b>, not a fixed kernel — so more precisely it belongs to the
              <b> dynamic / content-adaptive convolution</b> family that sits "between convolution and attention".
            </p>
            <p>
              But note: <b>CSA/HCA is more than convolution</b>. After producing summaries it still <b>scores blocks by content, picks top-k, then attends</b> —
              this "which blocks are globally relevant" is data-dependent global routing that convolution cannot do (convolution only sees a fixed local window).
            </p>
            <table className="ver-table">
              <thead><tr><th></th><th>Convolution</th><th>Attention</th></tr></thead>
              <tbody>
                <tr><td>Weights of the weighted sum</td><td><b>fixed</b> (input-independent)</td><td><b>computed from content</b> (dynamic)</td></tr>
                <tr><td>Receptive field</td><td><b>local</b> fixed window</td><td><b>global</b>, any position</td></tr>
              </tbody>
            </table>
            <div className="note" style={{ marginTop: 8 }}>
              In one line: <b>CSA/HCA = local "convolution-style" downsampling compression + global sparse attention selection</b>.
              It spends the compute saved by convolution on what convolution cannot do — "globally selecting blocks" — which is exactly why it beats pure convolution yet is cheaper than dense attention.
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              名词对齐(取自 V4 技术报告):<b>CSA = Compressed Sparse Attention</b>(压缩稀疏注意力);
              <b>HCA = Heavily Compressed Attention</b>(<b>重度</b>压缩注意力)。
            </p>
            <p>
              第 15 章的 DSA 省了算力,但 KV 缓存一个没少。V4 要在 <b>1M 上下文</b>下省显存,用的是
              <b>两种注意力层逐层交替</b>——<b>不是一个方法的两级</b>,而是不同的层干不同的活。
            </p>
            <h2>CSA(稀疏层):压缩 + 选择 + 滑窗</h2>
            <p>
              CSA 可以理解成「<b>把第 15 章的 DSA 用在压缩块上,再补一条滑动窗口</b>」:
            </p>
            <ul>
              <li><b>轻压缩</b>:每 <b>4 个 token</b>(toy 里 {mC} 个)用门控池化成 <b>1 个压缩块</b>。</li>
              <li><b>稀疏选择</b>:闪电索引器给压缩块打分,选 <b>top-1024</b> 个块(toy 选
                <b style={{ color: 'var(--accent-2)' }}> {Math.min(topBlk, blocksC.length)}</b> 个)。注意力只对<b>选中的压缩块</b>做——
                <b>不还原成原始 token</b>(这点我上一版讲错了)。</li>
              <li><b>滑动窗口</b>:最近 <b>128 个</b>(toy 里 {w} 个)<b>未压缩</b>的原始 token 永远参与,补足局部细节。</li>
            </ul>
            <p>
              所以 CSA 的注意力目标 = <b style={{ color: 'var(--accent-2)' }}>选中的压缩块</b> ⊕
              <b style={{ color: 'var(--accent)' }}> 滑窗原始 token</b>(右图两种颜色)。
            </p>
            <h2>HCA(稠密层):重压缩,但全看</h2>
            <p>
              HCA 走另一条路:压得<b>更狠</b>(每 <b>128 个 token</b> → 1 块,toy 里 {mH} 个),但<b>不做选择</b>、
              对所有压缩块做<b>稠密注意力</b>。它用极小的代价提供<b>全局上下文</b>。
            </p>
            <div className="note">
              为什么要两种交替:CSA 保细节(选择 + 滑窗)但压得轻;HCA 给全局但很糊。
              交替堆叠 → 既有全局又有细节。V4 报告:1M 上下文下,相比 V3.2 只用
              <b> 27% 的 FLOPs、10% 的 KV 缓存</b>。
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              和 <b>MLA</b> 正交:MLA 压每个条目的<b>维度</b>,CSA/HCA 压<b>条目数</b>,可叠加。
              (toy 用均值池化近似;真实 CSA 用两条重叠流 + softmax 门控混合,避免「坏切分」边界问题。)
            </div>

            <h2>一个直觉:压缩那一步,本质上是「卷积」</h2>
            <p>
              把连续 B 个 token 聚成 1 个摘要——这正是一个<b>沿序列滑动、kernel=B、步幅=B 的一维卷积</b>
              (和 ViT 把图像切成 patch 是同一种操作);CSA 的重叠窗口就是<b>步幅 &lt; kernel 的重叠卷积</b>。
              不过它的聚合权重是<b>由块内内容算出来的(softmax 门控)</b>,而不是固定的核——所以更准确地说,
              它属于<b>动态卷积 / 内容自适应卷积</b>这一「卷积与注意力之间」的家族。
            </p>
            <p>
              但要注意:<b>整个 CSA/HCA 不止卷积</b>。压缩出摘要后还要<b>按内容给块打分、选 top-k、再做注意力</b>——
              这种「全局挑哪些块相关」是数据相关的全局路由,卷积做不到(卷积只能看固定的局部窗口)。
            </p>
            <table className="ver-table">
              <thead><tr><th></th><th>卷积</th><th>注意力</th></tr></thead>
              <tbody>
                <tr><td>加权和的权重</td><td><b>固定</b>(与输入无关)</td><td><b>内容算出</b>(动态)</td></tr>
                <tr><td>看的范围</td><td><b>局部</b>固定窗口</td><td><b>全局</b>任意位置</td></tr>
              </tbody>
            </table>
            <div className="note" style={{ marginTop: 8 }}>
              一句话:<b>CSA/HCA = 局部「卷积式」下采样压缩 + 全局稀疏注意力选择</b>。
              它把卷积省下来的算力,花在了卷积做不到的「全局选块」上——这正是它比纯卷积强、又比稠密注意力省的原因。
            </div>
          </>
        )}
        <Refs ids={['2512.02556', '2606.19348', '2405.04434', '1901.10430', '1706.03762']} />
      </>
      <>
        <h3>{t('V4 注意力:CSA / HCA 逐层交替', 'V4 attention: CSA / HCA alternating layers')}</h3>
        <div style={{ overflowX: 'auto', paddingBottom: 8, background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', marginBottom: 8 }}>
          {renderLayers()}
        </div>

        <h3 style={{ marginTop: 14 }}>{t('CSA ①:压缩 + 选块(蓝=滑窗,绿=选中块)', 'CSA ①: compress + select blocks (blue=window, green=selected)')}</h3>
        <FigureBoard renderSvg={renderCSAcompress} baseCell={26} fullCell={40}
          controls={controls} onPageStep={onPageStep} />

        <h3 style={{ marginTop: 14 }}>{t('CSA ②:注意力 = 选中压缩块 ⊕ 滑窗 token', 'CSA ②: attention = selected blocks ⊕ window tokens')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {lang === 'en' ? (
            <>q attends to both the <b style={{ color: 'var(--accent-2)' }}>selected compressed blocks (green)</b> and the
            <b style={{ color: 'var(--accent)' }}> sliding-window raw tokens (blue)</b>, softmax together → output. The blocks are not expanded.</>
          ) : (
            <>q 同时注意<b style={{ color: 'var(--accent-2)' }}>选中的压缩块(绿)</b>和
            <b style={{ color: 'var(--accent)' }}> 滑窗原始 token(蓝)</b>,一起 softmax → 输出。压缩块没被还原。</>
          )}
        </p>
        <div style={{ overflowX: 'auto', paddingBottom: 8, background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
          {renderCSAattend(28)}
        </div>

        <h3 style={{ marginTop: 16 }}>{t('HCA:重压缩 + 稠密(无选择)', 'HCA: heavy compression + dense (no selection)')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {lang === 'en' ? (
            <>Compressed into fewer blocks, but <b>all participate</b> in attention (unlike CSA's selection). A cheap global view.</>
          ) : (
            <>压成更少的块,但<b>全部参与</b>注意力(对比 CSA 的挑选)。便宜的全局视野。</>
          )}
        </p>
        <div style={{ overflowX: 'auto', paddingBottom: 8, background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
          {renderHCA(28)}
        </div>

        <h3 style={{ marginTop: 16 }}>{t('KV 缓存:每层存什么(1M 上下文真实参照)', 'KV cache: what each layer stores (real 1M-context reference)')}</h3>
        <div className="cost-panel">
          <div className="cost-row">
            <span>{t('CSA 层:压缩块(每4压1) + 滑窗(128)', 'CSA layer: blocks (4→1) + window (128)')}</span>
            <b style={{ color: 'var(--accent-2)' }}>≈ {realCSA.toLocaleString('en-US')} + 128 {t('条目', 'entries')}</b>
          </div>
          <div className="cost-row">
            <span>{t('HCA 层:重压缩块(每128压1)', 'HCA layer: heavy blocks (128→1)')}</span>
            <b style={{ color: 'var(--accent-2)' }}>≈ {realHCA.toLocaleString('en-US')} {t('条目', 'entries')}</b>
          </div>
          <div className="cost-divider" />
          <div className="cost-row" style={{ fontSize: 12 }}>
            <span>{t('V4-Pro vs V3.2(1M 上下文,整模型)', 'V4-Pro vs V3.2 (1M context, full model)')}</span>
            <b style={{ color: 'var(--warn)' }}>{t('FLOPs 27% · KV 缓存 10%', 'FLOPs 27% · KV cache 10%')}</b>
          </div>
        </div>
      </>
    </ChapterLayout>
  )
}
