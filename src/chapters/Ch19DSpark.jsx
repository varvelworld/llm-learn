import { useState, useMemo } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Tex from '../components/Tex.jsx'
import Refs from '../components/Refs.jsx'
import { T } from '../components/svg/theme.js'
import { seededMatrix } from '../lib/synth.js'
import { expectedAccept, speedup, parallelDraft } from '../lib/specdec.js'
import { useLang, useT } from '../i18n/lang.jsx'

// 英文更长,按文本宽度兜底避免裁切(CJK≈11、ASCII≈6.4)
const estTextW = (s) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 11 : 6.4), 0)

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
  const t = useT()
  const { lang } = useLang()
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
    const titleStr = t('接受 accept · 拒绝 reject · 补采 resample(重采一个字)', 'accept · reject · resample (redraw one token)')
    els.push(<text key="ttl" x={lx - 8} y={y1 - 16} fontFamily={T.font} fontSize={9.5} fill={T.c.dim}>
      <tspan fill={T.c.accent2}>{t('接受 accept', 'accept')}</tspan> · <tspan fill={T.c.dim}>{t('拒绝 reject', 'reject')}</tspan> · <tspan fill={T.c.accent2}>{t('补采 resample(重采一个字)', 'resample (redraw one token)')}</tspan></text>)
    // 草稿 p_d:接受(绿)+ 拒绝(灰)
    els.push(<text key="ld" x={lx - 8} y={y1 + barH / 2 + 4} textAnchor="end" fontFamily={T.font} fontSize={10.5} fill={T.c.dim}>{t('草稿 p_d', 'draft p_d')}</text>)
    seg('da', x0, y1, accW, T.c.accent2, 0.85, t('接受', 'accept'), accPct, '#0b1410')
    seg('dr', x0 + accW, y1, remW, T.c.dim, 0.5, t('拒绝', 'reject'), remPct, T.c.text)
    // 大模型 p_t:接受(绿)+ 补采(浅绿)
    els.push(<text key="lt" x={lx - 8} y={y2 + barH / 2 + 4} textAnchor="end" fontFamily={T.font} fontSize={10.5} fill={T.c.accent2}>{t('大模型 p_t', 'target p_t')}</text>)
    seg('ta', x0, y2, accW, T.c.accent2, 0.85, t('接受', 'accept'), accPct, '#0b1410')
    seg('tr', x0 + accW, y2, remW, T.c.accent2, 0.32, t('补采', 'resample'), remPct, T.c.accent2)
    // 接受/剩余 的分界对齐虚线
    els.push(<line key="div" x1={x0 + accW} y1={y1 - 6} x2={x0 + accW} y2={y2 + barH + 6} stroke={T.c.border} strokeWidth={1} strokeDasharray="3 3" />)
    // 箭头:拒回的质量 → 等量补采
    const gx = x0 + accW + remW / 2
    els.push(<line key="arr" x1={gx} y1={y1 + barH + 3} x2={gx} y2={y2 - 3} stroke={T.c.warn} strokeWidth={1.5} markerEnd="url(#lah)" />)
    els.push(<text key="arrl" x={x0 + accW - 8} y={(y1 + barH + y2) / 2 + 3} textAnchor="end" fontFamily={T.font} fontSize={9.5} fill={T.c.warn}>{t('拒绝量 = 补采量', 'reject mass = resample mass')}</text>)
    // 0/100 刻度
    els.push(<text key="z0" x={x0} y={y2 + barH + 16} fontFamily={T.font} fontSize={8.5} fill={T.c.dim}>0%</text>)
    els.push(<text key="z1" x={x0 + Wbar} y={y2 + barH + 16} textAnchor="end" fontFamily={T.font} fontSize={8.5} fill={T.c.dim}>100%</text>)
    const W = Math.max(x0 + Wbar + 16, lx - 8 + estTextW(titleStr) + 16)
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
    const inputLbl = t('输入:大模型给的锚点 + (γ−1) 个 mask', 'Input: target-given anchor + (γ−1) masks')
    const backboneLbl = t('并行骨架(重)· 一次前向,所有位置同时算', 'Parallel backbone (heavy) · one forward pass, all positions at once')
    const serialLbl = t('串行头(轻)· 左→右 · 每步 Uₖ + Bₖ(前一字) 再采样', 'Serial head (light) · left→right · each step resample from Uₖ + Bₖ(prev token)')
    const outLbl = t('↓ 得到草稿块(再各配一个置信度 cₖ,见后两章)', '↓ yields the draft block (each also gets a confidence cₖ, see next two chapters)')
    els.push(<text key="il" x={lx} y={y0 - 8} fontFamily={T.font} fontSize={9.5} fill={T.c.dim}>{inputLbl}</text>)
    for (let i = 0; i < G; i++) {
      const anchor = i === 0
      box(`in${i}`, cx(i), y0, iw, anchor ? t('D(锚点)', 'D (anchor)') : 'mask', anchor ? 'rgba(110,168,254,0.2)' : T.c.bgElev, anchor ? T.c.accent : T.c.border, anchor ? T.c.accent : T.c.dim, 10)
      vArrow(cx(i), y0 + bh, y1)
    }
    els.push(<rect key="bb" x={lx} y={y1} width={G * colW - 6} height={bh} rx={7} fill="rgba(110,168,254,0.16)" stroke={T.c.accent} strokeWidth={1.6} />)
    els.push(<text key="bbt" x={lx + (G * colW - 6) / 2} y={y1 + bh / 2 + 4} textAnchor="middle" fontFamily={T.font} fontSize={12} fontWeight={700} fill={T.c.accent}>{backboneLbl}</text>)
    els.push(<text key="bbn" x={right + 6} y={y1 + bh / 2 + 4} fontFamily={T.font} fontSize={9.5} fill={T.c.accent}>{t('T_draft≈1 次', 'T_draft≈1 pass')}<tspan x={right + 6} dy={12}>{t('(与块长无关→快)', '(independent of block length → fast)')}</tspan></text>)
    for (let i = 0; i < G; i++) vArrow(cx(i), y1 + bh, y2)
    for (let i = 0; i < G; i++) box(`u${i}`, cx(i), y2, nw, `U${i + 1}`, T.c.bgElev, T.c.border, T.c.text, 11, true)
    els.push(<text key="ul" x={right + 6} y={y2 + bh / 2 + 4} fontFamily={T.font} fontSize={9.5} fill={T.c.dim}>{t('基础分:同时产出', 'base scores: emitted together')}<tspan x={right + 6} dy={12}>{t('但各位置独立→会碰撞', 'but positions independent → collide')}</tspan></text>)
    els.push(<text key="sl" x={lx} y={y3 - 12} fontFamily={T.font} fontSize={9.5} fill={T.c.accent2}>{serialLbl}</text>)
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
    els.push(<text key="snote" x={right + 6} y={ymid} fontFamily={T.font} fontSize={9.5} fill={T.c.accent2}>{t('只注入依赖', 'injects dependency only')}<tspan x={right + 6} dy={12}>{t('极轻→连贯(τ↑)', 'very light → coherent (τ↑)')}</tspan></text>)
    els.push(<text key="out" x={lx} y={y3 + bh + 18} fontFamily={T.font} fontSize={9.5} fill={T.c.dim}>{outLbl}</text>)
    const W2 = Math.max(W, lx + estTextW(inputLbl) + 12, lx + estTextW(serialLbl) + 12, lx + estTextW(outLbl) + 12, right + 6 + estTextW(t('(与块长无关→快)', '(independent of block length → fast)')) + 8, right + 6 + estTextW(t('但各位置独立→会碰撞', 'but positions independent → collide')) + 8, right + 6 + estTextW(t('极轻→连贯(τ↑)', 'very light → coherent (τ↑)')) + 8)
    const H = y3 + bh + 28
    return <svg width={W2} height={H} style={{ display: 'block', minWidth: W2 }}>{els}</svg>
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
    refRow(0, t('句意 A', 'Meaning A'), MODE_A)
    refRow(1, t('句意 B', 'Meaning B'), MODE_B)
    {
      const ri = 2, y = top + ri * rowH
      els.push(<text key={`l${ri}`} x={lx - 8} y={y + rowH / 2 + 2} textAnchor="end" fontFamily={T.font} fontSize={10} fill={T.c.accent}>{t('并行', 'Parallel')}</text>)
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
    const cap1 = lang === 'en'
      ? <text key="cap1" x={lx} y={yc} fontFamily={T.font} fontSize={10} fill={T.c.dim}>
          Parallel samples each position <tspan fill={T.c.accent}>independently</tspan> → token {d.par.firstCollision + 1} <tspan fill={T.c.hot}>drifts to the other meaning (✗)</tspan>, the rest of the block is rejected (grey).</text>
      : <text key="cap1" x={lx} y={yc} fontFamily={T.font} fontSize={10} fill={T.c.dim}>
          并行各位置<tspan fill={T.c.accent}>独立</tspan>采样 → 第 {d.par.firstCollision + 1} 个 <tspan fill={T.c.hot}>串到另一句意(✗)</tspan>,其后整段被拒(灰)。</text>
    const cap2 = lang === 'en'
      ? <text key="cap2" x={lx} y={yc + 15} fontFamily={T.font} fontSize={10} fill={T.c.dim}>
          DSpark <tspan fill={T.c.accent2}>semi-autoregressive</tspan>: each token conditions on the previous → coherent within the block, nearly all accepted.</text>
      : <text key="cap2" x={lx} y={yc + 15} fontFamily={T.font} fontSize={10} fill={T.c.dim}>
          DSpark <tspan fill={T.c.accent2}>半自回归</tspan>:每字以前一个为条件 → 块内连贯,几乎全被接受。</text>
    els.push(cap1)
    els.push(cap2)
    const by = yc + 36
    const barL = lx + 92
    const barMax = Math.max(120, cs * 5)
    const eMax = Math.max(d.eSar, 1)
    const drawBar = (bi, label, e, sp, col) => {
      const y = by + bi * 26
      els.push(<text key={`bl${bi}`} x={lx} y={y + 12} fontFamily={T.font} fontSize={10.5} fill={col}>{label}</text>)
      els.push(<rect key={`bt${bi}`} x={barL} y={y} width={barMax} height={15} rx={3} fill={T.c.bgElev} stroke={T.c.border} strokeWidth={0.5} />)
      els.push(<rect key={`bf${bi}`} x={barL} y={y} width={Math.max(2, (e / eMax) * barMax)} height={15} rx={3} fill={col} opacity={0.8} />)
      els.push(<text key={`bv${bi}`} x={barL + barMax + 8} y={y + 12} fontFamily={T.font} fontSize={10} fill={T.c.text}>{t(`τ≈${e.toFixed(2)} → 加速 ${sp.toFixed(1)}×`, `τ≈${e.toFixed(2)} → speedup ${sp.toFixed(1)}×`)}</text>)
    }
    els.push(<text key="bt" x={lx} y={by - 6} fontFamily={T.font} fontSize={9.5} fill={T.c.dim}>{t('每次大模型验证 · 期望接受 τ / 加速比', 'per target-model verification · expected accept τ / speedup')}</text>)
    drawBar(0, t('并行', 'Parallel'), d.ePar, d.spPar, T.c.accent)
    drawBar(1, 'DSpark', d.eSar, d.spSar, T.c.accent2)
    const barValStr = t(`τ≈${d.eSar.toFixed(2)} → 加速 ${d.spSar.toFixed(1)}×`, `τ≈${d.eSar.toFixed(2)} → speedup ${d.spSar.toFixed(1)}×`)
    const W = Math.max(lx + L * tw + 10, barL + barMax + estTextW(barValStr) + 20)
    const H = by + 2 * 26 + 8
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  const lossControls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 110 }}>{t('草稿偏离 p_t', 'draft deviates from p_t')}</span>
      <input type="range" min={0} max={100} step={1} value={lossDelta} onChange={(e) => setLossDelta(+e.target.value)} style={{ width: 140 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{lossDelta}%</b>
    </label>
  )
  const archControls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 130 }}>{t('串行头采样进度', 'serial-head sampling progress')}</span>
      <input type="range" min={0} max={ATOK.length} step={1} value={archStep} onChange={(e) => setArchStep(+e.target.value)} style={{ width: 130 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{archStep}/{ATOK.length}</b>
      <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{archStep === 0 ? t('(并行已出基础分,串行未开始)', '(backbone base scores ready, serial head not started)') : archStep === ATOK.length ? t('(整块起草完成)', '(whole block drafted)') : ''}</span>
    </label>
  )
  const blockControls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 110 }}>{t('块长 L(一次起草几个)', 'block length L (tokens per draft)')}</span>
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
    <ChapterLayout
      kicker={t('第二部分 · DeepSeek-V4 · Ch19', 'Part 2 · DeepSeek-V4 · Ch19')}
      title={t('DSpark(一)· 投机解码与半自回归', 'DSpark ① · Speculative Decoding & Semi-Autoregressive')}
      prev={prev}
      next={next}
      translated
    >
      <>
        {lang === 'en' ? (
        <>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          DSpark is DeepSeek-V4's <b>speculative decoding framework</b>, speeding things up with three tricks. This is the
          <b> first chapter</b>: the basics of speculative decoding plus the first trick <b>semi-autoregression</b>;
          the next two chapters cover <b>confidence scoring</b> and <b>dynamic scheduling</b>.
        </p>
        <h2>Speculative decoding: boss + intern</h2>
        <p>
          Large models are slow to generate because they <b>emit one token at a time</b>, running the whole model end to end for every token.
          <b> Speculative decoding</b> is like this: a <b>boss</b> (the target model, smart but slow) paired with an <b>intern</b> (the drafter, so-so but fast).
          The intern <b>drafts a run of tokens fast</b>, the boss <b>scans the whole run at a glance</b>: correct prefixes are <b>accepted wholesale</b>, and at the first wrong one the boss takes over and writes it correctly.
          This way the boss locks in a <b>whole run</b> of tokens at once, so it runs several times faster.
        </p>
        <p>
          The neat part is that it is <b>lossless</b>: every token passes the boss's check (the <b>rejection-sampling</b> rule below), so the final output is <b>identical, token for token, to what the target model would have written on its own</b>.
          The formula below matches the paper's notation — <Tex>{'p_t'}</Tex> = <b>target-model distribution</b>, <Tex>{'p_d'}</Tex> = <b>draft distribution</b>:
        </p>
        <div style={{ fontSize: 14, overflowX: 'auto', margin: '6px 0' }}><Tex block>{losslessTex}</Tex></div>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '2px 0' }}>
          The three expressions, left to right: <b>accept probability</b>, <b>resample distribution after a reject</b>, and the <b>final output</b> (strictly following <Tex>{'p_t'}</Tex>).
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0' }}>
          <b>How to read this rule</b>: the draft first samples a token <Tex>{'x'}</Tex> from its own distribution <Tex>{'p_d'}</Tex>.
        </p>
        <ul style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 0 }}>
          <li>If the target model's probability for <Tex>{'x'}</Tex> is <b>no lower</b> than the draft's (<Tex>{'p_t\\ge p_d'}</Tex>) → the ratio is ≥1 → <b>accept directly</b> (the boss wants it at least this much too).</li>
          <li>If the target probability is <b>lower</b> (the draft over-favored it) → accept only with probability <Tex>{'p_t/p_d'}</Tex>, and <b>otherwise reject and back off</b>.</li>
          <li>Once backed off, this position <b>still has to emit a token</b> (it can't be left blank), but the draft can't be reused (that would bring the bias back).
            So we <b>resample a token from those the target model wanted but the draft under-supplied, in proportion to the shortfall</b> — this step is called
            <b> resample</b>, and its sampling distribution is exactly the residual <Tex>{'(p_t-p_d)_{+}'}</Tex> (normalized).
            (The subscript <Tex>{'(\\cdot)_{+}'}</Tex> reads "<b>positive part</b>": <b>keep the positives, clamp negatives to 0</b>.)</li>
        </ul>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0' }}>
          In one line: where the draft <b>over-supplied</b> some tokens (rejected proportionally), that probability is <b>moved to fill in</b> the tokens it <b>under-supplied</b> (resample).
          The surplus and shortfall cancel exactly — the orange arrow in Figure ① (<b style={{ color: 'var(--warn)' }}>reject mass → resample mass</b>) draws this "move".
        </p>
        <div className="note">
          <b>See the residual <Tex>{'(p_t-p_d)_{+}'}</Tex> with numbers</b>. Take 3 candidate tokens A/B/C:
          the target wants <Tex>{'p_t=[0.5,\\ 0.1,\\ 0.4]'}</Tex>, the draft gives <Tex>{'p_d=[0.2,\\ 0.5,\\ 0.3]'}</Tex>.
          <ul style={{ margin: '4px 0' }}>
            <li>Subtract token by token <Tex>{'p_t-p_d=[+0.3,\\ -0.4,\\ +0.1]'}</Tex>;</li>
            <li><b>Take the positive part</b> (negatives → 0) → <Tex>{'[0.3,\\ 0,\\ 0.1]'}</Tex>: <b>both A and C were "under-supplied by the draft"</b>, while B "over-supplied" is zeroed;</li>
            <li>Normalize (÷0.4) → <Tex>{'[0.75,\\ 0,\\ 0.25]'}</Tex>: so resampling is <b>a distribution of "75% draw A, 25% draw C"</b> (not just picking one).</li>
          </ul>
          Intuition: resampling picks among the tokens the <b>draft shorted</b>, <b>in proportion to the shortfall</b> — A is shorted most so is drawn more, C is shorted less so drawn rarely; the over-supplied B is never resampled.
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '2px 0' }}>
          It can be proven that the token produced this way has a distribution <b>strictly equal to</b> sampling directly from the target model — hence <b>lossless</b> (<b>Figure ①</b> draws this rule: accept + resample exactly reconstruct p_t).
          (Accept probability, see DSpark paper §2.1; the resample step and lossless proof come from speculative sampling: Leviathan 2023 / Chen 2023.)
        </p>
        <div className="note">
          <b>Why not just "look at p_t directly, take its argmax or sample from it"?</b> — because <b>computing p_t itself is the most expensive step</b>.
          To get p_t at some position, the target model must <b>first know all preceding tokens</b> (autoregression), so normally it can only run <b>one token at a time, serially</b>,
          one full forward pass per token — that's the root of the slowness. Speculative decoding lets the drafter <b>guess</b> a run first, so the target model can then do <b>one parallel forward pass</b> that computes p_t for <b>all those positions at once</b>;
          and since these p_t values rest on the draft-guessed prefix, and the draft was sampled from the cheap p_d, we need accept/reject/resample to <b>losslessly correct</b> it back to sampling from p_t.
          <b> In one line: you really do use p_t; what you save is the time of "computing p_t serially, token by token".</b>
          (Taking the argmax of p_t = greedy deterministic decoding; sampling from p_t = stochastic decoding — both still require computing p_t first, which is exactly what speculative decoding accelerates.)
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          <b>What if the draft guessed wrong earlier? — everything after does get discarded.</b> The p_t at position k is computed under the prefix "the draft's guesses <Tex>{'x_1\\dots x_{k-1}'}</Tex>";
          once a token is rejected, all the p_t <b>after</b> it are built on a wrong prefix and are <b>thrown away entirely</b>. So verification runs <b>left to right</b>, <b>truncating the whole tail after the first reject</b>
          (Figure ③'s "everything turns grey after the drift" is exactly this), which is why the acceptable prefix length τ is capped.
          <br />But it <b>never gets worse</b>: the p_t at the rejected position is <b>still valid</b> (all tokens before it were accepted = a correct prefix), so we can resample <b>1 correct token</b> there —
          called the <b>bonus token</b>. Even if the very first token is rejected, this parallel forward pass <b>still produces at least 1 token</b>, never slower than token-by-token decoding; on average it produces <b>τ+1</b>.
          Precisely because "the further along, the more error-prone, and one error voids the rest", DSpark uses <b>semi-autoregression</b> to make the draft more coherent (raising τ) and <b>dynamic scheduling</b> to avoid wasting verification on tails likely to be rejected.
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          <b>"Lossless" refers to the output only, not the compute</b>: lossless guarantees the <b>final output distribution</b> is <b>exactly the same</b> as the target model's token-by-token sampling (no quality loss).
          It does <b>not</b> mean less compute — quite the opposite: the drafter runs extra, and the target model verifies the <b>whole block</b> in parallel (including the finally-rejected, wasted tokens),
          so total FLOPs are often <b>even more</b> than pure autoregression. Speculative decoding is <b>"trading extra compute for lower latency"</b>: the target model locks in multiple tokens in one forward pass and verifies in parallel,
          so it's <b>faster</b>. The third lever <Tex>{'T_{\\text{verify}}'}</Tex> (dynamic scheduling) later is about wasting as little of this verification compute as possible.
        </div>
        <p>
          So what determines the speedup? Break down "the average time per token" and you get DSpark's <b>master equation</b> (paper Eq. 1): one round of <b>drafting</b> costs
          <Tex>{'T_{\\text{draft}}'}</Tex>, <b>verification</b> costs <Tex>{'T_{\\text{verify}}'}</Tex>, and this round locks in <Tex>{'\\tau'}</Tex> tokens (the <b>accept length</b>):
        </p>
        <div style={{ fontSize: 14, overflowX: 'auto', margin: '6px 0' }}><Tex block>{latencyTex}</Tex></div>
        <p>
          To go faster there are only <b>three levers</b>: <b style={{ color: 'var(--accent)' }}>① draft faster (↓T_draft)</b>,
          <b style={{ color: 'var(--accent-2)' }}>② accept more (↑τ)</b>, <b style={{ color: 'var(--warn)' }}>③ verify cheaper (↓T_verify)</b>.
          DSpark's three tricks each handle one lever; <b>this chapter's semi-autoregression handles the first two at once</b>, leaving the third to the next two chapters.
        </p>

        <h2>Semi-autoregression — handles ① T_draft and ② τ</h2>
        <p>The intern can draft in two ways, each with a weakness:</p>
        <ul>
          <li><b>Autoregressive</b>: each token looks at <b>the token just written</b>, so it's coherent, <b style={{ color: 'var(--accent-2)' }}>high τ</b> —
            but <b style={{ color: 'var(--accent)' }}>T_draft ∝ block length</b> (the more it drafts the slower), so it can only draft very short blocks.</li>
          <li><b>Parallel</b>: all positions <b>write their own at the same time</b>, <b style={{ color: 'var(--accent)' }}>T_draft ≈ one forward pass</b> (blazing fast) —
            but they don't see each other, <b style={{ color: 'var(--accent-2)' }}>low τ</b>: the reply could be either "<b>of course</b>" or "<b>no problem</b>",
            position 1 picks <b>of</b>, position 2 picks <b>problem</b>, giving <b style={{ color: 'var(--warn)' }}>"of problem"</b> ✗ (<b>multi-mode collision</b>), drifting more the further along (Figure ③).</li>
        </ul>
        <p>
          <b>DSpark's semi-autoregression</b> (architecture in <b>Figure ②</b>): use a <b>parallel backbone</b> to emit each position's <b>base score</b> <Tex>{'U_k'}</Tex> in one forward pass (keeping T_draft fast),
          then attach a <b>lightweight serial head</b> that adds a <b>transition bias</b> <Tex>{'B_k'}</Tex> to each position — it looks <b>left→right</b> at the already-sampled context:
          if "of" was sampled it <b>boosts</b> "course" and <b>penalizes</b> "problem", so the block is coherent and <b>τ rises</b>.
        </p>
        <div style={{ fontSize: 13.5, overflowX: 'auto', margin: '6px 0' }}><Tex block>{biasTex}</Tex></div>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '2px 0' }}>
          Lightweight implementations of <Tex>{'B_k'}</Tex>: a <b>Markov head</b> (looks only at the previous token, low-rank <Tex>{'W_1W_2,\\ r{=}256'}</Tex>) or an <b>RNN head</b> (with intra-block memory).
        </p>
        <div className="note">
          Next chapter (<b>confidence scoring</b>): how to estimate, without running the target model, each draft token's "probability of passing verification";
          the chapter after (<b>dynamic scheduling</b>): using that probability to decide how many to verify given system load, tightening the third lever T_verify.
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          <b>Honest simplification</b>: Figure ① uses a toy distribution to demo reconstruction (real <Tex>{'p_t,p_d'}</Tex> are computed per position by the model);
          Figure ② is an architecture sketch (KV injection and mask details omitted); Figure ③ abstracts "coherence probability" into a single <Tex>{'c'}</Tex>
          (parallel ≈0.5, semi-AR higher), and its "speedup = τ+1" only demos lever ② (assuming <Tex>{'T_{\\text{draft}},T_{\\text{verify}}'}</Tex> are both small).
        </div>
        </>
        ) : (
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
            <b>补采(resample)</b>,采样分布就是残差 <Tex>{'(p_t-p_d)_{+}'}</Tex>(归一化)。
            (这里下标 <Tex>{'(\\cdot)_{+}'}</Tex> 读作「<b>取正部</b>」:<b>正的留下、负的当 0</b>。)</li>
        </ul>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0' }}>
          一句话:草稿在某些字上<b>给多了</b>(按比例拒绝),就把这部分概率<b>挪去补</b>那些<b>给少了</b>的字(补采)。
          一多一少正好抵消——图①里那根橙箭头(<b style={{ color: 'var(--warn)' }}>拒绝量 → 补采量</b>)画的就是这个「挪」。
        </p>
        <div className="note">
          <b>用数字看残差 <Tex>{'(p_t-p_d)_{+}'}</Tex></b>。设 3 个候选字 A/B/C:
          大模型想要 <Tex>{'p_t=[0.5,\\ 0.1,\\ 0.4]'}</Tex>、草稿给 <Tex>{'p_d=[0.2,\\ 0.5,\\ 0.3]'}</Tex>。
          <ul style={{ margin: '4px 0' }}>
            <li>逐字相减 <Tex>{'p_t-p_d=[+0.3,\\ -0.4,\\ +0.1]'}</Tex>;</li>
            <li><b>取正部</b>(负的当 0)→ <Tex>{'[0.3,\\ 0,\\ 0.1]'}</Tex>:<b>A、C 都「草稿给少了」</b>,B「草稿给多了」清零;</li>
            <li>归一化(÷0.4)→ <Tex>{'[0.75,\\ 0,\\ 0.25]'}</Tex>:所以补采是<b>「75% 采 A、25% 采 C」的一个分布</b>(不是只采一个)。</li>
          </ul>
          直觉:补采在「<b>草稿亏欠</b>」的字里<b>按缺口大小</b>挑——A 缺得多、更常补 A,C 缺得少、偶尔补 C;给多了的 B 不补。
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '2px 0' }}>
          可以证明:这样产出的字,分布<b>严格等于</b>直接从大模型采样——所以<b>无损</b>(<b>图①</b>把这条规则画了出来:接受+补采正好重建 p_t)。
          (接受概率见 DSpark 论文 §2.1;补采那步与无损证明来自投机采样:Leviathan 2023 / Chen 2023。)
        </p>
        <div className="note">
          <b>为什么不干脆「直接看 p_t、取最大值或从它采样」?</b>——因为<b>算出 p_t 本身才是最贵的一步</b>。
          要得到某位置的 p_t,大模型必须<b>先知道它前面所有的字</b>(自回归),所以正常只能<b>一个字一个字串行</b>地跑、
          每字一次完整前向——这就是慢的根源。投机解码让 drafter 先<b>猜</b>一串,大模型才能<b>一次并行前向</b>把这串位置的 p_t
          <b>全算出来</b>;而这些 p_t 是基于草稿猜的前缀、草稿又采自便宜的 p_d,所以才需要接受/拒绝/补采把它<b>无损纠正</b>成从 p_t 采。
          <b>一句话:你用的确实是 p_t,省掉的是「逐字串行算 p_t」的时间。</b>
          (取 p_t 最大值=greedy 确定性解码;从 p_t 采样=带随机性解码——两种都得先算出 p_t,投机解码加速的正是这件事。)
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          <b>那草稿前面就猜错了呢?——后面确实全作废。</b>第 k 位的 p_t 是在「草稿猜的 <Tex>{'x_1\\dots x_{k-1}'}</Tex>」这个前缀下算的;
          一旦某字被拒,它<b>后面</b>那些 p_t 都建立在错前缀上、<b>全部丢掉</b>。所以验证<b>从左到右</b>、<b>第一个被拒处之后整段截断</b>
          (图③「串味后全变灰」就是它),能接受的前缀长度 τ 也因此被卡住。
          <br />但<b>不会更糟</b>:被拒那一位的 p_t <b>仍有效</b>(它前面的字都已接受=正确前缀),于是能在该处补采出<b>1 个正确字</b>——
          叫<b>奖励字(bonus token)</b>。哪怕第一个字就被拒,这次并行前向也<b>至少产出 1 个字</b>,绝不比逐字解码慢;平均产出 <b>τ+1</b> 个。
          正因为「越往后越易错、一错全废」,DSpark 才用<b>半自回归</b>让草稿更连贯(抬高 τ)、用<b>动态调度</b>不在大概率被拒的尾巴上浪费验证。
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          <b>「无损」只指输出、不指算力</b>:无损保证的是<b>最终输出分布</b>和大模型逐字采样<b>一模一样</b>(质量不打折)。
          它<b>不是</b>说算力变少——恰恰相反,drafter 要额外跑、大模型要并行验证<b>整块</b>(含最后被拒、白算的 token),
          总 FLOPs 往往比纯自回归<b>还多</b>。投机解码是<b>「拿额外算力换更低延迟」</b>:大模型一次前向敲定多个字、验证又并行,
          所以<b>更快</b>。后面第三杠杆 <Tex>{'T_{\\text{verify}}'}</Tex>(动态调度)就是尽量少浪费这部分验证算力。
        </div>
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
        </>
        )}
        <Refs
          ids={['2211.17192', '2302.01318', '1711.02281', '2401.10774', '2401.15077', '2606.19348']}
          extra={[
            { label: t('DeepSeek 2026 · DSpark 论文(Confidence-Scheduled Speculative Decoding with Semi-Autoregressive Generation)', 'DeepSeek 2026 · DSpark paper (Confidence-Scheduled Speculative Decoding with Semi-Autoregressive Generation)'), url: 'https://github.com/deepseek-ai/DeepSpec/blob/main/DSpark_paper.pdf' },
            { label: t('deepseek-ai/DeepSpec · 开源代码库(DSpark / DFlash / Eagle3)', 'deepseek-ai/DeepSpec · open-source codebase (DSpark / DFlash / Eagle3)'), url: 'https://github.com/deepseek-ai/DeepSpec' },
          ]}
        />
      </>
      <>
        <h3>{t('图① 无损:拒绝多少 = 补采多少 → 重建 p_t', 'Figure ① Lossless: reject as much as you resample → reconstruct p_t')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {lang === 'en' ? (
            <>Lay out the <b>100% probability mass</b> of the draft <b>p_d</b> and the target <b>p_t</b> each as a horizontal bar to compare: on the left,
            the <b style={{ color: 'var(--accent-2)' }}>green "accept"</b> segments are equally wide (= where the two distributions overlap, taken directly);
            the segment on the right — for the draft it's the over-proposed part that must be <b>"rejected" (grey)</b>, for the target it's the shortfall that must be
            <b style={{ color: 'var(--accent-2)' }}> "resampled" (light green)</b>, and these two are <b>equally wide</b>.
            So <b>however much is dropped is exactly refilled</b>, and the final distribution is exactly p_t — that's lossless. Drag the slider: the more the draft deviates, the narrower the green and the wider grey/light-green, but <b>always equal</b>.</>
          ) : (
            <>把草稿 <b>p_d</b>、大模型 <b>p_t</b> 各自的 <b>100% 概率质量</b>摊成一条横条对比:左边
            <b style={{ color: 'var(--accent-2)' }}>绿色「接受 accept」</b>两条一样宽(=两分布重叠、直接照收的部分);
            右边那一截——草稿这条是多提议、要<b>「拒绝 reject」(灰)</b>掉的,大模型那条是缺、要
            <b style={{ color: 'var(--accent-2)' }}>「补采 resample」(浅绿)</b>的,而它俩<b>一样宽</b>。
            所以<b>丢掉多少就补回多少</b>,最终分布精确等于 p_t——这就是无损。拖滑块:草稿越偏,绿色越窄、灰/浅绿越宽,但<b>永远等量</b>。</>
          )}
        </p>
        <FigureBoard renderSvg={renderLossless} baseCell={28} fullCell={38} controls={lossControls} />
        <div style={{ marginTop: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: 'var(--text-dim)' }}>
          {lang === 'en' ? (
            <>Current deviation <b style={{ color: 'var(--accent)' }}>{lossDelta}%</b>: directly <b style={{ color: 'var(--accent2)' }}>accept {(lo.acc * 100).toFixed(0)}%</b>;
            the remaining <b>{((1 - lo.acc) * 100).toFixed(0)}%</b> of the draft is <b>rejected</b>, then an <b>equal amount</b> is resampled back → output = p_t.
            The larger the deviation, the less accepted and the more resampled, but the <b>result distribution is unchanged (lossless)</b>.</>
          ) : (
            <>当前偏离 <b style={{ color: 'var(--accent)' }}>{lossDelta}%</b>:直接<b style={{ color: 'var(--accent2)' }}>接受 {(lo.acc * 100).toFixed(0)}%</b>;
            其余 <b>{((1 - lo.acc) * 100).toFixed(0)}%</b> 草稿被<b>拒绝(reject)</b>,再<b>等量</b>补采(resample)填回 → 输出 = p_t。
            偏离越大,接受越少、补采越多,但<b>结果分布不变(无损)</b>。</>
          )}
        </div>

        <h3 style={{ marginTop: 18 }}>{t('图② 半自回归架构:并行骨架(重)+ 串行头(轻)', 'Figure ② Semi-AR architecture: parallel backbone (heavy) + serial head (light)')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {lang === 'en' ? (
            <>Top to bottom: the target-given <b>anchor D + masks</b> → <b style={{ color: 'var(--accent)' }}>the parallel backbone's single forward pass</b> computes every position's base score <b>Uₖ</b> at once
            (fast, but positions are independent → collide) → <b style={{ color: 'var(--accent-2)' }}>the serial head, left→right</b>, resamples each position from <b>Uₖ + Bₖ(prev token)</b>
            (very light, injects dependency → coherent). Drag "sampling progress" to watch the serial head fill cell by cell and the dependency arrows link up one by one.</>
          ) : (
            <>自上而下:大模型给的<b>锚点 D + mask</b> → <b style={{ color: 'var(--accent)' }}>并行骨架一次前向</b>同时算出所有位置的基础分 <b>Uₖ</b>
            (快,但各位置独立→会碰撞)→ <b style={{ color: 'var(--accent-2)' }}>串行头左→右</b>逐位把 <b>Uₖ + Bₖ(前一字)</b> 再采样
            (极轻,注入依赖→连贯)。拖「采样进度」看串行头一格格填、依赖箭头一段段接上。</>
          )}
        </p>
        <FigureBoard renderSvg={renderArch} baseCell={28} fullCell={38} controls={archControls} />

        <h3 style={{ marginTop: 18 }}>{t('图③ 半自回归的效果:并行「串味」截断 vs 块内连贯', 'Figure ③ Effect of semi-AR: parallel "drift" truncation vs intra-block coherence')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {lang === 'en' ? (
            <>The top two rows are two plausible phrasings (meaning A / B). "Parallel" samples each position independently, drifting at token {d.par.firstCollision + 1}
            (<b style={{ color: 'var(--hot,#ff6b6b)' }}>✗</b>) with everything after rejected; "DSpark" has intra-block dependency and stays coherent.
            Drag block length L: parallel τ saturates quickly, while DSpark keeps rising with L.</>
          ) : (
            <>上两行是两种合理说法(句意 A / B)。「并行」每位独立采样,采到第 {d.par.firstCollision + 1} 个就串味
            (<b style={{ color: 'var(--hot,#ff6b6b)' }}>✗</b>)、其后全被拒;「DSpark」块内有依赖、保持连贯。
            拖块长 L:并行 τ 很快饱和、DSpark 随 L 继续涨。</>
          )}
        </p>
        <FigureBoard renderSvg={renderBlock} baseCell={26} fullCell={34} controls={blockControls} />
        <div style={{ marginTop: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: 'var(--text-dim)' }}>
          {lang === 'en' ? (
            <>Current L={L}: parallel expected accept <b style={{ color: 'var(--accent)' }}>{d.ePar.toFixed(2)}</b> (speedup {d.spPar.toFixed(1)}×, saturated);
            DSpark <b style={{ color: 'var(--accent2)' }}>{d.eSar.toFixed(2)}</b> (speedup {d.spSar.toFixed(1)}×, rises with block length).</>
          ) : (
            <>当前 L={L}:并行期望接受 <b style={{ color: 'var(--accent)' }}>{d.ePar.toFixed(2)}</b>(加速 {d.spPar.toFixed(1)}×,已饱和);
            DSpark <b style={{ color: 'var(--accent2)' }}>{d.eSar.toFixed(2)}</b>(加速 {d.spSar.toFixed(1)}×,随块长涨)。</>
          )}
        </div>
      </>
    </ChapterLayout>
  )
}
