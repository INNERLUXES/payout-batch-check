# payout-batch-check: examples/good/batch.csv

- File: 12 lines, 1,744 bytes
- Batch: PAYOUT-EXAMPLE-GOOD; CSV; 11 payments \(8 bank, 3 stablecoin\); debit EUR; paid in EUR, GBP, CHF, JPY, KWD, USD, USDC and USDT
- Findings: 0
- Result: **PASS - no finding at or above error**

## Findings

None.

## Totals (8)

| Unit | Payments | Sum of rows | Total given | State |
| --- | ---: | ---: | ---: | --- |
| EUR | 3 | 2960 | - | no total given |
| GBP | 1 | 1200 | - | no total given |
| CHF | 1 | 950 | - | no total given |
| JPY | 1 | 150000 | - | no total given |
| KWD | 1 | 250.125 | - | no total given |
| USD | 1 | 2500 | - | no total given |
| USDC | 2 | 1250 | - | no total given |
| USDT | 1 | 400 | - | no total given |

Note: the batch gives no totals, so batch-total-mismatch had nothing to compare

This report is an input to a review before the batch is sent: not a compliance or sanctions screening and not a guarantee that a payment will arrive.
