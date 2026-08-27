import { Button } from '@sanvi/ui'
import { helper } from './helper'

// Dynamic imports through declared entry points are fine.
const loadButton = () => import('@sanvi/ui')

export { Button, helper, loadButton }
