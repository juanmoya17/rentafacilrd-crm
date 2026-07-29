import { motion } from 'motion/react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n/context'
import { Card, PageHeader } from '@/components/ui'
import { FactList, RecordSectionHead } from '@/components/record'
import { LanguageSwitcher } from '@/components/language-switcher'
import { useRowReveal } from '@/lib/motion'

export function SettingsPage() {
  const { state } = useAuth()
  const { t } = useI18n()
  const reveal = useRowReveal()
  if (state.status !== 'authenticated') return null

  const profile = [
    { label: t('settings.name'), value: state.user.name },
    { label: t('auth.email'), value: state.user.email },
    { label: t('settings.agentId'), value: String(state.user.id), numeric: true },
  ]

  return (
    <>
      <PageHeader title={t('settings.title')} />

      {/* Preferences is the one family with no data density to serve, so it is
          the one place the measure is held to reading width rather than filled. */}
      <div className="grid max-w-2xl gap-6">
        <motion.section {...reveal(0)}>
          <RecordSectionHead label={t('settings.profile')} />
          <Card className="p-4">
            <FactList facts={profile} />
          </Card>
        </motion.section>

        <motion.section {...reveal(1)}>
          <RecordSectionHead label={t('settings.language')} />
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-muted">{t('language.label')}</p>
            <LanguageSwitcher />
          </Card>
        </motion.section>

        <motion.section {...reveal(2)}>
          <RecordSectionHead label={t('settings.session')} />
          <Card className="p-4">
            <p className="max-w-prose text-sm text-ink-2">{t('settings.sessionNote')}</p>
          </Card>
        </motion.section>
      </div>
    </>
  )
}
