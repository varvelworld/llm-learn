import { useState } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import ProbBars from '../components/ProbBars.jsx'
import Slider from '../components/Slider.jsx'
import { SAMPLING } from '../data/toy.js'
import { softmaxWithTemperature } from '../lib/softmax.js'

export default function Ch10Sampling({ prev, next }) {
  const [temp, setTemp] = useState(1.0)
  const [topK, setTopK] = useState(6)

  const { candidates, logits } = SAMPLING
  // 先按 logits 排序,top-k 截断,再 softmax(带温度)
  const ranked = candidates
    .map((c, i) => ({ c, logit: logits[i] }))
    .sort((a, b) => b.logit - a.logit)
  const kept = ranked.slice(0, topK)
  const probs = softmaxWithTemperature(kept.map((r) => r.logit), temp)
  const best = probs.indexOf(Math.max(...probs))

  return (
    <ChapterLayout kicker="第 10 章 · 输出" title="logits → 下一个词" prev={prev} next={next}>
      <>
        <p>
          经过所有 Transformer 层后,模型为词表里<b>每个候选词</b>打一个分数(<b>logits</b>)。
          要变成"选哪个词",还差两步:把分数变概率,再按概率<b>采样</b>。
        </p>
        <h2>温度 Temperature</h2>
        <p>
          softmax 前给 logits 除以一个温度值。温度<b>低</b> → 分布更<b>尖</b>,模型更确定、更保守;
          温度<b>高</b> → 分布更<b>平</b>,更随机、更有创意。拖右边滑块感受。
        </p>
        <h2>Top-k</h2>
        <p>
          只在分数最高的 <b>k</b> 个候选里采样,砍掉长尾里的离谱词。
          (还有个常用的 top-p / nucleus,按累计概率截断,这里先用 top-k 演示。)
        </p>
        <div className="note">
          温度=0 基本等于"永远选最高分"(贪心)。聊天模型通常用 0.3~1.0。
        </div>
      </>
      <>
        <h3>采样控制</h3>
        <Slider label="温度 temperature" value={temp} min={0.1} max={3} step={0.1}
          onChange={setTemp} fmt={(v) => v.toFixed(1)} />
        <Slider label="top-k" value={topK} min={1} max={candidates.length} step={1}
          onChange={setTopK} fmt={(v) => String(v)} />
        <h3 style={{ marginTop: 20 }}>下一个词的概率</h3>
        <ProbBars labels={kept.map((r) => r.c)} probs={probs} highlight={best} />
        <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text-dim)' }}>
          当前最可能:<b style={{ color: 'var(--accent-2)' }}>{kept[best].c}</b>
          (共保留 {kept.length} 个候选)
        </div>
      </>
    </ChapterLayout>
  )
}
