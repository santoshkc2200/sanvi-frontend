import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import FieldWithInput from './fixtures/FieldWithInput.svelte'

describe('Field + Input', () => {
  it('associates the label with the control via a shared id', () => {
    render(FieldWithInput, { props: { label: 'Email address' } })
    const input = screen.getByLabelText('Email address')
    expect(input).toBeInstanceOf(HTMLInputElement)
  })

  it('renders the hint and wires it through aria-describedby when there is no error', () => {
    render(FieldWithInput, { props: { label: 'Email address', hint: "We'll never share it." } })
    const input = screen.getByLabelText('Email address')
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(screen.getByText("We'll never share it.").id).toBe(describedBy)
  })

  it('renders the error as an alert, marks the control invalid, and hides the hint', () => {
    render(FieldWithInput, {
      props: { label: 'Email address', hint: 'ignored', error: 'Enter a valid email.' },
    })
    const input = screen.getByLabelText('Email address')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('ignored')).not.toBeInTheDocument()

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Enter a valid email.')
    expect(input.getAttribute('aria-describedby')).toBe(alert.id)
  })

  it('has no accessibility violations with an error present', async () => {
    const { container } = render(FieldWithInput, {
      props: { label: 'Email address', error: 'Enter a valid email.' },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
