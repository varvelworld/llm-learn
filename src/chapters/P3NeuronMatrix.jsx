import { useState } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import Refs from '../components/Refs.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Tex from '../components/Tex.jsx'
import MatMul from '../components/svg/MatMul.jsx'
import Matrix from '../components/svg/Matrix.jsx'
import Edge from '../components/svg/Edge.jsx'
import { T } from '../components/svg/theme.js'
import { matmulLayout } from '../lib/figure.js'
import { seededMatrix } from '../lib/synth.js'
import { dot } from '../lib/tensor.js'
import { relu } from '../lib/ffn.js'
import { useLang, useT } from '../i18n/lang.jsx'

const CA = '#6ea8fe'; const CB = '#7ee787'; const CR = '#f0a35e'
const num = (v) => (Number.isInteger(v) ? `${v}` : v.toFixed(2))
const par = (v) => (v < 0 ? `(${num(v)})` : num(v))
const plus = (s, y) => (y < 0 ? `${s} - ${num(Math.abs(y))}` : `${s} + ${num(y)}`)
const tc = (c, s) => `\\textcolor{${c}}{${s}}`

// 单神经元权重 + 一层(4 神经元)权重,固定可复现
const W1 = [0.9, -0.7, 1.1]; const B1 = 0.3
// 取 1 位小数,保证热力图(显示 1 位)与下方公式数值完全一致
const WL = seededMatrix(4, 3, 5).map((r) => r.map((v) => +v.toFixed(1))) // 4×3
const BL = [0.2, -0.4, 0.5, -0.1]
const NEU = ['#6ea8fe', '#7ee787', '#f0a35e', '#d2a8ff']

export default function P3NeuronMatrix({ prev, next }) {
  const t = useT()
  const { lang } = useLang()
  const [x, setX] = useState([1.0, 0.6, -0.4])
  const [sel, setSel] = useState(1)

  // 单神经元
  const z1 = dot(W1, x) + B1
  const a1 = relu(z1)

  // 一层
  const WxOnly = WL.map((row) => dot(row, x)) // 不含偏置的 W·x
  const zL = WL.map((row, j) => dot(row, x) + BL[j])
  const aL = zL.map(relu)

  // ───────── 图 1:一个神经元 = 点积 + 偏置 + 激活 ─────────
  const renderNeuron = () => {
    const ix = 60; const ys = [55, 110, 165]; const ir = 18
    const nx = 250; const ny = 110; const nr = 26
    const ax = 330; const ox = 412
    const els = []
    x.forEach((xi, i) => {
      els.push(<line key={`e${i}`} x1={ix + ir} y1={ys[i]} x2={nx - nr} y2={ny}
        stroke={CA} strokeWidth={1.2 + Math.min(3, Math.abs(W1[i]) * 1.6)} opacity={0.7} />)
      const mx = (ix + ir + nx - nr) / 2; const my = (ys[i] + ny) / 2
      els.push(<text key={`w${i}`} x={mx} y={my - 3} textAnchor="middle" fontFamily={T.font} fontSize={10} fill={T.c.warn}>w{i}={W1[i]}</text>)
      els.push(<circle key={`n${i}`} cx={ix} cy={ys[i]} r={ir} fill={T.c.bgElev} stroke={CA} strokeWidth={1.5} />)
      els.push(<text key={`nt${i}`} x={ix} y={ys[i] + 4} textAnchor="middle" fontFamily={T.font} fontSize={12} fill="#fff">{num(xi)}</text>)
      els.push(<text key={`nl${i}`} x={ix - ir - 6} y={ys[i] + 4} textAnchor="end" fontFamily={T.font} fontSize={11} fill={T.c.dim}>x{i}</text>)
    })
    // 神经元体:加权和 + 偏置
    els.push(<circle key="body" cx={nx} cy={ny} r={nr} fill={T.c.bgElev} stroke={T.c.accent2} strokeWidth={2} />)
    els.push(<text key="bsum" x={nx} y={ny - 2} textAnchor="middle" fontFamily={T.font} fontSize={12} fill={T.c.accent2}>Σ+b</text>)
    els.push(<text key="bz" x={nx} y={ny + 13} textAnchor="middle" fontFamily={T.font} fontSize={10} fill={T.c.dim}>z={num(z1)}</text>)
    els.push(<text key="bb" x={nx} y={ny + nr + 14} textAnchor="middle" fontFamily={T.font} fontSize={9} fill={T.c.warn}>b={B1}</text>)
    // 激活
    els.push(<line key="l2" x1={nx + nr} y1={ny} x2={ax} y2={ny} stroke={T.c.dim} strokeWidth={1.4} />)
    els.push(<rect key="act" x={ax} y={ny - 16} width={56} height={32} rx={6} fill={T.c.bgElev} stroke={T.c.warn} />)
    els.push(<text key="actt" x={ax + 28} y={ny + 4} textAnchor="middle" fontFamily={T.font} fontSize={11} fill={T.c.warn}>ReLU</text>)
    // 输出
    els.push(<line key="l3" x1={ax + 56} y1={ny} x2={ox - 16} y2={ny} stroke={T.c.dim} strokeWidth={1.4} />)
    els.push(<circle key="out" cx={ox} cy={ny} r={18} fill={T.c.bgElev} stroke={T.c.accent2} strokeWidth={2} />)
    els.push(<text key="outt" x={ox} y={ny + 4} textAnchor="middle" fontFamily={T.font} fontSize={12} fill={T.c.accent2}>{num(a1)}</text>)
    els.push(<text key="outl" x={ox} y={ny - 24} textAnchor="middle" fontFamily={T.font} fontSize={10} fill={T.c.dim}>{t('输出 a', 'output a')}</text>)
    return <svg width={448} height={210} style={{ display: 'block' }}>{els}</svg>
  }

  // 单神经元 LaTeX
  const neuronTex = (() => {
    let s = `${num(W1[0])}\\cdot${tc(CA, par(x[0]))}`
    s += W1[1] < 0 ? ` - ${num(Math.abs(W1[1]))}\\cdot${tc(CA, par(x[1]))}` : ` + ${num(W1[1])}\\cdot${tc(CA, par(x[1]))}`
    s += W1[2] < 0 ? ` - ${num(Math.abs(W1[2]))}\\cdot${tc(CA, par(x[2]))}` : ` + ${num(W1[2])}\\cdot${tc(CA, par(x[2]))}`
    return `\\begin{aligned} z &= ${tc(CR, 'w')}\\cdot ${tc(CA, 'x')} + b = ${s} ${plus('', B1).trim()} \\\\ &= ${num(z1)},\\quad a = \\mathrm{ReLU}(z) = ${tc(CR, num(a1))} \\end{aligned}`
  })()

  // ───────── 图 2:一层神经元图 ↔ 矩阵乘交叉布局(融合在一张图) ─────────
  const renderLayer = (cell) => {
    const els = []
    // ---- 左:神经网络图(圆圈 + 连线) ----
    const ix = 46; const xs = [70, 126, 182]; const ir = 14
    const nx = 196; const nys = [70, 122, 174, 226]; const nr = 14
    x.forEach((_, i) => nys.forEach((nyj, j) => {
      const on = j === sel
      els.push(<line key={`e${i}-${j}`} x1={ix + ir} y1={xs[i]} x2={nx - nr} y2={nyj}
        stroke={on ? NEU[j] : T.c.border} strokeWidth={on ? 1.8 : 0.7} opacity={on ? 0.9 : 0.5} />)
    }))
    x.forEach((xi, i) => {
      els.push(<circle key={`in${i}`} cx={ix} cy={xs[i]} r={ir} fill={T.c.bgElev} stroke={CA} strokeWidth={1.4} />)
      els.push(<text key={`int${i}`} x={ix} y={xs[i] + 4} textAnchor="middle" fontFamily={T.font} fontSize={11} fill="#fff">{num(xi)}</text>)
      els.push(<text key={`inl${i}`} x={ix - ir - 5} y={xs[i] + 4} textAnchor="end" fontFamily={T.font} fontSize={10} fill={T.c.dim}>x{i}</text>)
    })
    nys.forEach((nyj, j) => {
      const on = j === sel
      els.push(<circle key={`ne${j}`} cx={nx} cy={nyj} r={nr} fill={T.c.bgElev} stroke={on ? NEU[j] : T.c.border} strokeWidth={on ? 2.4 : 1.2}
        style={{ cursor: 'pointer' }} onClick={() => setSel(j)} />)
      els.push(<text key={`net${j}`} x={nx} y={nyj + 4} textAnchor="middle" fontFamily={T.font} fontSize={10} fill={on ? NEU[j] : T.c.dim}>{num(aL[j])}</text>)
      els.push(<text key={`nel${j}`} x={nx + nr + 4} y={nyj + 4} fontFamily={T.font} fontSize={9} fill={on ? NEU[j] : T.c.dim}>a{j}</text>)
    })
    els.push(<text key="ncap" x={(ix + nx) / 2} y={30} textAnchor="middle" fontFamily={T.font} fontSize={11} fill={T.c.dim}>{t('神经网络图(点神经元)', 'neural net (click a neuron)')}</text>)

    // ---- 右:矩阵乘交叉布局 W·x + b → ReLU → a ----
    const mmX = 296; const mmY = 26
    const L = matmulLayout({ m: 4, k: 3, p: 1, cell, labelW: T.labelW, colLabelH: T.colLabelH, gap: T.gap })
    const baseY = mmY + L.headerH
    const midY = baseY + (4 * cell) / 2
    const xCol = x.map((v) => [v])
    const colData = [WxOnly, BL, zL, aL].map((arr) => arr.map((v) => [v]))
    const resRight = mmX + L.result.x + cell
    const plusX = resRight + 14; const bX = plusX + 16
    const eqX = bX + cell + 10; const zX = eqX + 16
    const aLX = zX + cell + 42
    const colLabel = (cx, txt, color) => (
      <text key={`cl${cx}`} x={cx + cell / 2} y={baseY - 6} textAnchor="middle" fontFamily={T.font} fontSize={T.fsLabel} fill={color}>{txt}</text>
    )
    // 中间「≡ 写成矩阵乘」连接
    const linkX = (nx + nr + (mmX + L.A.x)) / 2
    els.push(<text key="lk1" x={linkX} y={midY - 8} textAnchor="middle" fontFamily={T.font} fontSize={9} fill={T.c.dim}>{t('写成', 'as a')}</text>)
    els.push(<text key="lk2" x={linkX} y={midY + 6} textAnchor="middle" fontFamily={T.font} fontSize={16} fill={T.c.dim}>≡</text>)
    els.push(<text key="lk3" x={linkX} y={midY + 20} textAnchor="middle" fontFamily={T.font} fontSize={9} fill={T.c.dim}>{t('矩阵乘', 'matmul')}</text>)

    const svgW = aLX + cell + 80
    const svgH = Math.max(nys[3] + nr + 16, mmY + L.h + 8)
    return (
      <svg width={svgW} height={svgH} style={{ display: 'block', minWidth: svgW }}>
        {els}
        <MatMul x={mmX} y={mmY} A={WL} Bt={xCol} result={colData[0]} cell={cell}
          rowLabels={['a0', 'a1', 'a2', 'a3']} selRow={sel} showValues
          aLabel="W (4×3)" bLabel="x" resultLabel="W·x" />
        <text x={plusX} y={midY} textAnchor="middle" dominantBaseline="central" fontFamily={T.font} fontSize={15} fill={T.c.dim}>+</text>
        <Matrix x={bX} y={baseY} data={colData[1]} cell={cell} highlightRow={sel} showValues vmax={1} />
        {colLabel(bX, 'b', T.c.warn)}
        <text x={eqX} y={midY} textAnchor="middle" dominantBaseline="central" fontFamily={T.font} fontSize={15} fill={T.c.dim}>=</text>
        <Matrix x={zX} y={baseY} data={colData[2]} cell={cell} highlightRow={sel} showValues />
        {colLabel(zX, 'z', T.c.accent)}
        <Edge from={{ x: zX + cell, y: midY }} to={{ x: aLX, y: midY }} label={'ReLU'} />
        <Matrix x={aLX} y={baseY} data={colData[3]} cell={cell} highlightRow={sel} showValues />
        {colLabel(aLX, t('a 输出', 'a out'), T.c.accent2)}
      </svg>
    )
  }

  // 一层选中神经元 LaTeX
  const layerTex = (() => {
    const row = WL[sel]
    let s = `${num(row[0])}\\cdot${tc(CA, par(x[0]))}`
    s += row[1] < 0 ? ` - ${num(Math.abs(row[1]))}\\cdot${tc(CA, par(x[1]))}` : ` + ${num(row[1])}\\cdot${tc(CA, par(x[1]))}`
    s += row[2] < 0 ? ` - ${num(Math.abs(row[2]))}\\cdot${tc(CA, par(x[2]))}` : ` + ${num(row[2])}\\cdot${tc(CA, par(x[2]))}`
    const col = NEU[sel]
    return `\\begin{aligned} ${tc(col, `a_${sel}`)} &= \\mathrm{ReLU}\\big(\\underbrace{${tc(col, `W_{${sel},:}`)}\\cdot ${tc(CA, 'x')}}_{\\text{${t(`第${sel}行 · 输入`, `row ${sel} · input`)}}} + b_${sel}\\big) \\\\ &= \\mathrm{ReLU}(${s} ${plus('', BL[sel]).trim()}) = \\mathrm{ReLU}(${num(zL[sel])}) = ${tc(col, num(aL[sel]))} \\end{aligned}`
  })()

  const xSliders = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
      {x.map((xi, i) => (
        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--text-dim)', width: 30 }}>x{i}</span>
          <input type="range" min={-2} max={2} step={0.1} value={xi}
            onChange={(e) => setX(x.map((v, j) => (j === i ? +e.target.value : v)))} style={{ width: 120 }} />
          <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', width: 34 }}>{num(xi)}</b>
        </label>
      ))}
    </div>
  )
  const layerCtl = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--text-dim)' }}>{t('选神经元', 'pick neuron')}</span>
      {[0, 1, 2, 3].map((j) => (
        <button key={j} className="btn" onClick={() => setSel(j)}
          style={{ padding: '2px 10px', background: sel === j ? NEU[j] : 'var(--bg)',
            color: sel === j ? '#0f1115' : 'var(--text-dim)', fontWeight: sel === j ? 700 : 400 }}>a{j}</button>
      ))}
      <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{t('(输入 x 用上图滑块调)', '(adjust input x with the sliders above)')}</span>
    </div>
  )

  const panel = (texStr, note) => (
    <div style={{ marginTop: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 16, overflowX: 'auto' }}><Tex block>{texStr}</Tex></div>
      {note && <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 6 }}>{note}</div>}
    </div>
  )

  return (
    <ChapterLayout
      kicker={t('预备知识 · P3', 'Prerequisites · P3')}
      title={t('神经元与矩阵:前向传播就是矩阵乘法', 'Neurons & Matrices: The Forward Pass Is MatMul')}
      prev={prev}
      next={next}
      translated
    >
      <>
        {lang === 'en' ? (
          <>
            <p>
              You've probably seen the "<b>circles + wires</b>" picture of a neural network. This section lines it up with
              the <b>matrix operations</b> from the last one — you'll find that the so-called "forward pass", taken apart,
              is just <b>matrix multiplication + one activation function</b>, no other magic.
            </p>
            <h2>One neuron = dot product + bias + activation</h2>
            <p>
              A single neuron does three things: multiply each input <code>x_i</code> by its own weight <code>w_i</code> and sum them
              (that's the <b>dot product w·x</b>, from P2), add a bias <code>b</code>, and finally pass it through an <b>activation function</b> σ (here ReLU):
            </p>
            <div style={{ textAlign: 'center', margin: '8px 0' }}>
              <Tex block>{`a = \\sigma(\\,\\textcolor{#f0a35e}{w}\\cdot \\textcolor{#6ea8fe}{x} + b\\,)`}</Tex>
            </div>
            <p>Without an activation function, stacking any number of layers is still a single linear transform; σ provides <b>non-linearity</b>, so the network can learn complex functions.</p>
            <h2>One layer = one matrix × vector</h2>
            <p>
              A layer has many neurons, <b>each with its own set of weights</b>. Stack those weight sets <b>row by row</b> and you get a <b>weight matrix W</b>
              (rows = number of neurons, columns = input dimension). The whole layer's output is then computed in one shot:
            </p>
            <div style={{ textAlign: 'center', margin: '8px 0' }}>
              <Tex block>{`\\textcolor{#7ee787}{a} = \\sigma(\\,W\\textcolor{#6ea8fe}{x} + b\\,),\\qquad a_j = \\sigma(\\underbrace{W_{j,:}}_{\\text{${t('第 j 行', 'row j')}}}\\cdot \\textcolor{#6ea8fe}{x} + b_j)`}</Tex>
            </div>
            <p>
              In the figure below, on the <b>left</b> neural net, <b>the bundle of wires going into the j-th neuron</b> is exactly <b>row j of matrix W on the right</b>.
              The dense tangle of wires is really just the individual weight numbers in the matrix; a "<b>fully connected layer</b>" = one <code>Wx+b</code>.
            </p>
            <div className="note">
              Forward pass = repeat layer by layer: <Tex>{`x \\to \\sigma(W_1x+b_1) \\to \\sigma(W_2(\\cdot)+b_2) \\to \\cdots`}</Tex>.
              Toward LLMs: the <b>W_Q / W_K / W_V / W_O</b> projections and the <b>FFN</b> up/down projections in a Transformer
              are all this kind of "matmul + (optional) activation" fully connected layer — which is why matrix multiplication is the bulk of the model's compute.
              (Activations are also often sigmoid / tanh / GELU / Swish; the idea is the same.)
            </div>
          </>
        ) : (
          <>
            <p>
              你大概见过神经网络那张「<b>圆圈 + 连线</b>」的图。这一节把它和上一节的<b>矩阵运算</b>对上号——
              会发现所谓「前向传播」,拆开看就是<b>矩阵乘法 + 一个激活函数</b>,没有别的魔法。
            </p>
            <h2>一个神经元 = 点积 + 偏置 + 激活</h2>
            <p>
              单个神经元做三件事:把每个输入 <code>x_i</code> 乘上自己的权重 <code>w_i</code> 再求和(这就是
              <b>点积 w·x</b>,P2 学过)、加一个偏置 <code>b</code>、最后过一个<b>激活函数</b> σ(这里用 ReLU):
            </p>
            <div style={{ textAlign: 'center', margin: '8px 0' }}>
              <Tex block>{`a = \\sigma(\\,\\textcolor{#f0a35e}{w}\\cdot \\textcolor{#6ea8fe}{x} + b\\,)`}</Tex>
            </div>
            <p>没有激活函数,叠多少层都还是一次线性变换;σ 提供<b>非线性</b>,网络才能学复杂函数。</p>
            <h2>一层神经元 = 一次矩阵 × 向量</h2>
            <p>
              一层里有很多神经元,<b>每个神经元一组权重</b>。把它们的权重<b>按行摞起来</b>就是一个<b>权重矩阵 W</b>
              (行数 = 神经元个数,列数 = 输入维度)。于是整层的输出一次算完:
            </p>
            <div style={{ textAlign: 'center', margin: '8px 0' }}>
              <Tex block>{`\\textcolor{#7ee787}{a} = \\sigma(\\,W\\textcolor{#6ea8fe}{x} + b\\,),\\qquad a_j = \\sigma(\\underbrace{W_{j,:}}_{\\text{${t('第 j 行', 'row j')}}}\\cdot \\textcolor{#6ea8fe}{x} + b_j)`}</Tex>
            </div>
            <p>
              下图<b>左侧</b>神经网络里、<b>连到第 j 个神经元的那束连线</b>,就是<b>右侧矩阵 W 的第 j 行</b>。
              神经网络图密密麻麻的连线,本质就是矩阵里一个个权重数;「<b>全连接层</b>」= 一次 <code>Wx+b</code>。
            </p>
            <div className="note">
              前向传播 = 一层层重复:<Tex>{`x \\to \\sigma(W_1x+b_1) \\to \\sigma(W_2(\\cdot)+b_2) \\to \\cdots`}</Tex>。
              通往 LLM:Transformer 里的 <b>W_Q / W_K / W_V / W_O</b> 投影、<b>FFN</b> 升降维,
              全是这种「矩阵乘 + (可选)激活」的全连接层——所以矩阵乘法是整个模型的算力主体。
              (激活也常用 sigmoid / tanh / GELU / Swish,道理一样。)
            </div>
          </>
        )}
        <Refs ids={['1706.03762', '2002.05202', '1710.05941', '2412.19437']} />
      </>
      <>
        <h3>{t('图 1 · 一个神经元', 'Fig 1 · One neuron')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {t('3 个输入各乘权重 w_i 汇聚求和、加偏置 b、过 ReLU。拖滑块改输入,看 z 和输出 a 实时变。',
            'Three inputs each times a weight w_i, summed, plus bias b, through ReLU. Drag the sliders to change inputs and watch z and output a update live.')}
        </p>
        <FigureBoard renderSvg={renderNeuron} baseCell={22} fullCell={34} controls={xSliders} />
        {panel(neuronTex, t('加权和 w·x 就是点积;加 b 后过激活 = 这个神经元的输出。',
          'The weighted sum w·x is the dot product; add b then activate = this neuron\'s output.'))}

        <h3 style={{ marginTop: 18 }}>{t('图 2 · 一层神经元 ↔ 矩阵乘交叉布局', 'Fig 2 · One layer ↔ crossed matmul layout')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {lang === 'en' ? (
            <>
              The same layer, drawn two ways <b>side by side</b>: the left is a neural net (4 neurons, 3 inputs, fully connected),
              the right is the <b>"crossed matmul layout"</b> (W standing on the left, input x lying on top, result at the bottom-right), then +b through ReLU gives output a.
              Click a neuron (or a button below): its <b>wires</b> are the corresponding <b>row</b> of W, highlighted on both sides. This layout recurs later (e.g. self-attention).
            </>
          ) : (
            <>
              同一层、左右两种画法<b>对照看</b>:左是神经网络图(4 神经元、3 输入全连接),
              右是<b>「矩阵乘交叉布局」</b>(W 立左、输入 x 躺上、结果在右下),再 +b 过 ReLU 得输出 a。
              点神经元(或下方按钮):它的<b>连线</b>就是 W 的对应<b>行</b>,两边同步高亮。这种摆法后面(如自注意力)会反复用到。
            </>
          )}
        </p>
        <FigureBoard renderSvg={renderLayer} baseCell={24} fullCell={36} controls={layerCtl} />
        {panel(layerTex, t('左图的一束连线 = 右图 W 的一行;选中神经元输出 = (W 那一行 · x + 偏置)过激活,4 个一起 = 一次 Wx+b。',
          'A bundle of wires on the left = one row of W on the right; the selected neuron\'s output = (that row of W · x + bias) through activation; all four together = one Wx+b.'))}
      </>
    </ChapterLayout>
  )
}
