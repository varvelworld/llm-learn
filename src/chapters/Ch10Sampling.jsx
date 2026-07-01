import { useState } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import Refs from '../components/Refs.jsx'
import ProbBars from '../components/ProbBars.jsx'
import Slider from '../components/Slider.jsx'
import { SAMPLING } from '../data/toy.js'
import { softmaxWithTemperature } from '../lib/softmax.js'
import { useLang, useT } from '../i18n/lang.jsx'

export default function Ch10Sampling({ prev, next }) {
  const t = useT()
  const { lang } = useLang()
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
    <ChapterLayout
      kicker={t('第 10 章 · 输出', 'Chapter 10 · Output')}
      title={t('logits → 下一个词', 'logits → next token')}
      prev={prev}
      next={next}
      translated
    >
      <>
        {lang === 'en' ? (
          <>
            <p>
              After all the Transformer layers, the model assigns a score (<b>logits</b>) to <b>every candidate token</b>
              in the vocabulary. To turn that into "which token to pick" takes two more steps: turn the scores into
              probabilities, then <b>sample</b> by those probabilities.
            </p>
            <h2>Temperature</h2>
            <p>
              Before softmax, divide the logits by a temperature value. <b>Low</b> temperature → a <b>sharper</b>
              distribution, more confident and conservative; <b>high</b> temperature → a <b>flatter</b> distribution,
              more random and creative. Drag the slider on the right to feel it.
            </p>
            <h2>Top-k</h2>
            <p>
              Sample only among the <b>k</b> highest-scoring candidates, cutting off the absurd words in the long tail.
              (There is also the common top-p / nucleus, which truncates by cumulative probability; here we demo with
              top-k first.)
            </p>
            <div className="note">
              Temperature <b>approaching 0</b> (clamped to a tiny positive number in practice) is equivalent to
              "always pick the highest score", i.e. <b>greedy argmax</b>; note that T=0 itself makes logits/T divide by
              zero and is undefined, so implementations handle it via an argmax branch or a lower clamp.
              The exact temperature to use depends on the model/task (most vendor APIs default to around 1.0, with the
              range often open to 0–2); in practice chat often uses a lower temperature to balance coherence and diversity.
            </div>
          </>
        ) : (
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
              温度<b>趋近 0</b>(工程上钳到极小正数)等价于"永远选最高分"的<b>贪心 argmax</b>;
              注意 T=0 本身会让 logits/T 除零、无定义,实现里靠 argmax 分支或下钳处理。
              温度具体取多少随模型/任务而定(各厂 API 默认多为 1.0,范围常开放到 0~2),
              实践中聊天常用较低温度以兼顾连贯与多样。
            </div>
          </>
        )}
        <Refs ids={['1503.02531', '1904.09751', '1805.04833']} />
      </>
      <>
        <h3>{t('采样控制', 'Sampling controls')}</h3>
        <Slider label={t('温度 temperature', 'temperature')} value={temp} min={0.1} max={3} step={0.1}
          onChange={setTemp} fmt={(v) => v.toFixed(1)} />
        <Slider label="top-k" value={topK} min={1} max={candidates.length} step={1}
          onChange={setTopK} fmt={(v) => String(v)} />
        <h3 style={{ marginTop: 20 }}>{t('下一个词的概率', 'Next-token probabilities')}</h3>
        <ProbBars labels={kept.map((r) => r.c)} probs={probs} highlight={best} />
        <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text-dim)' }}>
          {t('当前最可能:', 'Most likely now: ')}<b style={{ color: 'var(--accent-2)' }}>{kept[best].c}</b>
          {t(`(共保留 ${kept.length} 个候选)`, ` (${kept.length} candidates kept)`)}
        </div>
      </>
    </ChapterLayout>
  )
}
