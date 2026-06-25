import { useState, useMemo, useCallback } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Refs from '../components/Refs.jsx'
import { T } from '../components/svg/theme.js'
import { colorFor } from '../lib/figure.js'
import { seededMatrix } from '../lib/synth.js'
import { matmul, addVec } from '../lib/tensor.js'
import { rmsNorm } from '../lib/norm.js'
import { attention } from '../lib/attention.js'
import { swiglu } from '../lib/ffn.js'
import { softmax } from '../lib/softmax.js'

const D = 4
const DFF = 8
const SEQ = 'the cat sat on mat'.split(' ')
const VOCAB = 'the cat sat on mat dog ran .'.split(' ') // toy 词表

export default function Ch08Block({ prev, next }) {
  const [n, setN] = useState(4)
  const [f, setF] = useState(3)
  const [Nl, setNl] = useState(4) // 堆叠层数(示意)
  const onPageStep = useCallback((d) => setNl((v) => Math.min(8, Math.max(1, v + d))), [])
  const fi = Math.min(f, n - 1)

  const tokens = useMemo(() => Array.from({ length: n }, (_, i) => SEQ[i] ?? `t${i}`), [n])
  const X = useMemo(() => seededMatrix(n, D, 7), [n])
  const g = useMemo(() => seededMatrix(1, D, 50)[0].map((r) => +(1 + 0.2 * r).toFixed(2)), [])
  const WQ = useMemo(() => seededMatrix(D, D, 3), [])
  const WK = useMemo(() => seededMatrix(D, D, 5), [])
  const WV = useMemo(() => seededMatrix(D, D, 9), [])
  const Wg = useMemo(() => seededMatrix(D, DFF, 21), [])
  const Wu = useMemo(() => seededMatrix(D, DFF, 22), [])
  const Wd = useMemo(() => seededMatrix(DFF, D, 23), [])
  const WU = useMemo(() => seededMatrix(D, VOCAB.length, 99), []) // 输出头 d×V

  // 一个 pre-norm block:x ← x + Attn(RMSNorm(x));x ← x + FFN(RMSNorm(x))
  const blk = useMemo(() => {
    const norm1 = X.map((r) => rmsNorm(r, g))
    const att = attention(matmul(norm1, WQ), matmul(norm1, WK), matmul(norm1, WV), true)
    const X1 = X.map((r, i) => addVec(r, att.output[i]))
    const norm2 = X1.map((r) => rmsNorm(r, g))
    const ffn = norm2.map((r) => swiglu(r, Wg, Wu, Wd).out)
    const X2 = X1.map((r, i) => addVec(r, ffn[i]))
    return {
      x: X[fi], xhat1: norm1[fi], d1: att.output[fi], x1: X1[fi],
      xhat2: norm2[fi], d2: ffn[fi], x2: X2[fi],
    }
  }, [X, g, WQ, WK, WV, Wg, Wu, Wd, fi])

  // 输出头:最终 RMSNorm(残差) · W_U = logits → softmax = 概率
  const head = useMemo(() => {
    const h = rmsNorm(blk.x2, g)
    const logits = matmul([h], WU)[0]
    const probs = softmax(logits)
    let am = 0
    probs.forEach((p, i) => { if (p > probs[am]) am = i })
    return { h, logits, probs, am }
  }, [blk.x2, g, WU])

  // ───────── 图 1:一个 Block 的接线(残差流穿过两个子块) ─────────
  const renderBlock = (cell) => {
    const C = cell
    const cy = 96
    const arcY = 26
    const all = [blk.x, blk.xhat1, blk.d1, blk.x1, blk.xhat2, blk.d2, blk.x2].flat()
    const vmax = Math.max(1e-6, ...all.map(Math.abs))
    const els = []
    let x = 26
    const hb = (row, { title, stroke, dec = 1 }) => {
      const y = cy - C / 2
      row.forEach((v, j) => {
        els.push(
          <g key={`${title}-${j}`}>
            <rect x={x + j * C} y={y} width={C} height={C} fill={colorFor(v, vmax)} stroke={stroke || T.c.border} strokeWidth={stroke ? 2 : 1} />
            <text x={x + j * C + C / 2} y={y + C * 0.66} textAnchor="middle" fontFamily={T.font} fontSize={T.fs} fill="#fff">{v.toFixed(dec)}</text>
          </g>
        )
      })
      els.push(<text key={`${title}-t`} x={x + (row.length * C) / 2} y={y + C + 12} textAnchor="middle" fontFamily={T.font} fontSize={9} fill={stroke || T.c.accent}>{title}</text>)
      const cx = x + (row.length * C) / 2
      x += row.length * C
      return cx
    }
    const op = (sym, wd, col) => { els.push(<text key={`op${x}`} x={x + wd / 2} y={cy} textAnchor="middle" dominantBaseline="middle" fontFamily={T.font} fontSize={9} fill={col || T.c.dim}>{sym}</text>); x += wd }
    const plus = () => { const px = x + 11; els.push(<circle key={`pl${px}`} cx={px} cy={cy} r={11} fill="none" stroke={T.c.accent2} strokeWidth={2} />); els.push(<text key={`plt${px}`} x={px} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontFamily={T.font} fontSize={13} fill={T.c.accent2}>＋</text>); x = px + 11; return px }
    const arc = (fromCx, toPx) => {
      els.push(<polyline key={`arc${fromCx}-${toPx}`} points={`${fromCx},${cy - C / 2 - 2} ${fromCx},${arcY} ${toPx},${arcY} ${toPx},${cy - 13}`} fill="none" stroke={T.c.accent2} strokeWidth={1.3} strokeDasharray="4 3" />)
    }

    const cxX = hb(blk.x, { title: `x「${tokens[fi]}」`, stroke: T.c.accent })
    op('RMSNorm→', 60)
    hb(blk.xhat1, { title: 'x̂' })
    op('多头注意力→', 70, T.c.accent)
    hb(blk.d1, { title: 'Δ₁', stroke: T.c.warn })
    const p1 = plus()
    op('=', 18)
    const cxX1 = hb(blk.x1, { title: "x' ", stroke: T.c.accent2 })
    op('RMSNorm→', 60)
    hb(blk.xhat2, { title: 'x̂' })
    op('FFN(SwiGLU)→', 78, T.c.accent)
    hb(blk.d2, { title: 'Δ₂', stroke: T.c.warn })
    const p2 = plus()
    op('=', 18)
    hb(blk.x2, { title: "x'' 出块", stroke: T.c.accent2 })

    arc(cxX, p1)
    arc(cxX1, p2)
    els.push(<text key="sub1" x={(cxX + p1) / 2} y={arcY - 5} textAnchor="middle" fontFamily={T.font} fontSize={9} fill={T.c.accent2}>注意力子块:残差直连</text>)
    els.push(<text key="sub2" x={(cxX1 + p2) / 2} y={arcY - 5} textAnchor="middle" fontFamily={T.font} fontSize={9} fill={T.c.accent2}>FFN 子块:残差直连</text>)
    const W = x + 16
    return <svg width={W} height={cy + C / 2 + 24} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  // ───────── 图 2:堆叠 N 层成完整模型骨架 ─────────
  const renderStack = () => {
    const bw = 250, bh = 26, gap = 9, x0 = 80
    const rows = []
    rows.push({ t: '输出头 → 下一个词 logits', c: T.c.accent2, kind: 'io' })
    rows.push({ t: '最终 RMSNorm', c: T.c.dim, kind: 'norm' })
    for (let k = Nl; k >= 1; k--) rows.push({ t: `Block ${k} · 多头注意力 + FFN`, c: T.c.accent, kind: 'block' })
    rows.push({ t: '词嵌入 + 位置编码', c: T.c.accent2, kind: 'io' })
    const els = []
    rows.forEach((r, i) => {
      const y = 14 + i * (bh + gap)
      const dashed = r.kind === 'block'
      els.push(<rect key={`r${i}`} x={x0} y={y} width={bw} height={bh} rx={5}
        fill={r.kind === 'block' ? 'rgba(110,168,254,0.10)' : 'none'} stroke={r.c} strokeWidth={1.3} strokeDasharray={dashed ? '0' : '0'} />)
      els.push(<text key={`rt${i}`} x={x0 + bw / 2} y={y + bh * 0.66} textAnchor="middle" fontFamily={T.font} fontSize={11} fill={r.c}>{r.t}</text>)
      if (i > 0) els.push(<line key={`ar${i}`} x1={x0 + bw / 2} y1={y + bh} x2={x0 + bw / 2} y2={y + bh + gap} stroke={T.c.border} strokeWidth={1.5} />)
    })
    // 残差流标注
    const totalH = 14 + rows.length * (bh + gap)
    els.push(<text key="resi" x={x0 - 8} y={totalH / 2} textAnchor="end" fontFamily={T.font} fontSize={10} fill={T.c.accent2}>残差流↑</text>)
    els.push(<text key="rep" x={x0 + bw + 12} y={14 + 2.5 * (bh + gap) + bh / 2} fontFamily={T.font} fontSize={10} fill={T.c.dim}>↕ 同一结构</text>)
    els.push(<text key="rep2" x={x0 + bw + 12} y={14 + 2.5 * (bh + gap) + bh / 2 + 13} fontFamily={T.font} fontSize={10} fill={T.c.dim}>重复 N 层(各层权重不同)</text>)
    return <svg width={x0 + bw + 180} height={totalH + 8} style={{ display: 'block' }}>{els}</svg>
  }

  // ───────── 图 3:输出头 —— 残差怎么变 logits ─────────
  const renderHead = (cell) => {
    const C = cell
    const cy = 52
    const V = VOCAB.length
    const vmaxH = Math.max(1e-6, ...head.h.map(Math.abs))
    const vmaxL = Math.max(1e-6, ...head.logits.map(Math.abs))
    const els = []
    let x = 24
    const hb = (row, { title, vmax, dec = 1, labels, hi }) => {
      const y = cy - C / 2
      row.forEach((v, j) => {
        const sel = hi === j
        els.push(
          <g key={`${title}-${j}`}>
            <rect x={x + j * C} y={y} width={C} height={C} fill={colorFor(v, vmax)} stroke={sel ? T.c.accent2 : T.c.border} strokeWidth={sel ? 2.5 : 1} />
            <text x={x + j * C + C / 2} y={y + C * 0.66} textAnchor="middle" fontFamily={T.font} fontSize={T.fs} fill="#fff">{v.toFixed(dec)}</text>
          </g>
        )
      })
      if (labels) labels.forEach((l, j) => els.push(<text key={`${title}-lb${j}`} x={x + j * C + C / 2} y={y - 4} textAnchor="middle" fontFamily={T.font} fontSize={8} fill={hi === j ? T.c.accent2 : T.c.dim}>{l}</text>))
      els.push(<text key={`${title}-t`} x={x + (row.length * C) / 2} y={y + C + 14} textAnchor="middle" fontFamily={T.font} fontSize={10} fill={T.c.accent}>{title}</text>)
      x += row.length * C
    }
    const op = (sym, wd) => { els.push(<text key={`op${x}`} x={x + wd / 2} y={cy} textAnchor="middle" dominantBaseline="middle" fontFamily={T.font} fontSize={10} fill={T.c.dim}>{sym}</text>); x += wd }
    hb(head.h, { title: '最终残差 h(归一后,d维)', vmax: vmaxH })
    op('×W_U →', 56)
    hb(head.logits, { title: `logits(每个词一个分,V=${V})`, vmax: vmaxL, labels: VOCAB, hi: head.am })
    op('softmax→', 56)
    hb(head.probs, { title: '概率', vmax: 1, dec: 2, labels: VOCAB, hi: head.am })
    op(`→ 「${VOCAB[head.am]}」`, 70)
    return <svg width={x + 16} height={cy + C / 2 + 28} style={{ display: 'block', minWidth: x + 16 }}>{els}</svg>
  }

  const controls = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 64 }}>聚焦 token</span>
        <input type="range" min={0} max={n - 1} step={1} value={fi}
          onChange={(e) => setF(Math.round(+e.target.value))} style={{ width: 120 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{tokens[fi]}</b>
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
    <ChapterLayout kicker="第 8 章 · Transformer Block" title="Transformer Block(把一切拼起来)" prev={prev} next={next}>
      <>
        <p>
          前几章的零件齐了:<b>多头注意力</b>(4、5 章)、<b>FFN/SwiGLU</b>(6 章)、
          <b>残差 + RMSNorm</b>(7 章)。这一章把它们拼成<b>一个完整的层(Block)</b>,再堆叠。
        </p>
        <h2>一个 Block = 两个同构子块</h2>
        <p>
          一个 Transformer Block 顺序做<b>两件事</b>,而且<b>结构完全一样</b>:
        </p>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent-2)' }}>
          x ← x + 多头注意力( RMSNorm(x) )<br />
          x ← x + FFN( RMSNorm(x) )
        </p>
        <ul>
          <li><b>注意力子块</b>:跨 token 搬运信息(谁该看谁)。</li>
          <li><b>FFN 子块</b>:逐 token 加工(每个 token 自己想)。</li>
          <li>两个子块都是同一个套路:<b>RMSNorm → 子层 → 残差加回</b>(右上图两段虚线一模一样)。</li>
        </ul>
        <h2>堆叠 N 层</h2>
        <p>
          把这个 Block <b>重复 N 层</b>(每层权重不同),就是模型主体。
          词嵌入从底部进,残差流逐层被精炼,顶部<b>最终 RMSNorm</b> 后接<b>输出头</b>得到下一个词的分数。
          DeepSeek-V3/V4 有 <b>61 层</b>这样的 Block。
        </p>
        <h2>残差怎么变成 logits</h2>
        <p>
          最后一层出来,每个 token 还是一个 d 维残差 <b>h</b>。怎么变成「下一个词」?
          经<b>最终 RMSNorm</b>,再过<b>输出头 W_U</b>(d×V,V=词表大小):
          <code> logits = h · W_U</code> —— 词表每个词一个分数。
          每个词在 W_U 里占一列(它的「方向」),<b>h 和它点积 = 该词的 logit</b>;
          h 和谁越对齐,谁分越高。再 softmax 成概率(采样见 Ch10)。
        </p>
        <div className="note">
          真实词表 <b>V 一般 3 万 ~ 26 万</b>(LLaMA2 3.2 万、GPT-2/3 约 5 万、GPT-4 约 10 万、
          <b>DeepSeek-V3 ≈ 12.8 万</b>、Gemma 26 万);本页 toy 只用 <b>V={VOCAB.length}</b>。
          词表越大,一句话拆得越少(更省),但 W_U(V×d)越大——DeepSeek-V3 光输出头就约 <b>9 亿参数</b>。
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          <b>权重绑定</b>(weight tying):让 W_U = Ch02 <b>嵌入矩阵的转置</b>,同一张表正反用,省一份 V×d 参数。
          这是 <b>GPT-2/BERT 等早期/小模型</b>的常见做法;但很多大模型(含 <b>DeepSeek-V3</b>、Llama 3)<b>不绑定</b>
          (<code>tie_word_embeddings=false</code>)——这正是 V3 的输出头能<b>单独</b>有约 9 亿参数的原因。
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          为什么"同一结构重复"如此强大:每层都能在残差流上<b>加一笔精炼</b>,
          浅层多管局部/语法,深层多管语义/推理——同样的积木,堆得越深、能力越强。
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          通往 DeepSeek:V2 起把这里的<b>注意力子块</b>换成 <b>MLA</b>(11 章)、
          <b>FFN 子块</b>换成 <b>MoE</b>(12 章),V4 再把注意力换成 <b>CSA/HCA</b>(16 章)——
          <b>Block 的骨架不变,只换两个子块的内部实现</b>。
        </div>
        <Refs ids={['1706.03762', '2002.04745', '1608.05859', '2412.19437', '2606.19348']} />
      </>
      <>
        <h3>一个 Block 的接线:残差流穿过两个子块(聚焦「{tokens[fi]}」)</h3>
        <FigureBoard renderSvg={renderBlock} baseCell={26} fullCell={40}
          controls={controls} onPageStep={onPageStep} />

        <h3 style={{ marginTop: 14 }}>堆叠成完整模型骨架</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>层数 N</span>
          <input type="range" min={1} max={8} step={1} value={Nl}
            onChange={(e) => setNl(Math.round(+e.target.value))} style={{ width: 160 }} />
          <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{Nl}</b>
        </div>
        <div style={{ overflowX: 'auto', paddingBottom: 8, background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
          {renderStack()}
        </div>

        <h3 style={{ marginTop: 16 }}>输出头:残差怎么变成 logits</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          最后一个 Block 的残差 → 最终 RMSNorm → <code>×W_U</code>(d×V)= 每个词一个分数(logits)→
          softmax = 概率。<b>h 和某个词的方向越对齐,那个词分越高</b>。这里预测:
          <b style={{ color: 'var(--accent-2)' }}>「{VOCAB[head.am]}」</b>。
        </p>
        <div style={{ overflowX: 'auto', paddingBottom: 8, background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
          {renderHead(30)}
        </div>
      </>
    </ChapterLayout>
  )
}
