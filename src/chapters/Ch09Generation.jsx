import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import Refs from '../components/Refs.jsx'
import Matrix from '../components/svg/Matrix.jsx'
import MatMul from '../components/svg/MatMul.jsx'
import Edge from '../components/svg/Edge.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
// 3D 滚轮场景按需懒加载:只有开启 3D 模式才动态拉 three.js,不拖累其它页
const DecodeScene3D = lazy(() => import('../components/DecodeScene3D.jsx'))
import { T } from '../components/svg/theme.js'
import { matmulLayout } from '../lib/figure.js'
import { seededMatrix } from '../lib/synth.js'
import { dot } from '../lib/tensor.js'
import { softmax } from '../lib/softmax.js'
import { useLang, useT } from '../i18n/lang.jsx'

// 估算一段文本的像素宽(CJK≈11、ASCII≈6.4),给 SVG 留够宽度、防英文更长时裁切。
const estTextW = (s) => [...String(s)].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 11 : 6.4), 0)

const D = 4
const CAP = 48 // 最大序列长度
const WORDS = 'the cat sat on the mat and the dog ran across a green field very fast'.split(' ')
const labelFor = (i) => (i < WORDS.length ? WORDS[i] : `t${i}`)

export default function Ch09Generation({ prev, next }) {
  const t = useT()
  const { lang } = useLang()
  const [L, setL] = useState(9)         // 目标序列长度(滑块)
  const [tok, setTok] = useState(3)     // 当前已生成到第 tok 个 token
  const [playing, setPlaying] = useState(false)
  const [selRaw, setSel] = useState(-1) // 悬停的缓存位置(-1=默认指向本步新行)
  const [dim, setDim] = useState(0)     // 悬停的输出/V 维度列
  const [mode, setMode] = useState('key') // 'key'=选缓存键(亮权重某行) | 'dim'=选维度(亮整条权重列)
  const [view3d, setView3d] = useState(false) // 3D 滚筒模式
  const setStep = useCallback((v) => { setPlaying(false); setTok(Math.max(1, Math.min(L, v))) }, [L])
  const onPageStep = useCallback((d) => setTok((v) => Math.max(1, Math.min(L, v + d))), [L])
  const onScore = useCallback((i) => { setSel(i); setMode('key') }, [])
  // 悬停 V/输出 = 选中维度列;权重整列都参与 输出[k] = 权重列·V第k列,故 mode='dim'
  const onVCell = useCallback((_i, j) => { setDim(j); setMode('dim') }, [])
  const onOut = useCallback((_i, j) => { setDim(j); setMode('dim') }, [])
  // 拖动长度:目标与当前步一起走(缓存随之实时增减)
  const onLen = useCallback((v) => { setPlaying(false); const n = Math.round(v); setL(n); setTok(n) }, [])
  // 自动播放:每 800ms 走一步,到末尾自停
  useEffect(() => {
    if (!playing) return
    if (tok >= L) { setPlaying(false); return }
    const id = setTimeout(() => setTok((v) => Math.min(L, v + 1)), 800)
    return () => clearTimeout(id)
  }, [playing, tok, L])
  const togglePlay = useCallback(() => {
    if (playing) { setPlaying(false); return }
    if (tok >= L) setTok(1) // 已到末尾 → 从头重播
    setPlaying(true)
  }, [playing, tok, L])

  // 整段所有位置的 q/k/v(确定性);decode 第 tok 步只用到前 tok 个
  const Qa = useMemo(() => seededMatrix(CAP, D, 11), [])
  const Ka = useMemo(() => seededMatrix(CAP, D, 22), [])
  const Va = useMemo(() => seededMatrix(CAP, D, 33), [])

  const step = useMemo(() => {
    const Kc = Ka.slice(0, tok)
    const Vc = Va.slice(0, tok)
    const q = Qa[tok - 1]
    const scores = Kc.map((k) => dot(q, k) / Math.sqrt(D))
    const weights = softmax(scores)
    const out = Array.from({ length: D }, (_, d) => weights.reduce((s, w, j) => s + w * Vc[j][d], 0))
    return { Kc, Vc, q, scoreCol: scores.map((s) => [s]), weightCol: weights.map((w) => [w]), out: [out] }
  }, [tok, Ka, Va, Qa])

  // 所有 decode 步的 q/分数/权重(滚筒每个面用一份)
  const allSteps = useMemo(() => Array.from({ length: L }, (_, s0) => {
    const q = Qa[s0]
    const scores = Ka.slice(0, s0 + 1).map((k) => dot(q, k) / Math.sqrt(D))
    return { q, scores, weights: softmax(scores), token: labelFor(s0) }
  }), [L, Ka, Qa])

  const tokens = useMemo(() => Array.from({ length: tok }, (_, i) => labelFor(i)), [tok])
  // 缓存行的明暗:最后一行(本步新算)亮,其余(缓存复用)淡
  const fade = useMemo(() => Array.from({ length: tok }, (_, i) => (i === tok - 1 ? 1 : 0.4)), [tok])
  // 当前聚焦的缓存位置(默认指向本步新行);点积拆解用
  const sel = selRaw < 0 ? tok - 1 : Math.min(selRaw, tok - 1)
  const terms = step.Kc[sel].map((kk, d) => ({ k: kk, q: step.q[d] }))
  const rawDot = terms.reduce((s, tm) => s + tm.k * tm.q, 0)
  const scoreVal = step.scoreCol[sel][0]

  const renderSvg = (cell0) => {
    // 序列长时自动缩小格子,长缓存也能整屏看
    const cell = tok > 22 ? Math.round(cell0 * 0.42) : tok > 12 ? Math.round(cell0 * 0.6) : cell0
    const lw = T.labelW
    const rowLabels = tok <= 12 ? tokens : undefined
    const qCol = step.q.map((v) => [v]) // q_t 作为 D×1 列,躺在分数列上方
    // ① 交叉网格:K缓存(tok×D) · q_t(D×1) = 分数(tok×1)
    const L = matmulLayout({ m: tok, k: D, p: 1, cell, labelW: lw, colLabelH: T.colLabelH, gap: T.gap })
    const topY = 42 // 顶部留白给 q_t 说明
    const baseY = topY + L.headerH // 矩阵主体(分数 / 权重 / V / 输出)顶部
    const mh = tok * cell
    const midY = baseY + mh / 2
    const EDGE = 44
    const scoresRight = L.result.x + cell
    const xW = scoresRight + EDGE
    const wRight = xW + cell
    const xV = wRight + 36
    const vRight = xV + D * cell
    const xO = vRight + EDGE
    const oRight = xO + D * cell
    const show = tok <= 8
    // 文案(英文更长,下面按文本宽度兜底 SVG 宽度,防裁切)
    const titleText = t('① K 缓存 · q_t = 分数(K 每步追加一行 k_t)', '① K cache · q_t = scores (K appends row k_t each step)')
    const qLabel = t(`q_t(新 token「${labelFor(tok - 1)}」)· 用完即弃 ↓`, `q_t (new token "${labelFor(tok - 1)}") · discard after use ↓`)
    const keyNote = t(`↑ 蓝框 = 第 ${sel + 1} 个缓存键 · 末行(亮)=本步新算 k_t,其余(淡)=缓存复用`,
      `↑ blue box = cached key #${sel + 1} · last row (bright) = k_t (new this step), rest (dim) = reused from cache`)
    const wCol = t('权重', 'weights')
    const step3Title = t('③ 权重列 × V 缓存 = 输出', '③ weight col × V cache = output')
    const outLabel = t('输出 → 下一个词', 'output → next token')
    const svgW = Math.max(
      oRight + 14,
      estTextW(titleText) + 8,
      L.A.x + lw + estTextW(qLabel) + 8,
      L.A.x + estTextW(keyNote) + 12,
      xO + estTextW(outLabel) + 12,
    )
    const svgH = baseY + mh + 52
    return (
      <svg width={svgW} height={svgH} style={{ display: 'block', minWidth: svgW }}>
        {/* ① K缓存 · q_t = 分数 —— 可悬浮的交叉网格 */}
        <text x={0} y={14} fontFamily={T.font} fontSize={13} fontWeight="700" fill={T.c.hot}>
          {titleText}
        </text>
        <text x={L.A.x + lw} y={topY - 6} fontFamily={T.font} fontSize={11} fill={T.c.accent}>
          {qLabel}
        </text>
        <g transform={`translate(0,${topY})`}>
          <MatMul x={0} y={0} A={step.Kc} Bt={qCol} result={step.scoreCol} cell={cell}
            rowLabels={rowLabels} aRowWeights={fade}
            selRow={sel} onHoverCell={onScore} onHoverARow={onScore}
            aLabel={t('K缓存', 'K cache')} bLabel="q_t" resultLabel={t('分数', 'scores')} showValues={show} />
        </g>
        <text x={L.A.x} y={baseY + mh + 36} fontFamily={T.font} fontSize={11} fill={T.c.accent}>
          {keyNote}
        </text>

        {/* softmax → 权重列 */}
        <text x={xW} y={baseY - 6} fontFamily={T.font} fontSize={11} fill={T.c.accent2}>{wCol}</text>
        <Matrix x={xW} y={baseY} data={step.weightCol} cell={cell} vmax={1}
          highlightRow={mode === 'key' ? sel : -1} highlightCol={mode === 'dim' ? 0 : -1}
          onHoverCell={onScore} showValues={show} />

        <text x={(wRight + xV) / 2} y={midY} textAnchor="middle" dominantBaseline="central"
          fontFamily={T.font} fontSize={15} fill={T.c.dim}>×</text>

        {/* ③ 权重 × V缓存 = 输出 */}
        <text x={xV} y={baseY - 24} fontFamily={T.font} fontSize={13} fontWeight="700" fill={T.c.hot}>
          {step3Title}
        </text>
        <Matrix x={xV} y={baseY} data={step.Vc} cell={cell} rowWeights={fade}
          highlightCol={dim} onHoverCell={onVCell} showValues={show} />

        <text x={xO} y={baseY - 6} fontFamily={T.font} fontSize={11} fill={T.c.accent2}>{outLabel}</text>
        <Matrix x={xO} y={baseY} data={step.out} cell={cell}
          highlightCell={[0, dim]} onHoverCell={onOut} showValues={show} />

        <Edge from={{ x: scoresRight, y: midY }} to={{ x: xW, y: midY }} label={'softmax'} />
        <Edge from={{ x: vRight, y: baseY + cell / 2 }} to={{ x: xO, y: baseY + cell / 2 }} label={t('加权和', 'weighted sum')} />
      </svg>
    )
  }

  const controls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
      <button className="btn" onClick={() => setStep(tok - 1)} disabled={tok <= 1}>{t('◀ 上一步', '◀ Prev')}</button>
      <button className="btn" onClick={togglePlay} style={playing ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}>
        {playing ? t('⏸ 暂停', '⏸ Pause') : (tok >= L ? t('↻ 重播', '↻ Replay') : t('▶ 自动播放', '▶ Auto play'))}
      </button>
      <button className="btn" onClick={() => setStep(tok + 1)} disabled={tok >= L}>{t('下一步 ▶', 'Next ▶')}</button>
      <span style={{ color: 'var(--text-dim)' }}>{lang === 'en' ? <>Step <b style={{ color: 'var(--accent)' }}>{tok}</b> / {L}</> : <>第 <b style={{ color: 'var(--accent)' }}>{tok}</b> / {L} 步</>}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)' }}>{t('序列长度', 'seq length')}</span>
        <input type="range" min={3} max={CAP} step={1} value={L}
          onChange={(e) => onLen(+e.target.value)} style={{ width: 130 }} />
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{L}</b>
      </div>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
        <input type="checkbox" checked={view3d} onChange={(e) => setView3d(e.target.checked)} />
        {t('🛢 3D 滚筒', '🛢 3D drum')}
      </label>
    </div>
  )

  // 开销
  const kvNums = 2 * tok * D

  return (
    <ChapterLayout
      kicker={t('第 9 章 · 生成', 'Chapter 9 · Generation')}
      title={t('自回归生成 + KV 缓存', 'Autoregressive Gen + KV Cache')}
      prev={prev}
      next={next}
      translated
    >
      <>
        {lang === 'en' ? (
          <>
            <p>
              How does a model write a whole passage? <b>One token at a time</b>: use the current last token to
              compute an output, predict the next word, append it, then feed that back in to predict the one after…
              on and on. This is called <b>autoregressive</b> generation.
            </p>
            <h2>Key: cache K and V, but not Q</h2>
            <p>
              When generating step t, you only compute <b>the new token's q_t, k_t, v_t</b>; yet it must attend to
              the K, V of <b>all preceding</b> positions. Recomputing the earlier K, V every step would be O(t²)
              waste — so we <b>cache</b> them and only append one new row per step. Click "Next" on the right to
              watch the K/V cache grow row by row (<b>bright = computed this step, dim = reused from cache</b>).
            </p>
            <p>
              <b>Why isn't Q cached?</b> Because q_t is used only once, at its own step; once it has predicted the
              next word it is useless, and the next step uses a brand-new q_{'{t+1}'}. Discard after use — caching
              it is pointless.
            </p>
            <h2>Attention becomes 1×t</h2>
            <p>
              In training it is a full n×n; at decode there is only <b>one query</b> q_t scoring against t cached
              keys (1×t), softmax into weights, then a <b>weighted sum</b> over the t cached values gives the
              output — the same "weight column · V = output" as Ch. 4 ③.
            </p>
            <div className="note">
              <b>This is where the cost comes from:</b> the KV cache grows <b>linearly</b> with sequence length,
              eating memory in long contexts; and decode must read the entire cache every step → <b>bandwidth
              bottleneck</b>. Ch. 11's MLA and V4's sparse attention both save exactly this.
            </div>
          </>
        ) : (
          <>
            <p>
              模型怎么写出一整段?<b>一个一个 token 地生成</b>:用当前最后一个 token 算出输出、
              预测下一个词,把它接上,再用它当输入预测下下个……不断重复。这叫<b>自回归</b>。
            </p>
            <h2>关键:K、V 要缓存,Q 不用</h2>
            <p>
              生成第 t 步时,只需算<b>新 token 的 q_t、k_t、v_t</b>;而它要和<b>前面所有</b>位置的
              K、V 做注意力。如果每步都重算前面的 K、V,就是 O(t²) 的浪费——
              所以把它们<b>缓存</b>下来,每步只追加新的一行。右边点「下一步」,看 K/V 缓存一行行长出来
              (<b>亮 = 本步新算,淡 = 之前缓存复用</b>)。
            </p>
            <p>
              <b>为什么 Q 不缓存?</b> 因为 q_t 只在它这一步用一次,预测完下一个词就没用了;
              下一步是全新的 q_{'{t+1}'}。用完即弃,缓存它没意义。
            </p>
            <h2>注意力变成 1×t</h2>
            <p>
              训练时是完整的 n×n;decode 时只有<b>一个查询</b> q_t 对 t 个缓存的键算分数(1×t)、
              softmax 成权重,再对 t 个缓存的值<b>加权求和</b>得到输出——和第 4 章 ③ 是同一套
              「权重列 · V = 输出」。
            </p>
            <div className="note">
              <b>这就引出了开销:</b>KV 缓存随序列<b>线性增长</b>,长上下文下吃显存;而 decode 每步都要把整个
              缓存读一遍 → <b>带宽瓶颈</b>。第 11 章 MLA、V4 的稀疏注意力,省的都是这块。
            </div>
          </>
        )}
        <Refs ids={['1706.03762', '2211.05102', '1911.02150', '2405.04434']} />
      </>
      <>
        {view3d ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 12,
              padding: '10px 14px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 10 }}>
              {controls}
            </div>
            <Suspense fallback={<div style={{ height: 480, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--text-dim)', background: 'var(--bg)',
              border: '1px solid var(--border)', borderRadius: 10 }}>{t('加载 3D 场景…', 'Loading 3D scene…')}</div>}>
              <DecodeScene3D step={step} allSteps={allSteps} t={tok} tokens={tokens} fade={fade}
                sel={sel} dim={dim} mode={mode} onScore={onScore} onVCell={onVCell} onOut={onOut}
                controls={controls} />
            </Suspense>
            <p className="step-desc" style={{ marginTop: 10 }}>
              {lang === 'en' ? (
                <>Left/right, <b>the K / V cache and output stay 2D</b>; in the middle, <b style={{ color: 'var(--accent)' }}>q_t</b> / scores /
                <b style={{ color: 'var(--accent-2)' }}> weights</b> form a <b>drum</b> spinning about the horizontal axis: the current step rotates to the <b>front</b> (flat, aligned with the cache rows),
                while past/future steps curl to the back, semi-transparent. Press <b>▶ Auto play</b> and the drum rolls forward with decode — showing that q_t / scores / weights are <b>recomputed and discarded every step</b>,
                while the K/V cache persists and accumulates. The front face is hoverable (row/column selection matches the 2D view).</>
              ) : (
                <>左右 <b>K / V 缓存、输出仍是 2D</b>;中间 <b style={{ color: 'var(--accent)' }}>q_t</b> / 分数 /
                <b style={{ color: 'var(--accent-2)' }}> 权重</b> 是绕横轴的<b>转筒</b>:当前步转到<b>正前方</b>(平铺、与缓存行对齐),
                过去/未来步卷向后方、半透明。按 <b>▶ 自动播放</b>,滚筒随 decode 一步步滚动 —— 体现 q_t/分数/权重 每步<b>重新算、用完即弃</b>,
                而 K/V 缓存持久累积。当前面可悬浮(选行/列与 2D 一致)。</>
              )}
            </p>
          </>
        ) : (
          <FigureBoard renderSvg={renderSvg} baseCell={28} fullCell={46}
            controls={controls} onPageStep={onPageStep} />
        )}

        {!view3d && (
        <div className="matmul-expand">
          <div style={{ marginBottom: 4 }}>
            {t('分数[', 'scores[')}<b style={{ color: 'var(--accent)' }}>{tokens[sel]}</b>{t(`] = 第 ${sel + 1} 个缓存键 k · q_t 逐位相乘再相加:`, `] = cached key #${sel + 1} k · q_t, multiply per-dim then sum:`)}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.9 }}>
            {terms.map((tm, i) => (
              <span key={i}>{i > 0 && ' + '}{tm.k.toFixed(1)}×{tm.q.toFixed(1)}</span>
            ))}
            {'  =  '}<b>{rawDot.toFixed(2)}</b>
            {`  ÷√${D}  =  `}<b style={{ color: 'var(--accent-2)' }}>{scoreVal.toFixed(2)}</b>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            {lang === 'en' ? (
              <>Hover <b>a row of scores / weights / the K cache</b> → pick a cached key (expands the K·q_t dot product here);
              hover <b>a column of V</b> (dim k) → highlight <code>output[k] = weight column · column k of V</code> (the weighted sum of that dim).</>
            ) : (
              <>悬停 <b>分数 / 权重 / K 缓存的某一行</b> → 选定一个缓存键(这里展开 K·q_t 点积);
              悬停 <b>V 某列</b>(维度 k)→ 高亮 <code>输出[k] = 权重列 · V 第 k 列</code>(那一维的加权和)。</>
            )}
          </div>
        </div>
        )}

        <h3 style={{ marginTop: 18 }}>{t(`缓存开销(到第 ${tok} 步)`, `Cache cost (through step ${tok})`)}</h3>
        <div className="cost-panel">
          <div className="cost-row"><span>{t('KV 缓存(toy:数字个数 = 2·t·d)', 'KV cache (toy: number count = 2·t·d)')}</span><b>{kvNums}</b></div>
          <div className="cost-row"><span>{t('每步计算量 · 无缓存(重算前面所有)', 'per-step compute · no cache (recompute all earlier)')}</span><b style={{ color: 'var(--warn)' }}>O(t²)</b></div>
          <div className="cost-row"><span>{t('每步计算量 · 有缓存(只算新行)', 'per-step compute · with cache (only the new row)')}</span><b style={{ color: 'var(--accent-2)' }}>O(t)</b></div>
          <div className="cost-divider" />
          <div className="cost-row" style={{ fontSize: 12 }}>
            <span>{t('缓存随序列', 'Cache scales')}</span><b>{t('线性增长 → 长上下文吃显存 + 解码带宽瓶颈', 'linearly with sequence → long context eats memory + decode bandwidth bottleneck')}</b>
          </div>
        </div>
      </>
    </ChapterLayout>
  )
}
