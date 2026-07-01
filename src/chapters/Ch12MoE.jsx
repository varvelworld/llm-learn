import { useState } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import Refs from '../components/Refs.jsx'
import { MOE } from '../data/toy.js'
import { route, expertLoad } from '../lib/moe.js'
import { useLang, useT } from '../i18n/lang.jsx'

export default function Ch12MoE({ prev, next }) {
  const t = useT()
  const { lang } = useLang()
  const [ti, setTi] = useState(1)
  const { gateW, topK, tokens, tokenVecs } = MOE

  const tokenVec = tokenVecs[ti]
  const { probs, chosen } = route(tokenVec, gateW, topK)
  const chosenIdx = new Set(chosen.map((c) => c.idx))
  const load = expertLoad(tokenVecs, gateW, topK)
  const maxLoad = Math.max(...load, 1)
  const maxProb = Math.max(...probs)

  return (
    <ChapterLayout
      kicker={t('第 12 章 · MoE · DeepSeekMoE(V2)→ V3', 'Ch 12 · MoE · DeepSeekMoE (V2) → V3')}
      title={t('MoE 混合专家', 'MoE (Mixture of Experts)')}
      prev={prev}
      next={next}
      translated
    >
      <>
        {lang === 'en' ? (
          <>
            <p>
              In a plain Transformer, every token goes through the <b>same</b> large feed-forward network.
              <b>MoE</b> flips the idea: prepare many small expert networks, and let each token <b>activate only a few of them</b>.
            </p>
            <p>
              A tiny <b>router (gate)</b> scores every expert and picks the top-{topK} to process this token.
              This way the total parameter count can be huge (lots of knowledge), yet the actual compute per token stays small (<b>sparse activation</b>) —
              this is one of the keys to how DeepSeek makes models both big and fast.
            </p>
            <h2>DeepSeek's MoE improvements</h2>
            <ul>
              <li><b>Fine-grained experts</b> (DeepSeekMoE / V2): slice experts smaller and more numerous, for more flexible combinations</li>
              <li><b>Shared experts</b> (DeepSeekMoE / V2): keep one or two experts that every token passes through, handling common knowledge,
                while the remaining routed experts specialize</li>
              <li><b>Auxiliary-loss-free load balancing</b> (<b>introduced in V3</b>): keep experts evenly used,
                without hurting quality the way V2's multiple auxiliary losses do. <span style={{ color: 'var(--text-dim)' }}>
                Note: V2 used auxiliary-loss balancing (expert/device/communication loss);
                the auxiliary-loss-free scheme was proposed by Wang et al. 2024 and adopted by DeepSeek-V3.</span></li>
            </ul>
            <p>Click different tokens on the right to see which experts the gate routes them to; below is the per-expert load over all tokens.</p>
            <div className="note">
              The dark highlights on the right = the selected top-{topK} routed experts. The last "generalist" expert in the demo is a <b>simplified approximation</b> of a shared expert —
              note that a real shared expert <b>skips the gate's scoring and is activated for every token unconditionally</b>, does not compete in top-k, and is fundamentally different from the ordinary experts that do compete here.
            </div>
          </>
        ) : (
          <>
            <p>
              普通 Transformer 里,每个 token 都过<b>同一个</b>大前馈网络。
              <b>MoE</b> 换了个思路:准备很多个小专家网络,每个 token 只<b>激活其中少数几个</b>。
            </p>
            <p>
              一个小小的<b>门控(router)</b>给每个专家打分,选出 top-{topK} 个来处理这个 token。
              这样总参数量可以很大(知识多),但每个 token 实际计算量很小(<b>稀疏激活</b>)——
              这正是 DeepSeek 能把模型做得又大又快的关键之一。
            </p>
            <h2>DeepSeek 的 MoE 改进</h2>
            <ul>
              <li><b>细粒度专家</b>(DeepSeekMoE / V2):把专家切得更小更多,组合更灵活</li>
              <li><b>共享专家</b>(DeepSeekMoE / V2):留一两个所有 token 都过的专家,负责通用知识,
                其余路由专家专攻细分</li>
              <li><b>无辅助损失的负载均衡</b>(<b>V3 才引入</b>):让各专家被均匀使用,
                且不像 V2 的多重辅助损失那样损害效果。<span style={{ color: 'var(--text-dim)' }}>
                注:V2 用的是带辅助损失的均衡(expert/device/communication loss),
                无辅助损失方案由 Wang et al. 2024 提出、DeepSeek-V3 采用。</span></li>
            </ul>
            <p>右边点不同 token,看门控把它路由给了哪些专家;下方是所有 token 的专家负载。</p>
            <div className="note">
              右边深色高亮 = 被选中的 top-{topK} 路由专家。最后一个"通才"专家在演示里<b>简化近似</b>共享专家——
              注意真实共享专家<b>不经过门控打分、对每个 token 恒定激活</b>,不参与 top-k 竞争,与这里参与竞争的普通专家本质不同。
            </div>
          </>
        )}
        <Refs ids={['1701.06538', '2401.06066', '2405.04434', '2408.15664', '2412.19437']} />
      </>
      <>
        <h3>{t('选一个 token', 'Pick a token')}</h3>
        <div className="chips">
          {tokens.map((tok, i) => (
            <span
              key={i}
              className="chip"
              onClick={() => setTi(i)}
              style={{
                cursor: 'pointer',
                borderColor: i === ti ? 'var(--accent)' : 'var(--border)',
                color: i === ti ? 'var(--accent)' : 'var(--text)',
              }}
            >
              {tok}
            </span>
          ))}
        </div>

        <h3 style={{ marginTop: 18 }}>{t('门控打分 → 路由', 'Gate scoring → routing')} (top-{topK})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {probs.map((p, e) => {
            const on = chosenIdx.has(e)
            return (
              <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 64, fontFamily: 'var(--mono)', fontSize: 12,
                  color: on ? 'var(--accent-2)' : 'var(--text-dim)' }}>
                  {t('专家', 'Expert ')}{e}
                </div>
                <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 6, height: 20, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(p / maxProb) * 100}%`, height: '100%',
                    background: on ? 'var(--accent-2)' : 'var(--bg-elev)',
                    border: on ? 'none' : '1px solid var(--border)',
                  }} />
                </div>
                <div style={{ width: 44, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                  {(p * 100).toFixed(0)}%
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-dim)' }}>
          {t('token「', 'Token "')}<b style={{ color: 'var(--accent)' }}>{tokens[ti]}</b>{t('」被送往:', '" is sent to:')}
          {chosen.map((c) => t(` 专家${c.idx}(权重${(c.weight * 100).toFixed(0)}%)`, ` expert ${c.idx} (weight ${(c.weight * 100).toFixed(0)}%)`)).join(' +')}
        </div>

        <h3 style={{ marginTop: 22 }}>{t('专家负载(全部 token)', 'Expert load (all tokens)')}</h3>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 70 }}>
          {load.map((l, e) => (
            <div key={e} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: `${(l / maxLoad) * 50}px`, background: 'var(--accent)',
                borderRadius: '4px 4px 0 0', minHeight: 2,
              }} />
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{e}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
          {t('负载不均时,有的专家累死、有的闲置——这就是为什么需要负载均衡。',
            'When load is uneven, some experts are overworked while others sit idle — this is why load balancing is needed.')}
        </div>
      </>
    </ChapterLayout>
  )
}
