import katex from 'katex'

// 把 LaTeX 字符串渲染成排版数学。block=true 用 display 模式(居中独占一行)。
export default function Tex({ children, block = false }) {
  const html = katex.renderToString(String(children), {
    throwOnError: false,
    displayMode: block,
    trust: true, // 允许 \textcolor{#rrggbb}
  })
  return <span style={block ? { display: 'block' } : undefined} dangerouslySetInnerHTML={{ __html: html }} />
}
