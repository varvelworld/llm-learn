import { useState, useMemo } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Tex from '../components/Tex.jsx'
import Refs from '../components/Refs.jsx'
import { T } from '../components/svg/theme.js'
import { seededMatrix } from '../lib/synth.js'
import { expectedAccept, speedup, parallelDraft, cumSurvival, scheduleLength } from '../lib/specdec.js'

// 图①:两个互斥「句意模式」(逐位都不同,混着取就串味)
const MODE_A = ['of', 'course', 'I', 'can', 'solve', 'this', 'for', 'you']
const MODE_B = ['no', 'problem', 'we', 'will', 'handle', 'that', 'right', 'now']
const C_PAR = 0.5 // 并行:块内独立 → 多峰碰撞,连贯概率 ~0.5
const C_SAR = 0.85 // 半自回归:建模块内依赖 → 连贯概率更高
const SEED = 8 // 让并行抽样在第 2 个 token 串味:'of'(A)+'problem'(B)="of problem" ✗

// 图②:一块草稿的逐位置信度(越靠后越低)
const DRAFT = ['E', 'F', 'G', 'H', 'I', 'J']
const CONFS = [0.97, 0.88, 0.74, 0.58, 0.4, 0.26]

export default function Ch19DSpark({ prev, next }) {
  const [L, setL] = useState(8) // 图① 块长
  const [load, setLoad] = useState(35) // 图② 系统负载 %

  const d = useMemo(() => {
    const row = seededMatrix(1, 8, SEED)[0]
    const par = parallelDraft(row, L)
    return { par, ePar: expectedAccept(C_PAR, L), eSar: expectedAccept(C_SAR, L), spPar: speedup(C_PAR, L), spSar: speedup(C_SAR, L) }
  }, [L])

  const sched = useMemo(() => {
    const theta = (load / 100) * 0.95 // 负载越高 → 阈值越高 → 验得越少
    const a = cumSurvival(CONFS)
    const l = scheduleLength(CONFS, theta)
    const tau = 1 + a.slice(0, l).reduce((s, x) => s + x, 0)
    return { theta, a, l, tau }
  }, [load])

  // —— 图①:并行串味 vs 半自回归连贯 —— //
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
      els.push(<text key={`l${ri}`} x={lx - 8} y={y + rowH / 2 + 2} textAnchor="end" fontFamily={T.font} fontSize={10} fill={T.c.accent}>并行草</text>)
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
    drawBar(0, '并行草', d.ePar, d.spPar, T.c.accent)
    drawBar(1, 'DSpark', d.eSar, d.spSar, T.c.accent2)
    const W = Math.max(lx + L * tw + 10, barL + barMax + 130)
    const H = by + 2 * 26 + 8
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  // —— 图②:置信度打分 + 按负载调度验证长度 —— //
  const renderSched = (cell) => {
    const cs = cell
    const cw = Math.max(cs * 1.7, 50)
    const lx = 40
    const top = 20
    const ph = cs * 3.4 // 绘图高
    const base = top + ph
    const els = []
    const Y = (v) => base - v * ph
    // y 轴刻度 0 / 0.5 / 1
    for (const t of [0, 0.5, 1]) {
      els.push(<line key={`gl${t}`} x1={lx} y1={Y(t)} x2={lx + DRAFT.length * cw} y2={Y(t)} stroke={T.c.border} strokeWidth={0.5} strokeDasharray={t === 0 ? '' : '3 3'} />)
      els.push(<text key={`gt${t}`} x={lx - 4} y={Y(t) + 3} textAnchor="end" fontFamily={T.font} fontSize={8.5} fill={T.c.dim}>{t}</text>)
    }
    // 阈值线 θ
    els.push(<line key="th" x1={lx} y1={Y(sched.theta)} x2={lx + DRAFT.length * cw} y2={Y(sched.theta)} stroke={T.c.warn} strokeWidth={1.2} strokeDasharray="5 3" />)
    els.push(<text key="thl" x={lx + DRAFT.length * cw + 4} y={Y(sched.theta) + 3} fontFamily={T.font} fontSize={9} fill={T.c.warn}>θ={sched.theta.toFixed(2)}</text>)
    // 每个 token:置信度条 c_k + 前缀存活点 a_j
    const aPts = []
    for (let i = 0; i < DRAFT.length; i++) {
      const x = lx + i * cw
      const verify = i < sched.l
      const c = CONFS[i]
      const bw = cw * 0.5
      const col = verify ? T.c.accent2 : T.c.dim
      els.push(<rect key={`cb${i}`} x={x + (cw - bw) / 2} y={Y(c)} width={bw} height={base - Y(c)} rx={2} fill={col} opacity={verify ? 0.8 : 0.35} />)
      els.push(<text key={`cv${i}`} x={x + cw / 2} y={Y(c) - 3} textAnchor="middle" fontFamily={T.font} fontSize={8.5} fill={col}>{c.toFixed(2)}</text>)
      els.push(<text key={`tk${i}`} x={x + cw / 2} y={base + 13} textAnchor="middle" fontFamily={T.font} fontSize={11} fontWeight={700} fill={verify ? T.c.accent2 : T.c.dim}>{DRAFT[i]}</text>)
      els.push(<text key={`st${i}`} x={x + cw / 2} y={base + 25} textAnchor="middle" fontFamily={T.font} fontSize={8.5} fill={verify ? T.c.accent2 : T.c.dim}>{verify ? '验证' : '丢弃'}</text>)
      aPts.push([x + cw / 2, Y(sched.a[i])])
    }
    // a_j 折线 + 点
    els.push(<polyline key="aline" points={aPts.map((p) => p.join(',')).join(' ')} fill="none" stroke={T.c.accent} strokeWidth={1.6} />)
    aPts.forEach(([x, y], i) => els.push(<circle key={`ap${i}`} cx={x} cy={y} r={2.6} fill={T.c.accent} />))
    // 验证截断竖线
    const cutX = lx + sched.l * cw
    els.push(<line key="cut" x1={cutX} y1={top - 4} x2={cutX} y2={base + 28} stroke={T.c.hot} strokeWidth={1.2} strokeDasharray="4 3" />)
    // 图例
    els.push(<text key="lg" x={lx} y={top - 8} fontFamily={T.font} fontSize={9} fill={T.c.dim}>
      <tspan fill={T.c.accent2}>实心条 = 单步置信度 cₖ</tspan>　<tspan fill={T.c.accent}>折线 = 前缀存活 aⱼ=∏cᵢ</tspan>　<tspan fill={T.c.warn}>θ=负载阈值</tspan></text>)
    const W = lx + DRAFT.length * cw + 56
    const H = base + 34
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  const blockControls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 110 }}>块长 L(草几个)</span>
      <input type="range" min={2} max={8} step={1} value={L} onChange={(e) => setL(+e.target.value)} style={{ width: 140 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{L}</b>
    </label>
  )
  const schedControls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 110 }}>系统负载</span>
      <input type="range" min={0} max={100} step={1} value={load} onChange={(e) => setLoad(+e.target.value)} style={{ width: 140 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{load}%</b>
      <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{load < 30 ? '(空闲:多验)' : load > 70 ? '(繁忙:少验)' : ''}</span>
    </label>
  )

  const losslessTex = `\\text{接受概率}=\\min\\!\\Big(1,\\;\\frac{\\textcolor{#7ee787}{p_{\\text{大}}(x)}}{\\textcolor{#6ea8fe}{q_{\\text{草}}(x)}}\\Big)
\\;\\Rightarrow\\;\\text{输出分布}\\equiv p_{\\text{大}}\\ (\\textbf{无损})`
  const latencyTex = `L=\\frac{\\textcolor{#6ea8fe}{T_{\\text{draft}}}+\\textcolor{#f0a35e}{T_{\\text{verify}}}}{\\textcolor{#7ee787}{\\tau}}
\\;\\Rightarrow\\;\\text{三杠杆:}\\;\\textcolor{#6ea8fe}{T_{\\text{draft}}\\!\\downarrow},\\;\\textcolor{#7ee787}{\\tau\\!\\uparrow},\\;\\textcolor{#f0a35e}{T_{\\text{verify}}\\!\\downarrow}`
  const biasTex = `p_k(x_k\\mid x_0,x_{<k})=\\mathrm{softmax}\\big(\\textcolor{#6ea8fe}{U_k}+\\textcolor{#7ee787}{B_k(x_{<k})}\\big)
\\quad\\substack{\\textcolor{#6ea8fe}{U_k:\\text{并行骨架基础分}}\\\\[2pt]\\textcolor{#7ee787}{B_k:\\text{串行块转移偏置}}}`
  const confTex = `c_k=\\sigma\\big(w^{\\top}[\\,h_k;\\,e_{x_{k-1}}]\\big)\\in(0,1),\\qquad
a_j=\\prod_{i\\le j}c_i\\;(\\text{前缀存活,单调}\\downarrow),\\qquad
c_k^{*}=1-\\tfrac12\\lVert p^d_k-p^t_k\\rVert_1`
  const schedTex = `\\max_{\\ell_1,\\dots,\\ell_R}\\;\\Theta=\\textcolor{#7ee787}{\\tau}\\cdot\\mathrm{SPS}(B),
\\quad \\textcolor{#7ee787}{\\tau}=\\sum_r\\Big(1+\\sum_{j\\le\\ell_r}a_{r,j}\\Big),
\\quad B=\\sum_r(1+\\ell_r)`

  return (
    <ChapterLayout kicker="第二部分 · DeepSeek-V4 · Ch19" title="DSpark:让投机解码的草稿更靠谱" prev={prev} next={next}>
      <>
        <h2>0 · 投机解码基础</h2>
        <p>
          大模型生成慢在<b>一次只蹦一个字</b>,每个字都要把整个模型从头算一遍。
          <b>投机解码</b>打个比方:一个<b>老板</b>(大模型,聪明但慢)配一个<b>实习生</b>(drafter,一般但快)。
          实习生先<b>飞快草一串词</b>,老板<b>一眼扫完整串</b>:开头对的<b>照单全收</b>、碰到第一个错的就接手写对。
          这样老板一次能敲定<b>一整串</b>字,于是快了好几倍。
        </p>
        <p>
          最妙的是<b>无损</b>:每字都经老板把关(下式的拒绝采样规则),最终输出<b>和大模型逐字写出来的一字不差</b>。
        </p>
        <div style={{ fontSize: 13.5, overflowX: 'auto', margin: '6px 0' }}><Tex block>{losslessTex}</Tex></div>
        <p>
          那提速由什么决定?把「每个字的平均耗时」拆开,就是全章<b>总纲</b>(论文公式 1):一轮<b>草稿</b>花
          <Tex>{'T_{\\text{draft}}'}</Tex>、<b>验证</b>花 <Tex>{'T_{\\text{verify}}'}</Tex>,这一轮敲定 <Tex>{'\\tau'}</Tex> 个字(<b>接受长度</b>):
        </p>
        <div style={{ fontSize: 14, overflowX: 'auto', margin: '6px 0' }}><Tex block>{latencyTex}</Tex></div>
        <p>
          想更快只有<b>三条杠杆</b>:<b style={{ color: 'var(--accent)' }}>① 草得快(↓T_draft)</b>、
          <b style={{ color: 'var(--accent-2)' }}>② 草得准(↑τ)</b>、<b style={{ color: 'var(--warn)' }}>③ 验得省(↓T_verify)</b>。
          DSpark 的三个模块正好各管一条——下面逐块拆。
        </p>

        <h2>1 · 半自回归 —— 管 ① T_draft 和 ② τ</h2>
        <p>实习生有两种草法,各有死穴:</p>
        <ul>
          <li><b>自回归</b>:写每字都看着<b>刚写的上一个字</b>,连贯、<b style={{ color: 'var(--accent-2)' }}>τ 高</b>——
            但 <b style={{ color: 'var(--accent)' }}>T_draft ∝ 块长</b>(越草越慢),只能草很短。</li>
          <li><b>并行</b>:所有位置<b>同时各写各的</b>,<b style={{ color: 'var(--accent)' }}>T_draft≈一次前向</b>(飞快)——
            但互相不看,<b style={{ color: 'var(--accent-2)' }}>τ 低</b>:回应既可「<b>of course</b>」也可「<b>no problem</b>」,
            位置 1 挑 <b>of</b>、位置 2 挑 <b>problem</b>,拼成 <b style={{ color: 'var(--warn)' }}>“of problem”</b> ✗(<b>多峰碰撞</b>),越往后越易串味(图①)。</li>
        </ul>
        <p>
          <b>DSpark 的半自回归</b>:用<b>并行骨架</b>一次出每个位置的<b>基础分</b> <Tex>{'U_k'}</Tex>(保住 T_draft 快),
          再挂一个<b>轻量串行块</b>给每个位置加一个<b>转移偏置</b> <Tex>{'B_k'}</Tex>——它看着已采样的前文:
          采了「of」就给「course」<b>加分</b>、给「problem」<b>减分</b>,于是块内连贯、<b>τ 抬高</b>。
        </p>
        <div style={{ fontSize: 13.5, overflowX: 'auto', margin: '6px 0' }}><Tex block>{biasTex}</Tex></div>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '2px 0' }}>
          <Tex>{'B_k'}</Tex> 的轻量实现:<b>Markov 头</b>(只看前一个字,低秩 <Tex>{'W_1W_2,\\ r{=}256'}</Tex>)或 <b>RNN 头</b>(带块内记忆)。
        </p>

        <h2>2 · 置信度打分 —— 为 ③ 铺路</h2>
        <p>
          想「验得省」,得先知道<b>每个草稿字有多大把握过审</b>。DSpark 给 drafter 加一个<b>置信度头</b>:
          对每个位置输出一个分数 <Tex>{'c_k\\in(0,1)'}</Tex>,含义是「<b>在前面的字都被接受的条件下,这个字能过审的概率</b>」。
          把它们<b>连乘</b>就得到<b>前缀存活率</b> <Tex>{'a_j=\\prod_{i\\le j}c_i'}</Tex>——<b>越靠后越低</b>(图②折线)。
        </p>
        <div style={{ fontSize: 13, overflowX: 'auto', margin: '6px 0' }}><Tex block>{confTex}</Tex></div>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '2px 0' }}>
          训练时用<b>解析接受率</b> <Tex>{'c_k^{*}=1-\\tfrac12\\lVert p^d_k-p^t_k\\rVert_1'}</Tex>(草稿分布与大模型分布的总变差距离)当监督目标;
          再做一次校准(STS),让 <Tex>{'c_k'}</Tex> 的<b>绝对数值</b>可信,好给第 3 步算吞吐用。
        </p>

        <h2>3 · 动态调度 —— 管 ③ T_verify</h2>
        <p>
          验证一个额外的字,代价<b>看系统负载</b>:<b>空闲时几乎免费</b>(多验几个无所谓),
          <b>繁忙时每个名额都金贵</b>(验一个没用的就挤掉别人的请求)。所以不该用<b>固定阈值</b>一刀切。
        </p>
        <p>
          DSpark 的<b>硬件感知调度器</b>把它变成一道<b>吞吐最大化</b>题:给每个请求选验证长度 <Tex>{'\\ell'}</Tex>,
          最大化全局吞吐 <Tex>{'\\Theta=\\tau\\cdot\\mathrm{SPS}(B)'}</Tex>(<Tex>{'\\mathrm{SPS}(B)'}</Tex> 是批大小 <Tex>{'B'}</Tex> 下引擎的每秒步数,开机时测一张表)。
          按前缀存活 <Tex>{'a_j'}</Tex> 从高到低贪心地加验证名额,加到吞吐不再上升就停:
        </p>
        <div style={{ fontSize: 13, overflowX: 'auto', margin: '6px 0' }}><Tex block>{schedTex}</Tex></div>
        <p>
          直观就是:<b style={{ color: 'var(--accent-2)' }}>空闲时多验</b>(尽量长)、
          <b style={{ color: 'var(--warn)' }}>繁忙时只验高把握的前缀、砍掉低置信尾巴</b> → 压住 T_verify(图②拖负载看截断线移动)。
        </p>

        <div className="note">
          实测:接受长度比 <b>Eagle-3 高 26~31%</b>、比 <b>DFlash 高 16~18%</b>;每用户生成速度
          <b>Flash +60~85% / Pro +57~78%</b>(对比 MTP-1 基线)。DSpark 是<b>纯推理侧</b>升级,
          <b>不改模型架构、不改输出分布</b>;训练/评测代码库 <b>DeepSpec</b> 已开源(含 DSpark/DFlash/Eagle3)。
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          <b>诚实简化</b>:图① 把「连贯概率」抽象成单个 <Tex>{'c'}</Tex>(并行≈0.5、半自回归更高),其「加速比=τ+1」只演示杠杆②;
          图② 的调度用「负载→阈值 θ,保留 <Tex>{'a_j\\ge\\theta'}</Tex> 的前缀」近似真实的 <Tex>{'\\Theta'}</Tex> 贪心最大化。结论方向一致。
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
        <h3>图① 半自回归:并行「串味」截断 vs DSpark 块内连贯</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          上两行是两种合理说法(句意 A / B)。「并行草」每位独立采样,采到第 {d.par.firstCollision + 1} 个就串味
          (<b style={{ color: 'var(--hot,#ff6b6b)' }}>✗</b>)、其后全被拒;「DSpark」块内有依赖、保持连贯。
          拖块长 L:并行 τ 很快饱和、DSpark 随 L 继续涨。
        </p>
        <FigureBoard renderSvg={renderBlock} baseCell={26} fullCell={34} controls={blockControls} />
        <div style={{ marginTop: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: 'var(--text-dim)' }}>
          当前 L={L}:并行期望接受 <b style={{ color: 'var(--accent)' }}>{d.ePar.toFixed(2)}</b>(加速 {d.spPar.toFixed(1)}×,已饱和);
          DSpark <b style={{ color: 'var(--accent2)' }}>{d.eSar.toFixed(2)}</b>(加速 {d.spSar.toFixed(1)}×,随块长涨)。
        </div>

        <h3 style={{ marginTop: 18 }}>图② 置信度打分 + 动态调度:按负载决定验证几个</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          一块草稿 E…J,实心条是各位置置信度 <b style={{ color: 'var(--accent-2)' }}>cₖ</b>、折线是前缀存活 <b style={{ color: 'var(--accent)' }}>aⱼ</b>(越靠后越低)。
          拖<b>系统负载</b>:负载越高、阈值 <b style={{ color: 'var(--warn)' }}>θ</b> 越高,<b style={{ color: 'var(--hot,#ff6b6b)' }}>截断线</b>左移、验证的字更少(只留高把握前缀)。
        </p>
        <FigureBoard renderSvg={renderSched} baseCell={28} fullCell={38} controls={schedControls} />
        <div style={{ marginTop: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: 'var(--text-dim)' }}>
          当前负载 <b style={{ color: 'var(--accent)' }}>{load}%</b>(阈值 θ={sched.theta.toFixed(2)}):这一块草稿只验证<b style={{ color: 'var(--accent2)' }}>前 {sched.l} 个</b>字
          (砍掉 {DRAFT.length - sched.l} 个低置信尾巴),期望接受 τ≈<b style={{ color: 'var(--accent2)' }}>{sched.tau.toFixed(2)}</b>。
          {load > 70 ? ' 繁忙 → 验得省、把名额让给别的请求。' : load < 30 ? ' 空闲 → 多验几个、尽量多收字。' : ''}
        </div>
      </>
    </ChapterLayout>
  )
}
