import { useEffect, useState } from 'react'
import type { Stripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useI18n } from '@/lib/i18n/context'
import { Button, ErrorState } from '@/components/ui'
import { stripeFor } from '@/lib/crm/stripe-loader'

function CardForm({ onPaid }: { onPaid: () => void }) {
  const { t } = useI18n()
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)

  const submit = async () => {
    if (stripe === null || elements === null) return
    setPaying(true)
    setError(null)

    try {
      // 'if_required' keeps a card that needs no 3DS inside the SPA; only a
      // challenge sends the agent to return_url and back.
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: `${window.location.origin}/plan` },
        redirect: 'if_required',
      })

      if (result.error !== undefined) {
        // Stripe's own wording names the actual decline reason.
        setError(result.error.message ?? t('error.generic'))
        setPaying(false)
        // The transaction stays pending server-side until the agent retries or
        // closes; only an abandoned dialog marks it failed.
        return
      }

      onPaid()
    } catch {
      // confirmPayment is documented to resolve rather than reject, even for
      // a decline — this only catches the unexpected case (e.g. the network
      // drops mid-confirm). Without it `paying` would stick true forever with
      // nothing on screen the agent can act on, since `void submit()` at the
      // call site discards the rejection.
      setError(t('error.generic'))
      setPaying(false)
    }
  }

  return (
    <div className="grid gap-3">
      <PaymentElement />
      {error !== null && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
      <Button
        variant="primary"
        state={paying ? 'loading' : 'idle'}
        onClick={() => void submit()}
      >
        {t(paying ? 'checkout.paying' : 'checkout.pay')}
      </Button>
    </div>
  )
}

export function StripePayment({
  publishableKey,
  clientSecret,
  onPaid,
}: {
  publishableKey: string
  clientSecret: string
  onPaid: () => void
}) {
  const { t } = useI18n()
  const [stripe, setStripe] = useState<Stripe | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  // Bumped by the retry button to re-run the effect below. stripeFor() itself
  // already evicts a rejected load from its cache, so this genuinely retries
  // instead of replaying the same dead promise.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoadFailed(false)

    // Resolved here, not handed to <Elements> as a promise: react-stripe-js's
    // own internal .then() chains on that prop carry no .catch, so a
    // rejecting promise would surface as an unhandled rejection there. Await
    // it ourselves and pass only the settled value down.
    stripeFor(publishableKey).then(
      (result) => {
        if (!cancelled) setStripe(result)
      },
      () => {
        if (!cancelled) setLoadFailed(true)
      },
    )

    return () => {
      cancelled = true
    }
  }, [publishableKey, attempt])

  if (loadFailed) {
    return (
      <ErrorState
        message={t('error.generic')}
        retryLabel={t('common.retry')}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    )
  }

  // Sub-second gap while the script loads (or resolves from cache); nothing
  // to render until it settles one way or the other.
  if (stripe === null) return null

  return (
    <Elements stripe={stripe} options={{ clientSecret }}>
      <CardForm onPaid={onPaid} />
    </Elements>
  )
}
