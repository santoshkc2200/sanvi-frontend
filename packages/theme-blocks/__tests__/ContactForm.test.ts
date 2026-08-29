import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import ContactForm from '../src/blocks/ContactForm.svelte'

describe('ContactForm block', () => {
  it('renders form fields with accessible labels and handles submit', async () => {
    const handleSubmit = vi.fn()
    render(ContactForm, {
      props: {
        heading: 'Get in Touch',
        description: 'We would love to hear from you.',
        nameLabel: 'Your Full Name',
        emailLabel: 'Work Email',
        messageLabel: 'How can we help?',
        submitButtonText: 'Submit Inquiry',
        onSubmit: handleSubmit,
      },
    })

    expect(screen.getByRole('heading', { level: 2, name: 'Get in Touch' })).toBeInTheDocument()
    expect(screen.getByText('We would love to hear from you.')).toBeInTheDocument()

    const nameInput = screen.getByLabelText('Your Full Name')
    const emailInput = screen.getByLabelText('Work Email')
    const messageInput = screen.getByLabelText('How can we help?')
    const submitBtn = screen.getByRole('button', { name: 'Submit Inquiry' })

    await fireEvent.input(nameInput, { target: { value: 'Jane Smith' } })
    await fireEvent.input(emailInput, { target: { value: 'jane@example.com' } })
    await fireEvent.input(messageInput, { target: { value: 'Hello world' } })
    await fireEvent.click(submitBtn)

    expect(handleSubmit).toHaveBeenCalledWith({
      name: 'Jane Smith',
      email: 'jane@example.com',
      message: 'Hello world',
    })
  })

  it('renders localized text when passed a locale map', () => {
    render(ContactForm, {
      props: {
        heading: { en: 'Contact', ja: 'お問い合わせ' },
        nameLabel: { en: 'Name', ja: 'お名前' },
      },
    })

    expect(screen.getByText('Contact')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(ContactForm, {
      props: {
        heading: 'Contact Support',
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
