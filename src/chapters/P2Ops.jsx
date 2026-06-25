import { useState } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Tex from '../components/Tex.jsx'
import { T } from '../components/svg/theme.js'

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
function arrow(key, x1, y1, x2, y2, color, w = 2.6) {
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const ah = 9
  return (
    <g key={key}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} />
      <path d={`M${x2},${y2} L${x2 - ah * Math.cos(ang - 0.4)},${y2 - ah * Math.sin(ang - 0.4)} L${x2 - ah * Math.cos(ang + 0.4)},${y2 - ah * Math.sin(ang + 0.4)} Z`} fill={color} />
    </g>
  )
}

const OPS = [
  { k: 'add', label: '加法 a+b', cap: '合成 / 平移 —— 沿 a 走完再沿 b 走,平行四边形对角线', llm: 'LLM:残差连接 x + 子层(x)' },
  { k: 'scale', label: '数乘 k·a', cap: '缩放 —— 只改长度(k<0 还会反向),方向所在直线不变', llm: 'LLM:学习率 / 权重缩放 / 归一化里的 ÷RMS' },
  { k: 'dot', label: '点积 a·b', cap: '投影 / 对齐程度 → 一个标量。同向为正、垂直为 0、反向为负', llm: 'LLM:注意力打分 q·k(两个 token 多相关)' },
  { k: 'matmul', label: '矩阵乘 M·a', cap: '变换 —— 整个空间被旋转+缩放,a 被搬到新位置(矩阵的列 = 基向量的新落点)', llm: 'LLM:Q/K/V 投影、FFN 升降维、输出头' },
  { k: 'hadamard', label: '逐元素 a⊙b', cap: '按轴门控 —— 第 i 维各自乘 b_i,b 像每个维度的「阀门」', llm: 'LLM:SwiGLU 的门控 gate ⊙ value' },
]

export default function P2Ops({ prev, next }) {
  const [op, setOp] = useState('add')
  const [a, setA] = useState([2, 1])
  const [b, setB] = useState([1, 2])
  const [k, setK] = useState(1.5)
  const [th, setTh] = useState(50) // 度
  const [s, setS] = useState(1.2)
  const [gates, setGates] = useState([1, 0.5, 0, 1.5]) // 门控图:每维一个阀门

  const cur = OPS.find((o) => o.k === op)

  // ── 门控直觉图:把 b 当一排「阀门」,看每维信号被放行多少 ──
  const SIG = [1.0, 1.0, 1.0, 1.0] // 各维入口信号(都设 1,让阀门效果最直观)
  const gateName = (g) => (g === 0 ? '关闭' : g < 1 ? '半开' : g === 1 ? '全开' : '放大')
  const renderGate = () => {
    const rowH = 50
    const top = 30
    const inX = 64; const inW = 70 // 信号条
    const gX = 168; const gW = 46; const gH = 36 // 阀门框
    const outX = 250; const outW = 70 // 输出条
    const W = 400
    const H = top + gates.length * rowH + 10
    const els = []
    els.push(<text key="h1" x={inX} y={18} textAnchor="middle" fontFamily={T.font} fontSize={10} fill={T.c.accent}>信号 a</text>)
    els.push(<text key="h2" x={gX + gW / 2} y={18} textAnchor="middle" fontFamily={T.font} fontSize={10} fill={T.c.accent2}>阀门 b</text>)
    els.push(<text key="h3" x={outX + outW / 2} y={18} textAnchor="middle" fontFamily={T.font} fontSize={10} fill={T.c.warn}>输出 a·b</text>)
    gates.forEach((g, i) => {
      const cyc = top + i * rowH + rowH / 2
      els.push(<text key={`dl${i}`} x={14} y={cyc + 4} fontFamily={T.font} fontSize={11} fill={T.c.dim}>维{i}</text>)
      // 入口信号条
      els.push(<rect key={`inbg${i}`} x={inX} y={cyc - 7} width={inW} height={14} rx={3} fill={T.c.bgElev} stroke={T.c.border} />)
      els.push(<rect key={`in${i}`} x={inX} y={cyc - 7} width={inW * SIG[i]} height={14} rx={3} fill={T.c.accent} opacity={0.75} />)
      // → 阀门
      els.push(<path key={`a1${i}`} d={`M${inX + inW + 4},${cyc} l10,0 m-4,-3 l4,3 l-4,3`} stroke={T.c.dim} strokeWidth={1.4} fill="none" />)
      // 阀门框 + 上下挡板(开口 = clamp(g,0,1))
      const open = Math.max(0, Math.min(1, g)) * gH
      const oT = cyc - open / 2; const oB = cyc + open / 2
      els.push(<rect key={`gf${i}`} x={gX} y={cyc - gH / 2} width={gW} height={gH} rx={3} fill="none" stroke={T.c.border} strokeWidth={1.2} />)
      els.push(<rect key={`st${i}`} x={gX} y={cyc - gH / 2} width={gW} height={Math.max(0, oT - (cyc - gH / 2))} fill={T.c.dim} opacity={0.55} />)
      els.push(<rect key={`sb${i}`} x={gX} y={oB} width={gW} height={Math.max(0, (cyc + gH / 2) - oB)} fill={T.c.dim} opacity={0.55} />)
      if (open > 0) els.push(<rect key={`op${i}`} x={gX} y={oT} width={gW} height={open} fill={T.c.accent2} opacity={0.35} />)
      els.push(<text key={`gv${i}`} x={gX + gW / 2} y={cyc + gH / 2 + 12} textAnchor="middle" fontFamily={T.font} fontSize={9} fill={T.c.accent2}>{g}({gateName(g)})</text>)
      // 阀门 → 输出
      els.push(<path key={`a2${i}`} d={`M${gX + gW + 4},${cyc} l10,0 m-4,-3 l4,3 l-4,3`} stroke={T.c.dim} strokeWidth={1.4} fill="none" />)
      // 输出条 = 信号 × 阀门
      const ov = SIG[i] * g
      els.push(<rect key={`outbg${i}`} x={outX} y={cyc - 7} width={outW} height={14} rx={3} fill={T.c.bgElev} stroke={T.c.border} />)
      els.push(<rect key={`out${i}`} x={outX} y={cyc - 7} width={Math.min(outW * 1.4, outW * ov)} height={14} rx={3} fill={T.c.warn} opacity={0.85} />)
      els.push(<text key={`ot${i}`} x={outX + outW + 8} y={cyc + 4} fontFamily={T.font} fontSize={10} fill={T.c.warn}>{ov.toFixed(2)}</text>)
    })
    return <svg width={W} height={H} style={{ display: 'block' }}>{els}</svg>
  }

  // ── 当前运算的数值公式(LaTeX,与右图同步,颜色对应箭头) ──
  const CA = '#6ea8fe'; const CB = '#7ee787'; const CR = '#f0a35e'
  const num = (v) => (Number.isInteger(v) ? `${v}` : v.toFixed(2))
  const vec = (x0, x1, color) => {
    const inner = `\\begin{bmatrix} ${num(x0)} \\\\ ${num(x1)} \\end{bmatrix}`
    return color ? `\\textcolor{${color}}{${inner}}` : inner
  }
  const tc = (c, s) => `\\textcolor{${c}}{${s}}`
  // a_i 行项:coef · a_i,带正确正负号(用于第二项拼接)
  const signTerm = (coef, aval) => {
    const op2 = coef < 0 ? '-' : '+'
    return ` ${op2} ${num(Math.abs(coef))}\\cdot${tc(CA, num(aval))}`
  }
  const formula = (() => {
    if (op === 'add') {
      const s = [a[0] + b[0], a[1] + b[1]]
      return {
        tex: `\\begin{aligned} ${tc(CA, 'a')}+${tc(CB, 'b')} &= ${vec(a[0], a[1], CA)} + ${vec(b[0], b[1], CB)} \\\\ &= \\begin{bmatrix} ${num(a[0])}\\!+\\!${num(b[0])} \\\\ ${num(a[1])}\\!+\\!${num(b[1])} \\end{bmatrix} = ${vec(s[0], s[1], CR)} \\end{aligned}`,
        note: '对应维度各自相加,结果还是个向量(平移 / 合成)',
      }
    }
    if (op === 'scale') {
      const ka = [a[0] * k, a[1] * k]
      return {
        tex: `${tc(CR, 'k\\,a')} = ${num(k)}\\cdot${vec(a[0], a[1], CA)} = ${vec(ka[0], ka[1], CR)}`,
        note: `每维同乘一个数:只改长度(${k < 0 ? 'k<0 还会反向' : '方向不变'})`,
      }
    }
    if (op === 'dot') {
      const p0 = a[0] * b[0]; const p1 = a[1] * b[1]; const d = p0 + p1
      return {
        tex: `\\begin{aligned} ${tc(CA, 'a')}\\cdot${tc(CB, 'b')} &= ${tc(CA, num(a[0]))}\\cdot${tc(CB, num(b[0]))} + ${tc(CA, num(a[1]))}\\cdot${tc(CB, num(b[1]))} \\\\ &= ${num(p0)} + ${num(p1)} = ${tc(CR, num(d))}\\ \\ (\\text{scalar}) \\end{aligned}`,
        note: '逐维相乘再相加 → 一个标量,衡量两者多对齐(注意力打分 q·k 就是它)',
      }
    }
    if (op === 'matmul') {
      const r = (th * Math.PI) / 180
      const m00 = s * Math.cos(r); const m10 = s * Math.sin(r)
      const m01 = -s * Math.sin(r); const m11 = s * Math.cos(r)
      const Ma = [m00 * a[0] + m01 * a[1], m10 * a[0] + m11 * a[1]]
      const Mmat = `\\begin{bmatrix} ${num(m00)} & ${num(m01)} \\\\ ${num(m10)} & ${num(m11)} \\end{bmatrix}`
      const CD = '#9aa3b2' // 灰:对应图里 e₀/e₁ 的落点箭头
      const col0 = tc(CD, `\\begin{bmatrix} ${num(m00)} \\\\ ${num(m10)} \\end{bmatrix}`)
      const col1 = tc(CD, `\\begin{bmatrix} ${num(m01)} \\\\ ${num(m11)} \\end{bmatrix}`)
      return {
        tex: `\\begin{aligned} ${tc(CR, 'M')}\\,${tc(CA, 'a')} &= ${Mmat}\\,${vec(a[0], a[1], CA)} = ${tc(CA, num(a[0]))}\\,\\underbrace{${col0}}_{e_0\\,\\text{落点}=\\text{列}0} + ${tc(CA, num(a[1]))}\\,\\underbrace{${col1}}_{e_1\\,\\text{落点}=\\text{列}1} \\\\ &= ${vec(Ma[0], Ma[1], CR)} \\end{aligned}`,
        note: `M 的两列 = 基向量 e₀=(1,0)、e₁=(0,1) 变换后的落点(图里两根灰箭头);M·a 就是用 a 的分量 ${num(a[0])}、${num(a[1])} 去加权这两个落点`,
      }
    }
    const h = [a[0] * b[0], a[1] * b[1]]
    return {
      tex: `${tc(CA, 'a')}\\odot${tc(CB, 'b')} = \\begin{bmatrix} ${tc(CA, num(a[0]))}\\cdot${tc(CB, num(b[0]))} \\\\ ${tc(CA, num(a[1]))}\\cdot${tc(CB, num(b[1]))} \\end{bmatrix} = ${vec(h[0], h[1], CR)}`,
      note: 'b 的每个分量是该维的「阀门」:逐维相乘、不求和 → 还是向量',
    }
  })()

  const render = (cell) => {
    const unit = cell * 1.4
    const R = 5
    const cx = 30 + R * unit
    const cy = 30 + R * unit
    const { P, els } = planeEls(cx, cy, unit, R)
    const O = [cx, cy]
    const Pa = P(a[0], a[1])

    if (op === 'add') {
      const sum = [a[0] + b[0], a[1] + b[1]]
      const Pb = P(b[0], b[1])
      const Ps = P(sum[0], sum[1])
      // 平行四边形
      els.push(<line key="p1" x1={Pa[0]} y1={Pa[1]} x2={Ps[0]} y2={Ps[1]} stroke={T.c.accent2} strokeWidth={1} strokeDasharray="3 3" />)
      els.push(<line key="p2" x1={Pb[0]} y1={Pb[1]} x2={Ps[0]} y2={Ps[1]} stroke={T.c.accent} strokeWidth={1} strokeDasharray="3 3" />)
      els.push(arrow('a', ...O, ...Pa, T.c.accent))
      els.push(arrow('b', ...O, ...Pb, T.c.accent2))
      els.push(arrow('s', ...O, ...Ps, T.c.warn, 3))
      els.push(<text key="la" x={Pa[0] + 6} y={Pa[1] - 4} fontFamily={T.font} fontSize={11} fill={T.c.accent}>a</text>)
      els.push(<text key="lb" x={Pb[0] + 6} y={Pb[1] - 4} fontFamily={T.font} fontSize={11} fill={T.c.accent2}>b</text>)
      els.push(<text key="ls" x={Ps[0] + 6} y={Ps[1] - 4} fontFamily={T.font} fontSize={11} fill={T.c.warn}>a+b = [{sum[0].toFixed(1)}, {sum[1].toFixed(1)}]</text>)
    } else if (op === 'scale') {
      const ka = [a[0] * k, a[1] * k]
      const Pk = P(ka[0], ka[1])
      // 方向直线
      els.push(<line key="ln" x1={cx - a[0] * unit * 3} y1={cy + a[1] * unit * 3} x2={cx + a[0] * unit * 3} y2={cy - a[1] * unit * 3}
        stroke={T.c.border} strokeWidth={1} strokeDasharray="2 4" />)
      els.push(arrow('ka', ...O, ...Pk, T.c.warn, 3))
      els.push(arrow('a', ...O, ...Pa, T.c.accent))
      els.push(<text key="la" x={Pa[0] + 6} y={Pa[1] - 4} fontFamily={T.font} fontSize={11} fill={T.c.accent}>a</text>)
      els.push(<text key="lk" x={Pk[0] + 6} y={Pk[1] - 4} fontFamily={T.font} fontSize={11} fill={T.c.warn}>{k}·a</text>)
    } else if (op === 'dot') {
      const Pb = P(b[0], b[1])
      const bb = b[0] * b[0] + b[1] * b[1]
      const dotv = a[0] * b[0] + a[1] * b[1]
      const t = dotv / (bb || 1)
      const foot = [b[0] * t, b[1] * t]
      const Pf = P(foot[0], foot[1])
      els.push(arrow('b', ...O, ...Pb, T.c.accent2))
      els.push(arrow('a', ...O, ...Pa, T.c.accent))
      // 投影垂线 + 投影段
      els.push(<line key="perp" x1={Pa[0]} y1={Pa[1]} x2={Pf[0]} y2={Pf[1]} stroke={T.c.dim} strokeWidth={1} strokeDasharray="3 3" />)
      els.push(<line key="proj" x1={cx} y1={cy} x2={Pf[0]} y2={Pf[1]} stroke={T.c.warn} strokeWidth={4} />)
      els.push(<text key="la" x={Pa[0] + 6} y={Pa[1] - 4} fontFamily={T.font} fontSize={11} fill={T.c.accent}>a</text>)
      els.push(<text key="lb" x={Pb[0] + 6} y={Pb[1] - 4} fontFamily={T.font} fontSize={11} fill={T.c.accent2}>b</text>)
      const cos = dotv / (Math.hypot(...a) * Math.hypot(...b) || 1)
      const ang = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
      els.push(<text key="dv" x={30} y={cy + R * unit + 20} fontFamily={T.font} fontSize={12} fill={T.c.warn}>
        a·b = {dotv.toFixed(2)}(夹角 {ang.toFixed(0)}°,{dotv > 0 ? '同向→正' : dotv < 0 ? '反向→负' : '垂直→0'})</text>)
      els.push(<text key="dv2" x={30} y={cy + R * unit + 36} fontFamily={T.font} fontSize={10} fill={T.c.dim}>
        橙色粗线 = a 投影到 b 上的长度;点积就是「a 在 b 方向上有多少」×|b|</text>)
    } else if (op === 'matmul') {
      const r = (th * Math.PI) / 180
      const c0 = [s * Math.cos(r), s * Math.sin(r)] // M 第 1 列 = e0 的落点
      const c1 = [-s * Math.sin(r), s * Math.cos(r)] // M 第 2 列 = e1 的落点
      const Ma = [c0[0] * a[0] + c1[0] * a[1], c0[1] * a[0] + c1[1] * a[1]]
      const Pm = P(Ma[0], Ma[1])
      const Pc0 = P(c0[0], c0[1])
      const Pc1 = P(c1[0], c1[1])
      // 基向量落点
      els.push(arrow('c0', ...O, ...Pc0, T.c.dim, 1.6))
      els.push(arrow('c1', ...O, ...Pc1, T.c.dim, 1.6))
      els.push(<text key="lc0" x={Pc0[0] + 4} y={Pc0[1] + 12} fontFamily={T.font} fontSize={9} fill={T.c.dim}>e₀→列0</text>)
      els.push(<text key="lc1" x={Pc1[0] + 4} y={Pc1[1] - 4} fontFamily={T.font} fontSize={9} fill={T.c.dim}>e₁→列1</text>)
      els.push(arrow('a', ...O, ...Pa, T.c.accent))
      els.push(arrow('Ma', ...O, ...Pm, T.c.warn, 3))
      els.push(<text key="la" x={Pa[0] + 6} y={Pa[1] - 4} fontFamily={T.font} fontSize={11} fill={T.c.accent}>a</text>)
      els.push(<text key="lm" x={Pm[0] + 6} y={Pm[1] - 4} fontFamily={T.font} fontSize={11} fill={T.c.warn}>M·a</text>)
      els.push(<text key="mm" x={30} y={cy + R * unit + 20} fontFamily={T.font} fontSize={10} fill={T.c.dim}>
        M = 旋转 {th}° + 缩放 {s}×。灰箭头是两个基向量被搬去的新落点 = M 的两列</text>)
    } else if (op === 'hadamard') {
      const h = [a[0] * b[0], a[1] * b[1]]
      const Ph = P(h[0], h[1])
      const Pb = P(b[0], b[1])
      // 每轴缩放:a 的分量(虚线落到坐标轴)→ h 的分量,差距 = ×b_i
      const axA = P(a[0], 0); const axH = P(h[0], 0)
      const ayA = P(0, a[1]); const ayH = P(0, h[1])
      els.push(<line key="gxa" x1={Pa[0]} y1={Pa[1]} x2={axA[0]} y2={axA[1]} stroke={T.c.accent} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />)
      els.push(<line key="gxh" x1={Ph[0]} y1={Ph[1]} x2={axH[0]} y2={axH[1]} stroke={T.c.warn} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />)
      els.push(<line key="gya" x1={Pa[0]} y1={Pa[1]} x2={ayA[0]} y2={ayA[1]} stroke={T.c.accent} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />)
      els.push(<line key="gyh" x1={Ph[0]} y1={Ph[1]} x2={ayH[0]} y2={ayH[1]} stroke={T.c.warn} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />)
      els.push(<text key="sx" x={(axA[0] + axH[0]) / 2} y={cy + 14} textAnchor="middle" fontFamily={T.font} fontSize={9} fill={T.c.accent2}>维0 ×{b[0]}</text>)
      els.push(<text key="sy" x={cx - 10} y={(ayA[1] + ayH[1]) / 2} textAnchor="end" fontFamily={T.font} fontSize={9} fill={T.c.accent2}>维1 ×{b[1]}</text>)
      els.push(arrow('b', ...O, ...Pb, T.c.accent2))
      els.push(arrow('a', ...O, ...Pa, T.c.accent))
      els.push(arrow('h', ...O, ...Ph, T.c.warn, 3))
      els.push(<text key="lb" x={Pb[0] - 6} y={Pb[1] - 4} textAnchor="end" fontFamily={T.font} fontSize={11} fill={T.c.accent2}>b(阀门)</text>)
      els.push(<text key="la" x={Pa[0] + 8} y={Pa[1] + 12} fontFamily={T.font} fontSize={11} fill={T.c.accent}>a</text>)
      els.push(<text key="lh" x={Ph[0] + 6} y={Ph[1] - 4} fontFamily={T.font} fontSize={11} fill={T.c.warn}>a⊙b</text>)
      els.push(<text key="hh" x={30} y={cy + R * unit + 20} fontFamily={T.font} fontSize={11} fill={T.c.dim}>
        b 不和 a 合成方向,而是<tspan fill={T.c.accent2}>逐维当阀门</tspan>:维0 ×{b[0]}、维1 ×{b[1]}(虚线看每轴被拉伸多少)</text>)
    }

    // 顶部说明
    els.push(<text key="cap" x={30} y={16} fontFamily={T.font} fontSize={11} fill={T.c.accent}>{cur.cap}</text>)
    const W = cx + R * unit + 130
    const H = cy + R * unit + 46
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  const slider = (label, val, set, min, max, st, col) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: 'var(--text-dim)', width: 48 }}>{label}</span>
      <input type="range" min={min} max={max} step={st} value={val} onChange={(e) => set(+e.target.value)} style={{ width: 110 }} />
      <b style={{ fontFamily: 'var(--mono)', color: col || 'var(--accent)', width: 30 }}>{val}</b>
    </label>
  )

  const needsB = op === 'add' || op === 'dot' || op === 'hadamard'
  const controls = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {OPS.map((o) => (
          <button key={o.k} className="btn" onClick={() => setOp(o.k)}
            style={{ padding: '2px 9px', fontSize: 11, background: op === o.k ? 'var(--accent)' : 'var(--bg)',
              color: op === o.k ? '#0f1115' : 'var(--text-dim)', fontWeight: op === o.k ? 700 : 400 }}>{o.label}</button>
        ))}
      </div>
      {slider('a.x', a[0], (v) => setA([v, a[1]]), -4, 4, 0.5)}
      {slider('a.y', a[1], (v) => setA([a[0], v]), -4, 4, 0.5)}
      {needsB && slider('b.x', b[0], (v) => setB([v, b[1]]), -4, 4, 0.5, 'var(--accent2)')}
      {needsB && slider('b.y', b[1], (v) => setB([b[0], v]), -4, 4, 0.5, 'var(--accent2)')}
      {op === 'scale' && slider('k', k, setK, -2, 3, 0.1, 'var(--warn)')}
      {op === 'matmul' && slider('旋转°', th, setTh, -180, 180, 5, 'var(--warn)')}
      {op === 'matmul' && slider('缩放', s, setS, 0.2, 2, 0.1, 'var(--warn)')}
    </div>
  )

  return (
    <ChapterLayout kicker="预备知识 · P2" title="五种核心运算的几何意义" prev={prev} next={next}>
      <>
        <p>
          上一节把向量看成<b>箭头</b>。这一节把后面会反复出现的<b>五种运算</b>一次性讲透——
          关键不是怎么算,而是<b>几何上它在做什么</b>。这也正好接上你之前问的「向量相乘和相加的区别」。
        </p>
        <table className="ver-table">
          <thead><tr><th>运算</th><th>几何动作</th><th>结果</th><th>LLM 里在哪</th></tr></thead>
          <tbody>
            <tr><td><b>加法</b> a+b</td><td>平移 / 合成(平行四边形)</td><td>向量</td><td>残差连接</td></tr>
            <tr><td><b>数乘</b> k·a</td><td>缩放(只改长度/反向)</td><td>向量</td><td>归一化 ÷RMS</td></tr>
            <tr><td><b>点积</b> a·b</td><td>投影 / 看多对齐</td><td><b>标量</b></td><td>注意力打分 q·k</td></tr>
            <tr><td><b>矩阵乘</b> M·a</td><td>旋转+缩放,搬到新位置</td><td>向量</td><td>Q/K/V 投影、FFN</td></tr>
            <tr><td><b>逐元素乘</b> a⊙b</td><td>按轴门控(逐维阀门)</td><td>向量</td><td>SwiGLU 门控</td></tr>
          </tbody>
        </table>
        <h2>三个最容易混的点</h2>
        <ul>
          <li><b>加法 vs 矩阵乘</b>:加法只是<b>平移</b>(把箭头挪一下);矩阵乘会<b>重塑整个空间</b>(旋转+缩放),
            是质变。残差用加法(温和地累加修正),投影用矩阵乘(换一个表示空间)。</li>
          <li><b>点积 vs 逐元素乘</b>:都"相乘",但点积把对应维度乘完<b>加起来 → 一个标量</b>(衡量对齐);
            逐元素乘<b>不求和 → 还是向量</b>(每维各自缩放)。注意力打分要标量,所以用点积;门控要逐维开关,所以用逐元素乘。</li>
          <li><b>矩阵乘的列</b>:M·a 的本质是「a 的每个分量,决定各个<b>基向量新落点</b>的加权和」。
            右图灰箭头就是基向量被搬去哪——看懂这个,投影矩阵就不神秘了。</li>
        </ul>
        <div className="note">
          切换右边的运算、拖动 a/b,看同样两个向量在不同运算下去了哪里。
          这五个动作几乎拼出了整个 Transformer:<b>投影(矩阵乘)→ 打分(点积)→ 汇总(加权=数乘+加法)→ 残差(加法)→ 门控(逐元素乘)</b>。
        </div>
      </>
      <>
        <h3>五种运算 · 同两个向量,不同去向</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          蓝=a,绿=b,橙=运算结果。切换运算按钮,拖滑块实时看几何变化。
        </p>
        <FigureBoard renderSvg={render} baseCell={22} fullCell={34} controls={controls} />
        <div style={{ marginTop: 10, background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>数值公式(随滑块实时变,对照右图箭头)</div>
          <div style={{ fontSize: 16, overflowX: 'auto' }}><Tex block>{formula.tex}</Tex></div>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 6 }}>{formula.note}</div>
        </div>

        {op === 'hadamard' && (
          <div style={{ marginTop: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>🚰 门控直觉:把 <b style={{ color: 'var(--accent2)' }}>b</b> 当一排「阀门」</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
              每一维是一根独立的水管,信号 a 从左流入,阀门 b 决定<b>放行多少</b>:
              关(×0)断流、半开(×0.5)减半、全开(×1)原样、放大(×1.5)加压。拖下面的阀门试试。
            </div>
            <div style={{ overflowX: 'auto' }}>{renderGate()}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
              {gates.map((g, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-dim)' }}>维{i}阀门</span>
                  <input type="range" min={0} max={2} step={0.25} value={g}
                    onChange={(e) => setGates(gates.map((x, j) => (j === i ? +e.target.value : x)))} style={{ width: 80 }} />
                  <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent2)', width: 28 }}>{g}</b>
                </label>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
              这就是 SwiGLU 里的门控:一条支路算出「内容值」,另一条算出「每维该开多大的阀门」,两者逐元素相乘 —— 模型借此<b>动态决定每个特征放行多少</b>。
            </div>
          </div>
        )}

        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>{cur.cap} &nbsp;·&nbsp; <b style={{ color: 'var(--accent2)' }}>{cur.llm}</b></p>
      </>
    </ChapterLayout>
  )
}
