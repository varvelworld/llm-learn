import { HashRouter, Routes, Route, Navigate, NavLink, useParams } from 'react-router-dom'
import { CHAPTERS, findChapter, neighbors } from './chapters/registry.js'
import { useLang, useT } from './i18n/lang.jsx'

function NavItem({ c }) {
  const t = useT()
  const title = t(c.title, c.titleEn)
  return c.Component ? (
    <NavLink to={`/c/${c.slug}`} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
      <span className="num">{c.num}</span>
      <span>{title}</span>
    </NavLink>
  ) : (
    <div className="nav-item soon">
      <span className="num">{c.num}</span>
      <span>{title}</span>
      <span className="badge">{t('建设中', 'WIP')}</span>
    </div>
  )
}

function LangToggle() {
  const { lang, setLang } = useLang()
  const btn = (code, label) => (
    <button
      onClick={() => setLang(code)}
      style={{
        padding: '2px 10px',
        borderRadius: 6,
        border: '1px solid var(--border)',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: lang === code ? 700 : 400,
        background: lang === code ? 'var(--accent)' : 'transparent',
        color: lang === code ? '#0f1115' : 'var(--text-dim)',
      }}
    >
      {label}
    </button>
  )
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
      {btn('zh', '中文')}
      {btn('en', 'EN')}
    </div>
  )
}

function Sidebar() {
  const t = useT()
  const prep = CHAPTERS.filter((c) => c.part === 'prep')
  const basics = CHAPTERS.filter((c) => c.part === 'basics')
  const deep = CHAPTERS.filter((c) => c.part === 'deepseek')
  const deepGroups = [...new Set(deep.map((c) => c.group))].map((g) => ({
    g,
    gEn: deep.find((c) => c.group === g)?.groupEn,
  }))
  const glm = CHAPTERS.filter((c) => c.part === 'glm')
  return (
    <nav className="sidebar">
      <div className="brand">
        {t('可视化学习 LLM', 'Learn LLMs Visually')}
        <small>{t('从零看懂开源大模型架构', 'Open-source LLM architecture, from scratch')}</small>
        <LangToggle />
      </div>

      <div className="group-label">{t('第 0 部分 · 预备知识(向量与矩阵)', 'Part 0 · Prerequisites (Vectors & Matrices)')}</div>
      {prep.map((c) => <NavItem key={c.slug} c={c} />)}

      <div className="group-label">{t('第一部分 · 基础(标准 Transformer)', 'Part 1 · Basics (Standard Transformer)')}</div>
      {basics.map((c) => <NavItem key={c.slug} c={c} />)}

      <div className="group-label">{t('第二部分 · DeepSeek 创新', 'Part 2 · DeepSeek Innovations')}</div>
      {deepGroups.map(({ g, gEn }) => (
        <div key={g}>
          <div className="subgroup-label">{t(g, gEn)}</div>
          {deep.filter((c) => c.group === g).map((c) => <NavItem key={c.slug} c={c} />)}
        </div>
      ))}

      {glm.length > 0 && <div className="group-label">{t('第三部分 · GLM(智谱)', 'Part 3 · GLM (Zhipu)')}</div>}
      {glm.map((c) => <NavItem key={c.slug} c={c} />)}
    </nav>
  )
}

function ChapterRoute() {
  const { slug } = useParams()
  const ch = findChapter(slug)
  if (!ch || !ch.Component) return <Navigate to="/c/overview" replace />
  const { prev, next } = neighbors(slug)
  const C = ch.Component
  return <C prev={prev} next={next} />
}

export default function App() {
  return (
    <HashRouter>
      <div className="app">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to="/c/overview" replace />} />
            <Route path="/c/:slug" element={<ChapterRoute />} />
            <Route path="*" element={<Navigate to="/c/overview" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
