import { useState, useMemo } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Tex from '../components/Tex.jsx'
import Refs from '../components/Refs.jsx'
import { T } from '../components/svg/theme.js'
import { seededMatrix } from '../lib/synth.js'
import { colorFor } from '../lib/figure.js'
import { ngramHash, allocLoss, ALLOC_OPTIMUM } from '../lib/engram.js'
import { useLang, useT } from '../i18n/lang.jsx'

// 英文更长,按文本估宽防裁切(CJK≈11、ASCII≈6.4)
const estTextW = (s) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 11 : 6.4), 0)

// toy 句子:[词, token id]
const SENT = [['the', 1], ['capital', 2], ['of', 3], ['France', 4], ['is', 5], ['Paris', 6], ['and', 7], ['it', 8], ['is', 5], ['very', 9], ['famous', 10]]
const NG = 3 // n-gram 大小
const B = 8 // 记忆库槽位数(真实是上百万)
const DM = 4 // 每个记忆槽的嵌入维度(真实是几千)
const TABLE = seededMatrix(B, DM, 99) // 记忆库:B 个槽,各存一条 DM 维「记忆嵌入」

export default function Ch18Engram({ prev, next }) {
  const t = useT()
  const { lang } = useLang()
  const [p, setP] = useState(3) // 当前 n-gram 的末位(0-based)
  const [fPct, setFPct] = useState(50) // 稀疏预算给「记忆」的比例 %

  const look = useMemo(() => {
    const lo = p - NG + 1
    const ids = []
    for (let i = lo; i <= p; i++) ids.push(SENT[i][1])
    const bucket = ngramHash(ids, B)
    return { lo, ids, bucket, mem: TABLE[bucket] }
  }, [p])

  // —— 图① N-gram → 哈希 → O(1) 查表 —— //
  const renderLookup = (cell) => {
    const cs = cell
    const tw = Math.max(cs * 1.7, 52)
    const top = 16
    const els = []
    // token 序列(窗口高亮)
    SENT.forEach(([w], i) => {
      const inWin = i >= look.lo && i <= p
      els.push(<rect key={`tk${i}`} x={8 + i * tw} y={top} width={tw - 4} height={cs} rx={4}
        fill={inWin ? 'rgba(110,168,254,0.22)' : T.c.bgElev} stroke={inWin ? T.c.accent : T.c.border} strokeWidth={inWin ? 1.6 : 0.6} />)
      els.push(<text key={`tw${i}`} x={8 + i * tw + (tw - 4) / 2} y={top + cs / 2 + 3.5} textAnchor="middle"
        fontFamily={T.font} fontSize={10.5} fill={inWin ? T.c.accent : T.c.dim}>{w}</text>)
    })
    els.push(<text key="seqL" x={8} y={top - 4} fontFamily={T.font} fontSize={9} fill={T.c.dim}>{t(`输入序列(蓝=最近 ${NG} 个 token = n-gram)`, `Input sequence (blue = last ${NG} tokens = n-gram)`)}</text>)
    // 哈希说明行
    const y2 = top + cs + 28
    const ngTxt = look.ids.map((_, i) => SENT[look.lo + i][0]).join(' ')
    els.push(<text key="hash" x={8} y={y2} fontFamily={T.font} fontSize={11} fill={T.c.text}>
      hash(<tspan fill={T.c.accent}>{ngTxt}</tspan>) <tspan fill={T.c.dim}>{t(`= FNV 整数哈希 % ${B} →`, `= FNV integer hash % ${B} →`)}</tspan> {t('槽', 'slot')} <tspan fill={T.c.warn} fontWeight={700}>#{look.bucket}</tspan></text>)
    // 记忆库:B 列 × DM 行,命中列高亮
    const bankX = 8
    const bankY = y2 + 18
    const bcs = Math.max(cs * 0.92, 26)
    const vmax = Math.max(...TABLE.flat().map(Math.abs), 1e-6)
    for (let j = 0; j < B; j++) {
      const hit = j === look.bucket
      for (let r = 0; r < DM; r++) {
        const v = TABLE[j][r]
        els.push(<rect key={`mb${j}-${r}`} x={bankX + j * bcs} y={bankY + r * bcs} width={bcs} height={bcs}
          fill={colorFor(v, vmax)} stroke={hit ? T.c.warn : T.c.border} strokeWidth={hit ? 2 : 0.5} />)
        if (hit) els.push(<text key={`mv${j}-${r}`} x={bankX + j * bcs + bcs / 2} y={bankY + r * bcs + bcs / 2 + 3.5}
          textAnchor="middle" fontFamily={T.font} fontSize={9} fill={T.c.text}>{v.toFixed(2)}</text>)
      }
      els.push(<text key={`ms${j}`} x={bankX + j * bcs + bcs / 2} y={bankY + DM * bcs + 12} textAnchor="middle"
        fontFamily={T.font} fontSize={9} fill={j === look.bucket ? T.c.warn : T.c.dim}>{j}</text>)
    }
    els.push(<text key="bankL" x={bankX} y={bankY - 5} fontFamily={T.font} fontSize={9.5} fill={T.c.dim}>{t(`记忆库(存于 CPU DRAM,${B} 槽)`, `Memory bank (in CPU DRAM, ${B} slots)`)}</text>)
    const hitLine1 = t('← 取出这条', '← fetch this one')
    const hitLine2 = t('记忆嵌入 m,补进 h', 'memory embedding m, add into h')
    const hitLine3 = t('O(1):1 次哈希 + 取 1 列', 'O(1): 1 hash + fetch 1 column')
    els.push(<text key="hitL" x={bankX + B * bcs + 10} y={bankY + DM * bcs / 2} fontFamily={T.font} fontSize={10.5}
      fill={T.c.warn}>{hitLine1}<tspan x={bankX + B * bcs + 10} dy={14} fill={T.c.accent2}>{hitLine2}</tspan>
      <tspan x={bankX + B * bcs + 10} dy={16} fill={T.c.dim}>{hitLine3}</tspan></text>)
    const rightW = Math.max(estTextW(hitLine1), estTextW(hitLine2), estTextW(hitLine3))
    const W = Math.max(8 + SENT.length * tw + 6, bankX + B * bcs + 10 + rightW + 12)
    const H = bankY + DM * bcs + 22
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  // —— 图② 稀疏分配律 U 曲线 —— //
  const f = fPct / 100
  const curLoss = allocLoss(f)
  const renderU = (cell) => {
    const cs = cell
    const x0 = 44, y0 = 14
    const W = Math.max(220, cs * 9)
    const Hh = Math.max(120, cs * 5)
    const yMin = 0.95, yMax = allocLoss(1) + 0.05
    const X = (ff) => x0 + ff * W
    const Y = (l) => y0 + (1 - (l - yMin) / (yMax - yMin)) * Hh
    const els = []
    // 最优带 20–25%
    els.push(<rect key="band" x={X(0.2)} y={y0} width={X(0.25) - X(0.2)} height={Hh} fill="rgba(126,231,135,0.12)" />)
    els.push(<text key="bandL" x={X(0.225)} y={y0 - 3} textAnchor="middle" fontFamily={T.font} fontSize={9} fill={T.c.accent2}>{t('最优 ~20–25%', 'optimal ~20–25%')}</text>)
    // 轴
    els.push(<line key="ax" x1={x0} y1={y0 + Hh} x2={x0 + W} y2={y0 + Hh} stroke={T.c.border} strokeWidth={1} />)
    els.push(<line key="ay" x1={x0} y1={y0} x2={x0} y2={y0 + Hh} stroke={T.c.border} strokeWidth={1} />)
    els.push(<text key="xl" x={x0 + W} y={y0 + Hh + 14} textAnchor="end" fontFamily={T.font} fontSize={9.5} fill={T.c.dim}>{t('记忆占比 f →', 'memory fraction f →')}</text>)
    els.push(<text key="yl" x={x0 - 2} y={y0 - 3} textAnchor="end" fontFamily={T.font} fontSize={9.5} fill={T.c.dim}>{t('损失↓', 'loss ↓')}</text>)
    els.push(<text key="x0" x={x0} y={y0 + Hh + 14} textAnchor="middle" fontFamily={T.font} fontSize={9} fill={T.c.dim}>{t('0(全计算)', '0 (all compute)')}</text>)
    els.push(<text key="x1" x={x0 + W} y={y0 + Hh + 26} textAnchor="end" fontFamily={T.font} fontSize={9} fill={T.c.dim}>{t('1(全记忆)', '1 (all memory)')}</text>)
    // 曲线
    const pts = []
    for (let i = 0; i <= 60; i++) { const ff = i / 60; pts.push(`${X(ff)},${Y(allocLoss(ff))}`) }
    els.push(<polyline key="curve" points={pts.join(' ')} fill="none" stroke={T.c.accent} strokeWidth={2} />)
    // 最优点
    els.push(<circle key="opt" cx={X(ALLOC_OPTIMUM)} cy={Y(allocLoss(ALLOC_OPTIMUM))} r={3} fill={T.c.accent2} />)
    // 当前点
    els.push(<line key="cl" x1={X(f)} y1={y0} x2={X(f)} y2={y0 + Hh} stroke={T.c.warn} strokeWidth={0.8} strokeDasharray="3 3" />)
    els.push(<circle key="cur" cx={X(f)} cy={Y(curLoss)} r={4} fill={T.c.warn} />)
    return <svg width={x0 + W + 10} height={y0 + Hh + 30} style={{ display: 'block' }}>{els}</svg>
  }

  const lookupControls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 120 }}>{t('n-gram 位置', 'n-gram position')}</span>
      <input type="range" min={NG - 1} max={SENT.length - 1} step={1} value={p} onChange={(e) => setP(+e.target.value)} style={{ width: 150 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{SENT.slice(look.lo, p + 1).map((tok) => tok[0]).join(' ')}</b>
    </label>
  )
  const uControls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 120 }}>{t('记忆占比 f', 'memory fraction f')}</span>
      <input type="range" min={0} max={100} step={1} value={fPct} onChange={(e) => setFPct(+e.target.value)} style={{ width: 150 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{fPct}%</b>
    </label>
  )

  const lookTex = `\\text{key}=\\text{hash}\\big(\\underbrace{x_{t-n+1},\\dots,x_t}_{n\\text{-gram}}\\big),\\quad
\\textcolor{#f0a35e}{m_t}=\\text{Mem}[\\text{key}],\\quad
h_t \\mathrel{+}= \\textcolor{#f0a35e}{m_t}
\\qquad(\\textbf{O(1)})`

  return (
    <ChapterLayout
      kicker={t('第二部分 · DeepSeek · Ch18', 'Part II · DeepSeek · Ch18')}
      title={t('Engram:把「记忆」从「计算」里拆出来', 'Engram: Splitting "Memory" out of "Compute"')}
      prev={prev}
      next={next}
      translated
    >
      <>
        {lang === 'en' ? (
          <>
            <p>
              A standard LLM crams both <b>factual knowledge</b> and <b>reasoning ability</b> into the same pile of weights: to "recall"
              a fact (say "the capital of France is Paris"), the information still has to be <b>computed layer by layer</b>. This both
              <b> wastes compute</b> (looking up a piece of common sense runs every layer) and easily <b>mixes memories up → hallucination</b>.
            </p>
            <h2>Engram: giving the model an "external dictionary"</h2>
            <p>
              DeepSeek's <b>Engram</b> (conditional memory) works like the brain's <b>hippocampus</b>: it <b>hashes</b> the
              <b> last few tokens (n-gram)</b> into a "key", uses it to look up a huge memory table in <b>O(1)</b>, and fetches the
              corresponding <b>memory embedding</b> straight into the hidden state. In essence it modernizes the
              <b> fifty-year-old N-gram</b> — no longer computing layer by layer, but <b>looking it up directly</b>.
            </p>
            <div style={{ fontSize: 14.5, overflowX: 'auto', margin: '6px 0' }}><Tex block>{lookTex}</Tex></div>
            <p>
              This adds <b>a new "axis of sparsity"</b>: MoE is "per token, <b>pick experts and compute</b>"; Engram is "per n-gram,
              <b> look up memory and skip the compute</b>". Moreover the static memory can live in cheap, massive <b>CPU memory (DRAM)</b>,
              leaving only dynamic reasoning on the GPU; the hash address is deterministic, so it can even be <b>prefetched ahead of time</b>,
              adding almost no latency.
            </p>
            <h2>The law of sparse allocation: how much should memory take?</h2>
            <p>
              The paper finds a <b>U-shaped law</b>: <b>neither all-compute (0% memory) nor all-memory (100%) is optimal</b>;
              giving <b>~20–25% of the sparse parameter budget to memory</b> and the rest to compute yields the lowest validation loss (figure ② on the right).
            </p>
            <div className="note">
              Measured (27B): multi-query NIAH "needle-in-a-haystack" accuracy rises from <b>84.2% → 97.0%</b>, knowledge/reasoning/code
              <b> +3~5 points</b>, with hallucination dropping markedly. Both the paper and the code are open-sourced (<Tex>{'\\texttt{deepseek-ai/Engram}'}</Tex>).
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              <b>Rigor note (whether it entered V4 is uncertain)</b>: Engram is a <b>study DeepSeek published separately in January 2026</b>
              (paper + code, validated at 27B). <b>Whether it made it into the finally released V4 is reported inconsistently</b> — several
              post-release analyses say the <b>final V4 architecture did not adopt Engram</b> (instead separating knowledge and reasoning at the
              <b> training stage</b>). What we describe here is <b>the Engram method itself</b>, without asserting it is already an online component of V4.
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              <b>Honest simplification in this figure</b>: the toy uses {B} memory slots, {DM}-dim embeddings, {NG}-gram (real is millions of slots,
              thousands of dims); the hash is FNV for illustration (real includes LSH / collision-resistant design). The U-curve is a
              <b> shape illustration</b>, with the optimum aligned to the paper's 20–25%.
            </div>
          </>
        ) : (
          <>
            <p>
              标准 LLM 把<b>事实知识</b>和<b>推理能力</b>全压进同一堆权重里:想「回忆」一个事实(比如「法国首都是巴黎」),
              也得让信息<b>层层算过去</b>。这既<b>浪费算力</b>(查个常识也要跑全部层),又容易<b>记混 → 幻觉</b>。
            </p>
            <h2>Engram:给模型配一本「外挂字典」</h2>
            <p>
              DeepSeek 的 <b>Engram</b>(条件记忆)思路像大脑的<b>海马体</b>:把<b>最近几个 token(n-gram)</b>
              <b>哈希</b>成一把「钥匙」,用它 <b>O(1)</b> 查一张超大的记忆表,取出对应的<b>记忆嵌入</b>直接补进隐藏态。
              本质是把<b>五十年前的 N-gram</b> 现代化——不再层层算,而是<b>直接查</b>。
            </p>
            <div style={{ fontSize: 14.5, overflowX: 'auto', margin: '6px 0' }}><Tex block>{lookTex}</Tex></div>
            <p>
              这就多出<b>一根新的「稀疏轴」</b>:MoE 是「按 token <b>挑专家算</b>」,Engram 是「按 n-gram <b>查记忆、不算</b>」。
              而且静态记忆可以放进便宜、海量的 <b>CPU 内存(DRAM)</b>,只把动态推理留给 GPU;
              哈希地址是确定的,还能<b>提前预取</b>,几乎不增延迟。
            </p>
            <h2>稀疏分配律:记忆该占多少?</h2>
            <p>
              论文发现一条 <b>U 形规律</b>:<b>全计算(0% 记忆)和全记忆(100%)都不是最优</b>,
              把稀疏参数预算的 <b>~20–25% 分给记忆</b>、其余给计算,验证损失最低(右图②)。
            </p>
            <div className="note">
              实测(27B):多查询 NIAH「大海捞针」准确率从 <b>84.2% → 97.0%</b>,知识/推理/代码 <b>+3~5 分</b>,
              幻觉显著下降。论文与代码均已开源(<Tex>{'\\texttt{deepseek-ai/Engram}'}</Tex>)。
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              <b>严谨说明(是否进 V4 存疑)</b>:Engram 是 DeepSeek <b>2026 年 1 月单独发表的研究</b>(论文 + 代码,在 27B 上验证)。
              它<b>是否进入最终发布的 V4,各方报道不一致</b>——多篇发布后分析称<b>最终 V4 架构并未采用 Engram</b>
              (改为在<b>训练阶段</b>分离知识与推理)。这里讲的是 <b>Engram 这套方法本身</b>,不断言它已是 V4 的在线组件。
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              <b>本图的诚实简化</b>:toy 用 {B} 个记忆槽、{DM} 维嵌入、{NG}-gram(真实是上百万槽、几千维);
              哈希用 FNV 示意(真实含 LSH / 抗碰撞设计)。U 曲线是<b>形状示意</b>,最优位置对齐论文的 20–25%。
            </div>
          </>
        )}
        <Refs ids={['2601.07372', '2401.06066', '2606.19348']} />
      </>
      <>
        <h3>{t('图① n-gram → 哈希 → O(1) 查记忆库', 'Figure ① n-gram → hash → O(1) memory lookup')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {lang === 'en' ? (
            <>Drag the slider to move the n-gram (blue window): it is hashed to some <b style={{ color: 'var(--warn)' }}>memory slot #k</b>,
            and that column — the <b style={{ color: 'var(--accent-2)' }}>memory embedding</b> — is fetched directly. Change the context
            (a different n-gram) and you look up a different memory — this is <b>conditional memory</b>.</>
          ) : (
            <>拖滑块移动 n-gram(蓝色窗口):它被哈希到某个<b style={{ color: 'var(--warn)' }}>记忆槽 #k</b>,
            直接取出那一列<b style={{ color: 'var(--accent-2)' }}>记忆嵌入</b>。换了上下文(不同 n-gram)就查到不同记忆——这叫<b>条件记忆</b>。</>
          )}
        </p>
        <FigureBoard renderSvg={renderLookup} baseCell={30} fullCell={40} controls={lookupControls} />
        <h3 style={{ marginTop: 18 }}>{t('图② 稀疏分配律:记忆 vs 计算怎么分', 'Figure ② Law of sparse allocation: memory vs compute')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {lang === 'en' ? (
            <>Drag the "memory fraction f" slider: validation loss is <b>U-shaped</b>, with the trough in the
            <b style={{ color: 'var(--accent-2)' }}> green band (20–25%)</b>. Too close to 0 (all compute) or to 1 (all memory) is worse.</>
          ) : (
            <>拖滑块改「记忆占比 f」:验证损失是 <b>U 形</b>,谷底落在<b style={{ color: 'var(--accent-2)' }}>绿色带(20–25%)</b>。
            太靠 0(全计算)或太靠 1(全记忆)都更差。</>
          )}
        </p>
        <FigureBoard renderSvg={renderU} baseCell={26} fullCell={34} controls={uControls} />
        <div style={{ marginTop: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
            {t('当前记忆占比 ', 'Current memory fraction ')}<b style={{ color: 'var(--accent)' }}>{fPct}%</b>{t(':验证损失', ': validation loss')}
            <b style={{ color: Math.abs(f - ALLOC_OPTIMUM) < 0.05 ? 'var(--accent2)' : 'var(--warn)' }}> {curLoss.toFixed(3)}</b>
            {Math.abs(f - ALLOC_OPTIMUM) < 0.05
              ? t('(就在最优带里 ✓)', ' (right in the optimal band ✓)')
              : t(`(最优在 ~22%,损失 ${allocLoss(ALLOC_OPTIMUM).toFixed(3)})`, ` (optimal ~22%, loss ${allocLoss(ALLOC_OPTIMUM).toFixed(3)})`)}{t('。', '.')}
          </div>
        </div>
      </>
    </ChapterLayout>
  )
}
