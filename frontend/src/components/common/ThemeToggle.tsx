import { Moon,Sun } from 'lucide-react'
import type { ThemeMode } from '../../hooks/useTheme'

export function ThemeToggle({theme,onToggle}:{theme:ThemeMode;onToggle:()=>void}){
  const next=theme==='light'?'dark':'light'
  return <button type="button" className="icon-button" onClick={onToggle} aria-label={`Use ${next} appearance`} title={`Use ${next} appearance`}>
    {theme==='light'?<Moon size={17} aria-hidden="true"/>:<Sun size={17} aria-hidden="true"/>}
  </button>
}
