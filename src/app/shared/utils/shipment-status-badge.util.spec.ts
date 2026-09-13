import { shipmentStatusBadgeClass } from './shipment-status-badge.util';

describe('shipmentStatusBadgeClass', () => {
  it.each([
    ['shipped', 'badge-info'],
    ['delivered', 'status-badge--delivered'],
    ['received', 'status-badge--success'],
    ['refused', 'status-badge--danger'],
    ['redirected', 'status-badge--redirected'],
  ])('maps "%s" to %s', (code, expectedClass) => {
    expect(shipmentStatusBadgeClass(code)).toBe(expectedClass);
  });

  it('falls back to a muted badge for an unknown code', () => {
    expect(shipmentStatusBadgeClass('some-future-status')).toBe('status-badge--muted');
  });

  it('falls back to a muted badge when the code is undefined (no shipment status yet)', () => {
    expect(shipmentStatusBadgeClass(undefined)).toBe('status-badge--muted');
  });
});
