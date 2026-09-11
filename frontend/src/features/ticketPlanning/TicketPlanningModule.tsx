import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import TicketPlanningApp from './TicketPlanningApp'
import moduleStyles from './styles.css?inline'
import Box from '@mui/material/Box'

export default function TicketPlanningModule() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    shadowRoot.innerHTML = ''

    const style = document.createElement('style')
    style.textContent = `${moduleStyles}
      :host {
        display: block;
        font-family: 'Noto Sans Thai', 'Inter', sans-serif;
        --navy:#070d3d;
        --pink:#e72d70;
        --line:#dedde6;
        --muted:#777b91;
        --type-page:36px;
        --type-card:28px;
        --type-section:22px;
        --type-body:18px;
        --type-secondary:16px;
        --type-caption:14px;
        --type-micro:12px;
      }
      .app-shell, .content { min-height: auto; }
      .content { margin-left: 0 !important; padding: 0 !important; }
    `
    const mount = document.createElement('div')
    shadowRoot.append(style, mount)
    setMountNode(mount)

    return () => {
      setMountNode(null)
      shadowRoot.innerHTML = ''
    }
  }, [])

  return <Box ref={hostRef}>{mountNode && createPortal(<TicketPlanningApp />, mountNode)}</Box>
}


