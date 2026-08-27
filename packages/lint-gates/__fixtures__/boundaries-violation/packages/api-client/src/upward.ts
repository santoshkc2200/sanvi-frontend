// Violation: a package importing an app — dependencies must never point
// upward into apps/.
import HomePage from '@sanvi/marketing'

export { HomePage }
