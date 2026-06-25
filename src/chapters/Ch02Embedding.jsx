import ChapterLayout from '../components/ChapterLayout.jsx'
import Refs from '../components/Refs.jsx'
import Heatmap from '../components/Heatmap.jsx'
import { SENTENCE, EMBEDDINGS } from '../data/toy.js'
import { dot, norm } from '../lib/tensor.js'

function cosine(a, b) {
  return dot(a, b) / (norm(a) * norm(b) + 1e-9)
}

export default function Ch02Embedding({ prev, next }) {
  const tokens = SENTENCE
  const matrix = tokens.map((t) => EMBEDDINGS[t])
  // 余弦相似度矩阵:看哪些词向量更接近
  const sim = tokens.map((a) => tokens.map((b) => cosine(EMBEDDINGS[a], EMBEDDINGS[b])))

  return (
    <ChapterLayout kicker="第 2 章 · 嵌入" title="Token → 向量" prev={prev} next={next}>
      <>
        <p>
          每个 token ID 会去一张<b>嵌入表</b>里查出一串数字——一个<b>向量</b>。
          这就是模型理解词义的载体:意思相近的词,向量也更接近。
        </p>
        <p>
          这些数字一开始是随机的,在训练中被慢慢调整,最终编码出词与词之间的关系。
          真实模型每个向量有几千维;这里为了看清楚只用 <b>4 维</b>。
        </p>
        <h2>真实模型的维度有多大?</h2>
        <p>
          这个"维度"叫 <b>d_model</b>(隐藏维度),是贯穿整个模型的向量宽度。下面感受一下量级:
        </p>
        <table className="dim-table">
          <thead>
            <tr><th>模型</th><th>d_model</th></tr>
          </thead>
          <tbody>
            <tr><td>经典词向量 Word2Vec / GloVe</td><td>300</td></tr>
            <tr><td>GPT-2 (small) / BERT-base</td><td>768</td></tr>
            <tr><td>GPT-2 XL</td><td>1600</td></tr>
            <tr><td>Llama-2 7B</td><td>4096</td></tr>
            <tr><td>Llama-2 / Llama-3 70B</td><td>8192</td></tr>
            <tr><td>GPT-3 (175B)</td><td>12288</td></tr>
            <tr className="hl"><td>DeepSeek-V3 (671B)</td><td>7168</td></tr>
            <tr className="hl"><td>DeepSeek-V4 (2026, ~1T)*</td><td>≈7168</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          * DeepSeek-V3 的 7168 有官方技术报告佐证;V4 规格目前多来自第三方整理,数字以官方为准。
        </p>
        <div className="note">
          有意思的是:<b>维度大 ≠ 一定更强</b>。DeepSeek 的 d_model(7168)反而比 GPT-3(12288)小——
          它靠的是 <b>MoE</b> 堆总参数、<b>MLA</b> 省显存,而不是一味加宽向量。这些后面会讲。
          另外别和"<b>每个注意力头</b>的维度"搞混:DeepSeek 有 128 个头、每个头才 128 维。
        </div>
        <h2>向量是有"几何"的</h2>
        <p>
          右下角是这些词两两之间的<b>余弦相似度</b>(1=方向相同)。注意
          <code>cat</code> 和 <code>mat</code> 的相似度偏高——我故意把它们的向量设计得接近,
          模拟"相关的词聚在一起"。
        </p>
        <div className="note">
          颜色:<span style={{ color: 'var(--hot)' }}>红=正、大</span> ·
          <span style={{ color: 'var(--accent)' }}> 蓝=负、小</span>。下面每张表都用这套配色。
        </div>
        <Refs ids={['1301.3781', '1810.04805', '2005.14165', '2412.19437', '2405.04434']} />
      </>
      <>
        <h3>嵌入向量 (5 token × 4 维)</h3>
        <Heatmap
          matrix={matrix}
          rowLabels={tokens}
          colLabels={['d0', 'd1', 'd2', 'd3']}
        />
        <h3 style={{ marginTop: 22 }}>词间余弦相似度</h3>
        <Heatmap matrix={sim} rowLabels={tokens} colLabels={tokens} cell={46} />
      </>
    </ChapterLayout>
  )
}
