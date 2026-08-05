import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button, FileField, LoadingState, Modal } from '@/components/ui'
import { useResource } from '@/lib/use-resource'
import { ApiError } from '@/lib/api'
import {
  RECEIPT_ACCEPT,
  createPaymentIntent,
  failPaymentTransaction,
  getBankDetails,
  getPaymentSettings,
  initiateBankTransfer,
  receiptError,
  type Package,
} from '@/lib/crm/packages'
import { apiOrigin, isTrustedPaymentMessage, openCentered } from '@/lib/crm/payment-popup'
import { StripePayment } from '@/components/stripe-payment'

type Screen =
  | { kind: 'methods' }
  | { kind: 'bank' }
  | { kind: 'bank-sent' }
  | { kind: 'paypal'; transactionId: number; blockedUrl: string | null }
  | { kind: 'stripe'; transactionId: number; clientSecret: string; publishableKey: string }

/**
 * Best-effort release of one abandoned/orphaned intent. Fire-and-forget by
 * design — nothing on screen can react to this failing, so the rejection is
 * swallowed here instead of becoming an unhandled one.
 */
function releaseTransaction(id: number): void {
  void failPaymentTransaction(id).catch(() => {})
}

export function CheckoutDialog({
  pkg,
  onClose,
  onPurchased,
}: {
  pkg: Package
  onClose: () => void
  onPurchased: () => void
}) {
  const { t } = useI18n()
  const settings = useResource((signal) => getPaymentSettings(signal), [])
  const [screen, setScreen] = useState<Screen>({ kind: 'methods' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** Every intent this dialog has created that is neither paid nor released yet. */
  const pending = useRef<Set<number>>(new Set())
  /** Flipped false in the cleanup below, so a request that resolves after
   *  close (the cleanup already ran and will never see its id) can release
   *  itself immediately instead of leaking. */
  const mounted = useRef(true)
  const paypalWindow = useRef<Window | null>(null)

  // Closing without paying releases every still-pending transaction. Runs on
  // unmount, which is how every dismissal here ends.
  useEffect(() => {
    // Not a DOM ref: `pending`/`mounted` are plain mutable containers this
    // component owns, so reading `.current` at cleanup time is the point —
    // it must see every id added since mount, not a snapshot from render.
    return () => {
      mounted.current = false
      // eslint-disable-next-line react-hooks/exhaustive-deps
      pending.current.forEach(releaseTransaction)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      pending.current.clear()
    }
  }, [])

  const start = async (method: 'paypal' | 'stripe') => {
    if (busy) return // one intent per dialog: each call writes a PaymentTransaction
    setBusy(true)
    setError(null)
    try {
      const intent = await createPaymentIntent(pkg.id, method)

      if (!mounted.current) {
        // The dialog closed while this request was in flight. The unmount
        // cleanup already ran and will never see this id, so release it here
        // instead of orphaning it.
        releaseTransaction(intent.transactionId)
        return
      }
      pending.current.add(intent.transactionId)

      if (method === 'stripe') {
        const key = settings.status === 'ready' ? settings.data.stripeKey : null
        if (key === null || intent.clientSecret === null) {
          setError(t('checkout.noMethods'))
          return
        }
        setScreen({
          kind: 'stripe',
          transactionId: intent.transactionId,
          clientSecret: intent.clientSecret,
          publishableKey: key,
        })
        return
      }

      const url = intent.paypalUrl ?? ''
      const popup = openCentered(url, 'PayPal')
      paypalWindow.current = popup
      // No same-tab fallback: paypal.blade.php calls window.opener.postMessage,
      // and a same-tab redirect has no opener — the agent would land on a blank
      // page. Offer the link instead, which reopens with a user gesture.
      setScreen({ kind: 'paypal', transactionId: intent.transactionId, blockedUrl: popup === null ? url : null })
    } catch (caught: unknown) {
      setError(caught instanceof ApiError ? caught.message : t('error.generic'))
    } finally {
      setBusy(false)
    }
  }

  // PayPal returns through a postMessage from the API origin. Treated only as
  // "go refetch" — never as proof of payment.
  useEffect(() => {
    if (screen.kind !== 'paypal') return
    const trusted = apiOrigin()
    const { transactionId } = screen

    const onMessage = (event: MessageEvent) => {
      if (!isTrustedPaymentMessage({ origin: event.origin, data: event.data }, trusted)) return
      pending.current.delete(transactionId)
      onPurchased()
    }

    window.addEventListener('message', onMessage)

    // An agent who closes the PayPal window without paying sends no message and
    // would otherwise sit on "finish the payment" forever. Poll for it and fall
    // back to the method list, where they can pick again. This intent is
    // known-abandoned right here, so release it now rather than deferring to
    // unmount — otherwise a retry's intent would overwrite this one and only
    // the most recent attempt would ever get released.
    //
    // But paypal.blade.php's success view ALSO closes the popup itself right
    // after posting the message — every successful payment ends with
    // `closed === true` too, so this poll fires on both outcomes. The only way
    // to tell them apart from here is whether onMessage already claimed the
    // id: `Set.delete` returns false when it's already gone, which is exactly
    // "the success handler got here first, this is not an abandonment." Do
    // NOT remove this guard — without it a payment that completes just before
    // the popup auto-closes gets reported as failed for money the agent
    // actually paid.
    const poll = window.setInterval(() => {
      if (paypalWindow.current?.closed !== true) return
      window.clearInterval(poll)
      paypalWindow.current = null
      if (pending.current.delete(transactionId)) {
        releaseTransaction(transactionId)
        setScreen({ kind: 'methods' })
      }
    }, 500)

    return () => {
      window.removeEventListener('message', onMessage)
      window.clearInterval(poll)
    }
  }, [screen, onPurchased])

  const body = () => {
    if (settings.status === 'loading') return <LoadingState label={t('plan.loading')} />
    if (settings.status === 'error') {
      return (
        <p role="alert" className="text-sm text-error">
          {settings.message}
        </p>
      )
    }

    const methods = settings.data

    if (screen.kind === 'stripe') {
      return (
        <StripePayment
          publishableKey={screen.publishableKey}
          clientSecret={screen.clientSecret}
          onPaid={() => {
            pending.current.delete(screen.transactionId)
            onPurchased()
          }}
        />
      )
    }

    if (screen.kind === 'paypal') {
      return (
        <div className="grid gap-3">
          <p className="text-sm text-ink-2">{t('checkout.paypalWaiting')}</p>
          {screen.blockedUrl !== null && (
            <>
              <p role="alert" className="text-sm text-error">
                {t('checkout.popupBlocked')}
              </p>
              <a
                href={screen.blockedUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-accent underline"
              >
                {t('checkout.popupOpen')}
              </a>
            </>
          )}
        </div>
      )
    }

    if (screen.kind === 'bank-sent') {
      return (
        <p role="status" className="text-sm text-ink-2">
          {t('checkout.bankSent')}
        </p>
      )
    }

    if (screen.kind === 'bank') return <BankPanel pkg={pkg} onSent={() => setScreen({ kind: 'bank-sent' })} />

    const anyMethod = methods.bank || methods.paypal || methods.stripe
    if (!anyMethod) {
      return (
        <p role="alert" className="text-sm text-error">
          {t('checkout.noMethods')}
        </p>
      )
    }

    return (
      <div className="grid gap-2">
        <p className="text-sm text-ink-2">{t('checkout.method')}</p>
        {methods.bank && (
          <Button onClick={() => setScreen({ kind: 'bank' })}>{t('checkout.bank')}</Button>
        )}
        {methods.paypal && (
          <Button state={busy ? 'loading' : 'idle'} onClick={() => void start('paypal')}>
            {t('checkout.paypal')}
          </Button>
        )}
        {methods.stripe && (
          <Button state={busy ? 'loading' : 'idle'} onClick={() => void start('stripe')}>
            {t('checkout.stripe')}
          </Button>
        )}
        {error !== null && (
          <p role="alert" className="text-xs text-error">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <Modal
      title={t('checkout.title', { package: pkg.translated_name ?? pkg.name })}
      closeLabel={t('checkout.close')}
      onClose={onClose}
    >
      {body()}
    </Modal>
  )
}

function BankPanel({ pkg, onSent }: { pkg: Package; onSent: () => void }) {
  const { t } = useI18n()
  // Lazy on purpose: web-settings returns every public setting the platform
  // has, and only this panel needs it.
  const details = useResource((signal) => getBankDetails(signal), [])
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const send = async () => {
    const file = files[0]
    if (file === undefined) return

    const problem = receiptError(file)
    if (problem !== null) {
      setError(t(problem === 'tooLarge' ? 'checkout.receipt.tooLarge' : 'checkout.receipt.badType'))
      return
    }

    setSending(true)
    setError(null)
    try {
      await initiateBankTransfer(pkg.id, file)
      onSent()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('error.generic'))
      setSending(false)
    }
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium text-ink">{t('checkout.bankTitle')}</p>
      {details.status === 'ready' && (
        <dl className="grid gap-1.5">
          {details.data.map((row) => (
            <div key={row.title} className="flex justify-between gap-3 text-sm">
              <dt className="text-ink-2">{row.translated_title ?? row.title}</dt>
              <dd className="font-mono text-xs text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <FileField
        id="bank-receipt"
        label={t('checkout.bankReceipt')}
        accept={RECEIPT_ACCEPT}
        files={files}
        onChange={setFiles}
        helper={t('checkout.bankReceiptHelper')}
        error={error ?? undefined}
        state={error !== null ? 'error' : 'idle'}
        required
      />

      <Button
        variant="primary"
        state={sending ? 'loading' : 'idle'}
        disabled={files.length === 0}
        onClick={() => void send()}
      >
        {t('checkout.bankSend')}
      </Button>
    </div>
  )
}
