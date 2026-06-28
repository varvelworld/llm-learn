import { useState, useMemo } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Tex from '../components/Tex.jsx'
import Refs from '../components/Refs.jsx'
import { T } from '../components/svg/theme.js'
import { seededMatrix } from '../lib/synth.js'
import { expectedAccept, speedup, parallelDraft } from '../lib/specdec.js'

// 两个互斥的「句意模式」(逐位都不同,混着取就串味)
const MODE_A = ['of', 'course', 'I', 'can', 'solve', 'this', 'for', 'you']
const MODE_B = ['no', 'problem', 'we', 'will', 'handle', 'that', 'right', 'now']
const C_PAR = 0.5 // 并行 drafter:块内独立 → 多峰碰撞,连贯概率 ~0.5
const C_SAR = 0.85 // DSpark 半自回归:建模块内依赖 → 连贯概率更高
const SEED = 8 // 让并行抽样在第 2 个 token 就串味:'of'(A) + 'problem'(B) = "of problem" ✗

export default function Ch19DSpark({ prev, next }) {
  const [L, setL] = useState(8) // drafter 一次草几个 token(块长)

  const d = useMemo(() => {
    const row = seededMatrix(1, 8, SEED)[0]
    const par = parallelDraft(row, L)
    return {
      par,
      ePar: expectedAccept(C_PAR, L),
      eSar: expectedAccept(C_SAR, L),
      spPar: speedup(C_PAR, L),
      spSar: speedup(C_SAR, L),
    }
  }, [L])

  const render = (cell) => {
    const cs = cell
    const tw = Math.max(cs * 2.0, 58) // token 单元宽
    const lx = 66 // 左标签宽
    const top = 22
    const rowH = cs * 1.06
    const els = []
    const tokCell = (key, x, y, txt, fill, stroke, txtColor, mark) => {
      els.push(<rect key={`r${key}`} x={x} y={y} width={tw - 4} height={rowH - 6} rx={4}
        fill={fill} stroke={stroke} strokeWidth={1} />)
      els.push(<text key={`t${key}`} x={x + (tw - 4) / 2} y={y + (rowH - 6) / 2 + 3.5} textAnchor="middle"
        fontFamily={T.font} fontSize={10.5} fill={txtColor}>{txt}</text>)
      if (mark) els.push(<text key={`m${key}`} x={x + tw - 10} y={y + 11} textAnchor="middle"
        fontFamily={T.font} fontSize={10} fill={T.c.hot}>{mark}</text>)
    }
    // 参考行:两个句意模式
    const refRow = (ri, label, toks) => {
      const y = top + ri * rowH
      els.push(<text key={`l${ri}`} x={lx - 8} y={y + rowH / 2 + 2} textAnchor="end" fontFamily={T.font}
        fontSize={10} fill={T.c.dim}>{label}</text>)
      for (let i = 0; i < L; i++)
        tokCell(`${ri}-${i}`, lx + i * tw, y, toks[i], T.c.bgElev, T.c.border, T.c.dim)
    }
    refRow(0, '句意 A', MODE_A)
    refRow(1, '句意 B', MODE_B)
    // 并行 drafter 抽样行
    {
      const ri = 2
      const y = top + ri * rowH
      els.push(<text key={`l${ri}`} x={lx - 8} y={y + rowH / 2 + 2} textAnchor="end" fontFamily={T.font}
        fontSize={10} fill={T.c.accent}>并行草</text>)
      for (let i = 0; i < L; i++) {
        const tok = d.par.picks[i] ? MODE_B[i] : MODE_A[i]
        const accepted = i < d.par.acceptedLen
        const collide = i === d.par.firstCollision
        const fill = accepted ? 'rgba(126,231,135,0.22)' : collide ? 'rgba(240,107,107,0.22)' : T.c.bgElev
        const stroke = accepted ? T.c.accent2 : collide ? T.c.hot : T.c.border
        const tc = accepted ? T.c.accent2 : collide ? T.c.hot : T.c.dim
        tokCell(`${ri}-${i}`, lx + i * tw, y, tok, fill, stroke, tc, collide ? '✗' : null)
      }
    }
    // DSpark 半自回归行(块内连贯,全部接受)
    {
      const ri = 3
      const y = top + ri * rowH
      const mode = d.par.mode0
      els.push(<text key={`l${ri}`} x={lx - 8} y={y + rowH / 2 + 2} textAnchor="end" fontFamily={T.font}
        fontSize={10} fill={T.c.accent2}>DSpark</text>)
      for (let i = 0; i < L; i++) {
        const tok = mode ? MODE_B[i] : MODE_A[i]
        tokCell(`${ri}-${i}`, lx + i * tw, y, tok, 'rgba(126,231,135,0.22)', T.c.accent2, T.c.accent2)
      }
    }
    // 说明
    const yc = top + 4 * rowH + 6
    els.push(<text key="cap1" x={lx} y={yc} fontFamily={T.font} fontSize={10} fill={T.c.dim}>
      并行各位置<tspan fill={T.c.accent}>独立</tspan>采样 → 第 {d.par.firstCollision + 1} 个 token <tspan fill={T.c.hot}>串到另一句意(✗)</tspan>,其后整段被拒(灰)。</text>)
    els.push(<text key="cap2" x={lx} y={yc + 15} fontFamily={T.font} fontSize={10} fill={T.c.dim}>
      DSpark <tspan fill={T.c.accent2}>半自回归</tspan>:每个 token 以前一个为条件 → 块内连贯,几乎全被接受。</text>)

    // 期望接受长度 / 加速比 条形
    const by = yc + 36
    const barL = lx + 92
    const barMax = Math.max(120, cs * 5)
    const eMax = Math.max(d.eSar, 1)
    const drawBar = (bi, label, e, sp, col) => {
      const y = by + bi * 26
      els.push(<text key={`bl${bi}`} x={lx} y={y + 12} fontFamily={T.font} fontSize={10.5} fill={col}>{label}</text>)
      els.push(<rect key={`bt${bi}`} x={barL} y={y} width={barMax} height={15} rx={3} fill={T.c.bgElev} stroke={T.c.border} strokeWidth={0.5} />)
      els.push(<rect key={`bf${bi}`} x={barL} y={y} width={Math.max(2, (e / eMax) * barMax)} height={15} rx={3} fill={col} opacity={0.8} />)
      els.push(<text key={`bv${bi}`} x={barL + barMax + 8} y={y + 12} fontFamily={T.font} fontSize={10} fill={T.c.text}>
        E≈{e.toFixed(2)} → 加速 {sp.toFixed(1)}×</text>)
    }
    els.push(<text key="bt" x={lx} y={by - 6} fontFamily={T.font} fontSize={9.5} fill={T.c.dim}>每次大模型验证 · 期望接受 token 数 / 加速比</text>)
    drawBar(0, '并行草', d.ePar, d.spPar, T.c.accent)
    drawBar(1, 'DSpark', d.eSar, d.spSar, T.c.accent2)

    const W = Math.max(lx + L * tw + 10, barL + barMax + 120)
    const H = by + 2 * 26 + 8
    return <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  const controls = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)', width: 110 }}>块长 L(草几个)</span>
      <input type="range" min={2} max={8} step={1} value={L} onChange={(e) => setL(+e.target.value)} style={{ width: 140 }} />
      <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{L}</b>
    </label>
  )

  const losslessTex = `\\text{接受概率}=\\min\\!\\Big(1,\\;\\frac{\\textcolor{#7ee787}{p_{\\text{大}}(x)}}{\\textcolor{#6ea8fe}{q_{\\text{草}}(x)}}\\Big),
\\qquad \\text{被拒则从 }(p_{\\text{大}}-q_{\\text{草}})_{+}\\text{ 补采}\\;\\Rightarrow\\;\\text{输出分布}\\equiv p_{\\text{大}}\\ (\\textbf{无损})`

  const collideTex = `\\underbrace{P(\\text{接受前缀}\\ge k)=c^{\\,k}}_{\\text{连贯概率 }c}
\\;\\Rightarrow\\;
E=\\sum_{k=1}^{L}c^{\\,k}
\\quad\\begin{cases}
\\textcolor{#6ea8fe}{\\text{并行 }c\\approx0.5}\\;\\Rightarrow\\;E\\to 1 & (\\text{多峰碰撞})\\\\[2pt]
\\textcolor{#7ee787}{\\text{DSpark }c\\uparrow}\\;\\Rightarrow\\;E\\;\\text{随 }L\\text{ 长} & (\\text{块内连贯})
\\end{cases}`

  return (
    <ChapterLayout kicker="第二部分 · DeepSeek-V4 · Ch19" title="DSpark:让投机解码的草稿更靠谱" prev={prev} next={next}>
      <>
        <p>
          大模型生成慢在哪:<b>一次只蹦一个字</b>,每个字都要把整个大模型从头算一遍。
          <b>投机解码(speculative decoding)</b>用一个巧办法提速,打个比方最好懂——
        </p>
        <p>
          一个<b>老板</b>(大模型:聪明但慢)配一个<b>实习生</b>(drafter:水平一般但快)。
          实习生先<b>飞快草一串词</b>,老板<b>一眼把整串扫完</b>:开头对的<b>照单全收</b>,
          碰到<b>第一个错的</b>就从那里接手、自己写对。这样老板每"读"一次就能敲定<b>一整串</b>字,
          而不是一个字——于是快了好几倍。
        </p>
        <p>
          最妙的是<b>无损</b>:每个字都经老板把关,最终输出<b>和大模型自己一个一个写出来的一字不差</b>,
          只是更快——近乎「免费的午餐」。
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0' }}>
          想要严谨版:草稿词 <Tex>{'x'}</Tex> 以「大模型本来也想说它」的程度被接受,被拒就按两者差值补一个字。
          可证明最终分布<b>严格等于</b>大模型逐字解码 —— 公式如下。
        </p>
        <div style={{ fontSize: 13.5, overflowX: 'auto', margin: '6px 0' }}><Tex block>{losslessTex}</Tex></div>
        <h2>实习生怎么草?两种办法都不完美</h2>
        <ul>
          <li><b>① 一个一个草(自回归)</b>:写每个词时都看着自己<b>刚写的上一个词</b>,质量高——
            但这样<b>和老板一样一个个来,没省到时间</b>。</li>
          <li><b>② 一口气草一整块(并行)</b>:所有位置<b>同时</b>各写各的,飞快;
            麻烦在于它们<b>互相不看</b>。</li>
        </ul>
        <p>
          第②种的坑在于:一句话常有<b>好几种都对</b>的说法。比如回应既可以是
          「<b>of course</b>」、也可以是「<b>no problem</b>」。可并行时各写各的——
          位置 1 自己挑了 <b>of</b>、位置 2 自己挑了 <b>problem</b>,<b>单看都合理,拼一起却成了
          <span style={{ color: 'var(--warn)' }}> “of problem”</span></b>,废了。这叫<b>多峰碰撞</b>(multi-modal collision)。
          而且<b>越往后越容易串味</b>:一旦某个词串到另一种说法,它<b>后面的全被老板拒掉、白草</b>。
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0' }}>
          量化一下:并行每多草一个词,「整串还连贯」的概率就<b>再乘一次</b> <Tex>{'c\\approx0.5'}</Tex>,
          所以期望接受长度很快<b>卡在 ~1</b>(右图);DSpark 把 <Tex>{'c'}</Tex> 抬高,长度就能随块长一直涨。
        </p>
        <div style={{ fontSize: 13.5, overflowX: 'auto', margin: '6px 0' }}><Tex block>{collideTex}</Tex></div>
        <h2>DSpark:让实习生「边草边瞄一眼」</h2>
        <p>
          DeepSeek-V4 的 <b>DSpark</b> 把两种办法的优点合起来——叫 <b>半自回归(semi-autoregressive)</b>:
          还是<b>一次草一整块</b>(保住快),但让实习生写每个词时<b>瞄一眼自己刚写的上一个词</b>。
          这样块内不再各说各话、自然<b>连贯</b>起来,<b>后段不再轻易串味</b>,接受长度随块长一直涨。
        </p>
        <p>
          它还配了个<b>置信度头(confidence head)</b>:给每个草稿词打一个「我多有把握这词能过审」的分,
          把<b>铁定会被拒的尾巴词提前撤掉</b>,不白占老板宝贵的验证名额(系统繁忙时尤其划算)。
        </p>
        <div className="note">
          实测:接受长度比 <b>Eagle-3 高 26~31%</b>、比 <b>DFlash 高 16~18%</b>;每用户生成速度
          <b>Flash +60~85% / Pro +57~78%</b>(对比 MTP-1 基线)、延迟下降。
          DeepSeek 同时开源了训练/评测草稿模型的代码库 <b>DeepSpec</b>(内含 DSpark / DFlash / Eagle3)。
          DSpark 全名 <b>Confidence-Scheduled Speculative Decoding with Semi-Autoregressive Generation</b>,
          是<b>纯推理侧</b>的工程升级,<b>不改模型架构、不改输出分布</b>。
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          <b>本图的诚实简化</b>:用「两个互斥句意」的 toy 模型演示多峰碰撞,把「连贯概率」抽象成单个 <Tex>{'c'}</Tex>
          (并行≈0.5、半自回归更高);真实 drafter 是神经网络、接受由拒绝采样逐 token 判定。结论方向一致:
          <b>并行接受长度饱和在 ~1,半自回归随块长继续变长</b>。
        </div>
        <Refs
          ids={['2211.17192', '2302.01318', '1711.02281', '2401.10774', '2401.15077', '2606.19348']}
          extra={[
            { label: 'DeepSeek 2026 · DSpark 论文(Confidence-Scheduled Speculative Decoding with Semi-Autoregressive Generation)', url: 'https://github.com/deepseek-ai/DeepSpec/blob/main/DSpark_paper.pdf' },
            { label: 'deepseek-ai/DeepSpec · 开源代码库(DSpark / DFlash / Eagle3)', url: 'https://github.com/deepseek-ai/DeepSpec' },
          ]}
        />
      </>
      <>
        <h3>同一块草稿:并行会「串味」截断,DSpark 半自回归保持连贯</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          上两行是两种合理说法(句意 A / B)。「并行草」每位独立采样,采到第 {d.par.firstCollision + 1} 个就串到另一句意
          (<b style={{ color: 'var(--hot,#ff6b6b)' }}>✗</b>),其后<b>全被拒</b>;「DSpark」块内有依赖、保持连贯。
          拖块长 L 看下面的<b>期望接受长度 / 加速比</b>:并行很快饱和、DSpark 随 L 继续涨。
        </p>
        <FigureBoard renderSvg={render} baseCell={26} fullCell={34} controls={controls} />
        <div style={{ marginTop: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
            当前 L={L}:并行 drafter 期望接受 <b style={{ color: 'var(--accent)' }}>{d.ePar.toFixed(2)}</b> 个/次
            (加速 <b>{d.spPar.toFixed(1)}×</b>,已饱和);
            DSpark 半自回归 <b style={{ color: 'var(--accent2)' }}>{d.eSar.toFixed(2)}</b> 个/次
            (加速 <b style={{ color: 'var(--accent2)' }}>{d.spSar.toFixed(1)}×</b>,随块长继续增长)。
          </div>
        </div>
      </>
    </ChapterLayout>
  )
}
