# GT Assessment: Engineering Design Doc

## Context

[CEP Sr. Engineer Take-Home](https://docs.google.com/document/d/1km1kusC0yu5ZqTqnwEhP66-KuYiOyR4xjxvtJYz1mZE/edit?tab=t.0)

A small service that models an order state machine with stage-dependent failure recovery.

---

## Overview

### Three-Step Processing
1. Initialization
2. Payment Validation
3. Completion

### Error Handling
- Payment validation failure → reject order
- Completion failure → void payment + cancel order
- Void failure → flag `Needs Attention`

### Technical Requirements
- State modeling
- Transition validation
- Timestamped history
- Small API

### Business Concerns
- UX speed
- Seamless checkout experience
- 100% coverage for payment error recovery

---

## Architecture

### Models

#### `Order`
**Params**
- `clientId: string`
- `ticketIds: string[]`

**Methods**

`private fulfill(): void`
> Fulfills the order by transferring the tickets.

---

`initialize(): void`
```
LogStatus(Status::Initialized)
```

---

`checkout(payment: PaymentMethod) -> Status`
```
try:
  payment.authorize()
  LogStatus(Status::PaymentAuthorized)  // only reached if authorize() succeeds
  this.fulfill()

catch (e):
  case PaymentDeclined:
    LogStatus(Status::PaymentDeclined)
    return Status::PaymentDeclined

  case FulfillmentFailed:
    try:
      payment.void()
      LogStatus(Status::FulfillmentFailed)
      return Status::FulfillmentFailed
    catch (e):
      LogStatus(Status::NeedsAttention)
      return Status::NeedsAttention

always:
  LogStatus(status)

return Status::OrderComplete
```

---

`getStatus(): Status`
```
return getTransactions().latest()?.status ?? Status::Pending
```

---

#### `PaymentMethod`
**Params**
- `clientId: string`

**Methods**
- `authorize(): void`
- `void(): void`

---

#### `Transaction`
**Params**
- `orderId: string`
- `paymentId: string`

**Props**
- `status: Status`
- `createdAt: timestamp`

---

#### `Status` (Enum)
| Value | Description |
|---|---|
| `Pending` | Order initialized, not yet processed |
| `PaymentAuthorized` | Payment successfully authorized |
| `PaymentDeclined` | Payment authorization failed |
| `FulfillmentFailed` | Completion failed; payment voided |
| `NeedsAttention` | Completion failed and void also failed |
| `OrderComplete` | Order successfully fulfilled |

---

### API Actions

#### `POST /orders` — Initialize Order
Creates and validates a new order, logging initial `Pending` status.

#### `POST /orders/:orderId/checkout` — Execute Transaction
```
transaction = new Transaction(orderId, paymentId)
status = order.checkout(payment)
LogTransaction(transaction, status)

if status === Status::NeedsAttention:
  fireAlert(orderId)
```

#### `GET /orders/:orderId/status` — Get Order Status
Returns the current status and full status history for the given order.

---

## Assumptions

- **Inventory management is out of scope.** The service assumes tickets are available and allocatable. Availability checks, seat reservation, and inventory locking against concurrent buyers are not modeled.
- **Fulfillment is hand-waved.** `Order.fulfill()` is a stub representing a call to a downstream ticketing service. The mechanics of ticket transfer (API calls, retries, idempotency keys) are outside the scope of this assessment.
- **`NeedsAttention` resolution is not implemented.** The service detects and flags orders that require manual intervention, but the mechanism for routing them to an agent or support queue is not built out. See Future Improvements for some proposed approaches.
- **Distributed write race conditions are out of scope.** Concurrent checkout attempts on the same order (e.g. duplicate submissions or multi-instance deployments) are not guarded against. This would be addressed with a DB-level pessimistic lock: an atomic `INSERT ... SELECT` into a `checkout_locks` table that checks order existence and current status in a single statement, claimed at the start of `checkout()` and released in a `finally` block. A TTL column plus a background reaper (or a DB-native advisory lock with automatic release on connection drop) would handle abandoned locks in production.

---

## Decisions & Tradeoffs

- **DB over in-memory storage:** The transaction log is the source of truth for order status. Accuracy is critical, and lookups remain fast with sensible indexing. In-memory caching is explicitly avoided to prevent stale state.

- **`currentState` as first-class field (single-instance):** Safe under single-instance in-memory operation. A multi-instance deployment would require optimistic locking or a distributed lock to prevent race conditions on state transitions.

- **Serialized payment + fulfillment processing:** Serializing payment authorization and order completion preserves transaction integrity at the cost of some latency. This tradeoff is justified because transaction integrity is a critical business concern, while the latency impact is minimal and has no effect on system integrity, trust, or complexity.

---

## Validation

### Test Cases

| Scenario | `ExecuteTransaction` result | Final status | Alert fires? |
|---|---|---|---|
| Valid order, payment authorized, fulfillment succeeds | ✅ Succeeds | `OrderComplete` | No |
| Invalid order | ❌ Fails | `Pending` (rejected at validation) | No |
| Payment authorization fails | ❌ Fails | `PaymentDeclined` | No |
| Fulfillment fails, void succeeds | ❌ Fails | `FulfillmentFailed` | No |
| Fulfillment fails, void also fails | ❌ Fails | `NeedsAttention` | **Yes** |

---

## Future Improvements

- **`NeedsAttention` alerting:** The right architecture depends on who is resolving the order.
  - **Human agents:** A `GET /orders?status=NeedsAttention` endpoint feeds a support queue. A recurring async job (e.g. every 30 seconds) polls and assigns cases. This is sufficient because if manual resolution happens on human timescales, polling latency is negligible.
  - **Automated agents:** A pub-sub model should push directly onto an event queue for assignment. Resolution can be monitored via secondary agent using the order statuses table mentioned above or a similar table for support tickets.
- **Rate limiting / usage enforcement:** Prevent race conditions from rapid duplicate checkout attempts; preserve data integrity and protect against abuse.