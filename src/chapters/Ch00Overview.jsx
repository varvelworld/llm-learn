import { useState, useMemo } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import { T } from '../components/svg/theme.js'
import { colorFor } from '../lib/figure.js'
import { seededMatrix } from '../lib/synth.js'
import { matmul, addVec } from '../lib/tensor.js'
import { attention } from '../lib/attention.js'
import { softmax } from '../lib/softmax.js'
import { rmsNorm } from '../lib/norm.js'
import { swiglu } from '../lib/ffn.js'
import { applyRope } from '../lib/rope.js'

const SEQ = ['the', 'cat', 'sat']
const VOCAB = 'the cat sat on mat dog ran .'.split(' ')
const D = 6
const DFF = 8
const n = SEQ.length

const STAGES = [
  { label: '① 分词', desc: '文本 → token(子词)' },
  { label: '② 嵌入', desc: '每个 token 查表成向量 —— 行=token,列=维度(红正/蓝负)' },
  { label: '③ 位置 RoPE', desc: '按位置旋转向量,把「先后顺序」注入进去' },
  { label: '④ 自注意力', desc: 'token 互相看:q·kᵀ→softmax 得权重,再加权汇总(行 i 只能看 ≤ i)' },
  { label: '⑤ 残差+FFN+Norm ×N', desc: '逐 token 加工,加回残差流,这样的层堆 N 遍' },
  { label: '⑥ 输出+采样', desc: '末位向量 ×W_U → logits → softmax → 下一个词' },
]

export default function Ch00Overview({ prev, next }) {
  const [step, setStep] = useState(1)

  // ── 真实(toy)前向计算:同种子可复现,预测词是算出来的 ──
  const fwd = useMemo(() => {
    const X = seededMatrix(n, D, 3)
    const WQ = seededMatrix(D, D, 11)
    const WK = seededMatrix(D, D, 12)
    const WV = seededMatrix(D, D, 13)
    const Wg = seededMatrix(D, DFF, 21)
    const Wu = seededMatrix(D, DFF, 22)
    const Wd = seededMatrix(DFF, D, 23)
    const WU = seededMatrix(D, VOCAB.length, 31)

    const Xr = X.map((r, i) => applyRope(r, i))
    const xn1 = Xr.map((r) => rmsNorm(r))
    const att = attention(matmul(xn1, WQ), matmul(xn1, WK), matmul(xn1, WV), true)
    const X1 = Xr.map((r, i) => addVec(r, att.output[i]))
    const xn2 = X1.map((r) => rmsNorm(r))
    const X2 = X1.map((r, i) => addVec(r, swiglu(xn2[i], Wg, Wu, Wd).out))
    const hLast = rmsNorm(X2[n - 1])
    const logits = matmul([hLast], WU)[0]
    const probs = softmax(logits)
    const pred = probs.indexOf(Math.max(...probs))
    return { X, Xr, weights: att.weights, X2, probs, pred }
  }, [])

  const amax = (M) => Math.max(1e-6, ...M.flat().map(Math.abs))

  const renderPipe = (cs) => {
    const fg = []
    const bg = []
    const matTop = 50
    const rowH = cs
    const cy = matTop + (n * rowH) / 2
    const gap = Math.max(36, cs * 1.7)
    let x = 14
    const pos = {}

    const head = (sx, w, idx, title) => {
      const active = step === idx
      if (active) bg.push(<rect key={`bg${idx}`} x={sx - 7} y={matTop - 30} width={w + 14}
        height={n * rowH + 40} rx={9} fill="rgba(110,168,254,0.09)" stroke={T.c.accent} strokeWidth={1.8} />)
      fg.push(<text key={`ht${idx}`} x={sx + w / 2} y={matTop - 14} textAnchor="middle" fontFamily={T.font}
        fontSize={10.5} fontWeight={active ? 700 : 400} fill={active ? T.c.accent : T.c.dim}>{title}</text>)
    }
    const arrow = (note) => {
      const x1 = x + 3
      const x2 = x + gap - 4
      fg.push(<line key={`al${x}`} x1={x1} y1={cy} x2={x2 - 5} y2={cy} stroke={T.c.dim} strokeWidth={1.6} />)
      fg.push(<path key={`ap${x}`} d={`M${x2 - 6},${cy - 4} L${x2},${cy} L${x2 - 6},${cy + 4} Z`} fill={T.c.dim} />)
      if (note) fg.push(<text key={`an${x}`} x={(x1 + x2) / 2} y={cy - 7} textAnchor="middle" fontFamily={T.font}
        fontSize={8.5} fill={T.c.dim}>{note}</text>)
      x = x + gap
    }
    const heat = (sx, M, vmax) => {
      M.forEach((row, i) => row.forEach((v, j) =>
        fg.push(<rect key={`m${sx}-${i}-${j}`} x={sx + j * cs} y={matTop + i * rowH} width={cs} height={rowH}
          fill={colorFor(v, vmax)} stroke={T.c.border} strokeWidth={0.5} />)))
      return M[0].length * cs
    }

    // ① 分词
    let sx = x
    SEQ.forEach((t, i) => {
      fg.push(<rect key={`tk${i}`} x={sx} y={matTop + i * rowH + 1} width={46} height={rowH - 3} rx={5}
        fill={T.c.bgElev} stroke={T.c.border} />)
      fg.push(<text key={`tt${i}`} x={sx + 23} y={matTop + i * rowH + rowH * 0.62} textAnchor="middle"
        fontFamily={T.font} fontSize={10} fill={T.c.text}>{t}</text>)
    })
    head(sx, 46, 0, '① 分词'); x += 46; arrow('查表')

    // ② 嵌入
    sx = x; pos.emb = { x: sx, w: D * cs }
    heat(sx, fwd.X, amax(fwd.X))
    head(sx, D * cs, 1, '② 嵌入 (n×d)'); x += D * cs; arrow('+位置')

    // ③ RoPE
    sx = x; pos.rope = { x: sx, w: D * cs }
    heat(sx, fwd.Xr, amax(fwd.Xr))
    head(sx, D * cs, 2, '③ +RoPE ⟳'); x += D * cs; arrow('互相看')

    // ④ 自注意力(n×n 权重)
    sx = x
    fwd.weights.forEach((row, i) => row.forEach((v, j) => {
      const masked = j > i
      fg.push(<rect key={`aw${i}-${j}`} x={sx + j * cs} y={matTop + i * rowH} width={cs} height={rowH}
        fill={masked ? 'transparent' : colorFor(v, 1)} stroke={T.c.border} strokeWidth={0.5} />)
      if (!masked && cs >= 22) fg.push(<text key={`awt${i}-${j}`} x={sx + j * cs + cs / 2} y={matTop + i * rowH + rowH * 0.64}
        textAnchor="middle" fontFamily={T.font} fontSize={8} fill="#fff">{v.toFixed(1)}</text>)
    }))
    fg.push(<text key="awc" x={sx + (n * cs) / 2} y={matTop + n * rowH + 12} textAnchor="middle"
      fontFamily={T.font} fontSize={8.5} fill={T.c.dim}>权重 q·kᵀ→softmax</text>)
    head(sx, n * cs, 3, '④ 自注意力'); x += n * cs; arrow('加工')

    // ⑤ 残差+FFN+Norm(× N 层)
    sx = x; pos.block = { x: sx, w: D * cs }
    heat(sx, fwd.X2, amax(fwd.X2))
    head(sx, D * cs, 4, '⑤ Block ×N'); x += D * cs

    // ×N 回环弧:从 Block 顶部绕回 RoPE 顶部
    const ax1 = pos.block.x + pos.block.w / 2
    const ax0 = pos.rope.x + pos.rope.w / 2
    const ayTop = matTop - 38
    const loopColor = step === 4 ? T.c.accent : T.c.dim
    fg.push(<path key="loop" d={`M${ax1},${matTop - 30} C${ax1},${ayTop} ${ax0},${ayTop} ${ax0},${matTop - 30}`}
      fill="none" stroke={loopColor} strokeWidth={1.6} strokeDasharray="4 3" />)
    fg.push(<path key="loopa" d={`M${ax0 - 4},${matTop - 34} L${ax0},${matTop - 28} L${ax0 + 4},${matTop - 34} Z`} fill={loopColor} />)
    fg.push(<text key="loopt" x={(ax0 + ax1) / 2} y={ayTop - 3} textAnchor="middle" fontFamily={T.font}
      fontSize={9.5} fontWeight={700} fill={loopColor}>× N 层</text>)
    arrow('末位向量')

    // ⑥ 输出 + 采样
    sx = x
    const barTop = matTop
    const barH = n * rowH
    const bw = Math.max(11, cs * 0.78)
    const bgap = 4
    const maxP = Math.max(...fwd.probs)
    fwd.probs.forEach((p, j) => {
      const h = Math.max(1, (p / maxP) * barH)
      const bx = sx + j * (bw + bgap)
      const isMax = j === fwd.pred
      fg.push(<rect key={`pb${j}`} x={bx} y={barTop + barH - h} width={bw} height={h} rx={2}
        fill={isMax ? T.c.accent2 : 'rgba(110,168,254,0.45)'} stroke={isMax ? T.c.accent2 : T.c.border} strokeWidth={0.6} />)
      fg.push(<text key={`pl${j}`} x={bx + bw / 2} y={barTop + barH + 11} textAnchor="middle" fontFamily={T.font}
        fontSize={8} fill={isMax ? T.c.accent2 : T.c.dim}>{VOCAB[j]}</text>)
    })
    const outW = VOCAB.length * (bw + bgap)
    fg.push(<text key="pred" x={sx + outW / 2} y={barTop + barH + 24} textAnchor="middle" fontFamily={T.font}
      fontSize={11.5} fontWeight={700} fill={T.c.accent2}>下一个词 → "{VOCAB[fwd.pred]}"</text>)
    head(sx, outW, 5, '⑥ logits→采样'); x += outW

    // 活动阶段说明(底部一行,全屏也可见)
    const W = x + 16
    fg.push(<text key="desc" x={14} y={matTop + n * rowH + 40} fontFamily={T.font} fontSize={10.5} fill={T.c.accent}>
      {STAGES[step].label}:{STAGES[step].desc}</text>)

    const H = matTop + n * rowH + 54
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{[...bg, ...fg]}</svg>
  }

  const controls = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn" onClick={() => setStep((s) => Math.max(0, s - 1))} style={{ padding: '2px 10px' }}>◀</button>
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', minWidth: 150, textAlign: 'center' }}>{STAGES[step].label}</b>
        <button className="btn" onClick={() => setStep((s) => Math.min(STAGES.length - 1, s + 1))} style={{ padding: '2px 10px' }}>▶</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {STAGES.map((s, i) => (
          <button key={i} className="btn" onClick={() => setStep(i)}
            style={{ padding: '2px 8px', fontSize: 11, background: step === i ? 'var(--accent)' : 'var(--bg)',
              color: step === i ? '#0f1115' : 'var(--text-dim)', fontWeight: step === i ? 700 : 400 }}>{s.label}</button>
        ))}
      </div>
    </div>
  )

  return (
    <ChapterLayout kicker="第 0 章 · 总览" title="LLM 是怎么工作的?" prev={prev} next={next}>
      <>
        <p>
          一个大语言模型(LLM)做的事情其实只有一句话:
          <b> 给定前面的文字,预测下一个词</b>。把这一步不断重复,就能写出整段话。
        </p>
        <p>难点在于"预测下一个词"这一步内部发生了什么。它是一条流水线——右边这张图就是它<b>真实的</b>计算过程(toy 尺寸:3 个 token、6 维向量),点阶段按钮逐步看:</p>
        <ol>
          <li>把文字切成 <b>token</b>(子词)</li>
          <li>每个 token 查表变成一串数字(<b>向量 / 嵌入</b>)</li>
          <li>用 <b>RoPE</b> 注入位置,再叠很多层 <b>Transformer</b>,核心是 <b>自注意力</b>——让每个词参考上下文</li>
          <li>最后用末位向量算出每个候选词的分数(logits),采样得到下一个词</li>
        </ol>
        <p>
          右图的<b>预测词是真算出来的</b>(同种子可复现):末位 token「sat」经过整条流水线后,
          模型给词表里每个词打分,绿色那根就是 argmax 选中的下一个词。
          后面每一章就是把这里的某一格放大来讲。
        </p>
        <div className="note">
          看图秘诀:<b>行 = token、列 = 维度</b>,红正蓝负、越深越大。
          注意力那块是 <b>n×n</b>(谁看谁),上三角空着是<b>因果掩码</b>(只能看自己和前面)。
          虚线回环 <b>× N 层</b> 表示同样的 Block 要重复很多遍。
        </div>

        <h2>DeepSeek 版本演进(谁加了什么)</h2>
        <p>第二部分讲的几个创新分属不同版本——它们是一层层叠上去的,这样看更清楚:</p>
        <table className="ver-table">
          <thead>
            <tr><th>版本</th><th>关键创新</th></tr>
          </thead>
          <tbody>
            <tr><td>V2(2024 中)</td><td><b>MLA</b>(潜变量注意力)+ <b>DeepSeekMoE</b>(细粒度+共享专家)→ 又大又省</td></tr>
            <tr><td>V3(2024 底)</td><td>沿用 MLA/MoE,+ 无辅助损失负载均衡、+ <b>MTP</b>(多 token 预测)</td></tr>
            <tr><td>R1(2025)</td><td>基于 V3 的推理模型(主要是训练方法,架构沿用)</td></tr>
            <tr><td>V3.2-Exp(2025 底)</td><td>+ <b>DSA 稀疏注意力</b>:闪电索引器先选 top-k 相关块,再只对这些算注意力</td></tr>
            <tr><td>V4(2026.4)*</td><td><b>混合稀疏注意力 CSA+HCA</b>(细粒度局部 + 廉价全局两级压缩)、<b>mHC 流形超连接</b>(替代残差)、<b>Engram 记忆</b>;1.6T 参数 / 1M 上下文</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          * V4 2026 年 4 月发布,部分架构细节来自公开/第三方分析。脉络:<b>MLA·MoE 是 V2 地基,
          MTP 是 V3,稀疏注意力 V3.2 起、到 V4 集大成</b>——所以第二部分按版本分组,V4 单独铺开讲。
        </p>
      </>
      <>
        <h3>前向流水线(真实 toy 计算)</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          一句「the cat sat」走完整条流水线,最后预测下一个词。用 ◀ ▶ 或下方阶段按钮高亮每一步。
        </p>
        <FigureBoard renderSvg={renderPipe} baseCell={22} fullCell={34} controls={controls} />
      </>
    </ChapterLayout>
  )
}
