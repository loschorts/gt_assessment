interface Props {
  status: string | null | undefined
}

export default function Badge({ status }: Props) {
  return <span className={`badge badge-${status}`}>{status ?? '—'}</span>
}
