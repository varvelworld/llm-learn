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

// 图①:半自回归两阶段架构(锚点+mask → 并行骨架 → 串行头)
const ATOK = ['E', 'F', 'G', 'H'] // γ=4 个草稿位置

export default function Ch19DSpark({ prev, next }) {
  const [archStep, setArchStep] = useState(2) // 图① 串行头已采样到第几位
  const [L, setL] = useState(8) // 图② 块长

  const d = useMemo(() => {
    const row = seededMatrix(1, 8, SEED)[0]
    const par = parallelDraft(row, L)
    return { par, ePar: expectedAccept(C_PAR, L), eSar: expectedAccept(C_SAR, L), spPar: speedup(C_PAR, L), spSar: speedup(C_SAR, L) }
  }, [L])

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

  const losslessTex = `\\text{接受概率}=\\min\\!\\Big(1,\\;\\frac{\\textcolor{#7ee787}{p_{\\text{大}}(x)}}{\\textcolor{#6ea8fe}{q_{\\text{草}}(x)}}\\Big)
\\;\\Rightarrow\\;\\text{输出分布}\\equiv p_{\\text{大}}\\ (\\textbf{无损})`
  const latencyTex = `L=\\frac{\\textcolor{#6ea8fe}{T_{\\text{draft}}}+\\textcolor{#f0a35e}{T_{\\text{verify}}}}{\\textcolor{#7ee787}{\\tau}}
\\;\\Rightarrow\\;\\text{三杠杆:}\\;\\textcolor{#6ea8fe}{T_{\\text{draft}}\\!\\downarrow},\\;\\textcolor{#7ee787}{\\tau\\!\\uparrow},\\;\\textcolor{#f0a35e}{T_{\\text{verify}}\\!\\downarrow}`
  const biasTex = `p_k(x_k\\mid x_0,x_{<k})=\\mathrm{softmax}\\big(\\textcolor{#6ea8fe}{U_k}+\\textcolor{#7ee787}{B_k(x_{<k})}\\big)
\\quad\\substack{\\textcolor{#6ea8fe}{U_k:\\text{并行骨架基础分}}\\\\[2pt]\\textcolor{#7ee787}{B_k:\\text{串行块转移偏置}}}`

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
          最妙的是<b>无损</b>:每字都经老板把关(下式的拒绝采样规则),最终输出<b>和大模型逐字写出来的一字不差</b>。
        </p>
        <div style={{ fontSize: 13.5, overflowX: 'auto', margin: '6px 0' }}><Tex block>{losslessTex}</Tex></div>
        <p>
          那提速由什么决定?把「每个字的平均耗时」拆开,就是 DSpark 的<b>总纲</b>(论文公式 1):一轮<b>草稿</b>花
          <Tex>{'T_{\\text{draft}}'}</Tex>、<b>验证</b>花 <Tex>{'T_{\\text{verify}}'}</Tex>,这一轮敲定 <Tex>{'\\tau'}</Tex> 个字(<b>接受长度</b>):
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
            位置 1 挑 <b>of</b>、位置 2 挑 <b>problem</b>,拼成 <b style={{ color: 'var(--warn)' }}>“of problem”</b> ✗(<b>多峰碰撞</b>),越往后越易串味(图②)。</li>
        </ul>
        <p>
          <b>DSpark 的半自回归</b>(架构见<b>图①</b>):用<b>并行骨架</b>一次前向出每个位置的<b>基础分</b> <Tex>{'U_k'}</Tex>(保住 T_draft 快),
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
          <b>诚实简化</b>:图① 是架构示意(略去 KV 注入、mask 细节);图② 把「连贯概率」抽象成单个 <Tex>{'c'}</Tex>
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
        <h3>图① 半自回归架构:并行骨架(重)+ 串行头(轻)</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          自上而下:大模型给的<b>锚点 D + mask</b> → <b style={{ color: 'var(--accent)' }}>并行骨架一次前向</b>同时算出所有位置的基础分 <b>Uₖ</b>
          (快,但各位置独立→会碰撞)→ <b style={{ color: 'var(--accent-2)' }}>串行头左→右</b>逐位把 <b>Uₖ + Bₖ(前一字)</b> 再采样
          (极轻,注入依赖→连贯)。拖「采样进度」看串行头一格格填、依赖箭头一段段接上。
        </p>
        <FigureBoard renderSvg={renderArch} baseCell={28} fullCell={38} controls={archControls} />

        <h3 style={{ marginTop: 18 }}>图② 半自回归的效果:并行「串味」截断 vs 块内连贯</h3>
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
