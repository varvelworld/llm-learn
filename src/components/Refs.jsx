import { PAPERS, arxivUrl } from '../data/refs.js'
import { useT } from '../i18n/lang.jsx'

// 章节末尾的「参考来源」块。ids = arXiv 号数组(查 PAPERS 目录);
// extra = 额外的 {label, url}(如官方模型卡、教科书)。
export default function Refs({ ids = [], extra = [] }) {
  const t = useT()
  const items = [
    ...ids.map((id) => ({ label: PAPERS[id] ? t(PAPERS[id].t, PAPERS[id].tEn) : id, url: arxivUrl(id) })),
    ...extra,
  ]
  if (!items.length) return null
  return (
    <div style={{ marginTop: 18, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 12.5 }}>
      <div style={{ color: 'var(--text-dim)', fontWeight: 600, marginBottom: 6 }}>{t('参考来源', 'References')}</div>
      <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--text-dim)', lineHeight: 1.7 }}>
        {items.map((it, i) => (
          <li key={i}>
            {it.url ? (
              <a href={it.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{it.label}</a>
            ) : it.label}
          </li>
        ))}
      </ol>
    </div>
  )
}
