interface ScreenHeaderProps {
  title: string
  onBack: () => void
}

/** Cabecera de las pantallas secundarias (Rangos/Logros/Historial): título centrado y flecha de
 * "volver" discreta en la esquina, en vez del botón grande de antes — el peso visual de un botón
 * no aporta nada aquí porque estas pantallas solo tienen una salida posible. */
export function ScreenHeader({ title, onBack }: ScreenHeaderProps) {
  return (
    <div className="screen-header">
      <button className="screen-header__back" onClick={onBack} aria-label="Volver">
        <span aria-hidden="true">←</span>
      </button>
      <h2 className="screen-header__title">{title}</h2>
    </div>
  )
}
