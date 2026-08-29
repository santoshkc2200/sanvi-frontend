<script lang="ts">
import { t } from '@sanvi/i18n'
import { resolveText, type LocalizedText } from '../utils'

interface Props {
  heading?: LocalizedText
  description?: LocalizedText
  nameLabel?: LocalizedText
  emailLabel?: LocalizedText
  messageLabel?: LocalizedText
  submitButtonText?: LocalizedText
  successMessage?: LocalizedText
  onSubmit?: (data: { name: string; email: string; message: string }) => Promise<void> | void
  class?: string
}

let {
  heading,
  description,
  nameLabel,
  emailLabel,
  messageLabel,
  submitButtonText,
  successMessage,
  onSubmit,
  class: className = '',
}: Props = $props()

let name = $state('')
let email = $state('')
let message = $state('')
let submitted = $state(false)
let isSubmitting = $state(false)

const headingText = $derived(
  heading ? resolveText(heading) : t['themeBlocks.contactForm.heading'](),
)
const descText = $derived(resolveText(description))
const nameLabelText = $derived(
  nameLabel ? resolveText(nameLabel) : t['themeBlocks.contactForm.nameLabel'](),
)
const emailLabelText = $derived(
  emailLabel ? resolveText(emailLabel) : t['themeBlocks.contactForm.emailLabel'](),
)
const messageLabelText = $derived(
  messageLabel ? resolveText(messageLabel) : t['themeBlocks.contactForm.messageLabel'](),
)
const submitText = $derived(
  submitButtonText ? resolveText(submitButtonText) : t['themeBlocks.contactForm.submitButton'](),
)
const successText = $derived(
  successMessage ? resolveText(successMessage) : t['themeBlocks.contactForm.successMessage'](),
)

async function handleSubmit(event: SubmitEvent) {
  event.preventDefault()
  if (isSubmitting) return
  isSubmitting = true

  try {
    if (onSubmit) {
      await onSubmit({ name, email, message })
    }
    submitted = true
  } finally {
    isSubmitting = false
  }
}
</script>

<section class="sanvi-block-contact-form {className}">
  <div class="sanvi-block-contact-form__container">
    {#if headingText || descText}
      <div class="sanvi-block-contact-form__header">
        {#if headingText}
          <h2 class="sanvi-block-contact-form__heading">{headingText}</h2>
        {/if}
        {#if descText}
          <p class="sanvi-block-contact-form__desc">{descText}</p>
        {/if}
      </div>
    {/if}

    {#if submitted}
      <div class="sanvi-block-contact-form__success" role="status">
        <p>{successText}</p>
      </div>
    {:else}
      <form class="sanvi-block-contact-form__form" onsubmit={handleSubmit}>
        <div class="sanvi-block-contact-form__field">
          <label for="contact-name" class="sanvi-block-contact-form__label">{nameLabelText}</label>
          <input
            id="contact-name"
            type="text"
            required
            bind:value={name}
            class="sanvi-block-contact-form__input"
          />
        </div>

        <div class="sanvi-block-contact-form__field">
          <label for="contact-email" class="sanvi-block-contact-form__label">{emailLabelText}</label>
          <input
            id="contact-email"
            type="email"
            required
            bind:value={email}
            class="sanvi-block-contact-form__input"
          />
        </div>

        <div class="sanvi-block-contact-form__field">
          <label for="contact-message" class="sanvi-block-contact-form__label">{messageLabelText}</label>
          <textarea
            id="contact-message"
            rows="4"
            required
            bind:value={message}
            class="sanvi-block-contact-form__textarea"
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          class="sanvi-block-contact-form__submit"
        >
          {submitText}
        </button>
      </form>
    {/if}
  </div>
</section>

<style>
  .sanvi-block-contact-form {
    width: 100%;
    padding: var(--sanvi-spacing-16) var(--sanvi-spacing-6);
    background-color: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-contact-form__container {
    max-width: var(--sanvi-spacing-48);
    margin: var(--sanvi-spacing-0) auto;
  }
  .sanvi-block-contact-form__header {
    text-align: center;
    margin-bottom: var(--sanvi-spacing-8);
  }
  .sanvi-block-contact-form__heading {
    font-size: var(--sanvi-font-size-3xl);
    font-weight: var(--sanvi-font-weight-bold);
    line-height: var(--sanvi-line-height-tight);
    margin: var(--sanvi-spacing-0) var(--sanvi-spacing-0) var(--sanvi-spacing-3);
  }
  .sanvi-block-contact-form__desc {
    font-size: var(--sanvi-font-size-lg);
    color: var(--sanvi-color-text-secondary);
    margin: var(--sanvi-spacing-0);
  }
  .sanvi-block-contact-form__form {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-6);
    background-color: var(--sanvi-color-background-secondary);
    padding: var(--sanvi-spacing-8);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
  }
  .sanvi-block-contact-form__field {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }
  .sanvi-block-contact-form__label {
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-contact-form__input,
  .sanvi-block-contact-form__textarea {
    width: 100%;
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    font-size: var(--sanvi-font-size-md);
    background-color: var(--sanvi-color-background-primary);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    color: var(--sanvi-color-text-primary);
    font-family: inherit;
    box-sizing: border-box;
  }
  .sanvi-block-contact-form__input:focus,
  .sanvi-block-contact-form__textarea:focus {
    outline: none;
    border-color: var(--sanvi-color-border-focus);
  }
  .sanvi-block-contact-form__submit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-6);
    background-color: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
    border: none;
    border-radius: var(--sanvi-radius-md);
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
    cursor: pointer;
    transition: background-color 150ms ease;
  }
  .sanvi-block-contact-form__submit:hover:not(:disabled) {
    background-color: var(--sanvi-color-solid-primary-hover);
  }
  .sanvi-block-contact-form__submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .sanvi-block-contact-form__success {
    text-align: center;
    padding: var(--sanvi-spacing-8);
    background-color: var(--sanvi-color-background-secondary);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    color: var(--sanvi-color-status-success);
    font-weight: var(--sanvi-font-weight-medium);
  }
</style>
