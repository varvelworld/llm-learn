import { useState, useMemo } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Tex from '../components/Tex.jsx'
import Refs from '../components/Refs.jsx'
import { T } from '../components/svg/theme.js'
import { seededMatrix } from '../lib/synth.js'
import { expectedAccept, speedup, parallelDraft } from '../lib/specdec.js'

// 图②:两个互斥「句意模式」(逐位都不同,混着取就串味)
const MODE_A = ['of', 'course', 'I', 'can', 'solve', 'this', 'for', 'you']
const MODE_B = ['no', 'problem', 'we', 'will', 'handle', 'that', 'right', 'now']
const C_PAR = 0.5 // 并行:块内独立 → 多峰碰撞,连贯概率 ~0.5
const C_SAR = 0.85 // 半自回归:建模块内依赖 → 连贯概率更高
const SEED = 8 // 让并行抽样在第 2 个 token 串味:'of'(A)+'problem'(B)="of problem" ✗

// 图①:无损 = 接受(重叠)+ 补采(残差)重建 p_t
const LVOCAB = ['A', 'B', 'C', 'D'] // 4 个候选字
const LP_T = [0.4, 0.3, 0.2, 0.1] // 大模型分布(固定)
const LOTHER = [0.1, 0.2, 0.3, 0.4] // 草稿跑偏时趋向它

// 图②:半自回归两阶段架构(锚点+mask → 并行骨架 → 串行头)
const ATOK = ['E', 'F', 'G', 'H'] // γ=4 个草稿位置

export default function Ch19DSpark({ prev, next }) {
  const [lossDelta, setLossDelta] = useState(35) // 图① 草稿偏离 %
  const [archStep, setArchStep] = useState(2) // 图② 串行头已采样到第几位
  const [L, setL] = useState(8) // 图③ 块长

  const lo = useMemo(() => {
    const dl = lossDelta / 100
    const pd = LP_T.map((v, i) => (1 - dl) * v + dl * LOTHER[i])
    const acc = LP_T.reduce((s, pt, i) => s + Math.min(pt, pd[i]), 0) // 接受率 = Σmin
    return { pd, acc }
  }, [lossDelta])

  const d = useMemo(() => {
    const row = seededMatrix(1, 8, SEED)[0]
    const par = parallelDraft(row, L)
    return { par, ePar: expectedAccept(C_PAR, L), eSar: expectedAccept(C_SAR, L), spPar: speedup(C_PAR, L), spSar: speedup(C_SAR, L) }
  }, [L])

  // —— 图①:无损 = 把 100% 概率质量摊平,拒回的量 = 补采的量 —— //
  const renderLossless = (cell) => {
    const cs = cell
    const acc = lo.acc // 接受率 = Σmin
    const lx = 70
    const top = 36
    const barH = Math.max(cs * 1.0, 28)
    const gap = Math.max(cs * 1.9, 54)
    const Wbar = Math.max(300, cs * 10)
    const x0 = lx
    const accW = acc * Wbar
    const remW = Wbar - accW
    const y1 = top
    const y2 = top + barH + gap
    const els = []
    els.push(<defs key="d"><marker id="lah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill={T.c.warn} /></marker></defs>)
    const seg = (key, x, y, w, fill, op, label, pct, tc) => {
      els.push(<rect key={`r${key}`} x={x} y={y} width={w} height={barH} fill={fill} opacity={op} stroke={T.c.border} strokeWidth={0.6} />)
      if (w >= 34) {
        els.push(<text key={`l${key}`} x={x + w / 2} y={y + barH / 2 - 1} textAnchor="middle" fontFamily={T.font} fontSize={10} fill={tc}>{label}</text>)
        els.push(<text key={`p${key}`} x={x + w / 2} y={y + barH / 2 + 11} textAnchor="middle" fontFamily={T.font} fontSize={9} fill={tc}>{pct}</text>)
      } else {
        els.push(<text key={`p${key}`} x={x + w / 2} y={y - 3} textAnchor="middle" fontFamily={T.font} fontSize={8.5} fill={fill === T.c.dim ? T.c.dim : T.c.accent2}>{label} {pct}</text>)
      }
    }
    const accPct = `${Math.round(acc * 100)}%`
    const remPct = `${Math.round((1 - acc) * 100)}%`
    els.push(<text key="ttl" x={lx - 8} y={y1 - 16} fontFamily={T.font} fontSize={9.5} fill={T.c.dim}>
      <tspan fill={T.c.accent2}>接受 accept</tspan> · <tspan fill={T.c.dim}>拒绝 reject</tspan> · <tspan fill={T.c.accent2}>补采 resample(重采一个字)</tspan></text>)
    // 草稿 p_d:接受(绿)+ 拒绝(灰)
    els.push(<text key="ld" x={lx - 8} y={y1 + barH / 2 + 4} textAnchor="end" fontFamily={T.font} fontSize={10.5} fill={T.c.dim}>草稿 p_d</text>)
    seg('da', x0, y1, accW, T.c.accent2, 0.85, '接受', accPct, '#0b1410')
    seg('dr', x0 + accW, y1, remW, T.c.dim, 0.5, '拒绝', remPct, T.c.text)
    // 大模型 p_t:接受(绿)+ 补采(浅绿)
    els.push(<text key="lt" x={lx - 8} y={y2 + barH / 2 + 4} textAnchor="end" fontFamily={T.font} fontSize={10.5} fill={T.c.accent2}>大模型 p_t</text>)
    seg('ta', x0, y2, accW, T.c.accent2, 0.85, '接受', accPct, '#0b1410')
    seg('tr', x0 + accW, y2, remW, T.c.accent2, 0.32, '补采', remPct, T.c.accent2)
    // 接受/剩余 的分界对齐虚线
    els.push(<line key="div" x1={x0 + accW} y1={y1 - 6} x2={x0 + accW} y2={y2 + barH + 6} stroke={T.c.border} strokeWidth={1} strokeDasharray="3 3" />)
    // 箭头:拒回的质量 → 等量补采
    const gx = x0 + accW + remW / 2
    els.push(<line key="arr" x1={gx} y1={y1 + barH + 3} x2={gx} y2={y2 - 3} stroke={T.c.warn} strokeWidth={1.5} markerEnd="url(#lah)" />)
    els.push(<text key="arrl" x={x0 + accW - 8} y={(y1 + barH + y2) / 2 + 3} textAnchor="end" fontFamily={T.font} fontSize={9.5} fill={T.c.warn}>拒绝量 = 补采量</text>)
    // 0/100 刻度
    els.push(<text key="z0" x={x0} y={y2 + barH + 16} fontFamily={T.font} fontSize={8.5} fill={T.c.dim}>0%</text>)
    els.push(<text key="z1" x={x0 + Wbar} y={y2 + barH + 16} textAnchor="end" fontFamily={T.font} fontSize={8.5} fill={T.c.dim}>100%</text>)
    const W = x0 + Wbar + 16
    const H = y2 + barH + 22
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  // —— 图①:半自回归两阶段架构 —— //
  const renderArch = (cell) => {
    const cs = cell
    const G = ATOK.length
    const colW = Math.max(cs * 2.6, 84)
    const lx = 14
    const bh = cs * 0.9
    const nw = colW * 0.66 // U / token 节点宽(居中,留出横向箭头空隙)
    const iw = colW * 0.84 // 输入节点宽
    const els = []
    const cx = (i) => lx + i * colW + colW / 2 // 列中心
    const box = (key, cxc, y, w, txt, fill, stroke, tc, fs = 11, bold) =>
      els.push(
        <rect key={`r${key}`} x={cxc - w / 2} y={y} width={w} height={bh} rx={5} fill={fill} stroke={stroke} strokeWidth={1.2} />,
        <text key={`t${key}`} x={cxc} y={y + bh / 2 + 4} textAnchor="middle" fontFamily={T.font} fontSize={fs} fontWeight={bold ? 700 : 400} fill={tc}>{txt}</text>,
      )
    const vArrow = (x, y1, y2, col = T.c.dim) =>
      els.push(<line key={`va${x}-${y1}`} x1={x} y1={y1} x2={x} y2={y2 - 4} stroke={col} strokeWidth={1.3} markerEnd="url(#ah)" />)
    const y0 = 26, y1 = y0 + bh + 30, y2 = y1 + bh + 26, y3 = y2 + bh + 42
    const right = lx + G * colW
    const W = right + 150
    els.push(
      <defs key="defs">
        <marker id="ah" markerWidth="7" markerHeight="7" refX="5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill={T.c.dim} /></marker>
        <marker id="ah2" markerWidth="7" markerHeight="7" refX="5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill={T.c.accent2} /></marker>
      </defs>,
    )
    els.push(<text key="il" x={lx} y={y0 - 8} fontFamily={T.font} fontSize={9.5} fill={T.c.dim}>输入:大模型给的锚点 + (γ−1) 个 mask</text>)
    for (let i = 0; i < G; i++) {
      const anchor = i === 0
      box(`in${i}`, cx(i), y0, iw, anchor ? 'D(锚点)' : 'mask', anchor ? 'rgba(110,168,254,0.2)' : T.c.bgElev, anchor ? T.c.accent : T.c.border, anchor ? T.c.accent : T.c.dim, 10)
      vArrow(cx(i), y0 + bh, y1)
    }
    els.push(<rect key="bb" x={lx} y={y1} width={G * colW - 6} height={bh} rx={7} fill="rgba(110,168,254,0.16)" stroke={T.c.accent} strokeWidth={1.6} />)
    els.push(<text key="bbt" x={lx + (G * colW - 6) / 2} y={y1 + bh / 2 + 4} textAnchor="middle" fontFamily={T.font} fontSize={12} fontWeight={700} fill={T.c.accent}>并行骨架(重)· 一次前向,所有位置同时算</text>)
    els.push(<text key="bbn" x={right + 6} y={y1 + bh / 2 + 4} fontFamily={T.font} fontSize={9.5} fill={T.c.accent}>T_draft≈1 次<tspan x={right + 6} dy={12}>(与块长无关→快)</tspan></text>)
    for (let i = 0; i < G; i++) vArrow(cx(i), y1 + bh, y2)
    for (let i = 0; i < G; i++) box(`u${i}`, cx(i), y2, nw, `U${i + 1}`, T.c.bgElev, T.c.border, T.c.text, 11, true)
    els.push(<text key="ul" x={right + 6} y={y2 + bh / 2 + 4} fontFamily={T.font} fontSize={9.5} fill={T.c.dim}>基础分:同时产出<tspan x={right + 6} dy={12}>但各位置独立→会碰撞</tspan></text>)
    els.push(<text key="sl" x={lx} y={y3 - 12} fontFamily={T.font} fontSize={9.5} fill={T.c.accent2}>串行头(轻)· 左→右 · 每步 Uₖ + Bₖ(前一字) 再采样</text>)
    const ymid = y3 + bh / 2
    for (let i = 0; i < G; i++) {
      const done = i < archStep
      vArrow(cx(i), y2 + bh, y3, done ? T.c.accent2 : T.c.border)
      if (i > 0) {
        const on = i < archStep
        const xa = cx(i - 1) + nw / 2 + 2
        const xb = cx(i) - nw / 2
        els.push(<line key={`dep${i}`} x1={xa} y1={ymid} x2={xb - 2} y2={ymid} stroke={on ? T.c.accent2 : T.c.border} strokeWidth={on ? 1.6 : 1} strokeDasharray={on ? '' : '3 3'} markerEnd={on ? 'url(#ah2)' : ''} />)
        els.push(<text key={`bk${i}`} x={(xa + xb) / 2} y={ymid - 5} textAnchor="middle" fontFamily={T.font} fontSize={8.5} fill={on ? T.c.accent2 : T.c.dim}>+B{i + 1}</text>)
      }
      box(`tk${i}`, cx(i), y3, nw, done ? ATOK[i] : '?', done ? 'rgba(126,231,135,0.22)' : T.c.bgElev, done ? T.c.accent2 : T.c.border, done ? T.c.accent2 : T.c.dim, 12, done)
    }
    els.push(<text key="snote" x={right + 6} y={ymid} fontFamily={T.font} fontSize={9.5} fill={T.c.accent2}>只注入依赖<tspan x={right + 6} dy={12}>极轻→连贯(τ↑)</tspan></text>)
    els.push(<text key="out" x={lx} y={y3 + bh + 18} fontFamily={T.font} fontSize={9.5} fill={T.c.dim}>↓ 得到草稿块(再各配一个置信度 cₖ,见后两章)</text>)
    const H = y3 + bh + 28
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  // —— 图②:并行串味 vs 半自回归连贯 —— //
  const renderBlock = (cell) => {
    const cs = cell
    const tw = Math.max(cs * 2.0, 58)
    const lx = 66
    const top = 22
    const rowH = cs * 1.06
    const els = []
    const tokCell = (key, x, y, txt, fill, stroke, txtColor, mark) => {
      els.push(<rect key={`r${key}`} x={x} y={y} width={tw - 4} height={rowH - 6} rx={4} fill={fill} stroke={stroke} strokeWidth={1} />)
      els.push(<text key={`t${key}`} x={x + (tw - 4) / 2} y={y + (rowH - 6) / 2 + 3.5} textAnchor="middle" fontFamily={T.font} fontSize={10.5} fill={txtColor}>{txt}</text>)
      if (mark) els.push(<text key={`m${key}`} x={x + tw - 10} y={y + 11} textAnchor="middle" fontFamily={T.font} fontSize={10} fill={T.c.hot}>{mark}</text>)
    }
    const refRow = (ri, label, toks) => {
      const y = top + ri * rowH
      els.push(<text key={`l${ri}`} x={lx - 8} y={y + rowH / 2 + 2} textAnchor="end" fontFamily={T.font} fontSize={10} fill={T.c.dim}>{label}</text>)
      for (let i = 0; i < L; i++) tokCell(`${ri}-${i}`, lx + i * tw, y, toks[i], T.c.bgElev, T.c.border, T.c.dim)
    }
    refRow(0, '句意 A', MODE_A)
    refRow(1, '句意 B', MODE_B)
    {
      const ri = 2, y = top + ri * rowH
      els.push(<text key={`l${ri}`} x={lx - 8} y={y + rowH / 2 + 2} textAnchor="end" fontFamily={T.font} fontSize={10} fill={T.c.accent}>并行</text>)
      for (let i = 0; i < L; i++) {
        const tok = d.par.picks[i] ? MODE_B[i] : MODE_A[i]
        const accepted = i < d.par.acceptedLen
        const collide = i === d.par.firstCollision
        const fill = accepted ? 'rgba(126,231,135,0.22)' : collide ? 'rgba(240,107,107,0.22)' : T.c.bgElev
        const stroke = accepted ? T.c.accent2 : collide ? T.c.hot : T.c.border
        const tc = accepted ? T.c.accent2 : collide ? T.c.hot : T.c.dim
        tokCell(`${ri}-${i}`, lx + i * tw, y, tok, fill, stroke, tc, collide ? '✗' : null)
      }
    }
    {
      const ri = 3, y = top + ri * rowH, mode = d.par.mode0
      els.push(<text key={`l${ri}`} x={lx - 8} y={y + rowH / 2 + 2} textAnchor="end" fontFamily={T.font} fontSize={10} fill={T.c.accent2}>DSpark</text>)
      for (let i = 0; i < L; i++) tokCell(`${ri}-${i}`, lx + i * tw, y, mode ? MODE_B[i] : MODE_A[i], 'rgba(126,231,135,0.22)', T.c.accent2, T.c.accent2)
    }
    const yc = top + 4 * rowH + 6
    els.push(<text key="cap1" x={lx} y={yc} fontFamily={T.font} fontSize={10} fill={T.c.dim}>
      并行各位置<tspan fill={T.c.accent}>独立</tspan>采样 → 第 {d.par.firstCollision + 1} 个 <tspan fill={T.c.hot}>串到另一句意(✗)</tspan>,其后整段被拒(灰)。</text>)
    els.push(<text key="cap2" x={lx} y={yc + 15} fontFamily={T.font} fontSize={10} fill={T.c.dim}>
      DSpark <tspan fill={T.c.accent2}>半自回归</tspan>:每字以前一个为条件 → 块内连贯,几乎全被接受。</text>)
    const by = yc + 36
    const barL = lx + 92
    const barMax = Math.max(120, cs * 5)
    const eMax = Math.max(d.eSar, 1)
    const drawBar = (bi, label, e, sp, col) => {
      const y = by + bi * 26
      els.push(<text key={`bl${bi}`} x={lx} y={y + 12} fontFamily={T.font} fontSize={10.5} fill={col}>{label}</text>)
      els.push(<rect key={`bt${bi}`} x={barL} y={y} width={barMax} height={15} rx={3} fill={T.c.bgElev} stroke={T.c.border} strokeWidth={0.5} />)
      els.push(<rect key={`bf${bi}`} x={barL} y={y} width={Math.max(2, (e / eMax) * barMax)} height={15} rx={3} fill={col} opacity={0.8} />)
      els.push(<text key={`bv${bi}`} x={barL + barMax + 8} y={y + 12} fontFamily={T.font} fontSize={10} fill={T.c.text}>τ≈{e.toFixed(2)} → 加速 {sp.toFixed(1)}×</text>)
    }
    els.push(<text key="bt" x={lx} y={by - 6} fontFamily={T.font} fontSize={9.5} fill={T.c.dim}>每次大模型验证 · 期望接受 τ / 加速比</text>)
    drawBar(0, '并行', d.ePar, d.spPar, T.c.accent)
    drawBar(1, 'DSpark', d.eSar, d.spSar, T.c.accent2)
    const W = Math.max(lx + L * tw + 10, barL + barMax + 130)
    const H = by + 2 * 26 + 8
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  const lossControls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 110 }}>草稿偏离 p_t</span>
      <input type="range" min={0} max={100} step={1} value={lossDelta} onChange={(e) => setLossDelta(+e.target.value)} style={{ width: 140 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{lossDelta}%</b>
    </label>
  )
  const archControls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 130 }}>串行头采样进度</span>
      <input type="range" min={0} max={ATOK.length} step={1} value={archStep} onChange={(e) => setArchStep(+e.target.value)} style={{ width: 130 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{archStep}/{ATOK.length}</b>
      <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{archStep === 0 ? '(并行已出基础分,串行未开始)' : archStep === ATOK.length ? '(整块起草完成)' : ''}</span>
    </label>
  )
  const blockControls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 110 }}>块长 L(一次起草几个)</span>
      <input type="range" min={2} max={8} step={1} value={L} onChange={(e) => setL(+e.target.value)} style={{ width: 140 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{L}</b>
    </label>
  )

  const losslessTex = `\\min\\!\\Big(1,\\ \\frac{\\textcolor{#7ee787}{p_t}(x)}{\\textcolor{#6ea8fe}{p_d}(x)}\\Big)
\\qquad
x \\sim \\frac{(\\textcolor{#7ee787}{p_t}-\\textcolor{#6ea8fe}{p_d})_{+}}{\\sum_x (\\textcolor{#7ee787}{p_t}-\\textcolor{#6ea8fe}{p_d})_{+}}
\\qquad\\Longrightarrow\\qquad x \\sim \\textcolor{#7ee787}{p_t}`
  const latencyTex = `L=\\frac{\\textcolor{#6ea8fe}{T_{\\text{draft}}}+\\textcolor{#f0a35e}{T_{\\text{verify}}}}{\\textcolor{#7ee787}{\\tau}}`
  const biasTex = `p_k(x_k\\mid x_0,x_{<k})=\\mathrm{softmax}\\big(\\textcolor{#6ea8fe}{U_k}+\\textcolor{#7ee787}{B_k(x_{<k})}\\big)`

  return (
    <ChapterLayout kicker="第二部分 · DeepSeek-V4 · Ch19" title="DSpark(一)· 投机解码与半自回归" prev={prev} next={next}>
      <>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          DSpark 是 DeepSeek-V4 的<b>投机解码框架</b>,用三招提速。这是<b>第一章</b>:先讲投机解码的基础与第一招
          <b>半自回归</b>;后面两章接着讲<b>置信度打分</b>与<b>动态调度</b>。
        </p>
        <h2>投机解码:老板 + 实习生</h2>
        <p>
          大模型生成慢在<b>一次只蹦一个字</b>,每个字都要把整个模型从头算一遍。
          <b>投机解码</b>打个比方:一个<b>老板</b>(大模型,聪明但慢)配一个<b>实习生</b>(drafter,一般但快)。
          实习生先<b>飞快起草一串词</b>,老板<b>一眼扫完整串</b>:开头对的<b>照单全收</b>、碰到第一个错的就接手写对。
          这样老板一次能敲定<b>一整串</b>字,于是快了好几倍。
        </p>
        <p>
          最妙的是<b>无损</b>:每字都经老板把关(下式的<b>拒绝采样</b>规则),最终输出<b>和大模型逐字写出来的一字不差</b>。
          下式与论文记号一致——<Tex>{'p_t'}</Tex> = <b>大模型(target)分布</b>、<Tex>{'p_d'}</Tex> = <b>草稿(draft)分布</b>:
        </p>
        <div style={{ fontSize: 14, overflowX: 'auto', margin: '6px 0' }}><Tex block>{losslessTex}</Tex></div>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '2px 0' }}>
          三式从左到右:<b>接受概率(accept prob)</b>、<b>被拒后的补采分布(resample)</b>、<b>最终输出</b>(严格服从 <Tex>{'p_t'}</Tex>)。
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0' }}>
          <b>怎么读这条规则</b>:草稿先按自己的分布 <Tex>{'p_d'}</Tex> 采了个字 <Tex>{'x'}</Tex>。
        </p>
        <ul style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 0 }}>
          <li>若大模型对 <Tex>{'x'}</Tex> 的概率<b>不低于</b>草稿(<Tex>{'p_t\\ge p_d'}</Tex>)→ 比值 ≥1 → <b>直接接受(accept)</b>(老板也至少这么想要它)。</li>
          <li>若大模型概率<b>更低</b>(草稿过度偏爱)→ 只以 <Tex>{'p_t/p_d'}</Tex> 的概率接受,<b>其余情况拒绝(reject)退回</b>。</li>
          <li>一旦退回,这个位置<b>总得吐一个字</b>(不能空着),但不能再用草稿(会把偏差带回来)。
            于是<b>改从「大模型想要、但草稿给少了」的字里、按缺口大小重新采一个</b>——这一步叫
            <b>补采(resample)</b>,采样分布就是残差 <Tex>{'(p_t-p_d)_{+}'}</Tex>(归一化)。</li>
        </ul>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0' }}>
          一句话:草稿在某些字上<b>给多了</b>(按比例拒绝),就把这部分概率<b>挪去补</b>那些<b>给少了</b>的字(补采)。
          一多一少正好抵消——图①里那根橙箭头(<b style={{ color: 'var(--warn)' }}>拒绝量 → 补采量</b>)画的就是这个「挪」。
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '2px 0' }}>
          可以证明:这样产出的字,分布<b>严格等于</b>直接从大模型采样——所以<b>无损</b>(<b>图①</b>把这条规则画了出来:接受+补采正好重建 p_t)。
          (接受概率见 DSpark 论文 §2.1;补采那步与无损证明来自投机采样:Leviathan 2023 / Chen 2023。)
        </p>
        <p>
          那提速由什么决定?把「每个字的平均耗时」拆开,就是 DSpark 的<b>总纲</b>(论文公式 1):一轮<b>草稿</b>花
          <Tex>{'T_{\\text{draft}}'}</Tex>、<b>验证</b>花 <Tex>{'T_{\\text{verify}}'}</Tex>,这一轮敲定 <Tex>{'\\tau'}</Tex> 个字(<b>接受长度 accept length</b>):
        </p>
        <div style={{ fontSize: 14, overflowX: 'auto', margin: '6px 0' }}><Tex block>{latencyTex}</Tex></div>
        <p>
          想更快只有<b>三条杠杆</b>:<b style={{ color: 'var(--accent)' }}>① 起草快(↓T_draft)</b>、
          <b style={{ color: 'var(--accent-2)' }}>② 接受多(↑τ)</b>、<b style={{ color: 'var(--warn)' }}>③ 验证省(↓T_verify)</b>。
          DSpark 三招正好各管一条;<b>本章的半自回归一举管住前两条</b>,第③条留给后两章。
        </p>

        <h2>半自回归 —— 管 ① T_draft 和 ② τ</h2>
        <p>实习生起草有两种方式,各有短板:</p>
        <ul>
          <li><b>自回归</b>:写每字都看着<b>刚写的上一个字</b>,连贯、<b style={{ color: 'var(--accent-2)' }}>τ 高</b>——
            但 <b style={{ color: 'var(--accent)' }}>T_draft ∝ 块长</b>(起草越多越慢),只能起草很短的块。</li>
          <li><b>并行</b>:所有位置<b>同时各写各的</b>,<b style={{ color: 'var(--accent)' }}>T_draft≈一次前向</b>(飞快)——
            但互相不看,<b style={{ color: 'var(--accent-2)' }}>τ 低</b>:回应既可「<b>of course</b>」也可「<b>no problem</b>」,
            位置 1 挑 <b>of</b>、位置 2 挑 <b>problem</b>,拼成 <b style={{ color: 'var(--warn)' }}>“of problem”</b> ✗(<b>多峰碰撞</b>),越往后越易串味(图③)。</li>
        </ul>
        <p>
          <b>DSpark 的半自回归</b>(架构见<b>图②</b>):用<b>并行骨架</b>一次前向出每个位置的<b>基础分</b> <Tex>{'U_k'}</Tex>(保住 T_draft 快),
          再挂一个<b>轻量串行头</b>给每个位置加一个<b>转移偏置</b> <Tex>{'B_k'}</Tex>——它<b>左→右</b>看着已采样的前文:
          采了「of」就给「course」<b>加分</b>、给「problem」<b>减分</b>,于是块内连贯、<b>τ 抬高</b>。
        </p>
        <div style={{ fontSize: 13.5, overflowX: 'auto', margin: '6px 0' }}><Tex block>{biasTex}</Tex></div>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '2px 0' }}>
          <Tex>{'B_k'}</Tex> 的轻量实现:<b>Markov 头</b>(只看前一个字,低秩 <Tex>{'W_1W_2,\\ r{=}256'}</Tex>)或 <b>RNN 头</b>(带块内记忆)。
        </p>
        <div className="note">
          下一章(<b>置信度打分</b>):怎么不跑大模型就提前估出每个草稿字「能过审的概率」;
          再下一章(<b>动态调度</b>):用这个概率按系统负载决定验证几个,压住第③条杠杆 T_verify。
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          <b>诚实简化</b>:图① 用 toy 分布演示重建(真实 <Tex>{'p_t,p_d'}</Tex> 是模型逐位算出的);
          图② 是架构示意(略去 KV 注入、mask 细节);图③ 把「连贯概率」抽象成单个 <Tex>{'c'}</Tex>
          (并行≈0.5、半自回归更高),其「加速比=τ+1」只演示杠杆②(假设 <Tex>{'T_{\\text{draft}},T_{\\text{verify}}'}</Tex> 都很小)。
        </div>
        <Refs
          ids={['2211.17192', '2302.01318', '1711.02281', '2401.10774', '2401.15077', '2606.19348']}
          extra={[
            { label: 'DeepSeek 2026 · DSpark 论文(Confidence-Scheduled Speculative Decoding with Semi-Autoregressive Generation)', url: 'https://github.com/deepseek-ai/DeepSpec/blob/main/DSpark_paper.pdf' },
            { label: 'deepseek-ai/DeepSpec · 开源代码库(DSpark / DFlash / Eagle3)', url: 'https://github.com/deepseek-ai/DeepSpec' },
          ]}
        />
      </>
      <>
        <h3>图① 无损:拒绝多少 = 补采多少 → 重建 p_t</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          把草稿 <b>p_d</b>、大模型 <b>p_t</b> 各自的 <b>100% 概率质量</b>摊成一条横条对比:左边
          <b style={{ color: 'var(--accent-2)' }}>绿色「接受 accept」</b>两条一样宽(=两分布重叠、直接照收的部分);
          右边那一截——草稿这条是多提议、要<b>「拒绝 reject」(灰)</b>掉的,大模型那条是缺、要
          <b style={{ color: 'var(--accent-2)' }}>「补采 resample」(浅绿)</b>的,而它俩<b>一样宽</b>。
          所以<b>丢掉多少就补回多少</b>,最终分布精确等于 p_t——这就是无损。拖滑块:草稿越偏,绿色越窄、灰/浅绿越宽,但<b>永远等量</b>。
        </p>
        <FigureBoard renderSvg={renderLossless} baseCell={28} fullCell={38} controls={lossControls} />
        <div style={{ marginTop: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: 'var(--text-dim)' }}>
          当前偏离 <b style={{ color: 'var(--accent)' }}>{lossDelta}%</b>:直接<b style={{ color: 'var(--accent2)' }}>接受 {(lo.acc * 100).toFixed(0)}%</b>;
          其余 <b>{((1 - lo.acc) * 100).toFixed(0)}%</b> 草稿被<b>拒绝(reject)</b>,再<b>等量</b>补采(resample)填回 → 输出 = p_t。
          偏离越大,接受越少、补采越多,但<b>结果分布不变(无损)</b>。
        </div>

        <h3 style={{ marginTop: 18 }}>图② 半自回归架构:并行骨架(重)+ 串行头(轻)</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          自上而下:大模型给的<b>锚点 D + mask</b> → <b style={{ color: 'var(--accent)' }}>并行骨架一次前向</b>同时算出所有位置的基础分 <b>Uₖ</b>
          (快,但各位置独立→会碰撞)→ <b style={{ color: 'var(--accent-2)' }}>串行头左→右</b>逐位把 <b>Uₖ + Bₖ(前一字)</b> 再采样
          (极轻,注入依赖→连贯)。拖「采样进度」看串行头一格格填、依赖箭头一段段接上。
        </p>
        <FigureBoard renderSvg={renderArch} baseCell={28} fullCell={38} controls={archControls} />

        <h3 style={{ marginTop: 18 }}>图③ 半自回归的效果:并行「串味」截断 vs 块内连贯</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          上两行是两种合理说法(句意 A / B)。「并行」每位独立采样,采到第 {d.par.firstCollision + 1} 个就串味
          (<b style={{ color: 'var(--hot,#ff6b6b)' }}>✗</b>)、其后全被拒;「DSpark」块内有依赖、保持连贯。
          拖块长 L:并行 τ 很快饱和、DSpark 随 L 继续涨。
        </p>
        <FigureBoard renderSvg={renderBlock} baseCell={26} fullCell={34} controls={blockControls} />
        <div style={{ marginTop: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: 'var(--text-dim)' }}>
          当前 L={L}:并行期望接受 <b style={{ color: 'var(--accent)' }}>{d.ePar.toFixed(2)}</b>(加速 {d.spPar.toFixed(1)}×,已饱和);
          DSpark <b style={{ color: 'var(--accent2)' }}>{d.eSar.toFixed(2)}</b>(加速 {d.spSar.toFixed(1)}×,随块长涨)。
        </div>
      </>
    </ChapterLayout>
  )
}
