import { useId } from 'react'
import type { ReactNode } from 'react'

/** Vértices de un hexágono regular "de punta arriba" (mismo estilo que .attr-hex de la tarjeta de
 * misión) centrado en (cx,cy) con radio r, como string de puntos para <polygon>. */
function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 90)
    const x = cx + r * Math.cos(angle)
    const y = cy + r * Math.sin(angle)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

const VIEW_BOX = 120
const CENTER = VIEW_BOX / 2
const OUTER_R = 46
const INNER_R = 38
const MAJOR_RING_R = 54
const LEGENDARY_RING_R = 58

interface BattleHexProps {
  /** Emoji/SVG a centrar sobre el marco. Ignorado si se pasa `image`. */
  icon?: ReactNode
  /** Ilustración a recortar dentro del hexágono interior (ver bossIllustration). Tiene prioridad sobre `icon`. */
  image?: string
  size: number
  fillColor: string
  iconColor: string
  /** Nivel de amenaza del Boss (ver BOSS_DIFFICULTY_RING); el jugador no lleva anillo. */
  ring?: 'none' | 'major' | 'legendary'
  /** Bando derrotado: hexágono atenuado, el icono normal debe sustituirse por <DefeatedFace />. */
  defeated?: boolean
}

/** Hexágono de doble borde de la Batalla contra Boss (jugador o Boss): mismo lenguaje visual que
 * .attr-hex de la tarjeta de misión (contorno exterior grueso oscuro + interior fino dorado), pero
 * con el relleno coloreado (por atributo en el Boss, neutro en el jugador) y, opcionalmente, uno o
 * dos anillos dorados adicionales fuera del hexágono para representar el nivel de amenaza.
 *
 * Cuando se pasa `image`, se recorta (clipPath) al hexágono interior y se dibuja entre el borde
 * exterior y el anillo dorado interior, de forma que el marco/anillos de amenaza quedan intactos y
 * solo cambia lo que hay dentro. */
export function BattleHex({ icon, image, size, fillColor, iconColor, ring = 'none', defeated = false }: BattleHexProps) {
  // useId() incluye ':' (p.ej. ":r0:"), inválido dentro de un url(#...) — se elimina.
  const clipId = `battle-hex-clip-${useId().replace(/:/g, '')}`
  return (
    <span
      className={`battle-hex${defeated ? ' battle-hex--defeated' : ''}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`} className="battle-hex__svg" aria-hidden="true">
        {ring === 'legendary' && (
          <polygon className="battle-hex__ring battle-hex__ring--outer" points={hexPoints(CENTER, CENTER, LEGENDARY_RING_R)} />
        )}
        {(ring === 'major' || ring === 'legendary') && (
          <polygon className="battle-hex__ring" points={hexPoints(CENTER, CENTER, MAJOR_RING_R)} />
        )}
        <polygon className="battle-hex__outer" style={{ fill: fillColor }} points={hexPoints(CENTER, CENTER, OUTER_R)} />
        {image && (
          <>
            <defs>
              <clipPath id={clipId}>
                <polygon points={hexPoints(CENTER, CENTER, INNER_R)} />
              </clipPath>
            </defs>
            <image
              href={image}
              x={0}
              y={0}
              width={VIEW_BOX}
              height={VIEW_BOX}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${clipId})`}
            />
          </>
        )}
        <polygon className="battle-hex__inner" points={hexPoints(CENTER, CENTER, INNER_R)} />
      </svg>
      {!image && (
        <span className="battle-hex__icon" style={{ color: iconColor }}>
          {icon}
        </span>
      )}
    </span>
  )
}

/** Silueta genérica del jugador (círculo + hombros): no depende de atributo, a diferencia del
 * icono del Boss (ATTRIBUTE_ICONS). Relleno con currentColor para heredar iconColor de BattleHex. */
export function PersonSilhouette() {
  return (
    <svg viewBox="0 0 24 24" className="battle-hex__person" aria-hidden="true">
      <circle cx="12" cy="8" r="5" fill="currentColor" />
      <path d="M3 21c0-5 4-8 9-8s9 3 9 8z" fill="currentColor" />
    </svg>
  )
}

/** Gesto de "derrotado" (ojos en X + boca plana) que sustituye al icono normal del bando
 * perdedor en la pantalla de resultado. Trazo con currentColor para heredar iconColor. */
export function DefeatedFace() {
  return (
    <svg viewBox="0 0 64 36" className="battle-hex__defeated-face" aria-hidden="true">
      <path d="M8 6 L20 18 M20 6 L8 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M44 6 L56 18 M56 6 L44 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 29 Q32 20 50 29" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
