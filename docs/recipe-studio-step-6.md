# Permanent Recipe Studio in the app

The dashboard Recipes area now embeds the permanent Recipe Studio, including recipe cards, linked raw/batch components, tracking, history and CSV review. Onboarding links to the same restaurant book with no recipe completion deadline.

Recipe requests reuse the Google session exported by `auth.js` and obtain the current session token for each request. Authorized chef kitchen codes remain available for existing manual restaurant connections. The dashboard's separate restaurant AI credential is used only for Mise AI guidance. The existing backend verifies restaurant access and permissions.

The Studio stays mounted during normal dashboard navigation so editor drafts, suspended component drafts, tracking entries and CSV review remain intact. Pending or interrupted confirmations block departure. Reloading or disconnecting asks before discarding unsaved work. Confirmed recipe and tracking saves refresh the existing Prep screen using its existing reader.

The dashboard's existing CSV/Excel upload route feeds the deliberate CSV review queue. Saving and approval remain separate chef actions. Saved-recipe scaling uses the existing Supabase calculation endpoint. Costing still uses the Calculate button; automatic cost refresh has not been enabled.

## Validation

131 simulated checks passed: 15 module, 18 component navigation, 26 tracking, 20 history, 32 CSV and 20 app integration. All ten existing inline dashboard/onboarding scripts and both new JavaScript files parse successfully. Tests use synthetic records and mocked requests; they do not write restaurant records or stock.

Run with Node 20 or newer:

```sh
npm ci --prefix tests/recipe-studio/runtime
node tests/recipe-studio/module.test.mjs
node tests/recipe-studio/navigation.test.mjs
node tests/recipe-studio/tracking.test.mjs
node tests/recipe-studio/history.test.mjs
node tests/recipe-studio/csv.test.mjs
node tests/recipe-studio/integration.test.mjs
```

Full signed-in browser, visual and end-to-end verification remains outstanding. This change does not implement Step 7 event recipe reuse or Step 8 live checks. It makes no database, authentication-module, invoice-ingestion or inventory-ledger changes.
