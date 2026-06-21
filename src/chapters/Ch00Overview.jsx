import { Link } from 'react-router-dom'
import ChapterLayout from '../components/ChapterLayout.jsx'

const PIPE = [
  { slug: 'tokenization', label: '分词', desc: '文本 → token' },
  { slug: 'embedding', label: '嵌入', desc: 'token → 向量' },
  { slug: null, label: '位置编码 RoPE', desc: '加入位置信息' },
  { slug: 'attention', label: '自注意力', desc: 'token 之间互相看' },
  { slug: null, label: '前馈 / 残差 / 归一化', desc: '逐 token 加工 + 堆深' },
  { slug: null, label: '× N 层', desc: '重复很多层' },
  { slug: 'sampling', label: '输出 + 采样', desc: 'logits → 下一个词' },
]

export default function Ch00Overview({ prev, next }) {
  return (
    <ChapterLayout kicker="第 0 章 · 总览" title="LLM 是怎么工作的?" prev={prev} next={next}>
      <>
        <p>
          一个大语言模型(LLM)做的事情其实只有一句话:
          <b> 给定前面的文字,预测下一个词</b>。把这一步不断重复,就能写出整段话。
        </p>
        <p>难点在于"预测下一个词"这一步内部发生了什么。它大致是一条流水线:</p>
        <ol>
          <li>把文字切成 <b>token</b>(子词)</li>
          <li>每个 token 查表变成一串数字(<b>向量 / 嵌入</b>)</li>
          <li>叠很多层 <b>Transformer</b>,核心是 <b>自注意力</b>——让每个词参考上下文</li>
          <li>最后输出每个候选词的分数,采样得到下一个词</li>
        </ol>
        <p>
          这个课程会把这条流水线一节一节拆开,每节右边都有可以动手玩的小演示。
          学到后半段,我们会看 <b>DeepSeek</b> 在这条标准流水线上做了哪些关键改进
          (MLA、MoE、MTP)。
        </p>
        <div className="note">
          右边是整条流水线。蓝色的环节现在就能点进去看;灰色的还在建设中。
        </div>
      </>
      <>
        <h3>前向流水线</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {PIPE.map((s, i) => (
            <div key={i}>
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: s.slug ? 'var(--bg-elev)' : 'var(--bg)',
                  opacity: s.slug ? 1 : 0.5,
                }}
              >
                {s.slug ? (
                  <Link to={`/c/${s.slug}`} style={{ fontWeight: 600 }}>{s.label}</Link>
                ) : (
                  <span style={{ fontWeight: 600 }}>{s.label}</span>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{s.desc}</div>
              </div>
              {i < PIPE.length - 1 && (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', lineHeight: 1.2 }}>↓</div>
              )}
            </div>
          ))}
        </div>
      </>
    </ChapterLayout>
  )
}
