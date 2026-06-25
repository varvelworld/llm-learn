// Toy WordPiece 式分词器(教学用,非真实词表)。
// 思路:维护一份"子词词表",对每个单词做贪心最长匹配,切成子词,用 ## 标记续接。
// 注意这是 WordPiece(BERT)的推理机制;真实 BPE 不用 ## 也不做贪心最长匹配,而是按合并规则合并。
// 这能直观展示真实 LLM 为什么把词切成 "token"(子词)而不是整词或单字。

// 一份很小的子词词表。'##' 前缀表示"接在前一个子词后面"(类似 WordPiece 的可视记号)。
const VOCAB = [
  // 一些完整常见词
  'the', 'a', 'is', 'of', 'to', 'and', 'in', 'it', 'cat', 'dog', 'sat', 'on', 'mat',
  'learning', 'learn', 'model', 'token', 'deep', 'seek',
  // 子词片段(用于拼接没收录的词)
  'ing', 'ed', 'er', 'ly', 'tion', 'ize', 'un', 're', 'pre', 'ne', 'work', 'net',
]

// 把词表排长在前,保证"最长匹配优先"
const SORTED = [...VOCAB].sort((a, b) => b.length - a.length)

// 稳定的 ID 分配:按字母序固定,模拟真实词表里每个 token 有固定编号
const ID_MAP = (() => {
  const m = new Map()
  const all = [...VOCAB].sort()
  all.forEach((tok, i) => m.set(tok, i + 5)) // 0-4 留给特殊 token
  return m
})()

function idOf(piece) {
  const base = piece.replace(/^##/, '')
  if (ID_MAP.has(base)) return ID_MAP.get(base)
  return 3 // <unk>
}

/** 对单个词做贪心最长匹配子词切分 */
function tokenizeWord(word) {
  const pieces = []
  let i = 0
  let first = true
  while (i < word.length) {
    let matched = null
    for (const cand of SORTED) {
      if (word.startsWith(cand, i)) {
        matched = cand
        break
      }
    }
    if (matched) {
      pieces.push(first ? matched : '##' + matched)
      i += matched.length
    } else {
      // 没匹配上:退化为单字符
      pieces.push(first ? word[i] : '##' + word[i])
      i += 1
    }
    first = false
  }
  return pieces
}

/**
 * 把一句话切成 token。
 * @returns {{ text:string, id:number }[]}
 */
export function tokenize(text) {
  const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const out = []
  for (const w of words) {
    for (const p of tokenizeWord(w)) {
      out.push({ text: p, id: idOf(p) })
    }
  }
  return out
}
