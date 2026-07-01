import { useState, useMemo } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Tex from '../components/Tex.jsx'
import Refs from '../components/Refs.jsx'
import { T } from '../components/svg/theme.js'
import { overlap } from '../lib/specdec.js'
import { useLang, useT } from '../i18n/lang.jsx'

// 置信度标签 = 草稿分布 p_d 与大模型分布 p_t 的「重叠」
const VOCAB = ['cat', 'dog', 'fox', 'owl', 'ant']
const P_T = [0.46, 0.27, 0.15, 0.08, 0.04] // 大模型分布(固定)
const OTHER = [0.04, 0.08, 0.15, 0.27, 0.46] // 另一头的分布(草稿"跑偏"时趋向它)

// 英文更长,按文本宽度兜底避免裁切(CJK≈11、ASCII≈6.4)
const estTextW = (s) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 11 : 6.4), 0)

export default function Ch20DSparkConf({ prev, next }) {
  const t = useT()
  const { lang } = useLang()
  const [delta, setDelta] = useState(30) // 草稿与大模型的分歧 %

  const ov = useMemo(() => {
    const dl = delta / 100
    const pd = P_T.map((v, i) => (1 - dl) * v + dl * OTHER[i]) // 仍是合法分布(两者都和为1)
    return { pd, cstar: overlap(pd, P_T) }
  }, [delta])

  // —— 图①:置信度标签 = 重叠面积(接受率) —— //
  const renderOverlap = (cell) => {
    const cs = cell
    const cw = Math.max(cs * 2.0, 60)
    const lx = 36
    const top = 24
    const ph = cs * 3.6
    const base = top + ph
    const maxP = 0.5
    const Y = (v) => base - (v / maxP) * ph
    const els = []
    for (const tok of [0, 0.25, 0.5]) {
      els.push(<line key={`g${tok}`} x1={lx} y1={Y(tok)} x2={lx + VOCAB.length * cw} y2={Y(tok)} stroke={T.c.border} strokeWidth={0.5} strokeDasharray={tok === 0 ? '' : '3 3'} />)
      els.push(<text key={`gt${tok}`} x={lx - 4} y={Y(tok) + 3} textAnchor="end" fontFamily={T.font} fontSize={8.5} fill={T.c.dim}>{tok}</text>)
    }
    for (let i = 0; i < VOCAB.length; i++) {
      const x = lx + i * cw
      const pt = P_T[i], pd = ov.pd[i]
      const mn = Math.min(pt, pd), mx = Math.max(pt, pd)
      const bw = cw * 0.62, bx = x + (cw - bw) / 2
      els.push(<rect key={`ov${i}`} x={bx} y={Y(mn)} width={bw} height={base - Y(mn)} rx={2} fill={T.c.accent2} opacity={0.7} />)
      els.push(<rect key={`gap${i}`} x={bx} y={Y(mx)} width={bw} height={Y(mn) - Y(mx)} fill={T.c.hot} opacity={0.28} />)
      els.push(<line key={`pt${i}`} x1={bx - 4} y1={Y(pt)} x2={bx + bw + 4} y2={Y(pt)} stroke={T.c.accent} strokeWidth={1.6} />)
      els.push(<line key={`pd${i}`} x1={bx - 4} y1={Y(pd)} x2={bx + bw + 4} y2={Y(pd)} stroke={T.c.accent2} strokeWidth={1.6} strokeDasharray="3 2" />)
      els.push(<text key={`w${i}`} x={x + cw / 2} y={base + 13} textAnchor="middle" fontFamily={T.font} fontSize={10} fill={T.c.dim}>{VOCAB[i]}</text>)
    }
    els.push(<text key="lg" x={lx} y={top - 10} fontFamily={T.font} fontSize={9} fill={T.c.dim}>
      <tspan fill={T.c.accent}>{t('━ p_t 大模型', '━ p_t target')}</tspan>　<tspan fill={T.c.accent2}>{t('┄ p_d 草稿', '┄ p_d draft')}</tspan>{' '}
      <tspan fill={T.c.accent2}>{t('绿=重叠(接受)', 'green = overlap (accept)')}</tspan>　<tspan fill={T.c.hot}>{t('红=分歧', 'red = mismatch')}</tspan></text>)
    // 图例英文更长,按其文本宽度兜底避免右侧裁切
    const legW = estTextW(t('━ p_t 大模型 ┄ p_d 草稿 绿=重叠(接受) 红=分歧', '━ p_t target ┄ p_d draft green = overlap (accept) red = mismatch'))
    const W = Math.max(lx + VOCAB.length * cw + 8, lx + legW + 8)
    const H = base + 22
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  const deltaControls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 150 }}>{t('草稿与大模型的分歧', 'Draft–target divergence')}</span>
      <input type="range" min={0} max={100} step={1} value={delta} onChange={(e) => setDelta(+e.target.value)} style={{ width: 140 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{delta}%</b>
    </label>
  )

  const confTex = `c_k=\\sigma\\big(w^{\\top}[\\,h_k;\\,e_{x_{k-1}}]\\big)\\in(0,1),\\qquad
a_j=\\prod_{i\\le j}c_i,\\qquad
c_k^{*}=1-\\tfrac12\\lVert p_d-p_t\\rVert_1`

  return (
    <ChapterLayout
      kicker={t('第二部分 · DeepSeek-V4 · Ch20', 'Part 2 · DeepSeek-V4 · Ch20')}
      title={t('DSpark(二)· 置信度打分', 'DSpark ② Confidence Scoring')}
      prev={prev}
      next={next}
      translated
    >
      <>
        {lang === 'en' ? (
          <>
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              Last chapter's <b>semi-autoregressive</b> drafting handled two of the three levers: <b>draft fast (↓T_draft)</b> and <b>accept many (↑τ)</b>.
              One remains — <b>verify cheap (↓T_verify)</b>. To verify cheaply, we first need to <b>know, without running the target model: how likely is each draft token to pass verification?</b> That's this chapter's <b>confidence head</b>.
            </p>
            <h2>How the confidence head is actually computed</h2>
            <p>DSpark adds a <b>confidence head</b> to the drafter, in three steps:</p>
            <ul>
              <li><b>Step 1 · Input</b>: the parallel backbone's hidden state <Tex>{'h_k'}</Tex> at that position (which already encodes "how reliable this token is"),
                plus the <b>embedding of the previous token</b> <Tex>{'e_{x_{k-1}}'}</Tex>.</li>
              <li><b>Step 2 · Squash to a probability</b>: a <b>tiny linear layer</b> <Tex>{'w'}</Tex> plus a <b>sigmoid</b> squeezes it into a number <Tex>{'c_k'}</Tex> in (0,1).
                — But on its own this number is <b>meaningless</b>; we have to "teach" it.</li>
              <li><b>Step 3 · What to teach it (where the label comes from)</b>: recall last chapter's acceptance rule — a draft token is accepted with probability <Tex>{'\\min(1,p_t/p_d)'}</Tex>.
                <b>Averaged</b> over all possible tokens, the probability a draft token is accepted <b>is exactly the "overlap area" between the draft distribution <Tex>{'p_d'}</Tex> and the target distribution <Tex>{'p_t'}</Tex></b>:
                <Tex>{'c_k^{*}=\\sum_x\\min(p_d,p_t)=1-\\tfrac12\\lVert p_d-p_t\\rVert_1'}</Tex>. Use that as the label to train <Tex>{'c_k'}</Tex> to approximate.</li>
            </ul>
            <p>
              Intuition (Figure ①): <b>when the draft and the target "want to say the same word" → the two distributions overlap a lot → almost sure to pass (c*→1)</b>; when they diverge a lot → little overlap → often rejected.
              So the confidence head learns to <b>cheaply estimate this overlap rate from just <Tex>{'h_k'}</Tex> and the previous token</b>, without actually running the target model.
            </p>
            <div style={{ fontSize: 13, overflowX: 'auto', margin: '6px 0' }}><Tex block>{confTex}</Tex></div>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '2px 0' }}>
              Multiplying the <Tex>{'c_k'}</Tex> across positions <b>gives the prefix survival</b> <Tex>{'a_j=\\prod_{i\\le j}c_i'}</Tex> (lower the further back you go) — next chapter's scheduling relies on it.
              Also: neural-network confidence is often <b>overconfident</b>, so we calibrate once more (STS, Sequential Temperature Scaling), making the <b>absolute value</b> of <Tex>{'c_k'}</Tex> trustworthy enough to compute throughput.
            </p>
            <div className="note">
              With each token's "chance of passing verification" <Tex>{'c_k'}</Tex> and the prefix survival <Tex>{'a_j'}</Tex>, the <b>next chapter</b> can dynamically decide,
              based on system load, <b>how many tokens to verify per request</b>, pushing down the third lever T_verify.
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              <b>Honest simplification</b>: Figure ①'s draft distribution <Tex>{'p_d'}</Tex> approximates how far the draft drifts using a "mixture with <Tex>{'p_t'}</Tex>"; in reality <Tex>{'p_d/p_t'}</Tex> are distributions the models compute position by position.
            </div>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              上一章的<b>半自回归</b>管住了「起草快(↓T_draft)」「接受多(↑τ)」两条杠杆。还剩第三条——
              <b>验证省(↓T_verify)</b>。要做到验证省,得先<b>不跑大模型就提前知道:每个草稿字有多大把握过审?</b>这就是本章的<b>置信度头</b>。
            </p>
            <h2>置信度头到底怎么算出来的</h2>
            <p>DSpark 给 drafter 加一个<b>置信度头</b>,分三步:</p>
            <ul>
              <li><b>第 1 步 · 输入</b>:并行骨架在该位置的隐藏态 <Tex>{'h_k'}</Tex>(它本就编码了「这个字靠不靠谱」)
                加上<b>前一个字的嵌入</b> <Tex>{'e_{x_{k-1}}'}</Tex>。</li>
              <li><b>第 2 步 · 压成概率</b>:一个<b>极小的线性层</b> <Tex>{'w'}</Tex> 加 <b>sigmoid</b>,把它挤成一个 (0,1) 的数 <Tex>{'c_k'}</Tex>。
                —— 但光这样这个数<b>没意义</b>,得「教」它。</li>
              <li><b>第 3 步 · 教什么(标签从哪来)</b>:回忆上一章的接受规则——草稿字以 <Tex>{'\\min(1,p_t/p_d)'}</Tex> 被接受。
                对所有可能的字<b>平均</b>,一个草稿字被接受的概率,<b>恰好等于草稿分布 <Tex>{'p_d'}</Tex> 和大模型分布 <Tex>{'p_t'}</Tex> 的「重叠面积」</b>:
                <Tex>{'c_k^{*}=\\sum_x\\min(p_d,p_t)=1-\\tfrac12\\lVert p_d-p_t\\rVert_1'}</Tex>。用它当标签训练 <Tex>{'c_k'}</Tex> 去逼近。</li>
            </ul>
            <p>
              直觉(图①):<b>草稿和大模型「想说同样的词」→ 两分布重叠大 → 几乎必过(c*→1)</b>;想法分歧大 → 重叠小 → 常被拒。
              于是置信度头学会了<b>只看 <Tex>{'h_k'}</Tex> 和前一个字,就便宜地估出这个重叠率</b>,不必真去跑大模型。
            </p>
            <div style={{ fontSize: 13, overflowX: 'auto', margin: '6px 0' }}><Tex block>{confTex}</Tex></div>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '2px 0' }}>
              把各位置的 <Tex>{'c_k'}</Tex> <b>连乘</b>得<b>前缀存活率(prefix survival)</b> <Tex>{'a_j=\\prod_{i\\le j}c_i'}</Tex>(越靠后越低)——下一章的调度就靠它。
              另:神经网络的置信度常<b>过于自信</b>,所以再做一次校准(STS),让 <Tex>{'c_k'}</Tex> 的<b>绝对数值</b>可信,好用来算吞吐。
            </p>
            <div className="note">
              有了每个字「能过审的把握」<Tex>{'c_k'}</Tex> 与前缀存活 <Tex>{'a_j'}</Tex>,<b>下一章</b>就能按系统负载
              <b>动态决定每个请求验证几个字</b>,把第③条杠杆 T_verify 压下去。
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              <b>诚实简化</b>:图① 的草稿分布 <Tex>{'p_d'}</Tex> 用「与 <Tex>{'p_t'}</Tex> 的混合」近似草稿跑偏的程度;真实里 <Tex>{'p_d/p_t'}</Tex> 是模型逐位算出的分布。
            </div>
          </>
        )}
        <Refs
          ids={['2302.01318', '2211.17192', '2606.19348']}
          extra={[
            { label: t('DeepSeek 2026 · DSpark 论文(§3.2.1 Confidence Head)', 'DeepSeek 2026 · DSpark paper (§3.2.1 Confidence Head)'), url: 'https://github.com/deepseek-ai/DeepSpec/blob/main/DSpark_paper.pdf' },
          ]}
        />
      </>
      <>
        <h3>{t('图① 置信度的「标签」从哪来:重叠 = 接受率', 'Figure ①: where the confidence "label" comes from — overlap = acceptance rate')}</h3>
        {lang === 'en' ? (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
            The blue solid line is the target distribution <b style={{ color: 'var(--accent)' }}>p_t</b>; the green dashed line is the draft distribution <b style={{ color: 'var(--accent-2)' }}>p_d</b>;
            <b style={{ color: 'var(--accent-2)' }}>green = the overlap of the two</b> (will be accepted), <b style={{ color: 'var(--hot,#ff6b6b)' }}>red = the divergence</b> (may be rejected).
            Drag "divergence": the more the draft deviates from the target, the less green overlap → the lower the acceptance rate c*. This is exactly the label the confidence head must learn to predict.
          </p>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
            蓝实线是大模型分布 <b style={{ color: 'var(--accent)' }}>p_t</b>、绿虚线是草稿分布 <b style={{ color: 'var(--accent-2)' }}>p_d</b>;
            <b style={{ color: 'var(--accent-2)' }}>绿色 = 两者重叠</b>(会被接受)、<b style={{ color: 'var(--hot,#ff6b6b)' }}>红色 = 分歧</b>(可能被拒)。
            拖「分歧」:草稿越偏离大模型,绿色重叠越少 → 接受率 c* 越低。这就是置信度头要学着预测的标签。
          </p>
        )}
        <FigureBoard renderSvg={renderOverlap} baseCell={28} fullCell={38} controls={deltaControls} />
        <div style={{ marginTop: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: 'var(--text-dim)' }}>
          {lang === 'en' ? (
            <>Current divergence <b style={{ color: 'var(--accent)' }}>{delta}%</b>: overlap area (single-step acceptance rate) c* = <b style={{ color: 'var(--accent2)' }}>{ov.cstar.toFixed(2)}</b>
            {delta < 15 ? ' (draft ≈ target, almost sure to pass)' : delta > 70 ? ' (draft drifts, often rejected)' : ''}. This number is exactly what the confidence head learns.</>
          ) : (
            <>当前分歧 <b style={{ color: 'var(--accent)' }}>{delta}%</b>:重叠面积(单步接受率)c* = <b style={{ color: 'var(--accent2)' }}>{ov.cstar.toFixed(2)}</b>
            {delta < 15 ? '(草稿≈大模型,几乎必过)' : delta > 70 ? '(草稿跑偏,常被拒)' : ''}。置信度头学的就是这个数。</>
          )}
        </div>
      </>
    </ChapterLayout>
  )
}
