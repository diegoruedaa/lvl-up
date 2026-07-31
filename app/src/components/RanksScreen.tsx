import type { CharacterRow } from '../types/database'
import { RankPath, ScreenHeader } from './ui'

interface RanksScreenProps {
  character: CharacterRow
  onClose: () => void
}

export function RanksScreen({ character, onClose }: RanksScreenProps) {
  return (
    <div>
      <ScreenHeader title="Rangos" onBack={onClose} />

      <RankPath level={character.level} />
    </div>
  )
}
