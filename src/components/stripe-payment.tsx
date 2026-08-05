import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui'

/**
 * Stripe's JS must come from js.stripe.com and can never be bundled, which is
 * what loadStripe() exists for. Cached per publishable key so re-opening the
 * dialog does not re-fetch the script.
 */
const stripeCache = new Map<string, ReturnType<typeof loadStripe>>()

function stripeFor(publishableKey: string): ReturnType<typeof loadStripe> {
  const cached = stripeCache.get(publishableKey)
  if (cached !== undefined) return cached
  const created = loadStripe(publishableKey)
  stripeCache.set(publishableKey, created)
  return created
}

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
  return (
    <Elements stripe={stripeFor(publishableKey)} options={{ clientSecret }}>
      <CardForm onPaid={onPaid} />
    </Elements>
  )
}
