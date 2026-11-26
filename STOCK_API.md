# Stock API

Base URLs:
- `/api/stock/<resource>` (primary)
- `/api/<resource>` (same resource routes)

All list/create/update/delete endpoints return JSON. Deletes return `204 No Content`.

## LiveStock

`/api/stock/livestocks`

Fields: `kva` (required, unique), `codeCore`, `codeLV`, `codeHV`, and derived fields `looseCoreOrderedKG`, `lvConductorOrderedKG`, `hvConductorOrderedKG`, `looseCoreStockKG`, `lvConductorStockKG`, `hvConductorStockKG`, `readyToDispatch`, `rtdRepairing`, `defective`, `dispatch`, `location`.

## OrderEntry

`/api/stock/order-entries`

Fields: `material` (`CORE`, `LV CONDUCTOR`, or `HV CONDUCTOR`), `kva`, `code` (required, unique), `description`, `qty`, `qtyinjob`, `location`.

Patch quantity:

```http
PATCH /api/stock/order-entries/:id/qty
Content-Type: application/json

{ "new_qty": 25 }
```

## Invoice

`/api/stock/invoices`

Fields: `sl` (server assigned), `receiptdate`, `invoiceno`, `invoicedate`, `purchaseno`, `mcode`, `supplier`, `description`, `qty`, `unit`, `invoicerate`, `totalamount`, `billamount`, `POqty`, `POrate`, `received`, `remaining`, `remarks`.

`totalamount`, PO totals, received, and remaining are recalculated from linked invoice/PO records.

## InvoicePO

`/api/stock/invoice-pos`

Fields: `date`, `POnumber`, `supplier`, `icode`, `description`, `qty`, `unit`, `rate`, `total`, `totalamountPO`, `received`, `remaining`, `remarks`.

## RejectionStock

`/api/stock/rejection-stocks`

Fields: `kva`, `core`, `lvConductor`, `hvConductor`, `oil`. Derived rejection values are recalculated from `RejectionEntry`.

## RejectionEntry

`/api/stock/rejection-entries`

Fields: `timestamp`, `email`, `kva`, `coreRejectionKG`, `lvConductorRejectionKG`, `hvConductorRejectionKG`, `remarks_enter_purchase_no`, `oilRejectionLtr`, `remarks`.

## DailyProdReportStock

`/api/stock/daily-prod-report-stocks`

Fields: `kva`, `tankPaintDone`, `coreAssembly`, `lvCoil`, `hvCoil`, `coilAssembly`, `boxup`, `testingDone`, `tankOnlyFabrication`. Values are aggregated from `DailyProd`.

## DailyProd

`/api/stock/daily-prods`

Fields: `timestamp`, `operator`, `kva`, `tank`, `coreAssemblyDone`, `lvCoilWinding`, `hvCoilWinding`, `coilAssembly`, `boxupDone`, `testingDone`, `email`, `remarks`, `date`, `paint`, `coreJobNo`, `lvJobNo`, `hvJobNo`, `coilJobNo`, `boxupJobNo`.

## PerJobData

`/api/stock/per-job-data`

Fields: `kva`, `coreCode`, `lvConductorCode`, `hvConductorCode`, `corePerJobKG`, `lvConductorPerJobKG`, `hvConductorPerJobKG`, `oilConsumptionPerJob`, `radiatorCode`, `radiatorPerJob`, `lvConductorSize`, `hvConductorSize`, `widthWithRadiator`, `length`, `height`, `weightKG`, `blankTankWeight`, `yellow`, `manualIdea`.

## StockAdjustmentEntry

`/api/stock/stock-adjustment-entries`

Fields: `email`, `kva`, `core`, `ltConductor`, `htConductor`, `remarks`.

## ProductionFlor

`/api/stock/production-flor`

Fields: `kva`, `tank`, `coreAssemblyStock`, `lvCoilStock`, `hvCoilStock`, `coilAssembly`, `boxup`, `rtd`, `tankOnlyFabrication`. Derived fields are recalculated from `DailyProdReportStock`.

## RepairingData

`/api/stock/repairing-data`

Fields: `timestamp`, `email`, `kva`, `totalRepairing`, `workDetailsWithDTRSNo`, `operator`, `lvCoilChanged`, `hvCoilChanged`, `newOilUsing`, `remarks`.

## RepairingDataReturnStock

`/api/stock/repairing-data-return-stocks`

Fields: `kva`, `stock`.

## RepairingDataRepairingStock

`/api/stock/repairing-data-repairing-stocks`

Fields: `kva`, `stock`, `lvCoil`, `hvCoil`, `oil`.

## Dispatch additions

The existing `/api/dispatches` create/update payload now accepts these optional fields:

```json
{
  "trwrprintstatus": "string",
  "NEW2": "string",
  "REP2": "string",
  "remarks2": "string",
  "receivingcopystatus": "string",
  "purchaseorderno2": "string",
  "purchaseorderdate2": "2026-11-18",
  "qty2": 10
}
```

## Standard CRUD

For each resource:

```http
GET    /api/stock/<resource>
POST   /api/stock/<resource>
GET    /api/stock/<resource>/:id
PUT    /api/stock/<resource>/:id
DELETE /api/stock/<resource>/:id
```
