import { useState, useMemo } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Tex from '../components/Tex.jsx'
import Refs from '../components/Refs.jsx'
import { T } from '../components/svg/theme.js'
import { seededMatrix } from '../lib/synth.js'

const N = 12 // 序列 token 数(toy)
const L = 8 // 层数(toy)
const K = 3 // 每层选 top-k(真实 k=2048)

// 取数组里最大的 k 个的下标集合
function topkSet(arr, k) {
  return new Set(
    arr.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, k).map((p) => p[1])
  )
}

export default function G5GlmIndexShare({ prev, next }) {
  const [G, setG] = useState(4) // 每 G 层共享一次索引(G=1 即不共享)

  // 各层索引器分数:同一 base + 每层小扰动 → 相邻层 top-k 高度重合(真实 70~100%)
  const { indep, shared, leaders, overlaps, avgOverlap } = useMemo(() => {
    const base = seededMatrix(1, N, 7)[0]
    const noise = seededMatrix(L, N, 21)
    const S = noise.map((row) => row.map((v, t) => base[t] + v * 0.3))
    const indep = S.map((row) => topkSet(row, K)) // 每层独立会选的
    const leaders = Array.from({ length: L }, (_, l) => Math.floor(l / G) * G)
    const shared = leaders.map((ld) => indep[ld]) // IndexShare:复用组长的
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
    const labW = 64
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
      els.push(<text key={`ll${l}`} x={6} y={y + rowH * 0.66} fontFamily={T.font} fontSize={10} fill={T.c.dim}>层{l}</text>)
      els.push(<text key={`tag${l}`} x={labW - 6} y={y + rowH * 0.66} textAnchor="end" fontFamily={T.font} fontSize={9}
        fill={isLeader ? T.c.accent2 : T.c.dim}>{isLeader ? '🔍算' : '↻用'}</text>)
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
    const W = labW + N * cs + 10
    const H = top + L * rowH + 26
    els.push(<text key="cap" x={labW} y={H - 8} fontFamily={T.font} fontSize={9.5} fill={T.c.dim}>
      <tspan fill={T.c.accent2}>绿=选中(top-{K})</tspan>　<tspan fill={T.c.warn}>○=本层独立会选、被复用略过</tspan>　每 {G} 层一组(虚线)</text>)
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  const controls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 96 }}>每组层数 G</span>
      <input type="range" min={1} max={4} step={1} value={G} onChange={(e) => setG(+e.target.value)} style={{ width: 130 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{G}</b>
      <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{G === 1 ? '(每层独立,= 原始 DSA)' : `(每组省 ${G - 1}/${G} 索引)`}</span>
    </label>
  )

  const costTex = `\\begin{aligned}
\\text{每组 } G \\text{ 层 · 原始 DSA} &= G\\cdot C_{\\text{索引}} + G\\cdot C_{\\text{注意}} \\\\
\\text{IndexShare(共享索引)} &= \\underbrace{1}_{\\text{只组长算}}\\cdot C_{\\text{索引}} + G\\cdot C_{\\text{注意}} \\\\
\\text{索引省} &= \\tfrac{${G}-1}{${G}} = ${G === 1 ? '0' : (((G - 1) / G) * 100).toFixed(0) + '\\%'}
\\end{aligned}`

  return (
    <ChapterLayout kicker="第三部分 · GLM · G5" title="GLM-5.2 IndexShare:稀疏之上再省一层" prev={prev} next={next}>
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
        <Refs ids={['2512.02556', '2603.12201', '2602.15763', '2606.19348']} />
      </>
      <>
        <h3>L={L} 层 DSA · 每 G 层共享一次索引</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          拖 G:G=1 是原始 DSA(每层都🔍算);G=4 是 IndexShare(每组只组长算,其余复用)。
          看绿色选中块——同组各层完全一致;橙圈是复用带来的极少「漏选」。
        </p>
        <FigureBoard renderSvg={render} baseCell={26} fullCell={38} controls={controls} />
        <div style={{ marginTop: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 16, overflowX: 'auto' }}><Tex block>{costTex}</Tex></div>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 6 }}>
            当前 G={G}:全模型索引器只跑 <b style={{ color: 'var(--accent2)' }}>{runs}</b> 次(而非 {L} 次);
            复用与各层独立选择的平均重合度 <b style={{ color: 'var(--accent2)' }}>{Math.round(avgOverlap * 100)}%</b>
            (越高说明复用越无损)。
          </div>
        </div>
      </>
    </ChapterLayout>
  )
}
