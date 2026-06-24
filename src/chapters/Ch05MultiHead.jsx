import { useState, useMemo, useCallback } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import { T } from '../components/svg/theme.js'
import { colorFor } from '../lib/figure.js'
import { seededMatrix } from '../lib/synth.js'
import { matmul } from '../lib/tensor.js'
import { attention } from '../lib/attention.js'

const D = 8 // 模型维度(toy)
const SEQ = 'the cat sat on mat way'.split(' ')
const HEADS = [1, 2, 4] // d_head = D/H
const HCOL = ['#6ea8fe', '#7ee787', '#f0a35e', '#d2a8ff']

export default function Ch05MultiHead({ prev, next }) {
  const [n, setN] = useState(5)
  const [H, setH] = useState(2)
  const [qf, setQf] = useState(4)
  const onPageStep = useCallback((d) => setN((v) => Math.min(6, Math.max(3, v + d))), [])
  const f = Math.min(qf, n - 1)
  const dh = D / H

  const tokens = useMemo(() => Array.from({ length: n }, (_, i) => SEQ[i] ?? `t${i}`), [n])
  const X = useMemo(() => seededMatrix(n, D, 7), [n])
  const WO = useMemo(() => seededMatrix(D, D, 77), [])

  // 每个头:自己的 W_Q/W_K/W_V(D×d_head),各算各的注意力
  const heads = useMemo(() => Array.from({ length: H }, (_, h) => {
    const WQ = seededMatrix(D, dh, 30 + h * 5)
    const WK = seededMatrix(D, dh, 31 + h * 5)
    const WV = seededMatrix(D, dh, 32 + h * 5)
    const att = attention(matmul(X, WQ), matmul(X, WK), matmul(X, WV), true)
    return { weights: att.weights, output: att.output } // weights n×n, output n×dh
  }), [X, H, dh])

  // 聚焦 token:各头输出拼接 → ×W_O → Δ
  const concatF = useMemo(() => heads.flatMap((hd) => hd.output[f]), [heads, f]) // 长度 D
  const deltaF = useMemo(() => matmul([concatF], WO)[0], [concatF, WO])

  // ───────── 图 1:H 个头各自的注意力(并行独立) ─────────
  const renderHeads = (cell) => {
    const C = cell
    const gap = 30
    const lw = 38
    const top = 22
    let xo = lw
    const els = []
    const show = n <= 5
    heads.forEach((hd, h) => {
      const col = HCOL[h]
      els.push(<text key={`ht${h}`} x={xo + (n * C) / 2} y={14} textAnchor="middle" fontFamily={T.font}
        fontSize={11} fill={col}>头 {h}</text>)
      hd.weights.forEach((row, i) =>
        row.forEach((v, j) => {
          if (j > i) return
          els.push(<rect key={`h${h}-${i}-${j}`} x={xo + j * C} y={top + i * C} width={C} height={C}
            fill={colorFor(v, 1)} stroke={T.c.border} strokeWidth={1} />)
          if (show) els.push(<text key={`ht${h}-${i}-${j}`} x={xo + j * C + C / 2} y={top + i * C + C * 0.66}
            textAnchor="middle" fontFamily={T.font} fontSize={9} fill="#fff">{v.toFixed(1)}</text>)
        })
      )
      // 聚焦 query 行高亮
      els.push(<rect key={`hf${h}`} x={xo} y={top + f * C} width={(f + 1) * C} height={C}
        fill="none" stroke={col} strokeWidth={2} />)
      if (h === 0) tokens.forEach((t, i) =>
        els.push(<text key={`rl${i}`} x={xo - 6} y={top + i * C + C * 0.66} textAnchor="end" fontFamily={T.font}
          fontSize={9} fill={i === f ? T.c.accent : T.c.dim}>{t}</text>))
      xo += n * C + gap
    })
    els.push(<text key="cap" x={lw} y={top + n * C + 16} fontFamily={T.font} fontSize={10} fill={T.c.dim}>
      同一输入,每个头各算各的注意力 —— 模式不同(看高亮行:各头注目的 token 不一样)</text>)
    return <svg width={xo + 6} height={top + n * C + 26} style={{ display: 'block', minWidth: xo + 6 }}>{els}</svg>
  }

  // ───────── 图 2:拼接 concat → ×W_O → Δ(头之间唯一的混合点) ─────────
  const renderConcat = (cell) => {
    const C = cell
    const cy = 56
    const vmax = Math.max(1e-6, ...[...concatF, ...deltaF].map(Math.abs))
    const els = []
    let x = 30
    const cellRow = (row, { stroke, dec = 1, seg }) => {
      row.forEach((v, j) => {
        const col = seg ? HCOL[Math.floor(j / dh)] : stroke
        els.push(
          <g key={`${x}-${j}`}>
            <rect x={x + j * C} y={cy - C / 2} width={C} height={C} fill={colorFor(v, vmax)}
              stroke={col || T.c.border} strokeWidth={col ? 2 : 1} />
            <text x={x + j * C + C / 2} y={cy + C * 0.16} textAnchor="middle" fontFamily={T.font}
              fontSize={T.fs} fill="#fff">{v.toFixed(dec)}</text>
          </g>
        )
      })
      const w = row.length * C
      x += w
      return w
    }
    const label = (cx, text, color) => els.push(<text key={`lb${cx}-${text}`} x={cx} y={cy + C / 2 + 16}
      textAnchor="middle" fontFamily={T.font} fontSize={10} fill={color || T.c.accent}>{text}</text>)
    const op = (sym, wd) => { els.push(<text key={`op${x}`} x={x + wd / 2} y={cy} textAnchor="middle"
      dominantBaseline="middle" fontFamily={T.font} fontSize={11} fill={T.c.dim}>{sym}</text>); x += wd }

    // 各头输出,相邻摆放 = 拼接
    const concatStart = x
    heads.forEach((hd, h) => {
      const sx = x
      cellRow(hd.output[f], { stroke: HCOL[h] })
      label(sx + (dh * C) / 2, `头${h}(${dh}维)`, HCOL[h])
    })
    const concatMid = (concatStart + x) / 2
    els.push(<text key="concatlbl" x={concatMid} y={cy - C / 2 - 8} textAnchor="middle" fontFamily={T.font}
      fontSize={10} fill={T.c.accent2}>相邻摆放 = 拼接 concat({D} 维)</text>)
    op('×W_O →', 56)
    const dx = x
    cellRow(deltaF, { stroke: T.c.accent2 })
    label(dx + (D * C) / 2, 'Δ:注意力输出(加回残差流)', T.c.accent2)
    return <svg width={x + 16} height={cy + C / 2 + 30} style={{ display: 'block', minWidth: x + 16 }}>{els}</svg>
  }

  const controls = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 64 }}>头数 H</span>
        {HEADS.map((h) => (
          <button key={h} className="btn" onClick={() => setH(h)}
            style={{ padding: '2px 10px', background: H === h ? 'var(--accent)' : 'var(--bg)',
              color: H === h ? '#0f1115' : 'var(--text-dim)', fontWeight: H === h ? 700 : 400 }}>{h}</button>
        ))}
        <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-dim)', fontSize: 12 }}>d_head={dh}</span>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 64 }}>query 行</span>
        <input type="range" min={0} max={n - 1} step={1} value={f}
          onChange={(e) => setQf(Math.round(+e.target.value))} style={{ width: 120 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{tokens[f]}</b>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 64 }}>序列长度</span>
        <input type="range" min={3} max={6} step={1} value={n}
          onChange={(e) => setN(Math.round(+e.target.value))} style={{ width: 120 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{n}</b>
      </label>
    </div>
  )

  return (
    <ChapterLayout kicker="第 5 章 · 多头注意力" title="多头注意力" prev={prev} next={next}>
      <>
        <p>
          第 4 章是<b>一个</b>头。多头注意力把同一个输入<b>切成 H 份</b>,
          每份在一个 <b>d/H 维的子空间</b>里<b>各算各的</b>注意力,最后再拼回来。
          关键是搞清<b>头与头之间</b>是什么关系。
        </p>
        <h2>头与头:并行、独立、不通气</h2>
        <ul>
          <li><b>共享输入</b>:所有头读<b>同一个</b> x̂(上一章 RMSNorm 的输出)。</li>
          <li><b>各自投影</b>:头 h 有自己的 <code>W_Q^h / W_K^h / W_V^h</code>(都是 D×<b>{dh}</b>),
            把 x̂ 投到自己的小子空间,得到自己的 q/k/v。</li>
          <li><b>并行独立</b>:每个头<b>各算各的</b> <code>q·kᵀ→softmax→·V</code>,
            得到<b>各自的一张注意力模式图</b>。算的时候<b>彼此不通气</b>。
            右上图就是 H 张并排的注意力矩阵——看高亮行,<b>不同头注目的 token 不一样</b>。</li>
        </ul>
        <h2>唯一的"碰面":拼接 + W_O</h2>
        <p>
          每个头输出一个 <b>{dh} 维</b>的小向量。把 H 个头的输出<b>拼接(concat)</b>回 <b>{D} 维</b>,
          再过一个<b>输出投影 W_O</b>(D×D)——<b>这是头之间唯一一次混合</b>。
          结果就是注意力子层的 <b>Δ</b>,加回残差流(上一章)。
        </p>
        <div className="note">
          为什么要多头:每个头能在不同子空间里<b>盯不同的关系</b>(有的看相邻、有的看主谓、有的看远处指代)。
          单头只能学一种"看法";多头 = 并行学多种,再用 W_O 融合。
          注意 <b>d_head = d/H</b>:头越多、每头越窄(总参数量基本不变)。
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          接线归位:整个「多头注意力」就是上一章 <code>x ← x + 注意力(RMSNorm(x))</code> 里的那个
          <b>「注意力(·)」子层</b>;它内部其实是 H 个头并行 + 拼接 + W_O。
        </div>
      </>
      <>
        <h3>H 个头各自的注意力(并行独立)</h3>
        <FigureBoard renderSvg={renderHeads} baseCell={30} fullCell={46}
          controls={controls} onPageStep={onPageStep} />

        <h3 style={{ marginTop: 14 }}>拼接 + W_O:头之间唯一的混合点(聚焦「{tokens[f]}」)</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          每个头给出一个 {dh} 维输出,<b>相邻摆放就是拼接</b>成 {D} 维,再 <code>×W_O</code> 融合成 Δ。
          颜色对应各头,看 Δ 怎么把各头的信息混到一起。
        </p>
        <div style={{ overflowX: 'auto', paddingBottom: 8, background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
          {renderConcat(30)}
        </div>
      </>
    </ChapterLayout>
  )
}
