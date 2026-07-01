import { useState, useMemo } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Tex from '../components/Tex.jsx'
import Refs from '../components/Refs.jsx'
import { T } from '../components/svg/theme.js'
import { cumSurvival, scheduleLength } from '../lib/specdec.js'
import { useLang, useT } from '../i18n/lang.jsx'

// 一块草稿的逐位置信度(越靠后越低)
const DRAFT = ['E', 'F', 'G', 'H', 'I', 'J']
const CONFS = [0.97, 0.88, 0.74, 0.58, 0.4, 0.26]

// 英文更长,按文本宽度兜底避免裁切(CJK≈11、ASCII≈6.4)
const estTextW = (s) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 11 : 6.4), 0)

export default function Ch21DSparkSched({ prev, next }) {
  const t = useT()
  const { lang } = useLang()
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
    for (const tok of [0, 0.5, 1]) {
      els.push(<line key={`gl${tok}`} x1={lx} y1={Y(tok)} x2={lx + DRAFT.length * cw} y2={Y(tok)} stroke={T.c.border} strokeWidth={0.5} strokeDasharray={tok === 0 ? '' : '3 3'} />)
      els.push(<text key={`gt${tok}`} x={lx - 4} y={Y(tok) + 3} textAnchor="end" fontFamily={T.font} fontSize={8.5} fill={T.c.dim}>{tok}</text>)
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
      els.push(<text key={`st${i}`} x={x + cw / 2} y={base + 25} textAnchor="middle" fontFamily={T.font} fontSize={8.5} fill={verify ? T.c.accent2 : T.c.dim}>{verify ? t('验证', 'verify') : t('丢弃', 'discard')}</text>)
      aPts.push([x + cw / 2, Y(sched.a[i])])
    }
    els.push(<polyline key="aline" points={aPts.map((p) => p.join(',')).join(' ')} fill="none" stroke={T.c.accent} strokeWidth={1.6} />)
    aPts.forEach(([x, y], i) => els.push(<circle key={`ap${i}`} cx={x} cy={y} r={2.6} fill={T.c.accent} />))
    const cutX = lx + sched.l * cw
    els.push(<line key="cut" x1={cutX} y1={top - 4} x2={cutX} y2={base + 28} stroke={T.c.hot} strokeWidth={1.2} strokeDasharray="4 3" />)
    const legA = t('实心条 = 单步置信度 cₖ', 'solid bar = per-step confidence cₖ')
    const legB = t('折线 = 前缀存活 aⱼ=∏cᵢ', 'line = prefix survival aⱼ=∏cᵢ')
    const legC = t('θ=负载阈值', 'θ=load threshold')
    els.push(<text key="lg" x={lx} y={top - 8} fontFamily={T.font} fontSize={9} fill={T.c.dim}>
      <tspan fill={T.c.accent2}>{legA}</tspan>　<tspan fill={T.c.accent}>{legB}</tspan>　<tspan fill={T.c.warn}>{legC}</tspan></text>)
    const legW = lx + estTextW(`${legA}　${legB}　${legC}`) + 10
    const W = Math.max(lx + DRAFT.length * cw + 56, legW)
    const H = base + 34
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  const schedControls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 110 }}>{t('系统负载', 'System load')}</span>
      <input type="range" min={0} max={100} step={1} value={load} onChange={(e) => setLoad(+e.target.value)} style={{ width: 140 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{load}%</b>
      <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{load < 30 ? t('(空闲:多验)', '(idle: verify more)') : load > 70 ? t('(繁忙:少验)', '(busy: verify fewer)') : ''}</span>
    </label>
  )

  const schedTex = `\\max_{\\ell_1,\\dots,\\ell_R}\\;\\Theta=\\textcolor{#7ee787}{\\tau}\\cdot\\mathrm{SPS}(B),
\\quad \\textcolor{#7ee787}{\\tau}=\\sum_r\\Big(1+\\sum_{j\\le\\ell_r}a_{r,j}\\Big),
\\quad B=\\sum_r(1+\\ell_r)`

  return (
    <ChapterLayout
      kicker={t('第二部分 · DeepSeek-V4 · Ch21', 'Part 2 · DeepSeek-V4 · Ch21')}
      title={t('DSpark(三)· 动态调度', 'DSpark ③ Dynamic Scheduling')}
      prev={prev}
      next={next}
      translated
    >
      <>
        {lang === 'en' ? (
          <>
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              The previous chapter's <b>confidence head</b> gave each draft token its "odds of passing verification" <Tex>{'c_k'}</Tex>, plus the prefix survival
              <Tex>{'a_j=\\prod_{i\\le j}c_i'}</Tex> (lower the further back). This chapter uses it to press down the last lever — <b>cheaper verification (↓T_verify)</b>.
            </p>
            <h2>How many to verify depends on how busy the system is</h2>
            <p>
              Verifying one extra token costs <b>as much as the system load</b>: <b>nearly free when idle</b> (a few extras don't matter),
              <b> every slot is precious when busy</b> (verifying a useless one squeezes out someone else's request). So you shouldn't apply a <b>fixed threshold</b> across the board.
            </p>
            <p>
              DSpark's <b>hardware-aware prefix scheduler</b> turns this into a <b>throughput-maximization</b> problem: pick a verify length <Tex>{'\\ell'}</Tex> for each request
              to maximize global throughput <Tex>{'\\Theta=\\tau\\cdot\\mathrm{SPS}(B)'}</Tex> (<Tex>{'\\mathrm{SPS}(B)'}</Tex> is the engine's steps-per-second at batch size <Tex>{'B'}</Tex>, measured into a table at startup).
              Greedily add verify slots by prefix survival <Tex>{'a_j'}</Tex> from high to low, stopping once throughput no longer rises:
            </p>
            <div style={{ fontSize: 13, overflowX: 'auto', margin: '6px 0' }}><Tex block>{schedTex}</Tex></div>
            <p>
              Intuitively (Figure ①): <b style={{ color: 'var(--accent-2)' }}>verify more when idle</b> (as long as possible),
              <b style={{ color: 'var(--warn)' }}>when busy verify only the high-confidence prefix and cut the low-confidence tail</b> → pressing down T_verify.
            </p>
            <div className="note">
              <b>All three levers together</b>: semi-autoregressive (↓T_draft, ↑τ) + confidence scoring + dynamic scheduling (↓T_verify). Measured: accept length is
              <b> 26–31% higher than Eagle-3</b> and <b>16–18% higher than DFlash</b>; per-user generation speed <b>Flash +60–85% / Pro +57–78%</b>
              (vs. the MTP-1 baseline). DSpark is a <b>purely inference-side</b> upgrade — it <b>doesn't change the model architecture or the output distribution</b>;
              the training/eval codebase <b>DeepSpec</b> is open-sourced (including DSpark/DFlash/Eagle3).
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              <b>Honest simplification</b>: Figure ① approximates the true <Tex>{'\\Theta'}</Tex> greedy maximization with a "load → threshold θ, keep prefixes with <Tex>{'a_j\\ge\\theta'}</Tex>" rule; the direction of the conclusion is the same (higher load → verify fewer).
            </div>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              上一章的<b>置信度头</b>给了每个草稿字「能过审的把握」<Tex>{'c_k'}</Tex>,以及前缀存活(prefix survival)
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
          </>
        )}
        <Refs
          ids={['2606.19348', '2211.17192']}
          extra={[
            { label: t('DeepSeek 2026 · DSpark 论文(§3.2.2 Hardware-Aware Prefix Scheduler / Algorithm 1)', 'DeepSeek 2026 · DSpark paper (§3.2.2 Hardware-Aware Prefix Scheduler / Algorithm 1)'), url: 'https://github.com/deepseek-ai/DeepSpec/blob/main/DSpark_paper.pdf' },
            { label: t('deepseek-ai/DeepSpec · 开源代码库', 'deepseek-ai/DeepSpec · open-source codebase'), url: 'https://github.com/deepseek-ai/DeepSpec' },
          ]}
        />
      </>
      <>
        <h3>{t('图① 动态调度:按负载决定验证几个', 'Figure ① Dynamic scheduling: load decides how many to verify')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {lang === 'en' ? (
            <>A draft block E…J; solid bars are per-position confidence <b style={{ color: 'var(--accent-2)' }}>cₖ</b> and the line is prefix survival <b style={{ color: 'var(--accent)' }}>aⱼ</b> (lower the further back).
            Drag <b>system load</b>: the higher the load, the higher the threshold <b style={{ color: 'var(--warn)' }}>θ</b>, and the <b style={{ color: 'var(--hot,#ff6b6b)' }}>cut line</b> moves left — fewer tokens get verified (only the high-confidence prefix remains).</>
          ) : (
            <>一块草稿 E…J,实心条是各位置置信度 <b style={{ color: 'var(--accent-2)' }}>cₖ</b>、折线是前缀存活 <b style={{ color: 'var(--accent)' }}>aⱼ</b>(越靠后越低)。
            拖<b>系统负载</b>:负载越高、阈值 <b style={{ color: 'var(--warn)' }}>θ</b> 越高,<b style={{ color: 'var(--hot,#ff6b6b)' }}>截断线</b>左移、验证的字更少(只留高把握前缀)。</>
          )}
        </p>
        <FigureBoard renderSvg={renderSched} baseCell={28} fullCell={38} controls={schedControls} />
        <div style={{ marginTop: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: 'var(--text-dim)' }}>
          {t('当前负载 ', 'Current load ')}<b style={{ color: 'var(--accent)' }}>{load}%</b>{t('(阈值 θ=', ' (threshold θ=')}{sched.theta.toFixed(2)}{t('):这一块草稿只验证', '): this draft block verifies only the ')}<b style={{ color: 'var(--accent2)' }}>{t('前 ', 'first ')}{sched.l}{t(' 个字', ' tokens')}</b>
          {t('(砍掉 ', ' (cut ')}{DRAFT.length - sched.l}{t(' 个低置信尾巴),期望接受 τ≈', ' low-confidence tail tokens); expected accept length τ≈')}<b style={{ color: 'var(--accent2)' }}>{sched.tau.toFixed(2)}</b>{t('。', '.')}
          {load > 70 ? t(' 繁忙 → 验证更省、把名额让给别的请求。', ' Busy → verify more sparingly, yield slots to other requests.') : load < 30 ? t(' 空闲 → 多验几个、尽量多收字。', ' Idle → verify a few more to accept as many tokens as possible.') : ''}
        </div>
      </>
    </ChapterLayout>
  )
}
