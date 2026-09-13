export function shipmentStatusBadgeClass(code: string | undefined): string {
  switch (code) {
    case 'shipped':
      return 'badge-info';
    case 'delivered':
      return 'status-badge--delivered';
    case 'received':
      return 'status-badge--success';
    case 'refused':
      return 'status-badge--danger';
    case 'redirected':
      return 'status-badge--redirected';
    default:
      return 'status-badge--muted';
  }
}
