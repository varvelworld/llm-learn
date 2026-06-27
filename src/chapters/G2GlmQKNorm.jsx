import { useState, useMemo } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Tex from '../components/Tex.jsx'
import Refs from '../components/Refs.jsx'
import { T } from '../components/svg/theme.js'
import { seededMatrix } from '../lib/synth.js'
import { rmsNorm } from '../lib/norm.js'
import { dot } from '../lib/tensor.js'
import { softmax } from '../lib/softmax.js'

const D = 4 // toy head_dim(真实是 128 量级)
const NK = 5 // 被打分的 key 数

// 把向量缩放成 RMS≈1:这样 s=1(训练初期、权重还小)时两边一致,
// 之后只有「无 Norm」那侧随 s 放大。
function unit(v) {
  const r = Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length)
  return v.map((x) => x / r)
}

export default function G2GlmQKNorm({ prev, next }) {
  const [s, setS] = useState(3) // 模拟训练中 q/k 模长被整体放大 s 倍(权重变大)

  const data = useMemo(() => {
    const q0 = unit(seededMatrix(1, D, 5)[0])
    const ks = seededMatrix(NK, D, 11).map(unit)
    const sd = Math.sqrt(D)
    const q = q0.map((x) => x * s) // 放大后的原始 query
    const K = ks.map((k) => k.map((x) => x * s)) // 放大后的原始 key
    // 无 QK-Norm:logit = (q·k)/√d,随 s² 增长
    const rawLogits = K.map((k) => dot(q, k) / sd)
    const rawW = softmax(rawLogits)
    // 有 QK-Norm:先对 q、k 各做 RMSNorm(模长被钉死)再打分 → 与 s 无关
    const qh = rmsNorm(q)
    const normLogits = K.map((k) => dot(qh, rmsNorm(k)) / sd)
    const normW = softmax(normLogits)
    return { rawLogits, rawW, normLogits, normW }
  }, [s])

  const rawMax = Math.max(...data.rawW)
  const normMax = Math.max(...data.normW)

  const render = (cell) => {
    const rowH = cell * 1.12
    const top = 34
    const labW = 26
    const barW = Math.max(120, cell * 4.6)
    const valW = 80
    const panelW = labW + barW + valW
    const gap = 34
    const panels = [
      { title: '无 QK-Norm', logits: data.rawLogits, w: data.rawW, max: rawMax, col: T.c.warn },
      { title: '有 QK-Norm', logits: data.normLogits, w: data.normW, max: normMax, col: T.c.accent2 },
    ]
    const els = []
    panels.forEach((P, pi) => {
      const ox = pi * (panelW + gap)
      const sat = P.max > 0.9
      els.push(<text key={`t${pi}`} x={ox + panelW / 2} y={16} textAnchor="middle" fontFamily={T.font}
        fontSize={13} fontWeight={700} fill={P.col}>{P.title}</text>)
      P.w.forEach((w, i) => {
        const y = top + i * rowH
        const bh = rowH * 0.62
        els.push(<text key={`kl${pi}-${i}`} x={ox} y={y + bh * 0.78} fontFamily={T.font} fontSize={11}
          fill={T.c.dim}>k{i}</text>)
        els.push(<rect key={`bt${pi}-${i}`} x={ox + labW} y={y} width={barW} height={bh} rx={3}
          fill={T.c.bgElev} stroke={T.c.border} strokeWidth={0.5} />)
        els.push(<rect key={`bf${pi}-${i}`} x={ox + labW} y={y} width={Math.max(1, barW * w)} height={bh} rx={3}
          fill={P.col} opacity={0.82} />)
        els.push(<text key={`wv${pi}-${i}`} x={ox + labW + barW + 6} y={y + bh * 0.78} fontFamily={T.font}
          fontSize={11} fill={T.c.text}>{(w * 100).toFixed(0)}%</text>)
        els.push(<text key={`lv${pi}-${i}`} x={ox + labW + barW + 44} y={y + bh * 0.78} fontFamily={T.font}
          fontSize={9.5} fill={T.c.dim}>{P.logits[i] >= 0 ? ' ' : ''}{P.logits[i].toFixed(1)}</text>)
      })
      const yB = top + NK * rowH + 4
      els.push(<text key={`sat${pi}`} x={ox} y={yB} fontFamily={T.font} fontSize={10.5}
        fill={sat ? T.c.hot : T.c.dim}>最大权重 {(P.max * 100).toFixed(0)}%{sat ? ' ← 饱和≈one-hot(卡死)' : ' ✓ 分布健康'}</text>)
      // 列小标题(右侧 logit 列)
      els.push(<text key={`hl${pi}`} x={ox + labW + barW + 44} y={top - 6} fontFamily={T.font}
        fontSize={9} fill={T.c.dim}>logit</text>)
    })
    const W = 2 * panelW + gap + 6
    const H = top + NK * rowH + 22
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  const controls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 150 }}>q、k 整体放大 s(模拟权重变大)</span>
      <input type="range" min={1} max={7} step={0.5} value={s} onChange={(e) => setS(+e.target.value)} style={{ width: 140 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{s.toFixed(1)}</b>
    </label>
  )

  const formTex = `\\hat q=\\frac{q}{\\sqrt{\\tfrac1d\\sum_i q_i^2+\\epsilon}}\\odot\\gamma,
\\qquad
\\textcolor{#f0a35e}{\\text{score}}=\\frac{\\hat q\\cdot\\hat k}{\\sqrt d}`

  const scaleTex = `\\text{若 } q\\to c\\,q,\\ k\\to c\\,k:\\quad
\\underbrace{\\tfrac{q\\cdot k}{\\sqrt d}\\to c^{2}\\cdot(\\cdots)}_{\\text{无 Norm:随 }c^2\\text{ 爆炸}}
\\quad\\text{vs}\\quad
\\underbrace{\\tfrac{\\hat q\\cdot\\hat k}{\\sqrt d}\\ \\text{不变}}_{\\text{QK-Norm:尺度无关}}`

  return (
    <ChapterLayout kicker="第三部分 · GLM · G2" title="QK-Norm:把注意力打分稳住" prev={prev} next={next}>
      <>
        <p>
          回忆第 4 章:注意力先算 <b>q·k</b> 当「相关度打分(logit)」,再除以 <b>√d</b>、过 <b>softmax</b> 得权重。
          问题是——模型越深越大、训练越久,<b>q 和 k 的模长会慢慢变大</b>,
          而 <b>q·k 随模长是平方级增长</b>。logit 一旦冲到几十上百,softmax 就会
          <b>饱和成 one-hot</b>:某个 key 权重≈100%、其余≈0,注意力「卡死」只盯一个位置,梯度也几乎消失——训练不稳。
        </p>
        <h2>QK-Norm:打分前先给 q、k 归一化</h2>
        <p>
          GLM-4.5 的解法很轻:在算 q·k <b>之前</b>,先对每个头的 <b>q 向量、k 向量各做一次 RMSNorm</b>
          (第 7 章那个「只除均方根、不减均值」的归一化,带可学增益 γ),把它们的<b>模长钉死在 ~1</b>,再打分。
        </p>
        <div style={{ fontSize: 16, overflowX: 'auto', margin: '6px 0' }}><Tex block>{formTex}</Tex></div>
        <p>
          关键性质是<b>尺度无关</b>:把 q、k 同时放大 c 倍,普通点积会被放大 <b>c²</b>(爆炸),
          但归一化后的 <b>q̂·k̂ 完全不变</b>——logit 被牢牢锁在合理区间,softmax 永远「软」着。
        </p>
        <div style={{ fontSize: 14.5, overflowX: 'auto', margin: '6px 0' }}><Tex block>{scaleTex}</Tex></div>
        <div className="note">
          <b>顺序要点</b>:GLM 是 <b>投影 → RMSNorm(q,k) → 再加 RoPE → 才算 q·k</b>。
          RoPE 是纯旋转、不改模长,放在归一化之后不会破坏「模长被钉死」这件事。
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          <b>一点历史诚实</b>:最早的 QK-Norm(Henry 2020)用的是 <b>L2 归一 + 一个可学温度</b>(代替 /√d);
          现代 LLM(GLM-4.5、Qwen3、Gemma 等)改成对 q、k 各做 <b>RMSNorm</b>。
          形式略不同,但思想完全一致:<b>固定 q、k 的模长,让点积不随尺度爆炸</b>。
        </div>
        <Refs ids={['2010.04245', '1910.07467', '1706.03762', '2508.06471']} />
      </>
      <>
        <h3>同一组 q、k · 放大 s 倍,看两边的注意力分布</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          s=1(训练初期、权重还小)时两边一模一样。拖大 s 模拟训练中权重变大:
          <b style={{ color: 'var(--warn)' }}>左边(无 Norm)</b>很快塌成一根满格条(只盯一个 key=卡死),
          <b style={{ color: 'var(--accent-2)' }}>右边(QK-Norm)</b>分布纹丝不动。
        </p>
        <FigureBoard renderSvg={render} baseCell={26} fullCell={36} controls={controls} />
        <div style={{ marginTop: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
            当前 s={s.toFixed(1)}:
            <b style={{ color: 'var(--warn)' }}> 无 Norm</b> 最大注意力权重
            <b style={{ color: rawMax > 0.9 ? 'var(--hot,#ff6b6b)' : 'var(--text)' }}> {(rawMax * 100).toFixed(0)}%</b>
            (s 一大就逼近 100%=只看一个 key、梯度消失);
            <b style={{ color: 'var(--accent-2)' }}> QK-Norm</b> 最大
            <b style={{ color: 'var(--text)' }}> {(normMax * 100).toFixed(0)}%</b>(始终健康,与 s 无关)。
          </div>
        </div>
      </>
    </ChapterLayout>
  )
}
