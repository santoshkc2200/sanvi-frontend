// Marketing is public and has no per-request personalization — prerender
// everything by default; a route opts out with its own `export const
// prerender = false` if a later phase needs one (e.g. a contact form action).
export const prerender = true
