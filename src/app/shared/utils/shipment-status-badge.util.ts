export function shipmentStatusBadgeClass(code: string | undefined): string {
  switch (code) {
    case 'shipped':
      return 'badge-info';
    case 'delivered':
      return 'status-badge--success';
    case 'received':
      return 'status-badge--muted';
    case 'refused':
      return 'status-badge--danger';
    default:
      return 'status-badge--muted';
  }
}
