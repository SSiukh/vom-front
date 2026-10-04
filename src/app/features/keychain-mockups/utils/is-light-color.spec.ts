import { isLightColor } from './is-light-color';

describe('isLightColor', () => {
  it('treats white and pale colours as light', () => {
    expect(isLightColor('#ffffff')).toBe(true);
    expect(isLightColor('#e8e8e8')).toBe(true);
    expect(isLightColor('#FFFF00')).toBe(true);
  });

  it('treats black and dark colours as dark', () => {
    expect(isLightColor('#000000')).toBe(false);
    expect(isLightColor('#111111')).toBe(false);
    expect(isLightColor('#8c3aaa')).toBe(false);
  });

  it('places the boundary at a luminance of 0.6', () => {
    expect(isLightColor('#999999')).toBe(false);
    expect(isLightColor('#9a9a9a')).toBe(true);
  });

  it('rejects anything that is not #rrggbb', () => {
    expect(() => isLightColor('red')).toThrow('Expected a #rrggbb colour');
    expect(() => isLightColor('#fff')).toThrow('Expected a #rrggbb colour');
  });
});
