import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useToast } from '@/lib/toast-context'
import { useResource } from '@/lib/use-resource'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  Select,
} from '@/components/ui'
import {
  canInvite,
  cancelInvitation,
  changeMemberRole,
  changeMemberStatus,
  exitMember,
  exitPreflight,
  exitReceivers,
  getAgency,
  holdsSomething,
  inviteMember,
  listInvitations,
  listMembers,
  seatsLabel,
  transferOwnership,
  type AgencyMember,
  type ExitPreflight,
} from '@/lib/crm/agency'

const ROLE_TONE = { owner: 'brand', admin: 'success', agent: 'neutral' } as const
const STATUS_TONE = { active: 'success', suspended: 'warning', ended: 'neutral' } as const

/**
 * El equipo de la agencia.
 *
 * El listado de miembros es SOLO DE ADMIN en el servidor, así que esta pantalla
 * se apoya en `role`/`is_admin` del perfil —la única lectura que un asesor
 * puede hacer— en vez de pedir el equipo y deducir el permiso de un 403.
 */
export function AgencyPage() {
  const { t, formatDate } = useI18n()
  const toast = useToast()
  const [nonce, setNonce] = useState(0)

  const profile = useResource((signal) => getAgency(signal), [nonce])
  const isAdmin = profile.status === 'ready' && profile.data.is_admin

  const roster = useResource(
    (signal) => (isAdmin ? listMembers({ limit: 100 }, signal) : Promise.resolve(null)),
    [isAdmin, nonce],
  )
  const invites = useResource(
    (signal) => (isAdmin ? listInvitations({ status: 'pending' }, signal) : Promise.resolve(null)),
    [isAdmin, nonce],
  )

  const reload = () => setNonce((n) => n + 1)

  const [exiting, setExiting] = useState<AgencyMember | null>(null)
  const [transferring, setTransferring] = useState<AgencyMember | null>(null)

  if (profile.status === 'loading') return <LoadingState label={t('agency.loading')} />
  if (profile.status === 'error') {
    return <ErrorState message={profile.message} onRetry={profile.reload} retryLabel={t('common.retry')} />
  }

  const { agency, seats_used, seats_limit } = profile.data
  const rosterData = roster.status === 'ready' ? roster.data : null
  // Solo el listado del equipo lo calcula, y solo un admin puede pedirlo. Para
  // un asesor no hay aviso que dar: no puede invitar de todas formas.
  const overCapacity = rosterData?.over_capacity ?? false

  /**
   * Cualquier acción sobre un miembro: recarga en silencio y, si falla, enseña
   * el mensaje del servidor. No hay toast de éxito porque no hay API para uno
   * (ToastApi solo expone `fail`): la fila cambiando ES la confirmación.
   */
  const run = async (action: () => Promise<void>) => {
    try {
      await action()
      reload()
    } catch (caught: unknown) {
      // El mensaje del servidor, no uno genérico: las reglas de plazas y de
      // plan viajan en él y si se sustituyen por "algo salió mal" se vuelven
      // invisibles.
      toast.fail(caught instanceof Error ? caught.message : t('error.generic'))
    }
  }

  return (
    <div>
      <PageHeader
        title={t('agency.title')}
        subtitle={agency.name}
        actions={
          <span className="text-sm text-muted">
            {t('agency.seats')}: {seatsLabel(seats_used, seats_limit)}
          </span>
        }
      />

      {overCapacity && (
        <Card className="mb-4 border-warn/40 bg-warn/5 p-3 text-sm text-ink-2">
          {t('agency.overCapacity')}
        </Card>
      )}

      {!isAdmin ? (
        <EmptyState title={t('agency.memberOnly')} hint={t('agency.memberOnlyHint')} />
      ) : (
        <>
          <InviteBox
            disabled={!canInvite({ seats_used, seats_limit, over_capacity: overCapacity })}
            onInvited={reload}
          />

          {roster.status === 'loading' && <LoadingState label={t('agency.loading')} />}
          {roster.status === 'error' && (
            <ErrorState message={roster.message} onRetry={roster.reload} retryLabel={t('common.retry')} />
          )}

          {rosterData !== null && (
            <Card className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-rule text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">{t('agency.col.member')}</th>
                    <th className="px-3 py-2">{t('agency.col.role')}</th>
                    <th className="px-3 py-2">{t('agency.col.status')}</th>
                    <th className="px-3 py-2">{t('agency.col.joined')}</th>
                    <th className="px-3 py-2">{t('agency.col.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rosterData.members.map((member) => (
                    <tr key={member.id} className="border-b border-rule/60 last:border-0">
                      <td className="px-3 py-2">
                        <div className="text-ink">{member.name ?? '—'}</div>
                        <div className="text-xs text-muted">{member.email ?? member.mobile ?? ''}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={ROLE_TONE[member.role]}>{t(`agency.role.${member.role}`)}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={STATUS_TONE[member.status]}>{t(`agency.status.${member.status}`)}</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {member.joined_at === null ? '—' : formatDate(member.joined_at)}
                      </td>
                      <td className="px-3 py-2">
                        <MemberActions
                          member={member}
                          onRole={(role) =>
                            void run(() => changeMemberRole(member.id, role))
                          }
                          onStatus={(status) =>
                            void run(() => changeMemberStatus(member.id, status))
                          }
                          onTransfer={() => setTransferring(member)}
                          onExit={() => setExiting(member)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {invites.status === 'ready' && invites.data !== null && invites.data.invitations.length > 0 && (
            <Card className="mt-4 p-3">
              <h2 className="mb-2 text-sm font-semibold text-ink">{t('agency.pendingInvites')}</h2>
              <ul className="space-y-1 text-sm">
                {invites.data.invitations.map((invitation) => (
                  <li key={invitation.id} className="flex items-center justify-between gap-2">
                    <span className="text-ink-2">
                      {invitation.email ?? invitation.phone} · {t(`agency.role.${invitation.role}`)}
                      {!invitation.is_open && <> · {t('agency.inviteExpired')}</>}
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        void run(() => cancelInvitation(invitation.id))
                      }
                    >
                      {t('agency.cancelInvite')}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {transferring !== null && (
        <TransferDialog
          member={transferring}
          onClose={() => setTransferring(null)}
          onConfirm={() => {
            const member = transferring
            setTransferring(null)
            void run(() => transferOwnership(member.id))
          }}
        />
      )}

      {exiting !== null && rosterData !== null && (
        <ExitDialog
          member={exiting}
          colleagues={exitReceivers(rosterData.members, exiting.id)}
          onClose={() => setExiting(null)}
          onConfirm={(toCustomerId) => {
            const member = exiting
            setExiting(null)
            void run(() => exitMember(member.id, toCustomerId))
          }}
        />
      )}
    </div>
  )
}

function MemberActions({
  member,
  onRole,
  onStatus,
  onTransfer,
  onExit,
}: {
  member: AgencyMember
  onRole: (role: 'admin' | 'agent') => void
  onStatus: (status: 'active' | 'suspended') => void
  onTransfer: () => void
  onExit: () => void
}) {
  const { t } = useI18n()

  // El propietario no admite ninguna de estas: no se le cambia el rol, no se le
  // suspende y no puede salirse sin traspasar antes. El servidor lo rechaza
  // igualmente; esto es para no ofrecer botones que solo dan error.
  if (member.role === 'owner') return <span className="text-xs text-muted">—</span>

  return (
    <div className="flex flex-wrap gap-1">
      <Button variant="ghost" onClick={() => onRole(member.role === 'admin' ? 'agent' : 'admin')}>
        {member.role === 'admin' ? t('agency.demote') : t('agency.promote')}
      </Button>
      <Button
        variant="ghost"
        onClick={() => onStatus(member.status === 'suspended' ? 'active' : 'suspended')}
      >
        {member.status === 'suspended' ? t('agency.reactivate') : t('agency.suspend')}
      </Button>
      <Button variant="ghost" onClick={onTransfer}>
        {t('agency.transfer')}
      </Button>
      <Button variant="ghost" onClick={onExit}>
        {t('agency.exit')}
      </Button>
    </div>
  )
}

/** Email O teléfono, nunca los dos: mandar ambos es un 422 del servidor. */
function InviteBox({ disabled, onInvited }: { disabled: boolean; onInvited: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [contact, setContact] = useState('')
  const [role, setRole] = useState<'admin' | 'agent'>('agent')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const value = contact.trim()
    if (value === '') return

    setBusy(true)
    try {
      const created = await inviteMember(
        value.includes('@') ? { email: value, role } : { phone: value, role },
      )
      setContact('')
      // El enlace se ve UNA vez: en la base solo queda su hash, así que no hay
      // forma de recuperarlo después. Si se pierde, se cancela y se rehace —
      // por eso se copia al portapapeles en el acto en vez de confiar en que
      // alguien lo lea de un aviso que se cierra solo.
      await navigator.clipboard?.writeText(created.invite_url).catch(() => undefined)
      onInvited()
    } catch (caught: unknown) {
      toast.fail(caught instanceof Error ? caught.message : t('error.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <Field
          id="invite-contact"
          label={t('agency.inviteContact')}
          value={contact}
          onChange={setContact}
          disabled={disabled}
          helper={t('agency.inviteContactHelp')}
        />
        <Select
          id="invite-role"
          label={t('agency.col.role')}
          value={role}
          onChange={(next) => setRole(next === 'admin' ? 'admin' : 'agent')}
          disabled={disabled}
          options={[
            { value: 'agent', label: t('agency.role.agent') },
            { value: 'admin', label: t('agency.role.admin') },
          ]}
        />
        <Button
          variant="primary"
          state={busy ? 'loading' : 'idle'}
          disabled={disabled || contact.trim() === ''}
          onClick={() => void submit()}
        >
          {t('agency.invite')}
        </Button>
      </div>
      {disabled && <p className="mt-2 text-xs text-muted">{t('agency.noSeats')}</p>}
    </Card>
  )
}

function TransferDialog({
  member,
  onClose,
  onConfirm,
}: {
  member: AgencyMember
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useI18n()
  // Confirmación fuerte: desde quien la entrega, el traspaso no tiene vuelta.
  const [typed, setTyped] = useState('')
  const expected = member.name ?? ''

  return (
    <Modal
      title={t('agency.transferTitle')}
      closeLabel={t('common.close')}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={typed.trim() !== expected} onClick={onConfirm}>
            {t('agency.transferConfirm')}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-ink-2">{t('agency.transferWarning')}</p>
      <div className="mt-3">
        <Field
          id="transfer-confirm"
          label={t('agency.transferType', { name: expected })}
          value={typed}
          onChange={setTyped}
        />
      </div>
    </Modal>
  )
}

/**
 * Dos pasos porque el servidor son dos endpoints: primero se cuenta lo que la
 * persona todavía lleva, luego se fusiona con la cartera de un colega. La
 * fusión no tiene vuelta atrás, así que las cifras se enseñan ANTES de
 * confirmar.
 */
function ExitDialog({
  member,
  colleagues,
  onClose,
  onConfirm,
}: {
  member: AgencyMember
  colleagues: AgencyMember[]
  onClose: () => void
  onConfirm: (toCustomerId: number) => void
}) {
  const { t } = useI18n()
  const preflight = useResource((signal) => exitPreflight(member.id, signal), [member.id])
  const [receiver, setReceiver] = useState('')

  useEffect(() => {
    if (receiver === '' && colleagues.length > 0) setReceiver(String(colleagues[0]!.customer_id))
  }, [colleagues, receiver])

  const counts: [keyof ExitPreflight, string][] = [
    ['properties', t('agency.exit.properties')],
    ['projects', t('agency.exit.projects')],
    ['open_leads', t('agency.exit.leads')],
    ['contacts', t('agency.exit.contacts')],
    ['open_tasks', t('agency.exit.tasks')],
  ]

  return (
    <Modal
      title={t('agency.exitTitle', { name: member.name ?? '' })}
      closeLabel={t('common.close')}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            disabled={receiver === '' || preflight.status !== 'ready'}
            onClick={() => onConfirm(Number(receiver))}
          >
            {t('agency.exitConfirm')}
          </Button>
        </div>
      }
    >
      {preflight.status === 'loading' && <LoadingState label={t('agency.loading')} />}
      {preflight.status === 'error' && (
        <ErrorState
          message={preflight.message}
          onRetry={preflight.reload}
          retryLabel={t('common.retry')}
        />
      )}

      {preflight.status === 'ready' && (
        <>
          {holdsSomething(preflight.data) ? (
            <>
              <p className="text-sm text-ink-2">{t('agency.exitWarning')}</p>
              <ul className="mt-2 space-y-1 text-sm text-ink-2">
                {counts
                  .filter(([key]) => preflight.data[key] > 0)
                  .map(([key, label]) => (
                    <li key={key}>
                      {preflight.data[key]} {label}
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-ink-2">{t('agency.exitNothing')}</p>
          )}

          <div className="mt-3">
            {colleagues.length === 0 ? (
              <p className="text-sm text-muted">{t('agency.exitNoReceiver')}</p>
            ) : (
              <Select
                id="exit-receiver"
                label={t('agency.exitReceiver')}
                value={receiver}
                onChange={setReceiver}
                options={colleagues.map((colleague) => ({
                  value: String(colleague.customer_id),
                  label: colleague.name ?? String(colleague.customer_id),
                }))}
              />
            )}
          </div>
        </>
      )}
    </Modal>
  )
}
