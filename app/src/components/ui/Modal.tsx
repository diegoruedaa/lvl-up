import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Overlay fixed + backdrop mínimo para editar contenido sin abandonar la pantalla actual (p.ej.
 * "Editar" sobre una MissionCard). Cierra con Escape o clic en el backdrop; un clic dentro del
 * panel no se propaga, para no cerrarlo por accidente al interactuar con el formulario. */
export function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-panel__header">
          <h3 className="modal-panel__title">{title}</h3>
          <button type="button" className="modal-panel__close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="modal-panel__body">{children}</div>
      </div>
    </div>
  )
}
