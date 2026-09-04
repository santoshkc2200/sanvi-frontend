<script lang="ts">
/**
 * The campaign builder's stepper (phase 10, TASK-012): an ordered list of
 * steps where the current step is marked with `aria-current="step"`, past
 * steps are buttons (revisiting is free — values are kept), and future
 * steps are inert text (moving forward happens through the form's own
 * validation, never by clicking ahead).
 *
 * State is never colour-only: every step carries its number, its label,
 * and a visible state word; the screen-reader text spells the same out.
 */
interface StepLabels {
  /** Visible state word for a completed step. */
  complete?: string
  /** Visible state word for the step being viewed. */
  current?: string
  /** Visible state word for a step not yet reachable. */
  upcoming?: string
  /** Screen-reader-only step announcement: `"{step} of {count}"`. */
  stepOf?: (step: number, count: number) => string
}

interface Props {
  steps: { id: string; label: string }[]
  /** The `id` of the step being viewed. */
  current: string
  /** Called when a completed (or the current) step is activated. Forward jumps never fire. */
  onStepSelect?: (id: string) => void
  labels?: StepLabels
  class?: string
}

let { steps, current, onStepSelect, labels = {}, class: className = '' }: Props = $props()

const COPY: Required<Omit<StepLabels, 'stepOf'>> & { stepOf: NonNullable<StepLabels['stepOf']> } = {
  complete: 'Complete',
  current: 'Current step',
  upcoming: 'Not started',
  stepOf: (step, count) => `Step ${step} of ${count}`,
}

const display = $derived({
  complete: labels.complete ?? COPY.complete,
  current: labels.current ?? COPY.current,
  upcoming: labels.upcoming ?? COPY.upcoming,
  stepOf: labels.stepOf ?? COPY.stepOf,
})

const currentIndex = $derived(
  Math.max(
    0,
    steps.findIndex((step) => step.id === current),
  ),
)

type StepState = 'complete' | 'current' | 'upcoming'

function stateFor(index: number): StepState {
  if (index < currentIndex) return 'complete'
  if (index === currentIndex) return 'current'
  return 'upcoming'
}

function stateWord(state: StepState): string {
  return state === 'complete'
    ? display.complete
    : state === 'current'
      ? display.current
      : display.upcoming
}

function select(event: MouseEvent, id: string): void {
  event.preventDefault()
  onStepSelect?.(id)
}
</script>

<nav class="sanvi-stepper {className}" aria-label={display.stepOf(currentIndex + 1, steps.length)}>
  <ol class="sanvi-stepper__list">
    {#each steps as step, index (step.id)}
      {@const state = stateFor(index)}
      <li class="sanvi-stepper__item" aria-current={state === 'current' ? 'step' : undefined}>
        <span class="sanvi-stepper__state sanvi-stepper__state--{state}">{stateWord(state)}</span>
        {#if state === 'upcoming'}
          <span class="sanvi-stepper__step">
            <span class="sanvi-stepper__number" aria-hidden="true">{index + 1}</span>
            <span class="sanvi-stepper__label">{step.label}</span>
          </span>
        {:else}
          <a
            class="sanvi-stepper__step"
            href="#step-{step.id}"
            onclick={(event) => select(event, step.id)}
          >
            <span class="sanvi-stepper__number" aria-hidden="true">{index + 1}</span>
            <span class="sanvi-stepper__label">{step.label}</span>
            <span class="sanvi-visually-hidden">
              {display.stepOf(index + 1, steps.length)}
            </span>
          </a>
        {/if}
      </li>
    {/each}
  </ol>
</nav>

<style>
  .sanvi-stepper__list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sanvi-spacing-2) var(--sanvi-spacing-5);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .sanvi-stepper__item {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-stepper__state {
    font-size: var(--sanvi-font-size-xs);
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-stepper__state--current {
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-stepper__step {
    display: inline-flex;
    align-items: baseline;
    gap: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-primary);
    text-decoration: none;
  }

  a.sanvi-stepper__step:hover .sanvi-stepper__label {
    text-decoration: underline;
  }

  .sanvi-stepper__number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--sanvi-spacing-6);
    height: var(--sanvi-spacing-6);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-full);
    font-size: var(--sanvi-font-size-xs);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-stepper__item[aria-current='step'] .sanvi-stepper__number {
    border-color: var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-stepper__label {
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
</style>
