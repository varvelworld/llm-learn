import { useState } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import FigureBoard from '../components/svg/FigureBoard.jsx'
import Refs from '../components/Refs.jsx'
import { T } from '../components/svg/theme.js'
import { useLang, useT } from '../i18n/lang.jsx'

// 列 = 模型;行 = 架构组件。tag: 'glm'=GLM 独特(蓝)、'conv'=GLM-5 与 DeepSeek 趋同(绿)、'na'=无/稠密(灰)
const COLS = ['GLM-4.5', 'GLM-5 / 5.2', 'DeepSeek-V3', 'DeepSeek-V4']
// SUMMARY:每列一段摘要,双语
const SUMMARY = [
  {
    zh: 'GLM 自成一派:GQA + 部分 RoPE + QK-Norm + sigmoid 门控 MoE(355B/32B,2025.7)',
    en: 'GLM goes its own way: GQA + partial RoPE + QK-Norm + sigmoid-gated MoE (355B/32B, Jul 2025)',
  },
  {
    zh: '转向并趋同 DeepSeek:MLA + DSA;独门是 IndexShare → 1M(744B/40B,2026)',
    en: 'Turns toward and converges with DeepSeek: MLA + DSA; its own trick is IndexShare → 1M (744B/40B, 2026)',
  },
  {
    zh: 'MLA + 细粒度/共享 MoE + 无辅助损失均衡 + MTP(671B/37B,2024 底)',
    en: 'MLA + fine-grained/shared MoE + auxiliary-loss-free balancing + MTP (671B/37B, late 2024)',
  },
  {
    zh: '在 V3 上加 CSA + HCA 压缩稀疏注意力 + mHC(1.6T 总 / 1M,2026)',
    en: 'Adds CSA + HCA compressed sparse attention + mHC on top of V3 (1.6T total / 1M, 2026)',
  },
]
// ROWS:行标签(k / kEn)+ 每列取值(v / vEn,含 \n 换行);tag 决定配色
const ROWS = [
  { k: '注意力', kEn: 'Attention',
    v: ['GQA + 部分RoPE', 'MLA', 'MLA', 'MLA + CSA/HCA'],
    vEn: ['GQA + partial RoPE', 'MLA', 'MLA', 'MLA + CSA/HCA'], tag: ['glm', 'conv', 'na', 'na'] },
  { k: '位置编码', kEn: 'Position enc.',
    v: ['部分 RoPE', 'RoPE(MLA 解耦)', 'RoPE(MLA 解耦)', 'RoPE(MLA 解耦)'],
    vEn: ['partial RoPE', 'RoPE (MLA\ndecoupled)', 'RoPE (MLA\ndecoupled)', 'RoPE (MLA\ndecoupled)'], tag: ['glm', 'conv', 'na', 'na'] },
  { k: '注意力归一化', kEn: 'Attn norm',
    v: ['QK-Norm', '— / 未公开', '—', '—'],
    vEn: ['QK-Norm', '— / undisclosed', '—', '—'], tag: ['glm', 'na', 'na', 'na'] },
  { k: 'MoE', kEn: 'MoE',
    v: ['sigmoid 门控\n细粒度+共享', 'MoE\n256 专家/80 层', '细粒度+共享\n无损均衡', '同 V3'],
    vEn: ['sigmoid gating\nfine-grained+shared', 'MoE\n256 experts/80 layers', 'fine-grained+shared\naux-loss-free', 'same as V3'], tag: ['glm', 'conv', 'na', 'na'] },
  { k: '稀疏注意力', kEn: 'Sparse attn',
    v: ['—(稠密)', 'DSA', '—(稠密)', 'CSA + HCA'],
    vEn: ['— (dense)', 'DSA', '— (dense)', 'CSA + HCA'], tag: ['na', 'conv', 'na', 'na'] },
  { k: '多 token 预测', kEn: 'Multi-token pred.',
    v: ['MTP', 'MTP', 'MTP(V3 引入)', 'MTP'],
    vEn: ['MTP', 'MTP', 'MTP (from V3)', 'MTP'], tag: ['conv', 'conv', 'na', 'na'] },
  { k: '长上下文关键', kEn: 'Long-context',
    v: ['128K', 'IndexShare → 1M', '128K', 'CSA/HCA → 1M'],
    vEn: ['128K', 'IndexShare → 1M', '128K', 'CSA/HCA → 1M'], tag: ['na', 'glm', 'na', 'na'] },
  { k: '总 / 激活参数', kEn: 'Total / active',
    v: ['355B / 32B', '744B / 40B', '671B / 37B', '1.6T(总)'],
    vEn: ['355B / 32B', '744B / 40B', '671B / 37B', '1.6T (total)'], tag: ['na', 'na', 'na', 'na'] },
]
const TAGC = { glm: '#6ea8fe', conv: '#7ee787', na: T.c.dim }
// 英文更长,按字符估文本宽度(CJK≈11、ASCII≈6.4),用于兜底 SVG 宽度防裁切
const estTextW = (s) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 11 : 6.4), 0)

export default function G1GlmOverview({ prev, next }) {
  const t = useT()
  const { lang } = useLang()
  const [sel, setSel] = useState(1) // 默认高亮 GLM-5/5.2

  const render = (cell) => {
    const labW = lang === 'en' ? 118 : 92
    const colW = lang === 'en' ? Math.max(150, cell * 5.6) : Math.max(112, cell * 4.4)
    const top = 46
    const rowH = 40
    const els = []
    // 列头(可点)
    COLS.forEach((c, j) => {
      const isGlm = j < 2
      const on = j === sel
      const cx = labW + j * colW
      els.push(<rect key={`h${j}`} x={cx + 2} y={14} width={colW - 4} height={26} rx={6}
        fill={on ? (isGlm ? 'rgba(110,168,254,0.18)' : 'rgba(126,231,135,0.14)') : T.c.bgElev}
        stroke={on ? (isGlm ? '#6ea8fe' : '#7ee787') : T.c.border} strokeWidth={on ? 2 : 1}
        style={{ cursor: 'pointer' }} onClick={() => setSel(j)} />)
      els.push(<text key={`ht${j}`} x={cx + colW / 2} y={31} textAnchor="middle" fontFamily={T.font}
        fontSize={12} fontWeight={on ? 700 : 500} fill={on ? (isGlm ? '#6ea8fe' : '#7ee787') : T.c.text}
        style={{ cursor: 'pointer' }} onClick={() => setSel(j)}>{c}</text>)
    })
    // 行
    ROWS.forEach((r, i) => {
      const y = top + i * rowH
      els.push(<text key={`rl${i}`} x={labW - 8} y={y + rowH / 2 + 4} textAnchor="end" fontFamily={T.font}
        fontSize={11} fill={T.c.dim}>{t(r.k, r.kEn)}</text>)
      r.v.forEach((_val, j) => {
        const val = t(r.v[j], r.vEn && r.vEn[j])
        const cx = labW + j * colW
        const on = j === sel
        const col = TAGC[r.tag[j]]
        els.push(<rect key={`c${i}-${j}`} x={cx + 2} y={y + 2} width={colW - 4} height={rowH - 4} rx={5}
          fill={on ? 'rgba(255,255,255,0.04)' : 'transparent'} stroke={on ? col : T.c.border}
          strokeWidth={on ? 1.6 : 0.5} />)
        const lines = val.split('\n')
        lines.forEach((ln, li) => {
          els.push(<text key={`ct${i}-${j}-${li}`} x={cx + colW / 2}
            y={y + rowH / 2 + 4 + (li - (lines.length - 1) / 2) * 12} textAnchor="middle" fontFamily={T.font}
            fontSize={10.5} fill={r.tag[j] === 'na' ? T.c.dim : col}>{ln}</text>)
        })
      })
    })
    const H = top + ROWS.length * rowH + 8
    // 图例(双语)
    const lg1 = t('蓝=GLM 独特', 'blue = GLM-unique')
    const lg2 = t('绿=GLM-5 与 DeepSeek 趋同', 'green = GLM-5 converges with DeepSeek')
    const lg3 = t('灰=对照', 'grey = reference')
    els.push(<text key="lg" x={labW} y={H - 2} fontFamily={T.font} fontSize={9.5} fill={T.c.dim}>
      <tspan fill="#6ea8fe">{lg1}</tspan>　<tspan fill="#7ee787">{lg2}</tspan>　<tspan fill={T.c.dim}>{lg3}</tspan></text>)
    // 英文图例更长,按文本宽度兜底,避免被裁切
    const W = Math.max(labW + COLS.length * colW + 8, labW + estTextW(`${lg1}　${lg2}　${lg3}`) + 16)
    return <svg width={W} height={H + 6} style={{ display: 'block', minWidth: W }}>{els}</svg>
  }

  return (
    <ChapterLayout
      kicker={t('第三部分 · GLM · G1', 'Part 3 · GLM · G1')}
      title={t('GLM 是什么 · 渊源与版本演进', 'GLM: Origins & Evolution')}
      prev={prev}
      next={next}
      translated
    >
      <>
        {lang === 'en' ? (
          <>
            <p>
              <b>GLM</b> (General Language Model, from Zhipu / Tsinghua) is another major open-source LLM lineage.
              This part teaches by <b>comparison</b> — you already know the standard Transformer (Part 1) and DeepSeek's
              MLA / MoE / MTP / sparse attention (Part 2), so the focus is on <b>which different trade-offs GLM makes</b>,
              and what's new in <b>GLM-5.2</b>.
            </p>
            <h2>Origins: a different training objective</h2>
            <p>
              GLM's original (2021) signature was <b>autoregressive blank infilling</b>:
              punch out several <b>contiguous spans</b> from a sentence and have the model <b>fill the blanks back autoregressively</b>.
              This unified "bidirectional understanding (like BERT)" and "autoregressive generation (like GPT)" into one objective.
              To be clear though: <b>modern GLM-4/5 are already standard decoder-only autoregressive models</b> —
              blank infilling is its historical starting point, not its current structure.
            </p>
            <h2>Two open-source paths: diverge → converge → increment</h2>
            <ul>
              <li><b>GLM-4.5 (Jul 2025) diverges</b>: it took a set of choices <b>different</b> from DeepSeek —
                <b>GQA</b> (not MLA), <b>partial RoPE</b>, <b>QK-Norm</b>, <b>sigmoid-gated MoE</b>, deep and narrow.</li>
              <li><b>GLM-5 (2026) converges</b>: architecturally it <b>turns toward DeepSeek's stack</b> —
                adopting <b>MLA + DSA</b> (DeepSeek Sparse Attention), RoPE (MLA-style decoupled), MoE (256 experts), MTP.</li>
              <li><b>GLM-5.2 (Jun 2026) increments</b>: on top of DSA it adds its <b>own IndexShare</b> —
                letting the sparse attention's <b>top-k indices be reused across a few adjacent layers</b>, cutting per-token compute
                at <b>1M context</b> by roughly another 2.9×.</li>
            </ul>
            <p>
              The figure on the right puts GLM's two generations and DeepSeek's two generations <b>side by side, component by component</b>: click a column header to switch the highlight.
              <b style={{ color: '#6ea8fe' }}> Blue</b> = GLM's unique choices,
              <b style={{ color: '#7ee787' }}> green</b> = where GLM-5 converges with DeepSeek — at a glance you can see that
              "GLM-5 nearly copies DeepSeek's attention stack, innovating only on IndexShare".
            </p>
            <div className="note">
              G2–G7 later unpack each one: QK-Norm, partial RoPE + GQA (GLM-4.5's attention), sigmoid-gated MoE,
              <b> GLM-5.2's IndexShare (the highlight)</b>, MTP, and finally a full DeepSeek vs GLM panorama.
              Wherever something matches DeepSeek, we just point back to Part 2 rather than reinventing the wheel.
            </div>
          </>
        ) : (
          <>
            <p>
              <b>GLM</b>(General Language Model,智谱 / 清华)是另一条重要的开源大模型路线。
              这一部分用<b>对比</b>来讲——你已经学过标准 Transformer(第一部分)和 DeepSeek 的
              MLA/MoE/MTP/稀疏注意力(第二部分),所以重点看 <b>GLM 做了哪些不同取舍</b>,
              以及 <b>GLM-5.2</b> 的新东西。
            </p>
            <h2>渊源:一个不一样的训练目标</h2>
            <p>
              GLM 最初(2021)的特色是<b>自回归空白填充</b>(autoregressive blank infilling):
              把句子里若干<b>连续片段</b>挖空,让模型<b>自回归地把空补回来</b>。
              这把「双向理解(像 BERT)」和「自回归生成(像 GPT)」统一进一个目标。
              不过要说清:<b>现代 GLM-4/5 已经是标准的解码器(decoder-only)自回归模型</b>,
              空白填充是它的历史起点、不是现在的结构。
            </p>
            <h2>两条开源路线:分叉 → 趋同 → 增量</h2>
            <ul>
              <li><b>GLM-4.5(2025.7)分叉</b>:走了和 DeepSeek <b>不同</b>的一套——
                <b>GQA</b>(而非 MLA)、<b>部分 RoPE</b>、<b>QK-Norm</b>、<b>sigmoid 门控 MoE</b>,深而窄。</li>
              <li><b>GLM-5(2026)趋同</b>:架构上<b>转向 DeepSeek 那一套</b>——
                采用 <b>MLA + DSA</b>(DeepSeek 稀疏注意力)、RoPE(MLA 式解耦)、MoE(256 专家)、MTP。</li>
              <li><b>GLM-5.2(2026.6)增量</b>:在 DSA 之上加<b>独门的 IndexShare</b>——
                让稀疏注意力的 <b>top-k 索引在相邻几层之间复用</b>,把 <b>1M 上下文</b>的每 token 算力再降约 2.9×。</li>
            </ul>
            <p>
              右图把 GLM 两代和 DeepSeek 两代<b>逐组件对照</b>:点列头切换高亮。
              <b style={{ color: '#6ea8fe' }}>蓝</b>=GLM 独特选择,
              <b style={{ color: '#7ee787' }}>绿</b>=GLM-5 与 DeepSeek 趋同的部分——一眼能看出
              「GLM-5 几乎照搬了 DeepSeek 的注意力栈,只在 IndexShare 上自创」。
            </p>
            <div className="note">
              后面 G2–G7 会逐个拆:QK-Norm、部分 RoPE+GQA(GLM-4.5 的注意力)、sigmoid 门控 MoE、
              <b> GLM-5.2 的 IndexShare(重点)</b>、MTP,最后做一张 DeepSeek vs GLM 全景对比。
              凡和 DeepSeek 相同的部分,直接对照第二部分,不重复造轮子。
            </div>
          </>
        )}
        <Refs ids={['2103.10360', '2210.02414', '2406.12793', '2508.06471', '2602.15763', '2412.19437', '2606.19348']} />
      </>
      <>
        <h3>{t('GLM 两代 ↔ DeepSeek 两代 · 逐组件对照', 'GLM two gens ↔ DeepSeek two gens · component-by-component')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
          {lang === 'en' ? (
            <>Click a column header to switch the highlight. Look at the "GLM-5 / 5.2" column: most cells are
            <b style={{ color: '#7ee787' }}> green (converged with DeepSeek)</b>, only <b style={{ color: '#6ea8fe' }}>IndexShare</b> is its own.</>
          ) : (
            <>点列头切换高亮。看「GLM-5 / 5.2」这列:大部分是<b style={{ color: '#7ee787' }}>绿(趋同 DeepSeek)</b>,
            只有 <b style={{ color: '#6ea8fe' }}>IndexShare</b> 是它自己的。</>
          )}
        </p>
        <FigureBoard renderSvg={render} baseCell={26} fullCell={38} />
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 10,
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
          <b style={{ color: COLS[sel].startsWith('GLM') ? '#6ea8fe' : '#7ee787' }}>{COLS[sel]}</b>{t(':', ': ')}{t(SUMMARY[sel].zh, SUMMARY[sel].en)}
        </p>
      </>
    </ChapterLayout>
  )
}
