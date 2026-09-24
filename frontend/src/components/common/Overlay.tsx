import { X } from 'lucide-react'
import { useEffect,useId,useRef,type ReactNode } from 'react'

const focusableSelector='button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({open,title,children,footer,onClose}:{open:boolean;title:string;children:ReactNode;footer?:ReactNode;onClose:()=>void}) {
  const titleId=useId()
  const dialogRef=useRef<HTMLDivElement>(null)

  useEffect(()=>{
    if(!open)return

    const previouslyFocused=document.activeElement instanceof HTMLElement?document.activeElement:null
    const previousOverflow=document.body.style.overflow
    document.body.style.overflow='hidden'

    const focusable=()=>Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector)??[])
    focusable()[0]?.focus()

    const handleKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.preventDefault()
        onClose()
        return
      }

      if(event.key!=='Tab')return
      const elements=focusable()
      if(elements.length===0){event.preventDefault();return}
      const first=elements[0]
      const last=elements[elements.length-1]
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }

    window.addEventListener('keydown',handleKeyDown)
    return()=>{
      window.removeEventListener('keydown',handleKeyDown)
      document.body.style.overflow=previousOverflow
      previouslyFocused?.focus()
    }
  },[open,onClose])

  if(!open)return null

  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/35 p-4"><div ref={dialogRef} className="panel max-h-[90vh] w-full max-w-xl overflow-y-auto shadow-2xl" role="dialog" aria-modal="true" aria-labelledby={titleId}><div className="flex items-center justify-between border-b border-slate-200 p-4"><h2 id={titleId} className="text-lg font-semibold">{title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label={`Close ${title}`}><X size={18}/></button></div><div className="p-4">{children}</div>{footer&&<div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-4">{footer}</div>}</div></div>
}
