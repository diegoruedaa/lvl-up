import { useState } from 'react'
import type { BossType } from 'rules-engine'
import { coinsForBossVictory, damageForBossDefeat } from 'rules-engine'
import { getErrorMessage } from '../lib/errors'
import type { GameState } from '../lib/gameApi'
import { isBossAlreadyResolvedError, resolveBossDefeat, resolveBossVictory } from '../lib/gameApi'
import type { BossDefeatAliveOutcome, BossVictoryOutcome } from '../lib/gameApi'
import {
  ATTRIBUTE_LABELS,
  BOSS_DIFFICULTY_LABELS,
  attributeSummaryText,
  bossIllustration,
  playerIllustration,
} from '../types/database'
import type { MissionRow, PlayerCharacter } from '../types/database'
import { BattleHex, Button, DefeatedFace, PersonSilhouette } from './ui'

interface BossBattleScreenProps {
  mission: MissionRow
  userId: string
  gameState: GameState
  celestialHandActive: boolean
  /** Personaje elegido por la cuenta (backend/022_player_character.sql); null si aún no ha elegido, en cuyo caso se mantiene el PersonSilhouette genérico. */
  playerCharacter: PlayerCharacter | null
  onVictory: (outcome: BossVictoryOutcome) => void
  onDefeatAlive: (outcome: BossDefeatAliveOutcome) => void
  onDefeatDead: (newGameState: GameState) => void
  /** Se llama cuando el servidor rechaza "Confirmar" porque esta batalla ya se había resuelto antes (LV002, isBossAlreadyResolvedError) — p.ej. se reabrió esta pantalla tras cambiar de pestaña sin pulsar "Continuar" la vez anterior. A diferencia de onClose, no cierra la pantalla al instante: solo corrige la lista de Batallas pendientes en el padre, dejando visible el mensaje de error para que el usuario decida cuándo salir. */
  onAlreadyResolved: () => void
  onClose: () => void
}

type PendingChoice = 'victory' | 'defeat' | null

type BattleResult = { kind: 'victory'; outcome: BossVictoryOutcome } | { kind: 'defeat'; outcome: BossDefeatAliveOutcome } | null

/**
 * Pantalla "Batalla contra Boss" (documento 7.5 y 16.8): sin margen de deshacer, la confirmación
 * aquí hace ese papel. resolveBossVictory/resolveBossDefeat se llaman exactamente en el mismo punto
 * de siempre (justo tras "Confirmar"); lo único nuevo es que el resultado ya resuelto se guarda en
 * `result` y se muestra una pantalla de resultado antes de avisar al padre — "Continuar" es quien
 * dispara onVictory/onDefeatAlive, que es el mismo cierre (setBattlingMission(null) en
 * Dashboard.tsx) que existía antes justo después de confirmar. El caso 'dead' (el personaje muere)
 * no pasa por esta pantalla de resultado: conserva su cierre instantáneo de siempre, con el aviso
 * de "Has muerto" que ya vive en Dashboard.tsx.
 */
export function BossBattleScreen({
  mission,
  userId,
  gameState,
  celestialHandActive,
  playerCharacter,
  onVictory,
  onDefeatAlive,
  onDefeatDead,
  onAlreadyResolved,
  onClose,
}: BossBattleScreenProps) {
  const [pending, setPending] = useState<PendingChoice>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BattleResult>(null)

  async function handleConfirm() {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      if (pending === 'victory') {
        const outcome = await resolveBossVictory(
          mission,
          gameState.character,
          gameState.attributeProgress,
          gameState.adventureRun.id,
        )
        // resolveBossVictory ya dejó todo escrito en BD (mission.status +
        // consecuencias, en una sola transacción vía resolve_boss_victory):
        // el padre debe reflejarlo ya mismo, no esperar a "Continuar" —
        // así "Batallas pendientes" se actualiza aunque el usuario abandone
        // esta pantalla sin pulsar ese botón.
        onVictory(outcome)
        setResult({ kind: 'victory', outcome })
      } else {
        const outcome = await resolveBossDefeat(userId, gameState, mission)
        if (outcome.type === 'dead') {
          onDefeatDead(outcome.newGameState)
        } else {
          onDefeatAlive(outcome)
          setResult({ kind: 'defeat', outcome })
        }
      }
    } catch (err) {
      const supabaseError =
        typeof err === 'object' && err !== null ? (err as { code?: string | null; message?: string | null }) : null

      if (supabaseError && isBossAlreadyResolvedError(supabaseError)) {
        onAlreadyResolved()
        setError(
          'Esta batalla ya se había resuelto antes (probablemente al confirmar el resultado sin pulsar "Continuar" la vez anterior). Vuelve a la lista de Batallas pendientes.',
        )
        setBusy(false)
        return
      }

      setError(getErrorMessage(err))
      setBusy(false)
    }
  }

  const bossType = mission.difficulty as BossType
  const playerDefeated = result?.kind === 'defeat'

  // A diferencia del Boss (bossImageVariant, invertido), la variante del jugador es directa: es su
  // propia ilustración, así que gana -> _victoria (él celebrando), pierde -> _derrota (él derrotado).
  const playerImageVariant = result === null ? 'neutral' : result.kind === 'victory' ? 'victoria' : 'derrota'

  const playerHex = (
    <div className="boss-arena__side">
      <div className="boss-arena__side-visual">
        {playerCharacter ? (
          <img
            className="boss-arena__player-image"
            src={playerIllustration(playerCharacter, playerImageVariant)}
            alt=""
          />
        ) : (
          <BattleHex
            icon={playerDefeated ? <DefeatedFace /> : <PersonSilhouette />}
            size={76}
            fillColor="var(--color-border)"
            iconColor="var(--color-text)"
            defeated={playerDefeated}
          />
        )}
      </div>
      <span className="boss-arena__side-label">Tú</span>
    </div>
  )

  // Los archivos _victoria/_derrota nombran el resultado de la Batalla tal como se declara (el
  // mismo texto del sello Victoria/Derrota), no el resultado desde el punto de vista del Boss:
  // _derrota.png es el Boss celebrando (se usa en la Derrota del jugador) y _victoria.png es el
  // Boss aturdido (se usa en la Victoria del jugador).
  const bossImageVariant = result === null ? 'neutral' : result.kind === 'victory' ? 'victoria' : 'derrota'

  const bossHex = (
    <div className="boss-arena__side">
      <div className="boss-arena__side-visual">
        <img
          className="boss-arena__boss-image"
          src={bossIllustration(mission.primary_attribute, bossImageVariant)}
          alt=""
        />
      </div>
      <span className="boss-arena__side-label">Boss</span>
    </div>
  )

  if (result) {
    return (
      <div className="boss-arena">
        <div className="boss-arena__combatants">
          {playerHex}
          {bossHex}
        </div>

        <span className={`boss-arena__stamp boss-arena__stamp--${result.kind}`}>
          {result.kind === 'victory' ? 'Victoria' : 'Derrota'}
        </span>

        <h2 className="boss-arena__name">{mission.name}</h2>

        <div className="boss-arena__breakdown">
          {result.kind === 'victory' ? (
            <>
              <p className="boss-arena__breakdown-line">
                +{result.outcome.xpGained.general} XP general · +{result.outcome.xpGained.primary} XP{' '}
                {ATTRIBUTE_LABELS[mission.primary_attribute]}
                {result.outcome.xpGained.secondary !== null && mission.secondary_attribute && (
                  <>
                    {' '}
                    · +{result.outcome.xpGained.secondary} XP {ATTRIBUTE_LABELS[mission.secondary_attribute]}
                  </>
                )}
              </p>
              <p className="boss-arena__breakdown-line boss-arena__breakdown-coins">
                +{coinsForBossVictory(bossType)} monedas
              </p>
            </>
          ) : (
            <>
              <p className="boss-arena__breakdown-line">-{damageForBossDefeat(result.outcome.celestialHandConsumed)} HP</p>
              {result.outcome.celestialHandConsumed && (
                <p className="boss-arena__breakdown-line">Se consumió tu Mano Celestial.</p>
              )}
              {result.outcome.totemItem && (
                <p className="boss-arena__breakdown-line">
                  El Tótem de la Inmortalidad te salvó al perder contra el Boss "{mission.name}".
                </p>
              )}
            </>
          )}
        </div>

        {/* Las consecuencias (XP/monedas/daño) y mission.status ya se aplicaron atómicamente al
            pulsar "Confirmar" (handleConfirm -> onVictory/onDefeatAlive); este botón es puro cierre
            de pantalla, sin ninguna lógica de negocio pendiente. */}
        <Button variant="primary" onClick={onClose}>
          Continuar
        </Button>
      </div>
    )
  }

  return (
    <div className="boss-arena">
      <span className="boss-arena__badge">Batalla contra Boss</span>

      <div className="boss-arena__combatants">
        {playerHex}
        <span className="boss-arena__vs">VS</span>
        {bossHex}
      </div>

      <h2 className="boss-arena__name">{mission.name}</h2>
      <span className="boss-arena__difficulty-badge">{BOSS_DIFFICULTY_LABELS[bossType]}</span>
      <p className="boss-arena__attrs">{attributeSummaryText(mission)}</p>
      {mission.description && <p className="boss-arena__description">{mission.description}</p>}

      {celestialHandActive && <p className="boss-arena__note">🖐️ Mano Celestial activada</p>}

      {error && <p className="boss-arena__error">{error}</p>}

      {pending === null ? (
        <>
          <div className="boss-arena__actions">
            <Button variant="primary" onClick={() => setPending('victory')} disabled={busy}>
              Victoria
            </Button>
            <Button variant="danger" onClick={() => setPending('defeat')} disabled={busy}>
              Derrota
            </Button>
          </div>
          <button type="button" className="boss-arena__cancel" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
        </>
      ) : (
        <>
          <p className="boss-arena__confirm-text">
            ¿Confirmas {pending === 'victory' ? 'la Victoria' : 'la Derrota'}? No se puede deshacer.
          </p>
          <div className="boss-arena__actions">
            <Button variant={pending === 'victory' ? 'primary' : 'danger'} onClick={handleConfirm} disabled={busy}>
              Confirmar
            </Button>
            <Button variant="secondary" onClick={() => setPending(null)} disabled={busy}>
              Volver
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
