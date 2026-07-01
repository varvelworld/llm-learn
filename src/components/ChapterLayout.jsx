import { Link } from 'react-router-dom'
import { useLang, useT } from '../i18n/lang.jsx'

// 每章统一骨架:左讲解(children[0])+ 右演示(children[1])+ 底部翻页。
// translated:该章是否已提供英文;英文模式下未译章节显示提示条(内容回退中文)。
export default function ChapterLayout({ kicker, title, prev, next, translated = false, children }) {
  const [text, demo] = Array.isArray(children) ? children : [children, null]
  const { lang } = useLang()
  const t = useT()
  const showZhFallback = lang === 'en' && !translated
  return (
    <div className="chapter">
      <div className="chapter-text">
        {kicker && <div className="kicker">{kicker}</div>}
        <h1>{title}</h1>
        {showZhFallback && (
          <div className="note" style={{ marginTop: 0 }}>
            🌐 English translation in progress — showing the Chinese version for now.
          </div>
        )}
        {text}
      </div>
      <div>
        {demo && <div className="demo">{demo}</div>}
      </div>
      <div className="pager">
        {prev ? <Link to={`/c/${prev.slug}`}>← {prev.num}. {t(prev.title, prev.titleEn)}</Link> : <span />}
        <span className="spacer" />
        {next ? <Link to={`/c/${next.slug}`}>{next.num}. {t(next.title, next.titleEn)} →</Link> : <span />}
      </div>
    </div>
  )
}
