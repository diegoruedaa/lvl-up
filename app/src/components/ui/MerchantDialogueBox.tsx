interface MerchantDialogueBoxProps {
  line: string
}

/** Cuadro de diálogo de NPC de tienda (JRPG clásico): retrato fijo + una frase, con una colita
 * apuntando hacia la lista de objetos de debajo. El Mercado decide qué frase pasar (bienvenida,
 * "no te llegan las monedas", agradecimiento tras comprar); este componente solo la muestra. */
export function MerchantDialogueBox({ line }: MerchantDialogueBoxProps) {
  return (
    <div className="merchant-dialogue">
      <img className="merchant-dialogue__portrait" src="/ilustraciones/mercader.png" alt="" />
      <p className="merchant-dialogue__text">{line}</p>
    </div>
  )
}
