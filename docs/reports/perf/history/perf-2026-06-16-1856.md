# Performance Report — 2026-06-16T21:56:06.252Z

## Bundle
| Metric | Value |
|---|---|
| Total JS (raw) | 3128.2 KB |
| Total JS (gzip) | 867.1 KB |
| Total CSS (raw) | 53.8 KB |
| Total CSS (gzip) | 10.0 KB |
| Largest chunk | index-DAvHKRzx.js (1918.2 KB) |
| Build time | 4068 ms |

## Cold Start
| Metric | Value |
|---|---|
| Shell visible | 1993 ms |
| First useful screen | 2005 ms |
| Requests | 19 |

## Routes
| Route | Entry (ms) | Requests |
|---|---|---|
| Dashboard | 623 | 0 |
| Veículos | 142 | 1 |
| Motoristas | 92 | 2 |
| Manutenção | 97 | 1 |
| Pneus | 170 | 2 |
| Checklists | 958 | 3 |

## Return Behavior (veiculos)
| Metric | First | Return |
|---|---|---|
| Entry (ms) | 170 | 162 |
| Requests | 0 | 0 |

## Diff vs Baseline
| Metric | Current | Baseline | Delta | Status |
|---|---|---|---|---|
| totalJsGzip | 867.1 KB | — | — | ⚠️ no-baseline |
| largestChunk.raw | 1918.2 KB | — | — | ⚠️ no-baseline |
| coldStart.shellMs | 1993 ms | — | — | ⚠️ no-baseline |
| coldStart.firstUsefulMs | 2005 ms | — | — | ⚠️ no-baseline |
| route.dashboard.entryMs | 623 ms | — | — | ⚠️ no-baseline |
| route.dashboard.requestCount | 0 | — | — | ⚠️ no-baseline |
| route.veiculos.entryMs | 142 ms | — | — | ⚠️ no-baseline |
| route.veiculos.requestCount | 1 | — | — | ⚠️ no-baseline |
| route.motoristas.entryMs | 92 ms | — | — | ⚠️ no-baseline |
| route.motoristas.requestCount | 2 | — | — | ⚠️ no-baseline |
| route.manutencao.entryMs | 97 ms | — | — | ⚠️ no-baseline |
| route.manutencao.requestCount | 1 | — | — | ⚠️ no-baseline |
| route.pneus.entryMs | 170 ms | — | — | ⚠️ no-baseline |
| route.pneus.requestCount | 2 | — | — | ⚠️ no-baseline |
| route.checklists.entryMs | 958 ms | — | — | ⚠️ no-baseline |
| route.checklists.requestCount | 3 | — | — | ⚠️ no-baseline |
| returnBehavior.returnEntryMs | 162 ms | — | — | ⚠️ no-baseline |
| returnBehavior.returnRequestCount | 0 | — | — | ⚠️ no-baseline |

## Metas absolutas (informativo)
| Metric | Threshold | Current |
|---|---|---|
| Shell visible | 2500 ms | 1993 ms |
| First useful screen | 3500 ms | 2005 ms |
| Route entry (any) | 1500 ms | 958 ms |
| Largest chunk (raw) | 800.0 KB | 1918.2 KB |
