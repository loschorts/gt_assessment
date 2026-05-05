export interface Order {
  id: string
  client_id: string
  ticket_ids: string
  payment_id: string | null
  current_status: string
}

export interface StatusRow {
  id: number
  order_id: string
  status: string
  created_at: string
}

export interface DbState {
  orders: Order[]
  statusHistory: StatusRow[]
}

export interface RequestInfo {
  method: string
  url: string
  body?: object
}

export interface ResponseData {
  request: RequestInfo
  status: number
  body: Record<string, unknown>
}
