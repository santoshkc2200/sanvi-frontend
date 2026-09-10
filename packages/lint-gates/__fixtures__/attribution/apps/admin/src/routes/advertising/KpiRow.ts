// Violation fixture — deliberately wrong. One tidy ROAS number is the one
// thing that cannot be walked back once tenants have seen it.
export function kpiTiles(rows: { spend: number; revenue: number }[]) {
  const blended_roas = rows.reduce((total, row) => total + row.revenue / row.spend, 0)
  const totalConversionValue = rows.reduce((total, row) => total + row.revenue, 0)
  return { blended_roas, totalConversionValue }
}
