import { useState, useMemo } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Tex from '../components/Tex.jsx'
import Refs from '../components/Refs.jsx'
import { T } from '../components/svg/theme.js'
import { cumSurvival, scheduleLength } from '../lib/specdec.js'

// 一块草稿的逐位置信度(越靠后越低)
const DRAFT = ['E', 'F', 'G', 'H', 'I', 'J']
const CONFS = [0.97, 0.88, 0.74, 0.58, 0.4, 0.26]

export default function Ch21DSparkSched({ prev, next }) {
  const [load, setLoad] = useState(35) // 系统负载 %

  const sched = useMemo(() => {
    const theta = (load / 100) * 0.95 // 负载越高 → 阈值越高 → 验得越少
    const a = cumSurvival(CONFS)
    const l = scheduleLength(CONFS, theta)
    const tau = 1 + a.slice(0, l).reduce((s, x) => s + x, 0)
    return { theta, a, l, tau }
  }, [load])

  // —— 图①:置信度打分 + 按负载调度验证长度 —— //
  const renderSched = (cell) => {
    const cs = cell
    const cw = Math.max(cs * 1.7, 50)
    const lx = 40
    const top = 20
    const ph = cs * 3.4
    const base = top + ph
    const els = []
    const Y = (v) => base - v * ph
    for (const t of [0, 0.5, 1]) {
      els.push(<line key={`gl${t}`} x1={lx} y1={Y(t)} x2={lx + DRAFT.length * cw} y2={Y(t)} stroke={T.c.border} strokeWidth={0.5} strokeDasharray={t === 0 ? '' : '3 3'} />)
      els.push(<text key={`gt${t}`} x={lx - 4} y={Y(t) + 3} textAnchor="end" fontFamily={T.font} fontSize={8.5} fill={T.c.dim}>{t}</text>)
    }
    els.push(<line key="th" x1={lx} y1={Y(sched.theta)} x2={lx + DRAFT.length * cw} y2={Y(sched.theta)} stroke={T.c.warn} strokeWidth={1.2} strokeDasharray="5 3" />)
    els.push(<text key="thl" x={lx + DRAFT.length * cw + 4} y={Y(sched.theta) + 3} fontFamily={T.font} fontSize={9} fill={T.c.warn}>θ={sched.theta.toFixed(2)}</text>)
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
    els.push(<polyline key="aline" points={aPts.map((p) => p.join(',')).join(' ')} fill="none" stroke={T.c.accent} strokeWidth={1.6} />)
    aPts.forEach(([x, y], i) => els.push(<circle key={`ap${i}`} cx={x} cy={y} r={2.6} fill={T.c.accent} />))
    const cutX = lx + sched.l * cw
    els.push(<line key="cut" x1={cutX} y1={top - 4} x2={cutX} y2={base + 28} stroke={T.c.hot} strokeWidth={1.2} strokeDasharray="4 3" />)
    els.push(<text key="lg" x={lx} y={top - 8} fontFamily={T.font} fontSize={9} fill={T.c.dim}>
      <tspan fill={T.c.accent2}>实心条 = 单步置信度 cₖ</tspan>　<tspan fill={T.c.accent}>折线 = 前缀存活 aⱼ=∏cᵢ</tspan>　<tspan fill={T.c.warn}>θ=负载阈值</tspan></text>)
    const W = lx + DRAFT.length * cw + 56
    const H = base + 34
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  const schedControls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 110 }}>系统负载</span>
      <input type="range" min={0} max={100} step={1} value={load} onChange={(e) => setLoad(+e.target.value)} style={{ width: 140 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{load}%</b>
      <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{load < 30 ? '(空闲:多验)' : load > 70 ? '(繁忙:少验)' : ''}</span>
    </label>
  )

  const schedTex = `\\max_{\\ell_1,\\dots,\\ell_R}\\;\\Theta=\\textcolor{#7ee787}{\\tau}\\cdot\\mathrm{SPS}(B),
\\quad \\textcolor{#7ee787}{\\tau}=\\sum_r\\Big(1+\\sum_{j\\le\\ell_r}a_{r,j}\\Big),
\\quad B=\\sum_r(1+\\ell_r)`

  return (
    <ChapterLayout kicker="第二部分 · DeepSeek-V4 · Ch21" title="DSpark(三)· 动态调度" prev={prev} next={next}>
      <>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          上一章的<b>置信度头</b>给了每个草稿字「能过审的把握」<Tex>{'c_k'}</Tex>,以及前缀存活
          <Tex>{'a_j=\\prod_{i\\le j}c_i'}</Tex>(越靠后越低)。本章用它压住最后一条杠杆——<b>验证省(↓T_verify)</b>。
        </p>
        <h2>验证几个,要看系统忙不忙</h2>
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
          直观就是(图①):<b style={{ color: 'var(--accent-2)' }}>空闲时多验</b>(尽量长)、
          <b style={{ color: 'var(--warn)' }}>繁忙时只验高把握的前缀、砍掉低置信尾巴</b> → 压住 T_verify。
        </p>
        <div className="note">
          <b>三招合一</b>:半自回归(↓T_draft、↑τ)+ 置信度打分 + 动态调度(↓T_verify)。实测:接受长度比
          <b>Eagle-3 高 26~31%</b>、比 <b>DFlash 高 16~18%</b>;每用户生成速度 <b>Flash +60~85% / Pro +57~78%</b>
          (对比 MTP-1 基线)。DSpark 是<b>纯推理侧</b>升级,<b>不改模型架构、不改输出分布</b>;
          训练/评测代码库 <b>DeepSpec</b> 已开源(含 DSpark/DFlash/Eagle3)。
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          <b>诚实简化</b>:图① 用「负载→阈值 θ,保留 <Tex>{'a_j\\ge\\theta'}</Tex> 的前缀」近似真实的 <Tex>{'\\Theta'}</Tex> 贪心最大化;结论方向一致(负载越高、验得越少)。
        </div>
        <Refs
          ids={['2606.19348', '2211.17192']}
          extra={[
            { label: 'DeepSeek 2026 · DSpark 论文(§3.2.2 Hardware-Aware Prefix Scheduler / Algorithm 1)', url: 'https://github.com/deepseek-ai/DeepSpec/blob/main/DSpark_paper.pdf' },
            { label: 'deepseek-ai/DeepSpec · 开源代码库', url: 'https://github.com/deepseek-ai/DeepSpec' },
          ]}
        />
      </>
      <>
        <h3>图① 动态调度:按负载决定验证几个</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          一块草稿 E…J,实心条是各位置置信度 <b style={{ color: 'var(--accent-2)' }}>cₖ</b>、折线是前缀存活 <b style={{ color: 'var(--accent)' }}>aⱼ</b>(越靠后越低)。
          拖<b>系统负载</b>:负载越高、阈值 <b style={{ color: 'var(--warn)' }}>θ</b> 越高,<b style={{ color: 'var(--hot,#ff6b6b)' }}>截断线</b>左移、验证的字更少(只留高把握前缀)。
        </p>
        <FigureBoard renderSvg={renderSched} baseCell={28} fullCell={38} controls={schedControls} />
        <div style={{ marginTop: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: 'var(--text-dim)' }}>
          当前负载 <b style={{ color: 'var(--accent)' }}>{load}%</b>(阈值 θ={sched.theta.toFixed(2)}):这一块草稿只验证<b style={{ color: 'var(--accent2)' }}>前 {sched.l} 个</b>字
          (砍掉 {DRAFT.length - sched.l} 个低置信尾巴),期望接受 τ≈<b style={{ color: 'var(--accent2)' }}>{sched.tau.toFixed(2)}</b>。
          {load > 70 ? ' 繁忙 → 验证更省、把名额让给别的请求。' : load < 30 ? ' 空闲 → 多验几个、尽量多收字。' : ''}
        </div>
      </>
    </ChapterLayout>
  )
}
