import { useState } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import Refs from '../components/Refs.jsx'
import { MOE } from '../data/toy.js'
import { route, expertLoad } from '../lib/moe.js'

export default function Ch12MoE({ prev, next }) {
  const [ti, setTi] = useState(1)
  const { gateW, topK, tokens, tokenVecs } = MOE

  const tokenVec = tokenVecs[ti]
  const { probs, chosen } = route(tokenVec, gateW, topK)
  const chosenIdx = new Set(chosen.map((c) => c.idx))
  const load = expertLoad(tokenVecs, gateW, topK)
  const maxLoad = Math.max(...load, 1)
  const maxProb = Math.max(...probs)

  return (
    <ChapterLayout kicker="第 12 章 · MoE · DeepSeekMoE(V2)→ V3" title="MoE 混合专家" prev={prev} next={next}>
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
        <Refs ids={['1701.06538', '2401.06066', '2405.04434', '2408.15664', '2412.19437']} />
      </>
      <>
        <h3>选一个 token</h3>
        <div className="chips">
          {tokens.map((t, i) => (
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
              {t}
            </span>
          ))}
        </div>

        <h3 style={{ marginTop: 18 }}>门控打分 → 路由 (top-{topK})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {probs.map((p, e) => {
            const on = chosenIdx.has(e)
            return (
              <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 64, fontFamily: 'var(--mono)', fontSize: 12,
                  color: on ? 'var(--accent-2)' : 'var(--text-dim)' }}>
                  专家{e}
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
          token「<b style={{ color: 'var(--accent)' }}>{tokens[ti]}</b>」被送往:
          {chosen.map((c) => ` 专家${c.idx}(权重${(c.weight * 100).toFixed(0)}%)`).join(' +')}
        </div>

        <h3 style={{ marginTop: 22 }}>专家负载(全部 token)</h3>
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
          负载不均时,有的专家累死、有的闲置——这就是为什么需要负载均衡。
        </div>
      </>
    </ChapterLayout>
  )
}
