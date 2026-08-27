// Violation: a *dynamic* import reaching into another package's src/**
// internals — dynamic imports are extracted just like static ones.
const loadInternals = () => import('@sanvi/ui/src/index.ts')

export { loadInternals }
