import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import Slider from '../components/Slider.jsx'
import MatMul from '../components/svg/MatMul.jsx'
import Matrix from '../components/svg/Matrix.jsx'
import Edge from '../components/svg/Edge.jsx'
import AttentionArcs, { arcsGeom } from '../components/svg/AttentionArcs.jsx'
import { T } from '../components/svg/theme.js'
import { attention } from '../lib/attention.js'
import { seededMatrix } from '../lib/synth.js'
import { transpose, matmul } from '../lib/tensor.js'
import { matmulLayout } from '../lib/figure.js'

const WORDS = 'the cat sat on the mat and the dog ran across a green field very fast today while birds flew over quiet hills near the old river bridge at dawn'.split(' ')
const D = 4 // toy 向量维度

function labelFor(i) {
  return i < WORDS.length ? WORDS[i] : `t${i}`
}

export default function Ch04Attention({ prev, next }) {
  const [n, setN] = useState(8)
  const [causal, setCausal] = useState(true)
  const [query, setQuery] = useState(2)
  const [col, setCol] = useState(0) // ① 里悬停的键列(用于点积拆解)
  const [dim, setDim] = useState(0) // 输出/V 的维度列
  const [proj, setProj] = useState(false)              // 显示 Q/K/V = X·W 投影来历
  const [full, setFull] = useState(false)              // 流水线全屏画布
  const [view, setView] = useState({ s: 1, x: 290, y: 70 }) // 画布视图:缩放 + 平移(留出左侧面板)
  const fullRef = useRef(null)
  const scaleRef = useRef(1)
  const panRef = useRef({ x: 290, y: 70 })
  const dragRef = useRef(null)

  // 全屏画布:滚轮朝光标缩放、拖拽平移、PageUp/Down 调长度、Esc 关闭
  useEffect(() => {
    if (!full) return
    const init = { s: 1, x: 290, y: 70 }
    scaleRef.current = init.s; panRef.current = { x: init.x, y: init.y }; setView(init)
    const apply = (s, x, y) => { scaleRef.current = s; panRef.current = { x, y }; setView({ s, x, y }) }
    const onWheel = (e) => {
      e.preventDefault()
      const s = scaleRef.current, p = panRef.current
      if (e.ctrlKey) {
        // 双指捏合(浏览器映射为 ctrl+wheel)→ 朝光标缩放
        const r = fullRef.current.getBoundingClientRect()
        const cx = e.clientX - r.left, cy = e.clientY - r.top
        const factor = Math.min(1.5, Math.max(1 / 1.5, Math.exp(-e.deltaY * 0.01))) // 限制单步,鼠标也平滑
        const s2 = Math.min(6, Math.max(0.2, s * factor))
        apply(s2, cx - ((cx - p.x) / s) * s2, cy - ((cy - p.y) / s) * s2)
      } else {
        // 普通滚轮 / 双指滑动 → 平移(支持横竖)
        apply(s, p.x - e.deltaX, p.y - e.deltaY)
      }
    }
    const onKey = (e) => {
      if (e.key === 'PageUp') { e.preventDefault(); setN((v) => Math.min(48, v + 1)) }
      else if (e.key === 'PageDown') { e.preventDefault(); setN((v) => Math.max(4, v - 1)) }
      else if (e.key === 'Escape') setFull(false)
    }
    const onMove = (e) => {
      const d = dragRef.current
      if (!d) return
      apply(scaleRef.current, d.px + (e.clientX - d.x), d.py + (e.clientY - d.y))
    }
    const onUp = () => { dragRef.current = null; document.body.style.cursor = '' }
    const el = fullRef.current
    if (el) el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      if (el) el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }
  }, [full])

  const startDrag = (e) => {
    dragRef.current = { x: e.clientX, y: e.clientY, px: panRef.current.x, py: panRef.current.y }
    document.body.style.cursor = 'grabbing'
  }

  const q = Math.min(query, n - 1) // 序列变短时夹住查询位置
  const c = col >= 0 ? Math.min(col, n - 1) : -1 // -1 = 未选具体键(整列查询模式)
  const tokens = useMemo(() => Array.from({ length: n }, (_, i) => labelFor(i)), [n])
  // 数据按 n/causal 记忆,身份稳定 → 悬停时格子层不重渲染
  // 嵌入 X 与投影权重 W_*,Q/K/V 真正由 X·W 算出(投影图与下游数值一致)
  const X = useMemo(() => seededMatrix(n, D, 7), [n])
  const WQ = useMemo(() => seededMatrix(D, D, 11), [])
  const WK = useMemo(() => seededMatrix(D, D, 22), [])
  const WV = useMemo(() => seededMatrix(D, D, 33), [])
  const Q = useMemo(() => matmul(X, WQ), [X, WQ])
  const K = useMemo(() => matmul(X, WK), [X, WK])
  const V = useMemo(() => matmul(X, WV), [X, WV])
  const Kt = useMemo(() => transpose(K), [K])
  const att = useMemo(() => attention(Q, K, V, causal), [Q, K, V, causal])
  const { scores, weights, output, d } = att

  // 紧凑格子尺寸
  const big = n > 12
  const huge = n > 22
  const baseCell = huge ? 12 : big ? 16 : 24   // 内联尺寸
  const fullCell = huge ? 20 : big ? 28 : 38   // 全屏放大尺寸
  const show = n <= 8
  const rowLabels = n <= 10 ? tokens : undefined

  // 点积拆解(① 选中格;c<0 时无具体键)
  const terms = c >= 0 ? Q[q].map((qq, t) => ({ q: qq, k: K[c][t] })) : null
  const scoreVal = c >= 0 ? scores[q][c] : null
  // 稳定回调 → 格子层 memo 生效(悬停不重建数千节点)
  const onCell = useCallback((i, j) => { setQuery(i); setCol(j) }, [])
  const focusQuery = useCallback((i) => { setQuery(i); setCol(-1) }, [])
  const focusKey = useCallback((j) => { setCol(j) }, [])
  const onVCell = useCallback((_i, j) => { setDim(j); setCol(-1) }, [])
  const onOutCell = useCallback((i, k) => { setQuery(i); setDim(k); setCol(-1) }, [])

  // 按给定格子尺寸生成整条流水线 SVG(内联用小尺寸,全屏用大尺寸)
  const pipeSvg = (cell) => {
    const L = matmulLayout({ m: n, k: D, p: n, cell, labelW: T.labelW, colLabelH: T.colLabelH, gap: T.gap })
    const baseY = L.headerH
    const midY = baseY + (n * cell) / 2
    const EDGE = 34
    const resultRight = L.result.x + n * cell
    const x2 = resultRight + EDGE
    const wCellsL = x2 + T.labelW
    const wRight = wCellsL + n * cell
    const x3 = wRight + EDGE
    const wcCellsL = x3 + T.labelW
    const wcRight = wcCellsL + cell
    const xV = wcRight + 22
    const vRight = xV + D * cell
    const x4 = vRight + EDGE
    const oCellsL = x4 + T.labelW
    // 注意力连线区(并入同一画板,放在矩阵下方)
    const ag = arcsGeom(cell)
    const connY = L.h + 48
    const connH = ag.archH + ag.boxH + 26
    const pipeH = connY + connH
    // 第0步:线性投影(开关打开时叠在最上,整条流水线下移)
    const pj = matmulLayout({ m: n, k: D, p: D, cell, labelW: T.labelW, colLabelH: T.colLabelH, gap: T.gap })
    const pjGap = 44, pjTop = 30
    const projBlockH = proj ? pjTop + pj.h + 40 : 0
    const svgW = Math.max(oCellsL + D * cell + 12, n * ag.step + 12, proj ? 3 * pj.w + 2 * pjGap + 12 : 0)
    const svgH = projBlockH + pipeH
    return (
      <svg width={svgW} height={svgH} style={{ display: 'block', minWidth: svgW }}>
        {proj && (
          <g>
            <text x={0} y={16} fontFamily={T.font} fontSize={12} fill={T.c.accent}>
              第0步:线性投影 — Q/K/V = X · W(同一个嵌入 X,各自的学习矩阵 W)
            </text>
            <MatMul x={0} y={pjTop} A={X} Bt={WQ} result={Q} cell={cell}
              rowLabels={rowLabels} showValues={show} aLabel="X" bLabel="W_Q" resultLabel="Q" />
            <MatMul x={pj.w + pjGap} y={pjTop} A={X} Bt={WK} result={K} cell={cell}
              rowLabels={rowLabels} showValues={show} aLabel="X" bLabel="W_K" resultLabel="K" />
            <MatMul x={2 * (pj.w + pjGap)} y={pjTop} A={X} Bt={WV} result={V} cell={cell}
              rowLabels={rowLabels} showValues={show} aLabel="X" bLabel="W_V" resultLabel="V" />
          </g>
        )}
        <g transform={`translate(0,${projBlockH})`}>
        <text x={L.A.x} y={12} fontFamily={T.font} fontSize={12} fill={T.c.accent}>① 打分 Q·Kᵀ</text>
        <text x={wCellsL} y={baseY - 20} fontFamily={T.font} fontSize={12} fill={T.c.accent}>② 注意力权重</text>
        <text x={wcCellsL} y={baseY - 20} fontFamily={T.font} fontSize={12} fill={T.c.accent}>③ 权重列 × V → 输出</text>

        <MatMul x={0} y={0} A={Q} Bt={Kt} result={scores} cell={cell}
          rowLabels={rowLabels} colLabels={rowLabels}
          selRow={q} selCol={c} onHoverCell={onCell}
          onHoverARow={focusQuery} onHoverBtCol={focusKey} showValues={show}
          aLabel="Q" bLabel="Kᵀ" resultLabel="分数" />

        <Matrix x={x2} y={baseY} data={weights} cell={cell}
          rowLabels={rowLabels} rowLabelW={T.labelW} highlightRow={q} highlightCol={c}
          onHoverCell={onCell} showValues={show} />
        <text x={wCellsL + (n * cell) / 2} y={baseY - 5} textAnchor="middle"
          fontFamily={T.font} fontSize={T.fsLabel} fill={T.c.accent2}>权重{causal ? '(因果)' : ''}</text>

        <Matrix x={x3} y={baseY} data={weights[q].map((w) => [w])} cell={cell}
          rowLabels={rowLabels} rowLabelW={T.labelW} highlightRow={c}
          onHoverCell={focusKey} vmax={1} showValues={show} />
        <rect x={wcCellsL - 1.5} y={baseY - 1.5} width={cell + 3} height={n * cell + 3}
          fill="none" stroke={T.c.accent2} strokeWidth={1.5} strokeDasharray="3 2" />
        <text x={wcCellsL + cell / 2} y={baseY - 5} textAnchor="middle"
          fontFamily={T.font} fontSize={T.fsLabel} fill={T.c.accent2}>权重[{tokens[q]}]</text>

        <text x={(wcRight + xV) / 2} y={midY} textAnchor="middle" dominantBaseline="central"
          fontFamily={T.font} fontSize={16} fill={T.c.dim}>×</text>

        <Matrix x={xV} y={baseY} data={V} cell={cell} rowLabelW={0}
          highlightCol={dim}
          onHoverCell={onVCell} showValues={show} />
        <text x={xV + (D * cell) / 2} y={baseY - 5} textAnchor="middle"
          fontFamily={T.font} fontSize={T.fsLabel} fill={T.c.dim}>V 值</text>

        <Matrix x={x4} y={baseY} data={output} cell={cell}
          rowLabels={rowLabels} rowLabelW={T.labelW} highlightCell={[q, dim]}
          onHoverCell={onOutCell} showValues={show} />
        <text x={oCellsL + (D * cell) / 2} y={baseY - 5} textAnchor="middle"
          fontFamily={T.font} fontSize={T.fsLabel} fill={T.c.accent2}>输出</text>

        <Edge from={{ x: resultRight, y: midY }} to={{ x: wCellsL, y: midY }} label={`÷√${d}\nsoftmax每行`} />
        <Edge from={{ x: wRight, y: midY }} to={{ x: wcCellsL, y: midY }} label={'取\n第q行'} />
        <Edge from={{ x: vRight, y: midY }} to={{ x: oCellsL, y: midY }} label={'Σ\n加权和'} />

        {/* ④ 注意力连线(同一画板) */}
        <text x={0} y={connY - 14} fontFamily={T.font} fontSize={12} fill={T.c.accent}>④ 注意力连线</text>
        <AttentionArcs x={0} y={connY} tokens={tokens} weights={weights} query={q}
          selKey={c} onSelect={focusQuery} cell={cell} />
        </g>
      </svg>
    )
  }

  // ---- 开销估算 ----
  const scoresCount = n * n
  // 真实参照:GPT-3 规模标准 MHA,128K 上下文的 KV 缓存(fp16)
  const REAL = { layers: 96, dModel: 12288, ctx: 128000 }
  const kvBytes = 4 * REAL.layers * REAL.dModel * REAL.ctx // 2(K,V)×2字节×layers×d×ctx
  const kvGB = Math.round(kvBytes / 1e9)

  return (
    <ChapterLayout kicker="第 4 章 · 核心" title="自注意力 Self-Attention" prev={prev} next={next}>
      <>
        <p>
          这是 Transformer 的心脏。每个 token 都会"环顾"序列里的其他 token,
          按相关程度把它们的信息汇聚到自己身上——这样"它"才知道指代的是哪个名词。
        </p>
        <p>机制分四步,用三组向量 <b>Q(查询)</b>、<b>K(键)</b>、<b>V(值)</b>:打分 → 缩放 → softmax → 加权求和。</p>
        <h2>拖长序列,感受长上下文的开销</h2>
        <p>
          拖动「逐步计算」下方的<b>序列长度</b>滑块,盯住第 1 步那张分数矩阵:它是 <b>n×n</b> 的——
          序列翻一倍,要算的注意力分数就变成 <b>4 倍</b>(平方增长)。这就是长上下文为什么贵。
        </p>
        <p>
          更要命的是生成时要把每个 token 的 <b>K、V 缓存</b>下来(KV 缓存),它随序列<b>线性</b>增长、吃显存。
          滑块下方给了一个真实量级的估算。
        </p>
        <div className="note">
          看到这块开销,就懂了 DeepSeek <b>MLA</b> 的动机:把 K、V 压成一个低秩"潜向量"再缓存,
          KV 显存直接砍掉约 93%。这是第 11 章的主角。
        </div>
      </>
      <>
        <h3>计算流水线(从左到右)</h3>
        <p className="step-desc">
          一条线读完:① Q·Kᵀ 打分 → softmax 出权重 → ③ 权重×V 得输出。
          <b style={{ color: 'var(--accent)' }}>查询 q</b> 决定 Q/分数行/权重行/输出;
          <b style={{ color: 'var(--accent)' }}>键 c</b> 决定 Kᵀ列/权重列里那一项。
          <br />③ 的看法:把 ② 中<b>查询 q 那行权重「竖起来」</b>成权重列(与 V 的行一一对应);
          <b>权重列 · V 的某一列(维度) = 输出的那一格</b>——和 ① 的"Q行·K列=分数格"对称。
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 12,
          padding: '10px 14px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={causal} onChange={(e) => setCausal(e.target.checked)} />
            因果掩码
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={proj} onChange={(e) => setProj(e.target.checked)} />
            显示 Q/K/V 来历(X·W)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ color: 'var(--text-dim)' }}>序列长度</span>
            <input type="range" min={4} max={48} step={1} value={n}
              onChange={(e) => setN(Math.round(+e.target.value))} style={{ width: 150 }} />
            <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{n}</b>
          </div>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={() => setFull(true)}>⛶ 全屏画布</button>
        </div>
        {!full && (
          <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
            {pipeSvg(baseCell)}
          </div>
        )}

        {full && (
          <div ref={fullRef} className="pipe-fullscreen" onMouseDown={startDrag}
            style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,14,0.98)', zIndex: 1000, overflow: 'hidden', cursor: 'grab' }}>
            {/* 可拖拽/缩放的画布层 */}
            <div style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, transformOrigin: '0 0' }}>
              {pipeSvg(fullCell)}
            </div>
            {/* 固定顶栏(不随画布变换) */}
            <div onMouseDown={(e) => e.stopPropagation()}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '10px 16px', background: 'rgba(8,10,14,0.85)', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                全屏画布 &nbsp;|&nbsp; <b style={{ color: 'var(--accent)' }}>捏合 / Ctrl+滚轮</b> 缩放 {Math.round(view.s * 100)}% ·
                <b style={{ color: 'var(--accent)' }}> 滚轮 / 拖拽</b> 平移 &nbsp;|&nbsp;
                序列 <b style={{ color: 'var(--accent)' }}>n={n}</b>(PageUp/Down) &nbsp;|&nbsp; Esc 关闭
              </span>
              <button className="btn" onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setFull(false)}>✕ 关闭</button>
            </div>
            {/* 全屏控制面板(不随画布变换) */}
            <div onMouseDown={(e) => e.stopPropagation()}
              style={{ position: 'absolute', top: 54, left: 16, width: 250, background: 'var(--bg-panel)',
                border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={causal} onChange={(e) => setCausal(e.target.checked)} />
                因果掩码(不能偷看未来)
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={proj} onChange={(e) => setProj(e.target.checked)} />
                显示 Q/K/V 来历(X·W)
              </label>
              <Slider label="序列长度 n" value={n} min={4} max={48} step={1}
                onChange={(v) => setN(Math.round(v))} fmt={(v) => `${v}`} />
            </div>
          </div>
        )}

        {/* 点积拆解(① 选中格;需选定一个键 c) */}
        <div className="matmul-expand">
          {terms ? (
            <>
              <div style={{ marginBottom: 4 }}>
                分数[<b style={{ color: 'var(--accent)' }}>{tokens[q]}</b> 行 ·
                <b style={{ color: 'var(--accent)' }}> {tokens[c]}</b> 列] = Q 行 · K 行 逐位相乘再相加:
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.9 }}>
                {terms.map((t, idx) => (
                  <span key={idx}>{idx > 0 && ' + '}{t.q.toFixed(1)}×{t.k.toFixed(1)}</span>
                ))}
                {'  =  '}<b style={{ color: 'var(--accent-2)' }}>{scoreVal.toFixed(2)}</b>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-dim)' }}>
              当前聚焦查询 <b style={{ color: 'var(--accent)' }}>{tokens[q]}</b>(整列权重已框出)。
              悬停 ① 结果格、② 权重、Kᵀ、权重列或 V 选定一个<b>键</b>,这里展开 Q·K 点积。
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            悬停<b>查询类</b>(Q/输出)= 定查询、框出整列权重;悬停<b>键类</b>(Kᵀ/权重列)= 点亮某个键。
            悬停 <b>V 某列</b>(维度 k)= <code>输出[q][k] = 权重列 · V第k列</code>(权重列整列 · V那一列 → 输出那一格)。
          </div>
        </div>

        <h3 style={{ marginTop: 24 }}>长上下文开销(随上方「序列长度」变化)</h3>
        <div className="cost-panel">
          <div className="cost-row">
            <span>注意力分数(每层每头)</span>
            <b>n² = {scoresCount.toLocaleString()}</b>
          </div>
          <div className="cost-row">
            <span>计算量随 n</span>
            <b>平方增长 O(n²)</b>
          </div>
          <div className="cost-row">
            <span>KV 缓存随 n</span>
            <b>线性增长 O(n)</b>
          </div>
          <div className="cost-divider" />
          <div className="cost-row" style={{ fontSize: 12 }}>
            <span>真实参照:GPT-3 规模 · 标准 MHA · 128K 上下文</span>
            <b style={{ color: 'var(--warn)' }}>KV 缓存 ≈ {kvGB} GB</b>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            DeepSeek 用 <b>MLA</b> 把这块压缩约 93% → 约 1/14(第 11 章)。
          </div>
        </div>
      </>
    </ChapterLayout>
  )
}
