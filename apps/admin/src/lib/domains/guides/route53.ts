import type { RegistrarGuide } from '../registrar-guides'

export const route53Guide: RegistrarGuide = {
  id: 'route53',
  nameKey: 'admin.domains.guides.route53.name',
  steps: [
    { textKey: 'admin.domains.guides.route53.step1' },
    { textKey: 'admin.domains.guides.route53.step2' },
    { textKey: 'admin.domains.guides.route53.step3' },
    { textKey: 'admin.domains.guides.route53.step4' },
  ],
}
