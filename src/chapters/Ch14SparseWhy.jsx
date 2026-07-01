import { useState, useMemo, useCallback } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Refs from '../components/Refs.jsx'
import { T } from '../components/svg/theme.js'
import { colorFor } from '../lib/figure.js'
import { seededMatrix } from '../lib/synth.js'
import { matmul, transpose } from '../lib/tensor.js'
import { attention } from '../lib/attention.js'
import { useLang, useT } from '../i18n/lang.jsx'

const DM = 4 // toy 维度
const WORDS = 'the cat sat on a warm mat and the dog ran fast over green hills today'.split(' ')

// 真实参照:128K 上下文、DSA 每个 query 选 top-2048 个 key
const CTX = 128 * 1024
const TOPK_REAL = 2048
const fmt = (x) => x.toLocaleString('en-US')
// 估算文本像素宽(CJK≈11、ASCII≈6.4),给 SVG 留够宽度、防英文更长时裁切
const estTextW = (s) => [...String(s)].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 11 : 6.4), 0)

export default function Ch14SparseWhy({ prev, next }) {
  const t = useT()
  const { lang } = useLang()
  const [n, setN] = useState(8)
  const [k, setK] = useState(3)
  const [sparse, setSparse] = useState(false)
  const [row, setRow] = useState(4)
  const r = Math.min(row, n - 1)
  const setRowCb = useCallback((i) => setRow(i), [])
  const onPageStep = useCallback((d) => setN((v) => Math.min(16, Math.max(3, v + d))), [])
  const kk = Math.min(k, n) // 有效 top-k

  const tokens = useMemo(() => Array.from({ length: n }, (_, i) => WORDS[i] ?? `t${i}`), [n])
  const X = useMemo(() => seededMatrix(n, DM, 7), [n])
  const WQ = useMemo(() => seededMatrix(DM, DM, 3), [])
  const WK = useMemo(() => seededMatrix(DM, DM, 5), [])
  const WV = useMemo(() => seededMatrix(DM, DM, 9), [])
  const Q = useMemo(() => matmul(X, WQ), [X, WQ])
  const K = useMemo(() => matmul(X, WK), [X, WK])
  const V = useMemo(() => matmul(X, WV), [X, WV])
  const att = useMemo(() => attention(Q, K, V, true), [Q, K, V])
  const weights = att.weights

  // 每行(query)按权重选 top-k key(仅在因果范围 j<=i 内)
  const keep = useMemo(
    () =>
      weights.map((wr, i) => {
        const valid = wr.map((w, j) => ({ w, j })).filter((o) => o.j <= i)
        valid.sort((a, b) => b.w - a.w)
        return new Set(valid.slice(0, kk).map((o) => o.j))
      }),
    [weights, kk]
  )

  // 选中行:top-k 抓住了多少注意力质量
  const keptMass = useMemo(() => {
    let s = 0
    keep[r].forEach((j) => (s += weights[r][j]))
    return s
  }, [keep, weights, r])
  const validCount = r + 1
  const keptCount = Math.min(validCount, kk)

  // 计算量(注意力分数对数):满 vs 稀疏
  const fullPairs = (n * (n + 1)) / 2
  const sparsePairs = useMemo(
    () => Array.from({ length: n }, (_, i) => Math.min(i + 1, kk)).reduce((a, b) => a + b, 0),
    [n, kk]
  )

  // 真实尺度外推(128K 上下文)
  const fullReal = (CTX * (CTX + 1)) / 2
  const sparseReal = CTX * TOPK_REAL - (TOPK_REAL * (TOPK_REAL - 1)) / 2
  const speedup = Math.round(fullReal / sparseReal)

  // 把"选中行"摊开成第 4 章那条完整链路:q · Kᵀ = 分数 → softmax → 权重 · V = 输出。
  // 稀疏模式下,被丢弃的列(分数/权重)和对应的 V 行打叉 —— 直观看到稀疏砍在链路哪一步。
  const renderTrace = (cell) => {
    const C = cell
    const m = r + 1
    const keptCol = Array.from({ length: m }, (_, j) => !sparse || keep[r].has(j))
    const qv = [Q[r]]
    const Kt = transpose(K.slice(0, m)) // D×m
    const sc = [att.scaled[r].slice(0, m)]
    const wt = [att.weights[r].slice(0, m)]
    const Vr = V.slice(0, m)
    const ov = [att.output[r]]
    const ioMax = Math.max(1e-6, ...[...qv.flat(), ...Kt.flat(), ...Vr.flat(), ...ov.flat()].map(Math.abs))
    const scMax = Math.max(1e-6, ...sc.flat().map(Math.abs))
    const maxRows = Math.max(DM, m)
    const topPad = 22
    const cy = topPad + (maxRows * C) / 2

    const blk = (x, data, { vmax, dec = 1, colKept, rowKept, title, colLabels, rowLabels }) => {
      const rows = data.length
      const cols = data[0].length
      const h = rows * C
      const y = cy - h / 2
      const els = []
      data.forEach((rowArr, i) =>
        rowArr.forEach((v, j) => {
          const kept = (colKept ? colKept[j] : true) && (rowKept ? rowKept[i] : true)
          const cx = x + j * C
          const cyy = y + i * C
          els.push(
            <g key={`${title}-${i}-${j}`}>
              <rect x={cx} y={cyy} width={C} height={C}
                fill={kept ? colorFor(v, vmax) : 'rgba(154,163,178,0.05)'}
                stroke={kept ? T.c.border : '#1a1d24'} strokeWidth={1} />
              {!kept && (
                <line x1={cx + C * 0.3} y1={cyy + C * 0.3} x2={cx + C * 0.7} y2={cyy + C * 0.7}
                  stroke="#3a4150" strokeWidth={1} />
              )}
              {kept && (
                <text x={cx + C / 2} y={cyy + C * 0.66} textAnchor="middle"
                  fontFamily={T.font} fontSize={T.fs} fill="#fff" pointerEvents="none">{v.toFixed(dec)}</text>
              )}
            </g>
          )
        })
      )
      if (colLabels)
        colLabels.forEach((c, j) =>
          els.push(<text key={`${title}-cl${j}`} x={x + j * C + C / 2} y={y - 4} textAnchor="middle"
            fontFamily={T.font} fontSize={9} fill={T.c.dim}>{c}</text>))
      if (rowLabels)
        rowLabels.forEach((rl, i) =>
          els.push(<text key={`${title}-rl${i}`} x={x - 4} y={y + i * C + C * 0.66} textAnchor="end"
            fontFamily={T.font} fontSize={9} fill={T.c.dim}>{rl}</text>))
      els.push(<text key={`${title}-t`} x={x + (cols * C) / 2} y={y + h + 14} textAnchor="middle"
        fontFamily={T.font} fontSize={11} fill={T.c.accent}>{title}</text>)
      return { els, w: cols * C }
    }

    const op = (x, sym, w) => (
      <text x={x + w / 2} y={cy} textAnchor="middle" dominantBaseline="middle"
        fontFamily={T.font} fontSize={12} fill={T.c.dim}>{sym}</text>
    )

    const outTitle = t('输出→预测下个词', 'output → predict next token')
    const parts = []
    let x = 44
    const add = (b, gap, opSym, opW) => {
      parts.push(...b.els)
      x += b.w
      if (opSym) { parts.push(op(x, opSym, opW)); x += opW } else { x += gap }
    }
    add(blk(x, qv, { vmax: ioMax, title: t(`q「${tokens[r]}」`, `q "${tokens[r]}"`) }), 0, '·', 20)
    add(blk(x, Kt, { vmax: ioMax, title: t(`Kᵀ(前 ${m} 个键)`, `Kᵀ (first ${m} keys)`), colLabels: tokens.slice(0, m) }), 0, '=', 24)
    add(blk(x, sc, { vmax: scMax, colKept: keptCol, title: t('分数 q·kⱼ/√d', 'score q·kⱼ/√d') }), 0, 'softmax→', 66)
    add(blk(x, wt, { vmax: 1, dec: 2, colKept: keptCol, title: t('权重(=上方该行)', 'weights (= that row above)') }), 0, '·', 20)
    add(blk(x, Vr, { vmax: ioMax, rowKept: keptCol, title: t(`V(前 ${m} 个值)`, `V (first ${m} values)`), rowLabels: tokens.slice(0, m) }), 0, '=', 24)
    add(blk(x, ov, { vmax: ioMax, title: outTitle }), 16)

    // 末块标题居中,英文更长时向右溢出 —— 按标题半宽兜底 SVG 宽度,防裁切
    const lastCenter = x - 16 - C / 2
    const W = Math.max(x + 16, lastCenter + estTextW(outTitle) / 2 + 8)
    const H = topPad + maxRows * C + 26
    return (
      <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{parts}</svg>
    )
  }

  const renderSvg = (cell) => {
    const gx = T.labelW
    const gy = T.colLabelH + 12
    const axisKeys = t('键(被注目的 token)→', 'keys (attended tokens) →')
    const W = Math.max(gx + n * cell + 16, gx + estTextW(axisKeys) + 8)
    const H = gy + n * cell + 34
    const show = n <= 9
    return (
      <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>
        {/* 轴说明 */}
        <text x={gx} y={12} fontFamily={T.font} fontSize={11} fill={T.c.dim}>{axisKeys}</text>
        <text x={4} y={gy - 4} fontFamily={T.font} fontSize={11} fill={T.c.dim}>{t('查询↓', 'query↓')}</text>

        {/* 行标签(query token) */}
        {tokens.map((tok, i) => (
          <text key={`r${i}`} x={gx - 6} y={gy + i * cell + cell * 0.66} textAnchor="end"
            fontFamily={T.font} fontSize={T.fsLabel} fill={i === r ? T.c.accent : T.c.dim}>
            {i === r ? '▶ ' : ''}{tok}
          </text>
        ))}

        {/* 注意力权重格子 */}
        {weights.map((wr, i) =>
          wr.map((w, j) => {
            if (j > i) return null // 因果:不存在的对,不画
            const kept = !sparse || keep[i].has(j)
            const x = gx + j * cell
            const y = gy + i * cell
            return (
              <g key={`${i}-${j}`} onMouseEnter={() => setRowCb(i)} style={{ cursor: 'pointer' }}>
                <rect x={x} y={y} width={cell} height={cell}
                  fill={kept ? colorFor(w, 1) : 'rgba(154,163,178,0.05)'}
                  stroke={kept ? T.c.border : '#1a1d24'} strokeWidth={1} />
                {/* 稀疏模式下被丢弃的格子:打叉,表示"压根不算" */}
                {!kept && (
                  <line x1={x + cell * 0.3} y1={y + cell * 0.3} x2={x + cell * 0.7} y2={y + cell * 0.7}
                    stroke="#3a4150" strokeWidth={1} />
                )}
                {show && kept && (
                  <text x={x + cell / 2} y={y + cell * 0.66} textAnchor="middle"
                    fontFamily={T.font} fontSize={T.fs} fill="#fff" pointerEvents="none">
                    {w.toFixed(2)}
                  </text>
                )}
              </g>
            )
          })
        )}

        {/* 选中行轮廓 */}
        <rect x={gx} y={gy + r * cell} width={(r + 1) * cell} height={cell}
          fill="none" stroke={T.c.accent} strokeWidth={2} pointerEvents="none" />
      </svg>
    )
  }

  const controls = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', width: 64 }}>{t('序列长度', 'Seq length')}</span>
        <input type="range" min={3} max={16} step={1} value={n}
          onChange={(e) => setN(Math.round(+e.target.value))} style={{ width: 130 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{n}</b>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={sparse} onChange={(e) => setSparse(e.target.checked)} />
        <span>{t('只保留每行 Top-k(稀疏)', 'Keep only Top-k per row (sparse)')}</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: sparse ? 1 : 0.45 }}>
        <span style={{ color: 'var(--text-dim)', width: 64 }}>k =</span>
        <input type="range" min={1} max={Math.max(1, n)} step={1} value={k} disabled={!sparse}
          onChange={(e) => setK(Math.round(+e.target.value))} style={{ width: 130 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent-2)' }}>{kk}</b>
      </label>
    </div>
  )

  return (
    <ChapterLayout
      kicker={t('第 14 章 · 为什么要稀疏注意力 · DeepSeek-V3.2/V4 长上下文', 'Chapter 14 · Why Sparse Attention · DeepSeek-V3.2/V4 Long Context')}
      title={t('为什么要稀疏注意力', 'Why Sparse Attention')}
      prev={prev}
      next={next}
      translated
    >
      <>
        {lang === 'en' ? (
          <>
            <p>
              In Chapter 4, attention lets <b>every query look at all preceding keys</b>.
              Chapter 9 then showed that during generation all these K/V must also be <b>cached</b>. Both blow up under <b>long context</b>.
            </p>
            <h2>Two walls: O(n²) compute and the KV cache</h2>
            <p>
              The attention scores form an <b>n×n</b> matrix (a lower triangle under the causal mask). Every time the sequence doubles,
              the number of query-key pairs <b>quadruples</b> — this is <b>quadratic</b> growth.
              At 128K context, each head in each layer computes about <b>{fmt(Math.round(fullReal / 1e9))} billion</b> scores.
            </p>
            <h2>Key observation: attention is naturally sparse</h2>
            <p>
              Look at the heatmap on the right: in each row (one query) only a handful of cells are truly <b>bright</b>,
              while most are pale, near 0. In other words — <b>each query really depends on just a few relevant keys</b>,
              and computing the rest contributes almost nothing.
            </p>
            <p>
              This matrix doesn't come from nowhere: <b>each row is exactly the attention distribution one query gets after
              </b> <code>q·Kᵀ → scale → softmax</code> <b>in Chapter 4</b>, and stacking every query's row gives the whole thing.
              The "expanded" figure below-right unfolds the selected row back into that full pipeline, so you can see with your own eyes which step sparsity cuts columns at.
            </p>
            <p>
              The selected row "<b style={{ color: 'var(--accent)' }}>{tokens[r]}</b>" has {validCount} visible keys,
              but its <b>{keptCount}</b> highest-weighted ones already capture
              <b style={{ color: 'var(--accent-2)' }}> {Math.round(keptMass * 100)}%</b> of the attention.
              The rest is nearly wasted compute.
            </p>
            <h2>The idea: don't compute all, pick only Top-k</h2>
            <p>
              Turn on the "<b>Keep only Top-k per row</b>" switch on the right: each query attends only to its most relevant <b>k</b> keys
              and <b>skips the rest (the crossed-out cells)</b>. Compute drops from <b>O(n²)</b> to <b>O(n·k)</b> —
              with k fixed, that's <b>near-linear</b>.
            </p>
            <div className="note">
              This is the core motivation for sparse attention — <b>DSA (DeepSeek Sparse Attention) was first introduced in DeepSeek-V3.2-Exp</b>,
              and V4 keeps it while stacking on more compression (details next chapter; specific numbers like top-2048 and 128K belong to the V3.2 setting, while V4 defaults to 1M context).
              The hard part is: <b>how do you quickly guess which few keys are most relevant without first computing all the scores?</b>
              The <b>Lightning Indexer</b> in the next chapter does exactly that.
            </div>
          </>
        ) : (
          <>
            <p>
              第 4 章里,注意力让<b>每个查询(query)看遍前面所有的键(key)</b>。
              第 9 章又看到,生成时这些 K/V 还得全部<b>缓存</b>下来。两件事在<b>长上下文</b>下都会失控。
            </p>
            <h2>两堵墙:算力 O(n²) 与缓存</h2>
            <p>
              注意力分数是一个 <b>n×n</b> 的矩阵(因果掩码下是下三角)。序列每翻一倍,
              要算的 query-key 对就翻<b>四倍</b>——这是<b>平方级</b>增长。
              128K 上下文时,每层每个头要算约 <b>{fmt(Math.round(fullReal / 1e9))} 十亿</b>个分数。
            </p>
            <h2>关键观察:注意力天然是稀疏的</h2>
            <p>
              看右边的热力图:每一行(一个 query)里,真正<b>亮</b>的格子只有寥寥几个,
              大片是接近 0 的淡色。也就是说——<b>每个 query 其实只依赖少数几个相关的 key</b>,
              其余的算了也几乎不贡献。
            </p>
            <p>
              这张矩阵不是凭空来的:<b>每一行就是第 4 章里一个 query 走完
              </b><code>q·Kᵀ→缩放→softmax</code><b>得到的注意力分布</b>,把所有 query 的行叠起来就是它。
              右下方「摊开」图把选中行还原成那条完整链路,你可以亲眼看到稀疏是在链路的哪一步砍掉列的。
            </p>
            <p>
              当前选中行「<b style={{ color: 'var(--accent)' }}>{tokens[r]}</b>」有 {validCount} 个可见 key,
              但其中权重最高的 <b>{keptCount}</b> 个就抓住了
              <b style={{ color: 'var(--accent-2)' }}> {Math.round(keptMass * 100)}%</b> 的注意力。
              剩下的几乎是白算。
            </p>
            <h2>思路:别全算,只挑 Top-k</h2>
            <p>
              打开右侧「<b>只保留每行 Top-k</b>」开关:每个 query 只对最相关的 <b>k</b> 个 key 做注意力,
              其余直接<b>跳过(打叉的格子)</b>。计算量从 <b>O(n²)</b> 降到 <b>O(n·k)</b>——
              k 固定时,这是<b>近似线性</b>的。
            </p>
            <div className="note">
              这正是稀疏注意力的核心动机——<b>DSA(DeepSeek Sparse Attention)由 DeepSeek-V3.2-Exp 首次引入</b>,
              V4 继续沿用并叠加更多压缩(下一章细讲;top-2048、128K 等具体数字属 V3.2 语境,V4 默认 1M 上下文)。
              难点在于:<b>怎么在不先算出全部分数的前提下,快速猜到哪几个 key 最相关?</b>
              下一章的<b>闪电索引器</b>就是干这个的。
            </div>
          </>
        )}
        <Refs ids={['1706.03762', '1904.10509', '2512.02556', '2606.19348']} />
      </>
      <>
        <FigureBoard renderSvg={renderSvg} baseCell={30} fullCell={48}
          controls={controls} onPageStep={onPageStep} />

        <h3 style={{ marginTop: 18 }}>
          {lang === 'en' ? (
            <>Selected row "<span style={{ color: 'var(--accent)' }}>{tokens[r]}</span>" expanded = one full attention pass (the Ch.4 pipeline)</>
          ) : (
            <>选中行「<span style={{ color: 'var(--accent)' }}>{tokens[r]}</span>」摊开 = 一次完整注意力(第 4 章的链路)</>
          )}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {lang === 'en' ? (
            <>
              Hover any row of the matrix above to switch query. The numbers in the "weights" block = the highlighted row in the matrix above —
              it's just the result of <code>q·Kᵀ → scale → softmax</code>; then <code>·V</code> gives the output.
              With sparsity on, the crossed-out columns are skipped throughout <b>scores / softmax / the weighted sum</b> (even their V rows don't participate).
            </>
          ) : (
            <>
              悬停上方矩阵任意一行来切换 query。「权重」这一块的数字 = 上方矩阵里高亮那一行——
              它不过是 <code>q·Kᵀ → 缩放 → softmax</code> 的结果;再 <code>·V</code> 得到输出。
              打开稀疏后,被打叉的列在<b>分数 / softmax / 加权和</b>里全程跳过(连它的 V 行都不参与)。
            </>
          )}
        </p>
        <div style={{ overflowX: 'auto', paddingBottom: 8, background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
          {renderTrace(30)}
        </div>

        <h3 style={{ marginTop: 18 }}>{t(`要算多少个注意力分数(toy · 当前 n=${n})`, `How many attention scores to compute (toy · current n=${n})`)}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { name: t('满注意力 O(n²)', 'Full attention O(n²)'), val: fullPairs, color: 'var(--hot)' },
            { name: t(`稀疏 Top-${kk}`, `Sparse Top-${kk}`), val: sparse ? sparsePairs : fullPairs, color: 'var(--accent-2)' },
          ].map((b) => (
            <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 120, fontSize: 13, color: 'var(--text-dim)' }}>{b.name}</div>
              <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 6, height: 24, overflow: 'hidden' }}>
                <div style={{ width: `${(b.val / fullPairs) * 100}%`, height: '100%', background: b.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8,
                  fontFamily: 'var(--mono)', fontSize: 12, color: '#0f1115' }}>{b.val}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="cost-panel" style={{ marginTop: 12 }}>
          <div className="cost-row">
            <span>{t(`toy:满 vs 稀疏(Top-${kk})的分数个数`, `toy: score count, full vs sparse (Top-${kk})`)}</span>
            <b>{fullPairs} → {sparse ? sparsePairs : fullPairs}</b>
          </div>
          <div className="cost-divider" />
          <div className="cost-row" style={{ fontSize: 12 }}>
            <span>{t(`真实参照:128K 上下文,DSA 选 top-${fmt(TOPK_REAL)}`, `Real reference: 128K context, DSA picks top-${fmt(TOPK_REAL)}`)}</span>
            <b style={{ color: 'var(--warn)' }}>{t(`≈ ${speedup}× 更少的分数计算`, `≈ ${speedup}× fewer score computations`)}</b>
          </div>
          <div className="cost-row" style={{ fontSize: 12 }}>
            <span>{t('复杂度', 'Complexity')}</span>
            <b>{t('O(n²) → O(n·k),k 固定 ⇒ 近似线性', 'O(n²) → O(n·k), fixed k ⇒ near-linear')}</b>
          </div>
        </div>
      </>
    </ChapterLayout>
  )
}
