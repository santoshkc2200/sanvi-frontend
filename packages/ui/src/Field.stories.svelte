<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import Field from './Field.svelte'
import Input from './Input.svelte'

const { Story } = defineMeta({
  title: 'Components/Field',
  component: Field,
  tags: ['autodocs'],
})
</script>

<Story name="With hint" args={{ label: 'Email address', hint: "We'll never share it." }}>
  {#snippet children({ id, describedBy, invalid })}
    <Input {id} describedBy={describedBy} {invalid} type="email" placeholder="you@example.com" />
  {/snippet}
</Story>

<Story
  name="With error"
  args={{ label: 'Email address', error: 'Enter a valid email address.' }}
>
  {#snippet children({ id, describedBy, invalid })}
    <Input {id} describedBy={describedBy} {invalid} type="email" value="not-an-email" />
  {/snippet}
</Story>

<Story name="Required" args={{ label: 'Course title', required: true }}>
  {#snippet children({ id, describedBy, invalid })}
    <Input {id} describedBy={describedBy} {invalid} required />
  {/snippet}
</Story>
