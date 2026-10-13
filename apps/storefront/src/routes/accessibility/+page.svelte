<script lang="ts">
import { t } from '@sanvi/i18n'
import { Container, Stack } from '@sanvi/ui'

const COPY = $derived({
  title: t['a11y.statement.title'](),
  updated: t['a11y.statement.updated'](),
  intro: t['a11y.statement.intro'](),
  standard: t['a11y.statement.standard'](),
  methodTitle: t['a11y.statement.methodTitle'](),
  automated: t['a11y.statement.methodAutomated'](),
  keyboard: t['a11y.statement.methodKeyboard'](),
  layout: t['a11y.statement.methodLayout'](),
  gapsTitle: t['a11y.statement.gapsTitle'](),
  gapAudit: t['a11y.statement.gapAudit'](),
  gapScreenReaders: t['a11y.statement.gapScreenReaders'](),
  feedbackTitle: t['a11y.statement.feedbackTitle'](),
  feedback: t['a11y.statement.feedback'](),
})
</script>

<svelte:head>
  <title>{COPY.title}</title>
</svelte:head>

<Container size="md" padding="6">
  <Stack gap="5">
    <h1>{COPY.title}</h1>
    <p>{COPY.updated}</p>
    <p>{COPY.intro}</p>
    <p>{COPY.standard}</p>

    <h2>{COPY.methodTitle}</h2>
    <ul>
      <li>{COPY.automated}</li>
      <li>{COPY.keyboard}</li>
      <li>{COPY.layout}</li>
    </ul>

    <h2>{COPY.gapsTitle}</h2>
    <ul>
      <li>{COPY.gapAudit}</li>
      <li>{COPY.gapScreenReaders}</li>
    </ul>

    <h2>{COPY.feedbackTitle}</h2>
    <p>{COPY.feedback}</p>
  </Stack>
</Container>
