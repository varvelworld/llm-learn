import { useState, useMemo } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Tex from '../components/Tex.jsx'
import Refs from '../components/Refs.jsx'
import { T } from '../components/svg/theme.js'
import { seededMatrix } from '../lib/synth.js'
import { useLang, useT } from '../i18n/lang.jsx'

const N = 14 // 序列 token 数(toy)
const L = 12 // 层数(toy)
const K = 4 // 每层选 top-k(真实 k=2048)
const DRIFT = 0.07 // 每层偏好漂移步长:越大相邻层差异越大(真实相邻层重合 70~100%)

// 英文更长,按文本宽度兜底避免裁切(CJK≈11、ASCII≈6.4)
const estTextW = (s) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 11 : 6.4), 0)

// 取数组里最大的 k 个的下标集合
function topkSet(arr, k) {
  return new Set(
    arr.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, k).map((p) => p[1])
  )
}

export default function G5GlmIndexShare({ prev, next }) {
  const t = useT()
  const { lang } = useLang()
  const [G, setG] = useState(4) // 每 G 层共享一次索引(G=1 即不共享)

  // 各层索引器分数:base 分 + 每个 token 一个随层线性漂移的趋势。
  // → 排名随层「缓慢漂移」:相邻层最像、越远越不像(而非随机抖动,这样漏选才随 G 增长)。
  const { indep, shared, leaders, overlaps, avgOverlap } = useMemo(() => {
    const base = seededMatrix(1, N, 7)[0] // 每 token 的基准偏好
    const trend = seededMatrix(1, N, 29)[0] // 每 token 的漂移方向/速度 ∈[-1,1]
    const S = Array.from({ length: L }, (_, l) =>
      base.map((b, t) => b + trend[t] * l * DRIFT))
    const indep = S.map((row) => topkSet(row, K)) // 每层「独立」会选的 top-k
    const leaders = Array.from({ length: L }, (_, l) => Math.floor(l / G) * G)
    const shared = leaders.map((ld) => indep[ld]) // IndexShare:全组复用组长的 top-k
    const overlaps = indep.map((set, l) => {
      let hit = 0
      shared[l].forEach((i) => { if (set.has(i)) hit++ })
      return hit / K
    })
    const avgOverlap = overlaps.reduce((a, b) => a + b, 0) / L
    return { indep, shared, leaders, overlaps, avgOverlap }
  }, [G])

  const runs = useMemo(() => Math.ceil(L / G), [G])

  const render = (cell) => {
    const cs = cell
    const labW = lang === 'en' ? 88 : 64
    const top = 26
    const rowH = cs
    const els = []
    // 列头(token 序号)
    for (let t = 0; t < N; t++)
      els.push(<text key={`ct${t}`} x={labW + t * cs + cs / 2} y={top - 8} textAnchor="middle"
        fontFamily={T.font} fontSize={9} fill={T.c.dim}>{t}</text>)
    for (let l = 0; l < L; l++) {
      const y = top + l * rowH
      const isLeader = leaders[l] === l
      // 组括号 + 索引器标记
      els.push(<text key={`ll${l}`} x={6} y={y + rowH * 0.66} fontFamily={T.font} fontSize={10} fill={T.c.dim}>{t(`层${l}`, `L${l}`)}</text>)
      els.push(<text key={`tag${l}`} x={labW - 6} y={y + rowH * 0.66} textAnchor="end" fontFamily={T.font} fontSize={9}
        fill={isLeader ? T.c.accent2 : T.c.dim}>{isLeader ? t('🔍算', '🔍calc') : t('↻用', '↻reuse')}</text>)
      for (let t = 0; t < N; t++) {
        const inShared = shared[l].has(t)
        const inIndep = indep[l].has(t)
        els.push(<rect key={`g${l}-${t}`} x={labW + t * cs} y={y} width={cs} height={cs}
          fill={inShared ? 'rgba(126,231,135,0.5)' : T.c.bgElev} stroke={T.c.border} strokeWidth={0.5} />)
        // 复用导致的差异:本层独立想选、但被复用略过的 token(空心橙圈)
        if (!inShared && inIndep)
          els.push(<circle key={`d${l}-${t}`} cx={labW + t * cs + cs / 2} cy={y + cs / 2} r={cs * 0.22}
            fill="none" stroke={T.c.warn} strokeWidth={1.4} />)
      }
    }
    // 组分隔线
    for (let l = G; l < L; l += G)
      els.push(<line key={`sep${l}`} x1={labW} y1={top + l * rowH} x2={labW + N * cs} y2={top + l * rowH}
        stroke={T.c.accent} strokeWidth={1.4} strokeDasharray="4 3" />)
    const capA = t(`绿=选中(top-${K})`, `green = selected (top-${K})`)
    const capB = t('○=本层独立会选、被复用略过', '○ = would pick independently, skipped by reuse')
    const capC = t(`每 ${G} 层一组(虚线)`, `${G} layers per group (dashed)`)
    const capFull = `${capA}　${capB}　${capC}`
    const W = Math.max(labW + N * cs + 10, labW + estTextW(capFull) + 10)
    const H = top + L * rowH + 26
    els.push(<text key="cap" x={labW} y={H - 8} fontFamily={T.font} fontSize={9.5} fill={T.c.dim}>
      <tspan fill={T.c.accent2}>{capA}</tspan>　<tspan fill={T.c.warn}>{capB}</tspan>　{capC}</text>)
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  const controls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: lang === 'en' ? 128 : 96 }}>{t('每组层数 G', 'Layers per group G')}</span>
      <input type="range" min={1} max={4} step={1} value={G} onChange={(e) => setG(+e.target.value)} style={{ width: 130 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{G}</b>
      <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{G === 1 ? t('(每层独立,= 原始 DSA)', '(each layer independent, = vanilla DSA)') : t(`(每组省 ${G - 1}/${G} 索引)`, `(saves ${G - 1}/${G} of indexing per group)`)}</span>
    </label>
  )

  const costTex = `\\begin{aligned}
\\text{${t('每组', 'per group')}}\\; G\\; \\text{${t('层 · 原始 DSA', 'layers · vanilla DSA')}} &= G\\cdot C_{\\text{${t('索引', 'index')}}} + G\\cdot C_{\\text{${t('注意', 'attn')}}} \\\\
\\text{${t('IndexShare(共享索引)', 'IndexShare (shared index)')}} &= \\underbrace{1}_{\\text{${t('只组长算', 'leader only')}}}\\cdot C_{\\text{${t('索引', 'index')}}} + G\\cdot C_{\\text{${t('注意', 'attn')}}} \\\\
\\text{${t('索引省', 'index saved')}} &= \\tfrac{${G}-1}{${G}} = ${G === 1 ? '0' : (((G - 1) / G) * 100).toFixed(0) + '\\%'}
\\end{aligned}`

  return (
    <ChapterLayout
      kicker={t('第三部分 · GLM · G5', 'Part 3 · GLM · G5')}
      title={t('GLM-5.2 IndexShare:稀疏之上再省一层', 'GLM-5.2 IndexShare: saving one more layer above sparsity')}
      prev={prev}
      next={next}
      translated
    >
      <>
        {lang === 'en' ? (
          <>
            <p>
              Chapter 15 covered <b>DSA</b>: every layer uses a <b>lightning indexer</b> to score all tokens and pick the <b>top-k</b> (k=2048 in practice);
              attention runs only over those k. But <b>every layer re-runs the indexer</b> — and at a <b>1M context</b>,
              just "scoring a million-plus tokens" is expensive in itself.
            </p>
            <h2>Key observation: adjacent layers pick almost the same tokens</h2>
            <p>
              The GLM team found that comparing all DSA layers <b>pairwise</b>, <b>adjacent layers overlap 70–100%</b> on which tokens they select.
              In other words — <b>layer ℓ and layer ℓ+1 are basically looking at the same batch of tokens</b>.
              So why recompute "where to look" at every single layer?
            </p>
            <h2>IndexShare: one group of layers shares a single index</h2>
            <ul>
              <li>Split the layers into <b>groups of 4</b> (G is adjustable in the figure).</li>
              <li><b>Only the first layer of each group (the group leader) runs the indexer</b> and picks the top-k (marked <b style={{ color: 'var(--accent-2)' }}>🔍calc</b>).</li>
              <li>The other 3 layers in the group <b>reuse</b> the tokens the leader picked (marked <b>↻reuse</b>), <b>skipping their own indexer</b>.</li>
            </ul>
            <p>
              So the "indexing" step drops from <b>G times</b> per group to <b>once</b>, saving <b>(G−1)/G</b> (75% at G=4).
              Attention itself still runs every layer — what's saved is the <b>key-selection</b> part.
              Real effect: <b>total FLOPs per token drop about 2.9× at 1M context</b>.
            </p>
            <div className="note">
              This is <b>"sparsity on top of sparsity"</b>: DSA is sparse in the token dimension (only top-k),
              while IndexShare reuses in the <b>layer</b> dimension (compute top-k only once). The orange hollow circles in the figure = tokens a layer would
              have picked independently but were skipped by reuse — because adjacent layers overlap so much, such "missed selections" are rare, so accuracy barely drops.
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              This is GLM-5.2's <b>signature increment</b> over DeepSeek (the rest of the attention stack, MLA+DSA, converges with DeepSeek — see G1).
              The accompanying paper is THUDM's <b>IndexCache</b> (cross-layer index reuse).
            </div>
          </>
        ) : (
          <>
            <p>
              第 15 章讲过 <b>DSA</b>:每层用<b>闪电索引器</b>给所有 token 打分、选 <b>top-k</b>(真实 k=2048),
              注意力只对这 k 个算。但<b>每一层都要重跑一遍索引器</b>——在 <b>1M 上下文</b>下,
              光是「给上百万 token 打分」本身就很贵。
            </p>
            <h2>关键观察:相邻层选的 token 几乎一样</h2>
            <p>
              GLM 团队发现:把所有 DSA 层<b>两两比较</b>,<b>相邻层选中的 token 重合度高达 70~100%</b>。
              也就是说——<b>第 ℓ 层和第 ℓ+1 层,基本在看同一批 token</b>。
              既然如此,何必每层都重新算一遍「该看哪里」?
            </p>
            <h2>IndexShare:一组层共享一次索引</h2>
            <ul>
              <li>把层<b>每 4 层分一组</b>(右图 G 可调)。</li>
              <li><b>只有组里第一层(组长)跑索引器</b>、选出 top-k(标 <b style={{ color: 'var(--accent-2)' }}>🔍算</b>)。</li>
              <li>组内<b>其余 3 层直接复用</b>组长选好的那批 token(标 <b>↻用</b>),<b>跳过自己的索引器</b>。</li>
            </ul>
            <p>
              于是「索引」这步的开销从每组 <b>G 次</b>降到 <b>1 次</b>,省下 <b>(G−1)/G</b>(G=4 即 <b>75%</b>)。
              注意力本身仍每层照算——省的是<b>选键</b>那部分。真实效果:<b>1M 上下文下每 token 总 FLOPs 降约 2.9×</b>。
            </p>
            <div className="note">
              这是<b>「稀疏之上再加一层稀疏」</b>:DSA 在 token 维度稀疏(只看 top-k),
              IndexShare 在<b>层</b>维度复用(只算一次 top-k)。右图橙色空心圈 = 某层独立本会选、但被复用略过的 token
              ——因为相邻层重合度高,这种「漏选」很少,所以几乎不掉精度。
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              这是 GLM-5.2 相对 DeepSeek 的<b>独门增量</b>(其余注意力栈 MLA+DSA 与 DeepSeek 趋同,见 G1)。
              配套论文是 THUDM 的 <b>IndexCache</b>(跨层索引复用)。
            </div>
          </>
        )}
        <Refs ids={['2512.02556', '2603.12201', '2602.15763', '2606.19348']} />
      </>
      <>
        <h3>{t(`L=${L} 层 DSA · 每 G 层共享一次索引`, `L=${L}-layer DSA · share one index every G layers`)}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {lang === 'en' ? (
            <>Each layer's preference <b>drifts slowly</b> with depth (adjacent layers most alike). Drag G: G=1 is vanilla DSA (every layer 🔍calc, zero missed selections);
            the larger G, the more each group has only the leader compute while the rest reuse — the green selected cells are identical within a group, while <b>the lower a layer sits in its group, the farther from the leader, the more drift accumulates, and the more orange circles (missed selections) appear</b>.
            That's the "save more vs. miss more" trade-off.</>
          ) : (
            <>每层偏好随深度<b>缓慢漂移</b>(相邻层最像)。拖 G:G=1 是原始 DSA(每层都🔍算、零漏选);
            G 越大每组只组长算、其余复用——绿色选中块同组完全一致,而<b>组内越靠下的层离组长越远、漂移累积越多,橙圈(漏选)就越多</b>。
            这就是「省得多 vs 漏得多」的权衡。</>
          )}
        </p>
        <FigureBoard renderSvg={render} baseCell={26} fullCell={38} controls={controls} />
        <div style={{ marginTop: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 16, overflowX: 'auto' }}><Tex block>{costTex}</Tex></div>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 6 }}>
            {lang === 'en' ? (
              <>Current G={G}: {G === 1
                ? <>every layer runs the indexer (<b style={{ color: 'var(--accent2)' }}>{L}</b> times total) — this is vanilla DSA, with zero missed selections (100% overlap).</>
                : <>the {L} layers run the indexer only <b style={{ color: 'var(--accent2)' }}>{runs}</b> times (saving {Math.round((1 - runs / L) * 100)}%);
                  the average overlap between reuse and each layer's independent selection is <b style={{ color: 'var(--accent2)' }}>{Math.round(avgOverlap * 100)}%</b>
                  — the higher the overlap, the more lossless the reuse. The lower a layer sits in its group (farther from the leader), the more drift accumulates and the more missed selections (orange circles).</>}</>
            ) : (
              <>当前 G={G}:{G === 1
                ? <>每层都跑索引器(共 <b style={{ color: 'var(--accent2)' }}>{L}</b> 次)——这就是原始 DSA,无漏选(重合度 100%)。</>
                : <>{L} 层只跑 <b style={{ color: 'var(--accent2)' }}>{runs}</b> 次索引器(省 {Math.round((1 - runs / L) * 100)}%);
                  复用与各层独立选择的平均重合度 <b style={{ color: 'var(--accent2)' }}>{Math.round(avgOverlap * 100)}%</b>
                  ——重合越高,复用越无损。组内越靠下的层(离组长越远),漂移累积越多、漏选(橙圈)越多。</>}</>
            )}
          </div>
        </div>
      </>
    </ChapterLayout>
  )
}
