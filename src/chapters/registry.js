// 章节注册表:侧边栏、路由、翻页都从这里派生(单一数据源)。
import P1Vectors from './P1Vectors.jsx'
import P2Ops from './P2Ops.jsx'
import P3NeuronMatrix from './P3NeuronMatrix.jsx'
import Ch00Overview from './Ch00Overview.jsx'
import Ch01Tokenization from './Ch01Tokenization.jsx'
import Ch02Embedding from './Ch02Embedding.jsx'
import Ch03Rope from './Ch03Rope.jsx'
import Ch04Attention from './Ch04Attention.jsx'
import Ch05MultiHead from './Ch05MultiHead.jsx'
import Ch06FFN from './Ch06FFN.jsx'
import Ch07Norm from './Ch07Norm.jsx'
import Ch08Block from './Ch08Block.jsx'
import Ch09Generation from './Ch09Generation.jsx'
import Ch10Sampling from './Ch10Sampling.jsx'
import Ch11MLA from './Ch11MLA.jsx'
import Ch12MoE from './Ch12MoE.jsx'
import Ch14SparseWhy from './Ch14SparseWhy.jsx'
import Ch15DSA from './Ch15DSA.jsx'
import Ch16CSAHCA from './Ch16CSAHCA.jsx'
import Ch17MHC from './Ch17MHC.jsx'
import Ch18Engram from './Ch18Engram.jsx'
import Ch19DSpark from './Ch19DSpark.jsx'
import G1GlmOverview from './G1GlmOverview.jsx'
import G2GlmQKNorm from './G2GlmQKNorm.jsx'
import G5GlmIndexShare from './G5GlmIndexShare.jsx'

// part: 'basics' | 'deepseek'。Component 为 null 表示"建设中"。
export const CHAPTERS = [
  { num: 'P1', slug: 'vectors', title: '向量与矩阵', part: 'prep', Component: P1Vectors },
  { num: 'P2', slug: 'vec-ops', title: '五种核心运算', part: 'prep', Component: P2Ops },
  { num: 'P3', slug: 'neuron-matrix', title: '神经元与矩阵', part: 'prep', Component: P3NeuronMatrix },
  { num: 0, slug: 'overview', title: '总览地图', part: 'basics', Component: Ch00Overview },
  { num: 1, slug: 'tokenization', title: '分词 Tokenization', part: 'basics', Component: Ch01Tokenization },
  { num: 2, slug: 'embedding', title: '词嵌入 Embedding', part: 'basics', Component: Ch02Embedding },
  { num: 3, slug: 'rope', title: '位置信息 RoPE', part: 'basics', Component: Ch03Rope },
  { num: 4, slug: 'attention', title: '自注意力(核心)', part: 'basics', Component: Ch04Attention },
  { num: 5, slug: 'multihead', title: '多头注意力', part: 'basics', Component: Ch05MultiHead },
  { num: 6, slug: 'ffn', title: '前馈 FFN / SwiGLU', part: 'basics', Component: Ch06FFN },
  { num: 7, slug: 'norm', title: '残差 & RMSNorm', part: 'basics', Component: Ch07Norm },
  { num: 8, slug: 'block', title: 'Transformer Block', part: 'basics', Component: Ch08Block },
  { num: 9, slug: 'generation', title: '自回归生成 + KV 缓存', part: 'basics', Component: Ch09Generation },
  { num: 10, slug: 'sampling', title: '输出与采样', part: 'basics', Component: Ch10Sampling },
  { num: 11, slug: 'mla', title: 'MLA 潜变量注意力', part: 'deepseek', group: 'V2 · 又大又省', Component: Ch11MLA },
  { num: 12, slug: 'moe', title: 'MoE 混合专家', part: 'deepseek', group: 'V2 · 又大又省', Component: Ch12MoE },
  { num: 13, slug: 'mtp', title: 'MTP 多 token 预测', part: 'deepseek', group: 'V3 · 提速', Component: null },
  { num: 14, slug: 'sparse-why', title: '为什么要稀疏注意力', part: 'deepseek', group: 'V4 · 长上下文与稀疏', Component: Ch14SparseWhy },
  { num: 15, slug: 'dsa', title: 'DSA + 闪电索引器', part: 'deepseek', group: 'V4 · 长上下文与稀疏', Component: Ch15DSA },
  { num: 16, slug: 'csa-hca', title: 'CSA + HCA 混合注意力', part: 'deepseek', group: 'V4 · 长上下文与稀疏', Component: Ch16CSAHCA },
  { num: 17, slug: 'mhc', title: 'mHC 流形超连接', part: 'deepseek', group: 'V4 · 长上下文与稀疏', Component: Ch17MHC },
  { num: 18, slug: 'engram', title: 'Engram 记忆', part: 'deepseek', group: 'V4 · 长上下文与稀疏', Component: Ch18Engram },
  { num: 19, slug: 'dspark', title: 'DSpark 投机解码', part: 'deepseek', group: 'V4 · 推理加速', Component: Ch19DSpark },
  { num: 20, slug: 'deepseek', title: '全景总览 · V2→V4', part: 'deepseek', group: '收尾', Component: null },
  { num: 'G1', slug: 'glm-overview', title: 'GLM 渊源与演进', part: 'glm', Component: G1GlmOverview },
  { num: 'G2', slug: 'glm-qknorm', title: 'QK-Norm', part: 'glm', Component: G2GlmQKNorm },
  { num: 'G3', slug: 'glm-rope-gqa', title: '部分 RoPE + GQA', part: 'glm', Component: null },
  { num: 'G4', slug: 'glm-moe', title: 'Sigmoid 门控 MoE', part: 'glm', Component: null },
  { num: 'G5', slug: 'glm-indexshare', title: 'GLM-5.2 IndexShare', part: 'glm', Component: G5GlmIndexShare },
  { num: 'G6', slug: 'glm-mtp', title: 'MTP 投机解码', part: 'glm', Component: null },
  { num: 'G7', slug: 'glm-vs-deepseek', title: 'DeepSeek vs GLM', part: 'glm', Component: null },
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
