import { useState, useEffect, useRef } from 'react'
import { useT } from '../../i18n/lang.jsx'

// 可复用图板:内联控制条 + 可滚动小图 + 「全屏画布」;全屏为 pan/zoom 画布 + 左侧控制面板。
// 章节只需提供 renderSvg(cell)、controls(本章控件)、onPageStep(PageUp/Down 调序列长度)。
export default function FigureBoard({ renderSvg, baseCell = 24, fullCell = 38, controls, onPageStep }) {
  const t = useT()
  const [full, setFull] = useState(false)
  const [view, setView] = useState({ s: 1, x: 290, y: 70 })
  const fullRef = useRef(null)
  const scaleRef = useRef(1)
  const panRef = useRef({ x: 290, y: 70 })
  const dragRef = useRef(null)

  useEffect(() => {
    if (!full) return
    const init = { s: 1, x: 290, y: 70 }
    scaleRef.current = init.s; panRef.current = { x: init.x, y: init.y }; setView(init)
    const apply = (s, x, y) => { scaleRef.current = s; panRef.current = { x, y }; setView({ s, x, y }) }
    const onWheel = (e) => {
      e.preventDefault()
      const s = scaleRef.current, p = panRef.current
      if (e.ctrlKey) {
        const r = fullRef.current.getBoundingClientRect()
        const cx = e.clientX - r.left, cy = e.clientY - r.top
        const factor = Math.min(1.5, Math.max(1 / 1.5, Math.exp(-e.deltaY * 0.01)))
        const s2 = Math.min(6, Math.max(0.2, s * factor))
        apply(s2, cx - ((cx - p.x) / s) * s2, cy - ((cy - p.y) / s) * s2)
      } else {
        apply(s, p.x - e.deltaX, p.y - e.deltaY)
      }
    }
    const onKey = (e) => {
      if (e.key === 'PageUp') { e.preventDefault(); onPageStep && onPageStep(1) }
      else if (e.key === 'PageDown') { e.preventDefault(); onPageStep && onPageStep(-1) }
      else if (e.key === 'Escape') setFull(false)
    }
    const onMove = (e) => {
      const d = dragRef.current
      if (!d) return
      apply(scaleRef.current, d.px + (e.clientX - d.x), d.py + (e.clientY - d.y))
    }
    const onUp = () => { dragRef.current = null; document.body.style.cursor = '' }
    const el = fullRef.current
    if (el) el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      if (el) el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }
  }, [full, onPageStep])

  const startDrag = (e) => {
    dragRef.current = { x: e.clientX, y: e.clientY, px: panRef.current.x, py: panRef.current.y }
    document.body.style.cursor = 'grabbing'
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 12,
        padding: '10px 14px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 10 }}>
        {controls}
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => setFull(true)}>⛶ {t('全屏画布', 'Fullscreen')}</button>
      </div>

      {!full && (
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          {renderSvg(baseCell)}
        </div>
      )}

      {full && (
        <div ref={fullRef} onMouseDown={startDrag}
          style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,14,0.98)', zIndex: 1000, overflow: 'hidden', cursor: 'grab' }}>
          <div style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, transformOrigin: '0 0' }}>
            {renderSvg(fullCell)}
          </div>
          <div onMouseDown={(e) => e.stopPropagation()}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', padding: '10px 16px', background: 'rgba(8,10,14,0.85)', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              {t('全屏画布', 'Fullscreen')} &nbsp;|&nbsp; <b style={{ color: 'var(--accent)' }}>{t('拖拽', 'drag')}</b>{t('平移', ' to pan')} ·
              <b style={{ color: 'var(--accent)' }}> {t('捏合/Ctrl+滚轮', 'pinch / Ctrl+wheel')}</b> {t('缩放', 'zoom')} {Math.round(view.s * 100)}% ·
              <b style={{ color: 'var(--accent)' }}> {t('滚轮', 'wheel')}</b>{t('平移', ' to pan')} &nbsp;|&nbsp; {onPageStep ? t('PageUp/Down 调长度 · ', 'PageUp/Down length · ') : ''}{t('Esc 关闭', 'Esc close')}
            </span>
            <button className="btn" onMouseDown={(e) => e.stopPropagation()} onClick={() => setFull(false)}>✕ {t('关闭', 'Close')}</button>
          </div>
          <div onMouseDown={(e) => e.stopPropagation()}
            style={{ position: 'absolute', top: 54, left: 16, width: 250, display: 'flex', flexDirection: 'column', gap: 10,
              background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
            {controls}
          </div>
        </div>
      )}
    </>
  )
}
