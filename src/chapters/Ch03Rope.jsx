import { useState, useMemo, useCallback } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import Refs from '../components/Refs.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import { T } from '../components/svg/theme.js'
import { freqs, rot2 } from '../lib/rope.js'
import { useLang, useT } from '../i18n/lang.jsx'

// 教学用底数:取 16,让四根「时钟指针」的速度呈干净的 2× 递减,直观看清多频率。
// 真实 RoPE 用 base=10000(d 较大时让最慢的指针在整段上下文里只转不到一圈)。
const VIZ_BASE = 16
const D = 8 // toy 维度 → 4 个频率对
const TH0 = 0.55 // 第 0 对在图 1/2 里的可视角速度(弧度/位置)

const deg = (r) => (r * 180) / Math.PI
// 估算一段文本的像素宽(CJK≈11、ASCII≈6.4),给 SVG 留够宽度、防英文更长时裁切。
const estTextW = (s) => [...String(s)].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 11 : 6.4), 0)

export default function Ch03Rope({ prev, next }) {
  const t = useT()
  const { lang } = useLang()
  const [mode, setMode] = useState('rot') // 'add' | 'rot'(图1)
  const [m, setM] = useState(3) // 图1 位置
  const [qm, setQm] = useState(5) // 图2:q 的位置
  const [kn, setKn] = useState(2) // 图2:k 的位置
  const [pos, setPos] = useState(4) // 图3 位置
  const onPageStep = useCallback((d) => setM((v) => Math.min(8, Math.max(0, v + d))), [])

  // ── 2D 平面绘制小工具 ──────────────────────────────
  // 把数学坐标 (vx,vy) 投到屏幕(y 轴向上为正);unit = 每单位像素。
  const plane = (cx, cy, unit, R) => {
    const P = (vx, vy) => [cx + vx * unit, cy - vy * unit]
    const axes = []
    // 网格圆 + 坐标轴
    for (let r = 1; r <= R; r++)
      axes.push(<circle key={`g${r}`} cx={cx} cy={cy} r={r * unit} fill="none"
        stroke={T.c.border} strokeWidth={0.6} strokeDasharray="2 4" />)
    axes.push(<line key="ax" x1={cx - R * unit} y1={cy} x2={cx + R * unit} y2={cy} stroke={T.c.border} strokeWidth={1} />)
    axes.push(<line key="ay" x1={cx} y1={cy - R * unit} x2={cx} y2={cy + R * unit} stroke={T.c.border} strokeWidth={1} />)
    return { P, axes }
  }
  const arrow = (key, cx, cy, x2, y2, color, w = 2.4) => {
    const ang = Math.atan2(y2 - cy, x2 - cx)
    const ah = 8
    return (
      <g key={key}>
        <line x1={cx} y1={cy} x2={x2} y2={y2} stroke={color} strokeWidth={w} />
        <path d={`M${x2},${y2} L${x2 - ah * Math.cos(ang - 0.4)},${y2 - ah * Math.sin(ang - 0.4)} L${x2 - ah * Math.cos(ang + 0.4)},${y2 - ah * Math.sin(ang + 0.4)} Z`} fill={color} />
      </g>
    )
  }

  // ───────── 图 1:注入位置的两种方式 —— 加法(平移) vs 旋转(RoPE) ─────────
  const base = [1.6, 0.9] // 原始 (q 的一个 2D 子向量)
  const step = [0.32, 0.18] // 加法方案:每个位置加的位置向量 p
  const renderInject = (cell) => {
    const unit = cell * 1.5
    const R = 5
    const cx = 40 + R * unit
    const cy = 40 + R * unit
    const { P, axes } = plane(cx, cy, unit, R)
    const els = [...axes]
    // 原始向量(位置 0)
    const [ox, oy] = P(base[0], base[1])
    els.push(arrow('orig', cx, cy, ox, oy, T.c.dim, 2))
    els.push(<text key="ol" x={ox + 6} y={oy - 4} fontFamily={T.font} fontSize={10} fill={T.c.dim}>{t('x(位置0)', 'x (pos 0)')}</text>)
    // 轨迹:位置 0..m
    const pts = []
    for (let i = 0; i <= m; i++) {
      const v = mode === 'add'
        ? [base[0] + i * step[0], base[1] + i * step[1]]
        : rot2(base[0], base[1], i * TH0)
      pts.push(v)
    }
    pts.forEach((v, i) => {
      const [px, py] = P(v[0], v[1])
      els.push(<circle key={`p${i}`} cx={px} cy={py} r={2.5} fill={i === m ? T.c.accent : T.c.border} />)
    })
    // 当前向量高亮
    const cur = pts[m]
    const [cxp, cyp] = P(cur[0], cur[1])
    els.push(arrow('cur', cx, cy, cxp, cyp, T.c.accent, 2.8))
    els.push(<text key="cl" x={cxp + 6} y={cyp - 4} fontFamily={T.font} fontSize={11} fill={T.c.accent}>{t('位置', 'pos')} {m}</text>)
    const len = Math.hypot(cur[0], cur[1])
    const infoText = mode === 'add'
      ? t(`加法:x + ${m}·p —— 向量被「平移」,长度 ${len.toFixed(2)} 越走越长 ✗`,
        `Add: x + ${m}·p — vector is translated, length ${len.toFixed(2)} keeps growing ✗`)
      : t(`旋转:R(${m}·θ)·x —— 向量只「转角度」,长度恒为 ${len.toFixed(2)} ✓`,
        `Rotate: R(${m}·θ)·x — vector only turns, length stays ${len.toFixed(2)} ✓`)
    els.push(<text key="info" x={40} y={cy + R * unit + 22} fontFamily={T.font} fontSize={11}
      fill={mode === 'add' ? T.c.hot : T.c.accent2}>
      {infoText}
    </text>)
    const W = Math.max(cx + R * unit + 60, 40 + estTextW(infoText) + 12)
    const H = cy + R * unit + 34
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  // ───────── 图 2:相对位置不变性 —— q_m·k_n 只看 (m−n) ─────────
  const qvec = [1.7, 0.5]
  const kvec = [1.3, 1.1]
  const off = qm - kn
  const curDot = useMemo(() => {
    const qr = rot2(qvec[0], qvec[1], qm * TH0)
    const kr = rot2(kvec[0], kvec[1], kn * TH0)
    return qr[0] * kr[0] + qr[1] * kr[1]
  }, [qm, kn])
  const renderRelative = (cell) => {
    const unit = cell * 1.5
    const R = 5
    const cx = 40 + R * unit
    const cy = 40 + R * unit
    const { P, axes } = plane(cx, cy, unit, R)
    const els = [...axes]
    const qr = rot2(qvec[0], qvec[1], qm * TH0)
    const kr = rot2(kvec[0], kvec[1], kn * TH0)
    // 原始(虚线灰)
    const [qx0, qy0] = P(qvec[0], qvec[1])
    const [kx0, ky0] = P(kvec[0], kvec[1])
    els.push(<line key="q0" x1={cx} y1={cy} x2={qx0} y2={qy0} stroke={T.c.border} strokeWidth={1.4} strokeDasharray="3 3" />)
    els.push(<line key="k0" x1={cx} y1={cy} x2={kx0} y2={ky0} stroke={T.c.border} strokeWidth={1.4} strokeDasharray="3 3" />)
    // 旋转后
    const [qx, qy] = P(qr[0], qr[1])
    const [kx, ky] = P(kr[0], kr[1])
    els.push(arrow('q', cx, cy, qx, qy, T.c.accent, 2.8))
    els.push(arrow('k', cx, cy, kx, ky, T.c.accent2, 2.8))
    els.push(<text key="ql" x={qx + 6} y={qy - 2} fontFamily={T.font} fontSize={11} fill={T.c.accent}>q@{qm}</text>)
    els.push(<text key="kl" x={kx + 6} y={ky - 2} fontFamily={T.font} fontSize={11} fill={T.c.accent2}>k@{kn}</text>)
    // 夹角弧
    const a1 = Math.atan2(qr[1], qr[0])
    const a2 = Math.atan2(kr[1], kr[0])
    const rr = unit * 1.1
    els.push(<path key="arc" d={`M${cx + rr * Math.cos(a1)},${cy - rr * Math.sin(a1)} A${rr},${rr} 0 0 ${a1 > a2 ? 1 : 0} ${cx + rr * Math.cos(a2)},${cy - rr * Math.sin(a2)}`}
      fill="none" stroke={T.c.warn} strokeWidth={2} />)
    const dy = cy + R * unit + 20
    const t1Text = t(
      `夹角 = |m−n|·θ = ${Math.abs(off)}·θ = ${deg(Math.abs(off) * TH0).toFixed(0)}°(只看相对位置 ${off})`,
      `angle = |m−n|·θ = ${Math.abs(off)}·θ = ${deg(Math.abs(off) * TH0).toFixed(0)}° (offset ${off} only)`,
    )
    els.push(<text key="t1" x={40} y={dy} fontFamily={T.font} fontSize={11} fill={T.c.warn}>{t1Text}</text>)
    els.push(<text key="t2" x={40} y={dy + 18} fontFamily={T.font} fontSize={12} fill={T.c.text}>
      q@{qm} · k@{kn} = <tspan fill={T.c.accent} fontWeight="bold">{curDot.toFixed(3)}</tspan></text>)
    const W = Math.max(cx + R * unit + 60, 40 + estTextW(t1Text) + 12)
    const H = dy + 30
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  // ───────── 图 2b:点积 vs 相对偏移曲线(同 m−n 同结果) ─────────
  const renderCurve = (cell) => {
    const offsets = []
    for (let o = -6; o <= 6; o++) offsets.push(o)
    const vals = offsets.map((o) => {
      const qr = rot2(qvec[0], qvec[1], o * TH0)
      const kr = rot2(kvec[0], kvec[1], 0)
      return qr[0] * kr[0] + qr[1] * kr[1]
    })
    const vmax = Math.max(...vals.map(Math.abs))
    const W = 460
    const H = 150
    const x0 = 40
    const y0 = H / 2
    const sx = (W - 60) / 12
    const sy = (H / 2 - 16) / vmax
    const els = []
    els.push(<line key="ax" x1={x0} y1={y0} x2={W - 14} y2={y0} stroke={T.c.border} strokeWidth={1} />)
    els.push(<line key="ay" x1={x0 + 6 * sx} y1={14} x2={x0 + 6 * sx} y2={H - 14} stroke={T.c.border} strokeWidth={1} />)
    const path = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x0 + (i) * sx},${y0 - v * sy}`).join(' ')
    els.push(<path key="ln" d={path} fill="none" stroke={T.c.accent} strokeWidth={2} />)
    vals.forEach((v, i) => {
      const cx = x0 + i * sx
      const hi = offsets[i] === off
      els.push(<circle key={`c${i}`} cx={cx} cy={y0 - v * sy} r={hi ? 4.5 : 2.6} fill={hi ? T.c.warn : T.c.accent} />)
      if (offsets[i] % 2 === 0)
        els.push(<text key={`x${i}`} x={cx} y={H - 2} textAnchor="middle" fontFamily={T.font} fontSize={9} fill={T.c.dim}>{offsets[i]}</text>)
    })
    els.push(<text key="hil" x={x0 + (off + 6) * sx} y={y0 - vals[off + 6] * sy - 8} textAnchor="middle"
      fontFamily={T.font} fontSize={10} fill={T.c.warn}>{t('当前', 'now')} m−n={off}</text>)
    els.push(<text key="xl" x={W - 14} y={y0 - 6} textAnchor="end" fontFamily={T.font} fontSize={10} fill={T.c.dim}>{t('相对偏移 m−n →', 'offset m−n →')}</text>)
    return <svg width={W} height={H} style={{ display: 'block' }}>{els}</svg>
  }

  // ───────── 图 3:多频率「时钟指针」—— 一个向量怎样唯一编码位置 ─────────
  const th = useMemo(() => freqs(D, VIZ_BASE), [])
  const renderClocks = (cell) => {
    const r = cell * 1.4
    const gap = 30
    const top = 30
    const els = []
    let x = 30
    th.forEach((w, i) => {
      const cx = x + r
      const cy = top + r
      els.push(<circle key={`f${i}`} cx={cx} cy={cy} r={r} fill="none" stroke={T.c.border} strokeWidth={1} />)
      // 轨迹点 0..pos
      for (let p = 0; p <= pos; p++) {
        const a = p * w
        els.push(<circle key={`f${i}p${p}`} cx={cx + r * Math.cos(-a)} cy={cy + r * Math.sin(-a)}
          r={p === pos ? 0 : 1.6} fill={T.c.border} />)
      }
      const a = pos * w
      const hx = cx + r * Math.cos(-a)
      const hy = cy + r * Math.sin(-a)
      els.push(arrow(`h${i}`, cx, cy, hx, hy, T.c.accent, 2.4))
      els.push(<text key={`ft${i}`} x={cx} y={top + 2 * r + 16} textAnchor="middle" fontFamily={T.font} fontSize={10} fill={T.c.accent2}>
        {t('对', 'pair')}{i} θ={w.toFixed(2)}</text>)
      els.push(<text key={`fa${i}`} x={cx} y={top + 2 * r + 30} textAnchor="middle" fontFamily={T.font} fontSize={9} fill={T.c.dim}>
        {deg(a % (2 * Math.PI)).toFixed(0)}°</text>)
      x += 2 * r + gap
    })
    const capText = t(
      `位置 ${pos}:快指针(对0)转得多,慢指针(对3)几乎不动 —— 这组角度的组合 = 位置 ${pos} 的唯一「指纹」`,
      `Position ${pos}: the fast hand (pair 0) turns a lot, the slow hand (pair 3) barely moves — this set of angles is a unique "fingerprint" for position ${pos}`,
    )
    els.push(<text key="cap" x={30} y={14} fontFamily={T.font} fontSize={11} fill={T.c.dim}>{capText}</text>)
    const W = Math.max(x + 6, 30 + estTextW(capText) + 12)
    const H = top + 2 * r + 42
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  const ctl1 = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 56 }}>{t('方式', 'Mode')}</span>
        {[['add', '加法平移', 'Add (shift)'], ['rot', '旋转 RoPE', 'Rotate (RoPE)']].map(([k, lbl, lblEn]) => (
          <button key={k} className="btn" onClick={() => setMode(k)}
            style={{ padding: '2px 10px', background: mode === k ? 'var(--accent)' : 'var(--bg)',
              color: mode === k ? '#0f1115' : 'var(--text-dim)', fontWeight: mode === k ? 700 : 400 }}>{t(lbl, lblEn)}</button>
        ))}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 56 }}>{t('位置 m', 'pos m')}</span>
        <input type="range" min={0} max={8} step={1} value={m} onChange={(e) => setM(+e.target.value)} style={{ width: 120 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{m}</b>
      </label>
    </div>
  )
  const ctl2 = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 64 }}>{t('q 位置 m', 'q pos m')}</span>
        <input type="range" min={0} max={8} step={1} value={qm} onChange={(e) => setQm(+e.target.value)} style={{ width: 120 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{qm}</b>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 64 }}>{t('k 位置 n', 'k pos n')}</span>
        <input type="range" min={0} max={8} step={1} value={kn} onChange={(e) => setKn(+e.target.value)} style={{ width: 120 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent2)' }}>{kn}</b>
      </label>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>{t('相对位置', 'relative pos')} m−n = <b style={{ color: 'var(--warn)' }}>{off}</b></div>
    </div>
  )
  const ctl3 = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 56 }}>{t('位置', 'pos')}</span>
      <input type="range" min={0} max={12} step={1} value={pos} onChange={(e) => setPos(+e.target.value)} style={{ width: 130 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{pos}</b>
    </label>
  )

  return (
    <ChapterLayout
      kicker={t('第 3 章 · 位置信息 RoPE', 'Chapter 3 · Positions: RoPE')}
      title={t('位置信息 · 旋转位置编码 RoPE', 'Positions: RoPE (Rotary Position Embedding)')}
      prev={prev}
      next={next}
      translated
    >
      <>
        {lang === 'en' ? (
          <>
            <p>
              Attention itself is <b>order-blind</b> — shuffle the tokens and it computes exactly the same thing (it only sees "who resembles whom", not "who comes first").
              So we must <b>inject position information separately</b>. How? This picks up right where the last chapter's question left off: "the geometric difference between vector <b>addition</b> and <b>multiplication</b>".
            </p>
            <h2>Two routes: add something vs turn it</h2>
            <ul>
              <li><b>Early approach (add = translate)</b>: build a position vector p for each position and just do <code>x + p</code>.
                Problem: this is an <b>absolute</b> position, and it "pushes" x elsewhere with a wildly changing length (pick "Add" in the top-right figure to watch the vector grow longer and longer).</li>
              <li><b>RoPE (multiply = rotate)</b>: add nothing; instead <b>turn the vector by an angle that depends on position</b> <code>R(m·θ)·x</code>.
                Rotation is an <b>orthogonal transform</b>: <b>length unchanged, direction only</b>. The larger the position, the more it turns.</li>
            </ul>
            <h2>Why rotation is so elegant: relative position emerges for free</h2>
            <p>
              Attention's core is <code>q·k</code> (dot product = projection = how aligned the two are). After turning q by <code>m·θ</code> and k by <code>n·θ</code>,
              their angle differs by exactly <code>(m−n)·θ</code> — <b>the dot product depends only on the relative position (m−n)</b>; the absolute position cancels out.
              Second figure: fix m−n and, whatever m and n each are, <code>q·k</code> is identical (the curve moves only with m−n).
              This is the root of why a model can generalize to lengths it never saw and can "count distances".
            </p>
            <h2>How one vector holds a position: multi-frequency clocks</h2>
            <p>
              One pair of dimensions turns at a single speed, and after a full turn it repeats (can't tell position 0 from position "one lap later").
              RoPE <b>pairs the dimensions two by two</b>, giving the i-th pair a <b>different angular speed</b> <code>θ_i = base^(−2i/d)</code>:
              like a row of <b>clock hands</b>, some fast (the second hand), some slow (the hour hand). In the third figure,
              <b>the combination of these angles</b> is <b>unique</b> for every position — resolving nearby positions finely while never wrapping around over long ranges.
            </p>
            <div className="note">
              Tie-in to DeepSeek: RoPE is the standard position scheme in modern LLMs (LLaMA / Qwen / DeepSeek all use it).
              Later, <b>MLA (Chapter 11)</b> hits a snag — RoPE needs to "turn by position", while MLA wants to compress K into a cached latent,
              and the two clash. DeepSeek's fix is to <b>split q/k into a "with-RoPE" part and a "without-RoPE" part</b>.
              So this chapter is a prerequisite for understanding MLA.
            </div>
          </>
        ) : (
          <>
            <p>
              注意力本身<b>不分先后</b>——打乱 token 顺序,它算出来一模一样(它只看「谁和谁像」,不看「谁在前」)。
              所以必须<b>额外注入位置信息</b>。怎么注入?这正好接上你上一章问的「向量<b>加法</b> vs <b>乘法</b>的几何区别」。
            </p>
            <h2>两条路:加一个 vs 转一下</h2>
            <ul>
              <li><b>早期做法(加法 = 平移)</b>:给每个位置造一个位置向量 p,直接 <code>x + p</code>。
                问题:这是<b>绝对</b>位置,而且把 x「推」到别处、长度乱变(右上图选「加法」看向量越走越长)。</li>
              <li><b>RoPE(乘法 = 旋转)</b>:不加东西,而是<b>把向量按位置转一个角度</b> <code>R(m·θ)·x</code>。
                旋转是<b>正交变换</b>:<b>长度不变、只改方向</b>。位置越大,转得越多。</li>
            </ul>
            <h2>为什么旋转这么妙:相对位置自动浮现</h2>
            <p>
              注意力的核心是 <code>q·k</code>(点积 = 投影 = 看两者多对齐)。把 q 转 <code>m·θ</code>、k 转 <code>n·θ</code> 后,
              它们的夹角恰好差 <code>(m−n)·θ</code>——<b>点积只依赖相对位置 (m−n)</b>,绝对位置被消掉了。
              第二张图:固定 m−n,无论 m、n 各是多少,<code>q·k</code> 完全一样(曲线只随 m−n 变)。
              这就是模型能泛化到没见过的长度、能「数距离」的根。
            </p>
            <h2>一个向量怎么装下位置:多频率时钟</h2>
            <p>
              一对维度只转一种速度,转一圈就重复了(分不清位置 0 和位置「一圈后」)。
              RoPE 把向量<b>两两配对</b>,第 i 对用<b>不同角速度</b> <code>θ_i = base^(−2i/d)</code>:
              就像一排<b>时钟指针</b>,有的快(秒针)、有的慢(时针)。第三张图里,
              <b>这一组角度的组合</b>对每个位置都<b>独一无二</b>——既能精细分辨近处,又不会在长程上绕回。
            </p>
            <div className="note">
              落到 DeepSeek:RoPE 是现代 LLM 的标配位置方案(LLaMA / Qwen / DeepSeek 全用它)。
              后面 <b>MLA(第 11 章)</b>会遇到一个麻烦——RoPE 要「按位置转」,而 MLA 想把 K 压成潜变量缓存,
              两者打架,DeepSeek 的解法是<b>把 q/k 拆成「带 RoPE」和「不带 RoPE」两部分</b>。
              所以这一章是读懂 MLA 的前置。
            </div>
          </>
        )}
        <Refs ids={['2104.09864', '1706.03762', '2405.04434']} />
      </>
      <>
        <h3>{t('图 1 · 注入位置:加法(平移)vs 旋转(RoPE)', 'Figure 1 · Injecting position: add (translate) vs rotate (RoPE)')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {t('切换两种方式、拖动位置 m。加法让向量越走越长(长度被污染);旋转只改方向、长度恒定。',
            'Switch between the two schemes and drag position m. Addition makes the vector grow longer and longer (length gets polluted); rotation only changes direction, keeping length constant.')}
        </p>
        <FigureBoard renderSvg={renderInject} baseCell={20} fullCell={32} controls={ctl1} onPageStep={onPageStep} />

        <h3 style={{ marginTop: 18 }}>{t('图 2 · 相对位置不变性:q·k 只看 (m−n)', 'Figure 2 · Relative-position invariance: q·k depends only on (m−n)')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {lang === 'en' ? (
            <>
              q (blue) at position m, k (green) at position n; after each is rotated the angle between them = (m−n)·θ. The curve below is q·k as a function of the <b>relative offset</b> —
              the same m−n always gives the same dot product (try m=5, n=2 and m=6, n=3: identical results).
            </>
          ) : (
            <>
              q(蓝)在位置 m、k(绿)在位置 n,各自旋转后夹角 = (m−n)·θ。下方曲线是 q·k 随<b>相对偏移</b>的变化——
              同一个 m−n 永远给同一个点积(试试 m=5,n=2 和 m=6,n=3,结果一致)。
            </>
          )}
        </p>
        <FigureBoard renderSvg={renderRelative} baseCell={20} fullCell={32} controls={ctl2} />
        <div style={{ marginTop: 10, overflowX: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
          {renderCurve(0)}
        </div>

        <h3 style={{ marginTop: 18 }}>{t('图 3 · 多频率时钟:一个向量如何唯一编码位置', 'Figure 3 · Multi-frequency clocks: how one vector uniquely encodes position')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {lang === 'en' ? (
            <>
              {D} dims → {D / 2} pairs, one hand per pair, with angular speed θ_i decreasing by the base (teaching base={VIZ_BASE}, real value 10000).
              Drag the position: the fast hands spin wildly, the slow hands barely move, together forming an angle fingerprint unique to each position.
            </>
          ) : (
            <>
              {D} 维 → {D / 2} 对,每对一根指针,角速度 θ_i 按底数递减(教学用 base={VIZ_BASE},真实 10000)。
              拖动位置:快指针狂转、慢指针微动,组合出每个位置独一无二的角度指纹。
            </>
          )}
        </p>
        <FigureBoard renderSvg={renderClocks} baseCell={26} fullCell={40} controls={ctl3} />
      </>
    </ChapterLayout>
  )
}
