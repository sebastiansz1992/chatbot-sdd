# Quickstart

## Commands
- npm install
- npm run dev
- npm run lint
- npm run build
- npm run test

## Validation
- Validate UI against baseline viewports: 1366x768, 1440x900, 1920x1080.
- Validate chat send/empty-submit behavior.
- Validate model selector and insight cards.
- Validate status indicators.

## Execution Log
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run test`: PASS (4 unit tests)
- `npm run test:e2e`: PASS (2 e2e tests)

## Performance Log
- First contentful paint (`FCP_MS`): `0.00` ms (headless Playwright run)
- Message-send interaction latency (`INTERACTION_MS`): `1.30` ms
