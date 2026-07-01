import { useState } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import Refs from '../components/Refs.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import { T } from '../components/svg/theme.js'
import { colorFor } from '../lib/figure.js'
import { useLang, useT } from '../i18n/lang.jsx'

// 预备知识用的迷你 token 矩阵(4 个 token × 2 维,方便画成箭头)
const TOK = ['the', 'cat', 'sat', 'on']
const MAT = [
  [1.5, 0.6],
  [-0.8, 1.3],
  [0.4, -1.1],
  [-1.2, -0.5],
]
const TCOL = ['#6ea8fe', '#7ee787', '#f0a35e', '#d2a8ff']

// ── 共享:2D 平面绘制 ──
function planeEls(cx, cy, unit, R) {
  const P = (vx, vy) => [cx + vx * unit, cy - vy * unit]
  const els = []
  for (let g = -R; g <= R; g++) {
    els.push(<line key={`gx${g}`} x1={cx + g * unit} y1={cy - R * unit} x2={cx + g * unit} y2={cy + R * unit}
      stroke={T.c.border} strokeWidth={g === 0 ? 1.2 : 0.5} />)
    els.push(<line key={`gy${g}`} x1={cx - R * unit} y1={cy + g * unit} x2={cx + R * unit} y2={cy + g * unit}
      stroke={T.c.border} strokeWidth={g === 0 ? 1.2 : 0.5} />)
  }
  return { P, els }
}
function arrowEl(key, x1, y1, x2, y2, color, w = 2.6) {
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const ah = 9
  return (
    <g key={key}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} />
      <path d={`M${x2},${y2} L${x2 - ah * Math.cos(ang - 0.4)},${y2 - ah * Math.sin(ang - 0.4)} L${x2 - ah * Math.cos(ang + 0.4)},${y2 - ah * Math.sin(ang + 0.4)} Z`} fill={color} />
    </g>
  )
}

export default function P1Vectors({ prev, next }) {
  const t = useT()
  const { lang } = useLang()
  const [vx, setVx] = useState(1.5)
  const [vy, setVy] = useState(1)
  const [row, setRow] = useState(1)

  // ── 图 1:一个向量 = 一串数字 = 一个箭头 ──
  const renderVec = (cell) => {
    const unit = cell * 1.5
    const R = 4
    const cx = 50 + R * unit
    const cy = 30 + R * unit
    const { P, els } = planeEls(cx, cy, unit, R)
    const [px, py] = P(vx, vy)
    els.push(arrowEl('v', cx, cy, px, py, T.c.accent, 3))
    els.push(<text key="vl" x={px + 8} y={py - 4} fontFamily={T.font} fontSize={12} fill={T.c.accent}>v</text>)
    const len = Math.hypot(vx, vy)
    const ang = (Math.atan2(vy, vx) * 180) / Math.PI
    // 坐标投影虚线
    els.push(<line key="dx" x1={px} y1={py} x2={px} y2={cy} stroke={T.c.dim} strokeWidth={1} strokeDasharray="3 3" />)
    els.push(<line key="dy" x1={px} y1={py} x2={cx} y2={py} stroke={T.c.dim} strokeWidth={1} strokeDasharray="3 3" />)
    els.push(<text key="ix" x={px} y={cy + 14} textAnchor="middle" fontFamily={T.font} fontSize={10} fill={T.c.dim}>{vx}</text>)
    els.push(<text key="iy" x={cx - 8} y={py + 4} textAnchor="end" fontFamily={T.font} fontSize={10} fill={T.c.dim}>{vy}</text>)
    // 右侧:同一个向量写成竖排数字(列向量)
    const bx = cx + R * unit + 40
    const by = 40
    els.push(<text key="ct" x={bx + 16} y={by - 8} textAnchor="middle" fontFamily={T.font} fontSize={11} fill={T.c.dim}>{t('= 一串数字', '= a list of numbers')}</text>)
    ;[vx, vy].forEach((v, i) => {
      els.push(<rect key={`cr${i}`} x={bx} y={by + i * 30} width={48} height={28} rx={4}
        fill={colorFor(v, 4)} stroke={T.c.border} />)
      els.push(<text key={`crt${i}`} x={bx + 24} y={by + i * 30 + 18} textAnchor="middle" fontFamily={T.font}
        fontSize={12} fill="#fff">{v.toFixed(1)}</text>)
      els.push(<text key={`crl${i}`} x={bx + 56} y={by + i * 30 + 18} fontFamily={T.font} fontSize={9} fill={T.c.dim}>{t('维', 'dim')}{i}</text>)
    })
    els.push(<text key="info" x={50} y={cy + R * unit + 22} fontFamily={T.font} fontSize={11} fill={T.c.accent2}>
      {t('长度', 'len')} |v| = √({vx}²+{vy}²) = {len.toFixed(2)} , {t('方向', 'angle')} = {ang.toFixed(0)}°</text>)
    const W = bx + 90
    const H = cy + R * unit + 32
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  // ── 图 2:矩阵 = 一摞向量(每行一个 token) ──
  const renderMat = (cell) => {
    const cs = cell
    const left = 46
    const top = 24
    const els = []
    // 左:n×2 数字网格
    MAT.forEach((r, i) => {
      els.push(<text key={`rl${i}`} x={left - 6} y={top + i * cs + cs * 0.62} textAnchor="end" fontFamily={T.font}
        fontSize={10} fill={i === row ? TCOL[i] : T.c.dim}>{TOK[i]}</text>)
      r.forEach((v, j) => {
        els.push(<rect key={`m${i}-${j}`} x={left + j * cs} y={top + i * cs} width={cs} height={cs}
          fill={colorFor(v, 2)} stroke={i === row ? TCOL[i] : T.c.border} strokeWidth={i === row ? 2 : 0.6} />)
        els.push(<text key={`mt${i}-${j}`} x={left + j * cs + cs / 2} y={top + i * cs + cs * 0.62} textAnchor="middle"
          fontFamily={T.font} fontSize={10} fill="#fff">{v.toFixed(1)}</text>)
      })
    })
    els.push(<text key="cl0" x={left + cs / 2} y={top - 6} textAnchor="middle" fontFamily={T.font} fontSize={9} fill={T.c.dim}>{t('维0', 'dim0')}</text>)
    els.push(<text key="cl1" x={left + cs + cs / 2} y={top - 6} textAnchor="middle" fontFamily={T.font} fontSize={9} fill={T.c.dim}>{t('维1', 'dim1')}</text>)
    els.push(<text key="mc" x={left} y={top + MAT.length * cs + 16} fontFamily={T.font} fontSize={10} fill={T.c.dim}>
      {t(`矩阵 ${MAT.length}×2:每行是一个 token 的向量`, `matrix ${MAT.length}×2: each row = one token's vector`)}</text>)
    // 右:把选中行画成箭头
    const R = 2
    const unit = cs * 1.4
    const cx = left + 2 * cs + 50 + R * unit
    const cy = top + R * unit
    const { P, els: pe } = planeEls(cx, cy, unit, R)
    els.push(...pe)
    MAT.forEach((r, i) => {
      const [px, py] = P(r[0], r[1])
      const sel = i === row
      els.push(arrowEl(`a${i}`, cx, cy, px, py, sel ? TCOL[i] : T.c.border, sel ? 3 : 1.4))
      if (sel) els.push(<text key={`at${i}`} x={px + 6} y={py - 4} fontFamily={T.font} fontSize={11} fill={TCOL[i]}>{TOK[i]}</text>)
    })
    els.push(<text key="rc" x={cx - R * unit} y={cy + R * unit + 18} fontFamily={T.font} fontSize={10} fill={T.c.dim}>
      {t('点左边的行 → 看它在平面上的箭头(每个 token 是空间里的一个点)', "click a row on the left → see its arrow on the plane (each token is a point in space)")}</text>)
    const W = cx + R * unit + 20
    const H = Math.max(top + MAT.length * cs + 26, cy + R * unit + 28)
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  const ctl1 = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 40 }}>{t('维0 x', 'dim0 x')}</span>
        <input type="range" min={-4} max={4} step={0.5} value={vx} onChange={(e) => setVx(+e.target.value)} style={{ width: 120 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{vx}</b>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 40 }}>{t('维1 y', 'dim1 y')}</span>
        <input type="range" min={-4} max={4} step={0.5} value={vy} onChange={(e) => setVy(+e.target.value)} style={{ width: 120 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{vy}</b>
      </label>
    </div>
  )
  const ctl2 = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--text-dim)' }}>{t('选 token 行', 'pick token row')}</span>
      {TOK.map((t, i) => (
        <button key={t} className="btn" onClick={() => setRow(i)}
          style={{ padding: '2px 10px', background: row === i ? TCOL[i] : 'var(--bg)',
            color: row === i ? '#0f1115' : 'var(--text-dim)', fontWeight: row === i ? 700 : 400 }}>{t}</button>
      ))}
    </div>
  )

  return (
    <ChapterLayout
      kicker={t('预备知识 · P1', 'Prerequisites · P1')}
      title={t('向量与矩阵是什么', 'What Are Vectors & Matrices')}
      prev={prev}
      next={next}
      translated
    >
      <>
        {lang === 'en' ? (
          <>
            <p>
              Every later chapter works with <b>vectors</b> and <b>matrices</b>. If these aren't second nature yet,
              this Part 0 gets you ready — once you see them as <b>geometric objects</b>, attention, projection and
              residuals all turn into pictures.
            </p>
            <h2>A vector: a list of numbers, and an arrow</h2>
            <ul>
              <li><b>Algebra view</b>: a vector is an <b>ordered list of numbers</b>, e.g. <code>[1.5, 1.0]</code>. How many numbers = the <b>dimension d</b>.</li>
              <li><b>Geometry view</b>: that list is an <b>arrow</b> in space (from the origin to that coordinate), with a <b>direction</b> and a <b>length</b>.
                Drag the sliders (top-right): the numbers and the arrow are <b>the same thing</b>, written two ways.</li>
              <li><b>In an LLM</b>: each token becomes such a vector after embedding (Ch. 2). Real ones have thousands of dimensions — you can't draw them,
                but the idea is exactly the 2-D one, just with more numbers.</li>
            </ul>
            <h2>A matrix: a stack of vectors / a grid of numbers</h2>
            <p>
              Stack several equal-length vectors and you get a <b>matrix</b> (rows × columns).
              The most common use: <b>each row is one token's vector</b>, so a sentence (n tokens, each d-dim) is an <b>n×d matrix</b>.
              Bottom figure: the left is a 4×2 grid of numbers; click a row and the right side draws that token's arrow on the plane —
              <b>a sentence = a set of points in space</b>.
            </p>
            <div className="note">
              Keep two phrasings in mind: “<b>an n×d matrix</b>” ≈ “<b>n vectors of dimension d, stacked</b>”.
              The next section covers the matrix's other role — as a <b>transform</b> (moving a vector to a new place), which is exactly what Q/K/V projections and the FFN do.
            </div>
          </>
        ) : (
          <>
            <p>
              后面所有章节都在和<b>向量</b>、<b>矩阵</b>打交道。如果这两个概念还不熟,这一节(第 0 部分)先补齐——
              一旦把它们看成<b>几何对象</b>,后面的注意力、投影、残差就都有画面了。
            </p>
            <h2>向量:一串数字,也是一个箭头</h2>
            <ul>
              <li><b>代数看法</b>:向量就是<b>一串有序的数字</b>,比如 <code>[1.5, 1.0]</code>。数字的个数叫<b>维度 d</b>。</li>
              <li><b>几何看法</b>:这串数字是空间里的一个<b>箭头</b>(从原点指向那个坐标),有<b>方向</b>和<b>长度</b>。
                右上图拖滑块,看数字和箭头是<b>同一个东西</b>的两种写法。</li>
              <li><b>在 LLM 里</b>:每个 token 经过嵌入(第 2 章)就变成这样一个向量。真实是几千维——画不出来,
                但道理和 2 维完全一样,只是数字更多。</li>
            </ul>
            <h2>矩阵:一摞向量 / 一张数字网格</h2>
            <p>
              把多个等长向量<b>摞起来</b>,就是一个<b>矩阵</b>(行数×列数)。
              最常见的用法:<b>每一行是一个 token 的向量</b>,所以一句话(n 个 token、每个 d 维)就是一个 <b>n×d 矩阵</b>。
              右下图:左边是 4×2 的数字网格,点某一行,右边就画出那个 token 在平面上的箭头——
              <b>一句话 = 空间里的一组点</b>。
            </p>
            <div className="note">
              记住两套话:「<b>n×d 矩阵</b>」≈「<b>n 个 d 维向量摞起来</b>」。
              下一节会讲矩阵的另一重身份——它还能当<b>变换</b>(把向量搬到新位置),那正是 Q/K/V 投影和 FFN 在做的事。
            </div>
          </>
        )}
        <Refs ids={['1706.03762', '2302.13971']} />
      </>
      <>
        <h3>{t('图 1 · 向量 = 数字 = 箭头', 'Fig 1 · Vector = numbers = arrow')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {t('拖动两个分量,左边箭头和右边那串数字始终是同一个向量;下方是它的长度与方向。',
            'Drag the two components; the arrow (left) and the numbers (right) are always the same vector. Its length and direction are shown below.')}
        </p>
        <FigureBoard renderSvg={renderVec} baseCell={22} fullCell={34} controls={ctl1} />

        <h3 style={{ marginTop: 18 }}>{t('图 2 · 矩阵 = 一摞 token 向量', 'Fig 2 · Matrix = a stack of token vectors')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {t('左:一句话的 n×d 矩阵(每行一个 token)。点某行 → 右边平面画出它的箭头。',
            'Left: a sentence as an n×d matrix (one token per row). Click a row → the plane on the right draws its arrow.')}
        </p>
        <FigureBoard renderSvg={renderMat} baseCell={30} fullCell={44} controls={ctl2} />
      </>
    </ChapterLayout>
  )
}
