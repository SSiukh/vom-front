import { convertToParamMap } from '@angular/router';
import { queryParamNumber, queryParamString } from './query-params.util';

describe('queryParamString', () => {
  it('returns the value when the key is present', () => {
    expect(queryParamString(convertToParamMap({ senderId: 's1' }), 'senderId')).toBe('s1');
  });

  it('returns null when the key is missing', () => {
    expect(queryParamString(convertToParamMap({}), 'senderId')).toBeNull();
  });
});

describe('queryParamNumber', () => {
  it('parses a valid positive number', () => {
    expect(queryParamNumber(convertToParamMap({ page: '3' }), 'page', 1)).toBe(3);
  });

  it('falls back when the key is missing', () => {
    expect(queryParamNumber(convertToParamMap({}), 'page', 1)).toBe(1);
  });

  it('falls back for a non-numeric value', () => {
    expect(queryParamNumber(convertToParamMap({ page: 'abc' }), 'page', 1)).toBe(1);
  });

  it('falls back for zero or a negative number', () => {
    expect(queryParamNumber(convertToParamMap({ page: '0' }), 'page', 1)).toBe(1);
    expect(queryParamNumber(convertToParamMap({ page: '-5' }), 'page', 1)).toBe(1);
  });
});
