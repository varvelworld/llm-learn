// 章节注册表:侧边栏、路由、翻页都从这里派生(单一数据源)。
import Ch00Overview from './Ch00Overview.jsx'
import Ch01Tokenization from './Ch01Tokenization.jsx'
import Ch02Embedding from './Ch02Embedding.jsx'
import Ch04Attention from './Ch04Attention.jsx'
import Ch10Sampling from './Ch10Sampling.jsx'
import Ch11MLA from './Ch11MLA.jsx'
import Ch12MoE from './Ch12MoE.jsx'

// part: 'basics' | 'deepseek'。Component 为 null 表示"建设中"。
export const CHAPTERS = [
  { num: 0, slug: 'overview', title: '总览地图', part: 'basics', Component: Ch00Overview },
  { num: 1, slug: 'tokenization', title: '分词 Tokenization', part: 'basics', Component: Ch01Tokenization },
  { num: 2, slug: 'embedding', title: '词嵌入 Embedding', part: 'basics', Component: Ch02Embedding },
  { num: 3, slug: 'rope', title: '位置信息 RoPE', part: 'basics', Component: null },
  { num: 4, slug: 'attention', title: '自注意力(核心)', part: 'basics', Component: Ch04Attention },
  { num: 5, slug: 'multihead', title: '多头注意力', part: 'basics', Component: null },
  { num: 6, slug: 'ffn', title: '前馈 FFN / SwiGLU', part: 'basics', Component: null },
  { num: 7, slug: 'norm', title: '残差 & RMSNorm', part: 'basics', Component: null },
  { num: 8, slug: 'block', title: 'Transformer Block', part: 'basics', Component: null },
  { num: 9, slug: 'generation', title: '自回归生成 + KV 缓存', part: 'basics', Component: null },
  { num: 10, slug: 'sampling', title: '输出与采样', part: 'basics', Component: Ch10Sampling },
  { num: 11, slug: 'mla', title: 'MLA 潜变量注意力', part: 'deepseek', group: 'V2 · 又大又省', Component: Ch11MLA },
  { num: 12, slug: 'moe', title: 'MoE 混合专家', part: 'deepseek', group: 'V2 · 又大又省', Component: Ch12MoE },
  { num: 13, slug: 'mtp', title: 'MTP 多 token 预测', part: 'deepseek', group: 'V3 · 提速', Component: null },
  { num: 14, slug: 'sparse-why', title: '为什么要稀疏注意力', part: 'deepseek', group: 'V4 · 长上下文与稀疏', Component: null },
  { num: 15, slug: 'dsa', title: 'DSA + 闪电索引器', part: 'deepseek', group: 'V4 · 长上下文与稀疏', Component: null },
  { num: 16, slug: 'csa-hca', title: 'CSA + HCA 混合两级压缩', part: 'deepseek', group: 'V4 · 长上下文与稀疏', Component: null },
  { num: 17, slug: 'mhc', title: 'mHC 流形超连接(替代残差)', part: 'deepseek', group: 'V4 · 长上下文与稀疏', Component: null },
  { num: 18, slug: 'engram', title: 'Engram 记忆(O(1) 检索)', part: 'deepseek', group: 'V4 · 长上下文与稀疏', Component: null },
  { num: 19, slug: 'deepseek', title: '全景总览 · V2→V4', part: 'deepseek', group: '收尾', Component: null },
]

export function findChapter(slug) {
  return CHAPTERS.find((c) => c.slug === slug)
}

// 取某章在"已建成章节"序列里的上一/下一章,用于翻页。
export function neighbors(slug) {
  const built = CHAPTERS.filter((c) => c.Component)
  const i = built.findIndex((c) => c.slug === slug)
  return {
    prev: i > 0 ? built[i - 1] : null,
    next: i < built.length - 1 ? built[i + 1] : null,
  }
}
