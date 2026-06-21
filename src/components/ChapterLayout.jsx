import { Link } from 'react-router-dom'

// 每章统一骨架:左讲解(children[0])+ 右演示(children[1])+ 底部翻页。
export default function ChapterLayout({ kicker, title, prev, next, children }) {
  const [text, demo] = Array.isArray(children) ? children : [children, null]
  return (
    <div className="chapter">
      <div className="chapter-text">
        {kicker && <div className="kicker">{kicker}</div>}
        <h1>{title}</h1>
        {text}
      </div>
      <div>
        {demo && <div className="demo">{demo}</div>}
      </div>
      <div className="pager">
        {prev ? <Link to={`/c/${prev.slug}`}>← {prev.num}. {prev.title}</Link> : <span />}
        <span className="spacer" />
        {next ? <Link to={`/c/${next.slug}`}>{next.num}. {next.title} →</Link> : <span />}
      </div>
    </div>
  )
}
