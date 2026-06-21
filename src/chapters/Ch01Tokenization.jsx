import { useState } from 'react'
import ChapterLayout from '../components/ChapterLayout.jsx'
import { tokenize } from '../lib/tokenizer.js'

export default function Ch01Tokenization({ prev, next }) {
  const [text, setText] = useState('the cat sat on the mat')
  const tokens = tokenize(text)

  return (
    <ChapterLayout kicker="第 1 章 · 分词" title="文本 → Token" prev={prev} next={next}>
      <>
        <p>
          模型不能直接读字符,第一步是把文本切成一个个 <b>token</b>。token 不一定是完整单词
          ——常见词是一个 token,生僻词会被拆成几个<b>子词</b>片段。
        </p>
        <p>
          这样做是为了平衡:词表太大(每个词一个 token)装不下,字符级又太细、序列太长。
          子词是折中。真实模型用 <b>BPE</b> 等算法从海量语料里"学"出一份子词词表。
        </p>
        <h2>试试看</h2>
        <p>
          在右边输入框改文字。词表里收录的词会整体保留;没收录的词(比如 <code>networking</code>)
          会被贪心地切成已知子词,<code>##</code> 表示"接在前一片后面"。
        </p>
        <div className="note">
          这里用的是一份很小的玩具词表,只为演示原理。真实 DeepSeek 词表有 10 万+ token。
        </div>
      </>
      <>
        <h3>分词器</h3>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-dim)' }}>
          切出 {tokens.length} 个 token:
        </div>
        <div className="chips">
          {tokens.map((t, i) => (
            <span key={i} className={'chip' + (t.text.startsWith('##') ? ' cont' : '')}>
              {t.text}
              <span className="id">#{t.id}</span>
            </span>
          ))}
        </div>
        <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-dim)' }}>
          每个 token 还带一个 <b>ID</b>(在词表里的编号)。下一步就是用这个 ID 去查它的向量。
        </div>
      </>
    </ChapterLayout>
  )
}
