<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import DomainRecordTable from './DomainRecordTable.svelte'

const { Story } = defineMeta({
  title: 'Components/DomainRecordTable',
  component: DomainRecordTable,
  tags: ['autodocs'],
})

const sampleRecords = [
  {
    type: 'TXT',
    name: '_sanvi-challenge.example.com',
    expected: 'sanvi-verification=abcdef123456',
    observed: 'matched' as const,
  },
  {
    type: 'CNAME',
    name: 'shop.example.com',
    expected: 'edge.sanvi.app',
    observed: 'pending' as const,
  },
  {
    type: 'A',
    name: '@',
    expected: '192.0.2.1',
    observed: 'mismatch' as const,
  },
]
</script>

<Story name="Populated" args={{ records: sampleRecords }} />

<Story name="Empty" args={{ records: [] }} />
