import { useState, useMemo } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Tex from '../components/Tex.jsx'
import Refs from '../components/Refs.jsx'
import { T } from '../components/svg/theme.js'
import { seededMatrix } from '../lib/synth.js'
import { colorFor } from '../lib/figure.js'
import { sinkhorn, rowSums, colSums, gainCurve, spectralRadius } from '../lib/manifold.js'
import { useLang, useT } from '../i18n/lang.jsx'

const N = 4 // 残差流条数(扩展率,真实 n=4)
const L = 12 // 演示深度(真实是几十层)
const KMAX = 20 // Sinkhorn 迭代上限(真实 t_max=20)
const X0 = [1, 0.4, 0.9, 0.5] // 固定初始信号(跨流):带均匀分量,双随机下稳在 ~1×

// 增益格式化
const fmtG = (g) => (g >= 100 ? Math.round(g).toLocaleString() : g >= 10 ? g.toFixed(0) : g.toFixed(2))

// 英文更长,按文本宽度兜底避免裁切(CJK≈11、ASCII≈6.4)
const estTextW = (s) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 11 : 6.4), 0)

export default function Ch17MHC({ prev, next }) {
  const t = useT()
  const { lang } = useLang()
  const [k, setK] = useState(0) // Sinkhorn 迭代次数:0=未约束(爆炸),20=mHC(双随机)

  const d = useMemo(() => {
    const raw = seededMatrix(N, N, 17).map((r) => r.map((v) => (v + 1) / 2)) // 非负 [0,1]
    const M = sinkhorn(raw, k)
    const rs = rowSums(M)
    const cs = colSums(M)
    const rho = spectralRadius(M)
    const gains = gainCurve(M, X0, L)
    const vmax = Math.max(...M.flat(), 1e-6)
    const maxDev = Math.max(...rs.map((s) => Math.abs(s - 1)), ...cs.map((s) => Math.abs(s - 1)))
    return { M, rs, cs, rho, gains, vmax, maxDev, isDS: maxDev < 0.02, finalGain: gains[gains.length - 1] }
  }, [k])

  const render = (cell) => {
    const cs = cell
    const mx = 8
    const my = 30
    const sumGap = 8
    const sumW = 34
    // 增益图区
    const chX = mx + N * cs + sumW + 40
    const chW = Math.max(150, cell * 6)
    const chTop = my
    const chH = N * cs
    const els = []

    // —— 左:流间混合矩阵 H^res —— //
    els.push(<text key="mt" x={mx} y={16} fontFamily={T.font} fontSize={11} fill={T.c.dim}>{t(`流间混合矩阵 Hʳᵉˢ (n=${N})`, `Cross-stream mixing matrix Hʳᵉˢ (n=${N})`)}</text>)
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const v = d.M[i][j]
        els.push(<rect key={`c${i}-${j}`} x={mx + j * cs} y={my + i * cs} width={cs} height={cs}
          fill={colorFor(v, d.vmax)} stroke={T.c.border} strokeWidth={0.5} />)
        els.push(<text key={`v${i}-${j}`} x={mx + j * cs + cs / 2} y={my + i * cs + cs / 2 + 3.5}
          textAnchor="middle" fontFamily={T.font} fontSize={9} fill={T.c.text}>{v.toFixed(2)}</text>)
      }
      // 行和
      const ok = Math.abs(d.rs[i] - 1) < 0.02
      els.push(<text key={`rs${i}`} x={mx + N * cs + sumGap} y={my + i * cs + cs / 2 + 3.5}
        fontFamily={T.font} fontSize={9.5} fill={ok ? T.c.accent2 : T.c.warn}>Σ{d.rs[i].toFixed(2)}</text>)
    }
    // 列和
    for (let j = 0; j < N; j++) {
      const ok = Math.abs(d.cs[j] - 1) < 0.02
      els.push(<text key={`cs${j}`} x={mx + j * cs + cs / 2} y={my + N * cs + 13} textAnchor="middle"
        fontFamily={T.font} fontSize={9.5} fill={ok ? T.c.accent2 : T.c.warn}>{d.cs[j].toFixed(2)}</text>)
    }
    els.push(<text key="rl" x={mx + N * cs + sumGap} y={my - 6} fontFamily={T.font} fontSize={8.5} fill={T.c.dim}>{t('行和', 'Row Σ')}</text>)
    els.push(<text key="cl" x={mx + N * cs + sumGap} y={my + N * cs + 13} fontFamily={T.font} fontSize={8.5} fill={T.c.dim}>{t('← 列和', '← Col Σ')}</text>)

    // —— 右:信号增益曲线(log 轴 0.1×~10000×)—— //
    const vmin = -1, vtop = 4 // log10
    const yForLog = (g) => {
      const v = Math.log10(Math.max(g, 1e-3))
      return chTop + chH - ((v - vmin) / (vtop - vmin)) * chH
    }
    // 网格 + 参考线
    const marks = [0, 1, 2, 3, 4] // 1× 10× 100× 1000× 10000×
    marks.forEach((mk) => {
      const y = chTop + chH - ((mk - vmin) / (vtop - vmin)) * chH
      els.push(<line key={`gl${mk}`} x1={chX} y1={y} x2={chX + chW} y2={y}
        stroke={mk === 0 ? T.c.accent2 : T.c.border} strokeWidth={mk === 0 ? 1.2 : 0.5} strokeDasharray={mk === 0 ? '4 3' : ''} />)
      els.push(<text key={`gt${mk}`} x={chX - 4} y={y + 3} textAnchor="end" fontFamily={T.font} fontSize={8}
        fill={mk === 0 ? T.c.accent2 : T.c.dim}>{mk === 0 ? '1×' : `1e${mk}`}</text>)
    })
    // 曲线
    const step = chW / L
    const explode = d.finalGain > 10
    const pts = d.gains.map((g, l) => `${chX + l * step},${yForLog(g)}`).join(' ')
    els.push(<polyline key="gain" points={pts} fill="none" stroke={explode ? T.c.hot : T.c.accent2} strokeWidth={2} />)
    d.gains.forEach((g, l) => els.push(<circle key={`pt${l}`} cx={chX + l * step} cy={yForLog(g)} r={2}
      fill={explode ? T.c.hot : T.c.accent2} />))
    const chartTitle = t(`信号增益 ‖Hˡ x‖ / ‖x‖(跨 ${L} 层,log 轴)`, `Signal gain ‖Hˡ x‖ / ‖x‖ (over ${L} layers, log axis)`)
    els.push(<text key="cht" x={chX} y={16} fontFamily={T.font} fontSize={11} fill={T.c.dim}>{chartTitle}</text>)
    els.push(<text key="chx" x={chX + chW} y={chTop + chH + 13} textAnchor="end" fontFamily={T.font} fontSize={8.5} fill={T.c.dim}>{t(`层 → ${L}`, `Layer → ${L}`)}</text>)

    const W = Math.max(chX + chW + 10, chX + estTextW(chartTitle) + 10)
    const H = chTop + chH + 22
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  const controls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 130 }}>{t('Sinkhorn 迭代 k', 'Sinkhorn iters k')}</span>
      <input type="range" min={0} max={KMAX} step={1} value={k} onChange={(e) => setK(+e.target.value)} style={{ width: 150 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{k}</b>
      <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{k === 0 ? t('(未约束 HC)', '(unconstrained HC)') : d.isDS ? t('(已双随机 = mHC)', '(doubly stochastic = mHC)') : t('(归一中…)', '(normalizing…)')}</span>
    </label>
  )

  const hcTex = `\\underbrace{x_{l+1}=x_l+f(x_l)}_{\\textcolor{#6ea8fe}{\\text{${t('单流残差', 'single-stream residual')}}}}
\\;\\longrightarrow\\;
\\underbrace{H_{l+1}=B^{\\top}f(A_m^{\\top}H_l)+\\textcolor{#f0a35e}{H^{\\text{res}}}\\,H_l}_{\\textcolor{#7ee787}{\\text{HC:}\\,n\\text{ ${t('条流', 'streams')}}+\\text{${t('流间混合', 'cross-stream mix')}}}}`

  const dsTex = `\\textcolor{#f0a35e}{H^{\\text{res}}}\\in\\text{${t('Birkhoff(双随机)', 'Birkhoff (doubly stochastic)')}}:\\quad
H^{\\text{res}}_{ij}\\ge0,\\;\\;\\sum_{j}H^{\\text{res}}_{ij}=1,\\;\\;\\sum_{i}H^{\\text{res}}_{ij}=1
\\;\\;\\Rightarrow\\;\\;\\rho(H^{\\text{res}})=1`

  return (
    <ChapterLayout
      kicker={t('第二部分 · DeepSeek-V4 · Ch17', 'Part 2 · DeepSeek-V4 · Ch17')}
      title={t('mHC:把残差从「一条流」变成「稳的多条流」', 'mHC: from one residual stream to many stable ones')}
      prev={prev}
      next={next}
      translated
    >
      <>
        {lang === 'en' ? (
          <>
            <p>
              Chapter 7 covered the <b>residual connection</b> <Tex>{'x_{l+1}=x_l+f(x_l)'}</Tex>: one "main signal stream"
              added along all the way, making deep networks trainable. But it has an old flaw — <b>Pre-Norm</b> (today's mainstream)
              resists vanishing gradients, yet suffers <b>representation collapse</b> (deeper layers output ever more alike, layers piled on for nothing);
              <b> Post-Norm</b> doesn't collapse but brings back vanishing gradients. It's a <b>seesaw</b>: push one side down, the other pops up.
            </p>
            <h2>Hyper-Connections: expand one stream into n</h2>
            <p>
              ByteDance's <b>Hyper-Connections (HC)</b> idea: don't keep just one residual stream, keep <b>n in parallel</b> (n=4 is empirically the sweet spot),
              and mix them between layers with a set of learnable connection weights: <b>A_m</b> merges the n streams into the layer's input,
              <b> B</b> distributes the layer output back to each stream, and <b style={{ color: 'var(--warn)' }}>Hʳᵉˢ</b> (n×n) does the residual mixing across streams.
              Multiple streams each handle a "depth range", pinning down both ends of the seesaw at once.
            </p>
            <div style={{ fontSize: 14.5, overflowX: 'auto', margin: '6px 0' }}><Tex block>{hcTex}</Tex></div>
            <h2>But at large-model scale, it "blows up"</h2>
            <p>
              The trouble is that cross-stream mixing matrix <b style={{ color: 'var(--warn)' }}>Hʳᵉˢ</b>: unconstrained, its "amplification factor" can be &gt;1,
              so the signal is <b>amplified exponentially layer by layer</b>. DeepSeek measured a gain peak of <b>~3000×</b> on a 27B model → training diverges outright.
            </p>
            <h2>mHC: pin the mixing matrix onto the "doubly stochastic" manifold</h2>
            <p>
              DeepSeek-V4's fix, <b>mHC (manifold-constrained hyper-connections)</b>: force <b style={{ color: 'var(--warn)' }}>Hʳᵉˢ</b> to be a
              <b> doubly stochastic matrix</b> — non-negative, with <b>every row sum and every column sum equal to 1</b> (geometrically it lands on the manifold called the "Birkhoff polytope").
              A doubly stochastic matrix has <b>spectral radius exactly 1</b>, which means that under repeated cross-layer action the signal is <b>neither amplified nor attenuated exponentially</b>.
            </p>
            <div style={{ fontSize: 14, overflowX: 'auto', margin: '6px 0' }}><Tex block>{dsTex}</Tex></div>
            <p>
              How do you project an arbitrary matrix onto doubly stochastic? Use the <b>Sinkhorn–Knopp</b> algorithm: <b>alternately</b> normalize each row to sum 1, then each column to sum 1,
              back and forth a few times until it converges (V4 uses 20 iterations). The figure on the right is that actual process: drag k to watch row/column sums both rush toward 1, and the signal gain crash from thousands of times back to ~1.
            </p>
            <div className="note">
              Measured effect: the gain drops from <b>~3000×</b> by <b>three orders of magnitude to ~1.6</b>, recovering "identity-map"-like stability;
              a 4× expansion adds only <b>6.7%</b> compute, and can stably train the deep stacks of 27B+ models.
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              <b>Honest simplification of this figure</b>: here we only demo the "cross-stream mixing matrix acting repeatedly → signal gain" — the <b>stability kernel</b> (the crux of mHC),
              omitting HC's full merge/distribute forward pass; the toy uses n=4 and 12 layers, whereas reality is 27B and dozens of layers. The direction of the conclusion is the same:
              <b> no constraint → explosion, doubly stochastic → bounded</b>.
            </div>
          </>
        ) : (
          <>
            <p>
              第 7 章讲过<b>残差连接</b> <Tex>{'x_{l+1}=x_l+f(x_l)'}</Tex>:一条「主干信号流」一路加下去,让深层网络好训练。
              但它有个老毛病——<b>Pre-Norm</b>(现在主流)虽不易梯度消失,却会<b>表示坍塌</b>(越深的层输出越像、白堆层);
              <b>Post-Norm</b> 不坍塌却又梯度消失。这是个<b>跷跷板</b>,按下葫芦浮起瓢。
            </p>
            <h2>Hyper-Connections:把一条流扩成 n 条</h2>
            <p>
              字节跳动的 <b>Hyper-Connections(HC)</b> 思路:别只留一条残差流,<b>并行留 n 条</b>(实测 n=4 最划算),
              层与层之间用一组可学的连接权重把它们<b>混合</b>:<b>A_m</b> 把 n 条流合成层的输入、<b>B</b> 把层输出分发回各流、
              <b style={{ color: 'var(--warn)' }}>Hʳᵉˢ</b>(n×n)在各流之间做残差混合。多条流各管一段「深浅」,跷跷板两头同时压住。
            </p>
            <div style={{ fontSize: 14.5, overflowX: 'auto', margin: '6px 0' }}><Tex block>{hcTex}</Tex></div>
            <h2>但放到大模型上,它会「炸」</h2>
            <p>
              问题出在那个流间混合矩阵 <b style={{ color: 'var(--warn)' }}>Hʳᵉˢ</b>:如果不加约束,它的「放大倍率」可能 &gt;1,
              于是信号<b>逐层指数放大</b>。DeepSeek 实测 27B 模型上增益峰值冲到 <b>~3000×</b> → 训练直接发散。
            </p>
            <h2>mHC:把混合矩阵钉在「双随机」流形上</h2>
            <p>
              DeepSeek-V4 的解法 <b>mHC(流形约束超连接)</b>:强制 <b style={{ color: 'var(--warn)' }}>Hʳᵉˢ</b> 成为
              <b>双随机矩阵</b>——非负、且<b>每行和、每列和都等于 1</b>(几何上落在「Birkhoff 多胞形」这个流形里)。
              双随机矩阵的<b>谱半径恰好等于 1</b>,意味着反复跨层作用时,信号<b>既不指数放大、也不指数衰减</b>。
            </p>
            <div style={{ fontSize: 14, overflowX: 'auto', margin: '6px 0' }}><Tex block>{dsTex}</Tex></div>
            <p>
              怎么把任意矩阵投影成双随机?用 <b>Sinkhorn–Knopp</b> 算法:<b>交替</b>把每行归一化到和为 1、再把每列归一化到和为 1,
              来回几次就收敛(V4 用 20 次)。右图就是这个真实过程:拖 k 看行和/列和一起奔向 1,信号增益从几千倍砸回 ~1。
            </p>
            <div className="note">
              实测效果:增益从 <b>~3000×</b> 降<b>三个数量级到 ~1.6</b>,恢复「恒等映射」般的稳定;
              扩展 4 倍仅多 <b>6.7%</b> 计算,就能稳稳训练 27B+ 的深堆叠。
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              <b>本图的诚实简化</b>:这里只演示「流间混合矩阵反复作用 → 信号增益」这个<b>稳定性内核</b>(mHC 的关键),
              省去了 HC 完整的合流/分发前向;toy 用 n=4、12 层,真实是 27B、几十层。结论方向一致:
              <b>没约束→爆炸,双随机→有界</b>。
            </div>
          </>
        )}
        <Refs ids={['2409.19606', '2512.24880', '2606.19348', '2002.04745']} />
      </>
      <>
        <h3>{t('Sinkhorn 把混合矩阵推成双随机 → 信号增益从爆炸到稳定', 'Sinkhorn pushes the mixing matrix to doubly stochastic → gain goes from explosive to stable')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {lang === 'en' ? (
            <>k=0 is the unconstrained raw mixing matrix: row/column sums are all over the place (<b style={{ color: 'var(--warn)' }}>orange</b>),
            and the gain curve on the right <b style={{ color: 'var(--hot,#ff6b6b)' }}>shoots up</b>. Increase k: each row and column is alternately normalized,
            so row and column sums all <b style={{ color: 'var(--accent-2)' }}>become 1</b> (doubly stochastic = mHC), and the gain curve is pushed back near the <b>1×</b> reference line.</>
          ) : (
            <>k=0 是未约束的原始混合矩阵:行和/列和五花八门(<b style={{ color: 'var(--warn)' }}>橙</b>),
            右边增益曲线<b style={{ color: 'var(--hot,#ff6b6b)' }}>冲上天</b>。拖大 k:每行每列被交替归一,
            行和列和都<b style={{ color: 'var(--accent-2)' }}>变成 1</b>(双随机=mHC),增益曲线被压回 <b>1×</b> 参考线附近。</>
          )}
        </p>
        <FigureBoard renderSvg={render} baseCell={30} fullCell={42} controls={controls} />
        <div style={{ marginTop: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
            {lang === 'en' ? (
              <>Current k={k}: spectral radius ρ≈<b style={{ color: d.rho > 1.1 ? 'var(--hot,#ff6b6b)' : 'var(--accent2)' }}>{d.rho.toFixed(2)}</b>;
              row/col sums deviate from 1 by at most <b style={{ color: d.isDS ? 'var(--accent2)' : 'var(--warn)' }}>{d.maxDev.toFixed(2)}</b>
              {d.isDS ? ' (doubly stochastic ✓)' : ''};
              signal gain over {L} layers ≈ <b style={{ color: d.finalGain > 10 ? 'var(--hot,#ff6b6b)' : 'var(--accent2)' }}>{fmtG(d.finalGain)}×</b>
              {d.finalGain > 10 ? ' (exponential blow-up → diverges)' : ' (bounded, stable)'}.</>
            ) : (
              <>当前 k={k}:谱半径 ρ≈<b style={{ color: d.rho > 1.1 ? 'var(--hot,#ff6b6b)' : 'var(--accent2)' }}>{d.rho.toFixed(2)}</b>;
              行/列和偏离 1 最多 <b style={{ color: d.isDS ? 'var(--accent2)' : 'var(--warn)' }}>{d.maxDev.toFixed(2)}</b>
              {d.isDS ? '(已双随机 ✓)' : ''};
              经 {L} 层信号增益 ≈ <b style={{ color: d.finalGain > 10 ? 'var(--hot,#ff6b6b)' : 'var(--accent2)' }}>{fmtG(d.finalGain)}×</b>
              {d.finalGain > 10 ? '(指数爆炸 → 发散)' : '(有界,稳)'}。</>
            )}
          </div>
        </div>
      </>
    </ChapterLayout>
  )
}
