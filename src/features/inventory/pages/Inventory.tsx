// The Inventory page is a literal alias for the Materials page — same feature, same per-project
// material stock/transaction data, same UI — just reachable from a second sidebar link
// ("Inventory" vs. "Materials"). Kept as its own file (rather than pointing the /inventory route
// straight at the Materials component in App.tsx) so a future re-split back into two distinct
// features doesn't have to touch routing.
export { default } from "../../materials/pages/Materials";
