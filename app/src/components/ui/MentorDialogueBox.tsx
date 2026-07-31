import type { ReactNode } from 'react'

interface MentorDialogueBoxProps {
  children: ReactNode
}

/** Cuadro de diálogo del mentor del tutorial (JRPG clásico): mismo patrón que
 * MerchantDialogueBox (retrato fijo + colita apuntando a lo que hay debajo), pero con acento
 * verde musgo (--color-accent) en vez del dorado del mercader, para no confundir "mentor
 * enseñando" con "mercader vendiendo". El texto puede incluir énfasis (p.ej. XP ganada en
 * negrita), así que a diferencia de MerchantDialogueBox recibe children en vez de un string. */
export function MentorDialogueBox({ children }: MentorDialogueBoxProps) {
  return (
    <div className="mentor-dialogue">
      <img className="mentor-dialogue__portrait" src="/ilustraciones/mentor.png" alt="" />
      <div className="mentor-dialogue__text">{children}</div>
    </div>
  )
}
