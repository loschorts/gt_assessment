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

`private tryComplete(): void`
> Completes the order by transferring the tickets.

---

`initialize(): void`
```
LogStatus(OrderStatus::Initialized)
```

---

`tryCheckout(payment: PaymentMethod, paymentId: string) -> OrderStatus`
```
if !canTransition(currentStatus, OrderStatus::PaymentAuthorized):
  throw InvalidTransitionError

try:
  payment.authorize()
  LogStatus(OrderStatus::PaymentAuthorized)
  this.tryComplete()

catch (e):
  case PaymentDeclined:
    LogStatus(OrderStatus::PaymentDeclined)
    return OrderStatus::PaymentDeclined

  case CompletionFailed:
    try:
      payment.void()
      LogStatus(OrderStatus::Cancelled)
      return OrderStatus::Cancelled
    catch (e):
      LogStatus(OrderStatus::NeedsAttention)
      return OrderStatus::NeedsAttention

LogStatus(OrderStatus::Complete)
return OrderStatus::Complete
```

---

`getStatus(): OrderStatus`
```
row = order_status_history.latest(orderId)
if !row: throw OrderNotInitializedError
return row.status
```

---

#### `PaymentMethod`
**Params**
- `clientId: string`

**Methods**
- `authorize(): void`
- `void(): void`

---

#### `OrderStatus` (Enum)
| Value | Description |
|---|---|
| `Initialized` | Order created, not yet checked out |
| `PaymentAuthorized` | Payment authorized; completion in progress |
| `PaymentDeclined` | Payment authorization failed |
| `Cancelled` | Completion failed; payment voided |
| `NeedsAttention` | Completion failed and void also failed |
| `Complete` | Order successfully completed |

---

### API Actions

#### `POST /orders` — Initialize Order
Creates and validates a new order, logging initial `Initialized` status.

#### `POST /orders/:orderId/checkout` — Execute Checkout
```
status = order.tryCheckout(payment, paymentId)

if status === OrderStatus::NeedsAttention:
  fireAlert(orderId)
```

If the order is already `Complete`, returns `409 Conflict`. This is intentional: tickets are non-fungible assets — once transferred, the same order cannot be used to claim them again. Re-checkout on a completed order would risk double-transfer of the same tickets to the same or a different buyer.

#### `GET /orders/:orderId/status` — Get Order Status
Returns the current status and full status history for the given order.

---

## Assumptions

- **Inventory management is out of scope.** The service assumes tickets are available and allocatable. Availability checks, seat reservation, and inventory locking against concurrent buyers are not modeled.
- **Completion is hand-waved.** `Order.tryComplete()` is a stub representing a call to a downstream ticketing service. The mechanics of ticket transfer (API calls, retries, idempotency keys) are outside the scope of this assessment.
- **`NeedsAttention` resolution is not implemented.** The service detects and flags orders that require manual intervention, but the mechanism for routing them to an agent or support queue is not built out. See Future Improvements for some proposed approaches.
- **Distributed write race conditions are out of scope.** Concurrent checkout attempts on the same order (e.g. duplicate submissions or multi-instance deployments) are not guarded against. This would be addressed with a DB-level pessimistic lock: an atomic `INSERT ... SELECT` into a `checkout_locks` table that checks order existence and current status in a single statement, claimed at the start of `checkout()` and released in a `finally` block. A TTL column plus a background reaper (or a DB-native advisory lock with automatic release on connection drop) would handle abandoned locks in production.

---

## Decisions & Tradeoffs

- **DB over in-memory storage:** The transaction log is the source of truth for order status. Accuracy is critical, and lookups remain fast with sensible indexing. In-memory caching is explicitly avoided to prevent stale state.

- **`currentState` as first-class field (single-instance):** Safe under single-instance in-memory operation. A multi-instance deployment would require optimistic locking or a distributed lock to prevent race conditions on state transitions.

- **Serialized payment + completement processing:** Serializing payment authorization and order completion preserves transaction integrity at the cost of some latency. This tradeoff is justified because transaction integrity is a critical business concern, while the latency impact is minimal and has no effect on system integrity, trust, or complexity.

- **`PaymentAuthorized` is a transitional status logged for diagnostic value:** Authorization is recorded as a discrete status entry immediately before completion is attempted. This gives the status history a complete audit trail of each checkout attempt. Without this entry, a resolving agent would have to query the payment provider directly to determine whether a charge is outstanding. With it, the history alone confirms that authorization succeeded. `PaymentAuthorized` is not a stable resting state: in the normal flow the order moves through it immediately to `Complete`, `Cancelled`, or `NeedsAttention` within the same request. On a retry, a fresh authorization is always started regardless of any prior `PaymentAuthorized` entry — resuming a stale authorization would risk acting on a charge that may have already expired or been reversed by the provider.

- **Explicit transition table (`VALID_TRANSITIONS`):** Rather than encoding checkout eligibility as a single guard (`if status === Complete, reject`), valid transitions are declared as a data structure in `OrderStatus.ts`. `Order.tryCheckout()` consults the table rather than implementing ad-hoc logic. This makes the state machine auditable at a glance and keeps new states cheap to add — a new state only requires an entry in the table, not changes scattered across business logic. Some intermediate states that would justify this extensibility:
  - **`FraudReview`** — order flagged by a risk model during authorization; checkout blocked pending a manual or automated clearance step before re-attempting payment.
  - **`RateLimited`** — too many checkout attempts in a short window; blocks further attempts until a cooldown expires, protecting against both accidental duplicate submissions and intentional abuse.
  - **`InventoryHold`** — tickets reserved but not yet confirmed available by the downstream ticketing service; checkout paused until the hold resolves or times out.
  - **`AwaitingExternalConfirmation`** — payment authorized but completion is waiting on an async callback (e.g. a 3DS challenge or a slow downstream ACK); order held in limbo until confirmation arrives.
  - **`OrderExpired`** — order was initialized but not checked out within an allowed window; terminal state that prevents stale orders from being fulfilled long after the customer's intent has lapsed.
  - **`PromotionExpired`** — a discount or promotional price applied at initialization is no longer valid at checkout time; blocks completion and prompts the customer to re-price the order before retrying.

---

## Validation

### Test Cases

| Scenario | `tryCheckout` result | Final status | Alert fires? |
|---|---|---|---|
| Payment authorized, completion succeeds | ✅ Succeeds | `Complete` | No |
| Invalid request body | ❌ Rejected (400) | unchanged | No |
| Order not found | ❌ Rejected (404) | unchanged | No |
| Order in terminal state | ❌ Rejected (409) | unchanged | No |
| Payment authorization fails | ❌ Fails | `PaymentDeclined` | No |
| Completion fails, void succeeds | ❌ Fails | `Cancelled` | No |
| Completion fails, void also fails | ❌ Fails | `NeedsAttention` | **Yes** |

---

## Future Improvements

- **`NeedsAttention` alerting:** The right architecture depends on who is resolving the order.
  - **Human agents:** A `GET /orders?status=NeedsAttention` endpoint feeds a support queue. A recurring async job (e.g. every 30 seconds) polls and assigns cases. This is sufficient because if manual resolution happens on human timescales, polling latency is negligible.
  - **Automated agents:** A pub-sub model should push directly onto an event queue for assignment. Resolution can be monitored via secondary agent using the order statuses table mentioned above or a similar table for support tickets.
- **Rate limiting / usage enforcement:** Prevent race conditions from rapid duplicate checkout attempts; preserve data integrity and protect against abuse.
- **Status transition messages:** Each entry in `order_status_history` could carry an optional message field capturing the reason for the transition — e.g. the payment provider's decline code on `PaymentDeclined`, the error type on `NeedsAttention`, or a correlation ID on `Cancelled`. This would make the history self-contained for diagnostics and support triage without requiring a separate log query.