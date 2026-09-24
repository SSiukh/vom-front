import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { StickerDocument } from '../../models/sticker.model';
import { StickerSvg } from './sticker-svg';

const PLAIN: StickerDocument = {
  width: 1000,
  height: 222.2222,
  cornerRadius: 0,
  background: '#112233',
  layers: [
    { d: 'M0 0L10 0L10 10Z', fill: '#ffffff' },
    { d: 'M20 20L30 20L30 30Z', fill: '#ff8800' },
  ],
  gradients: [],
};

const WITH_GRADIENTS: StickerDocument = {
  ...PLAIN,
  layers: [
    { d: 'M0 0L10 0L10 10Z', fill: 'url(#ring-1)' },
    { d: 'M20 20L30 20L30 30Z', fill: 'url(#text-1)' },
  ],
  gradients: [
    {
      type: 'radial',
      id: 'ring-1',
      cx: 0,
      cy: 0,
      r: 1,
      matrix: [80, 0, 0, 80, 10, 60],
      stops: [
        { offset: 0.09, color: '#fa8f21', opacity: 1 },
        { offset: 0.78, color: '#d82d7e', opacity: 0 },
      ],
    },
    {
      type: 'linear',
      id: 'text-1',
      x1: 0,
      y1: 1,
      x2: 1,
      y2: 0,
      stops: [
        { offset: 0, color: '#fa8f21', opacity: 1 },
        { offset: 1, color: '#8c3aaa', opacity: 1 },
      ],
    },
  ],
};

describe('StickerSvg', () => {
  let fixture: ComponentFixture<StickerSvg>;
  let el: HTMLElement;

  const render = (document: StickerDocument, label = 'Наклейка: kolo') => {
    fixture = TestBed.createComponent(StickerSvg);
    fixture.componentRef.setInput('document', document);
    fixture.componentRef.setInput('label', label);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [StickerSvg] });
  });

  it('draws the sticker with a matching viewBox and an accessible label', () => {
    render(PLAIN);

    const svg = el.querySelector('svg') as SVGSVGElement;
    expect(svg.getAttribute('viewBox')).toBe('0 0 1000 222.222');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Наклейка: kolo');
  });

  it('draws the background rectangle and one path per layer with its own fill', () => {
    render(PLAIN);

    const rect = el.querySelector('rect');
    expect(rect?.getAttribute('fill')).toBe('#112233');
    expect(rect?.getAttribute('width')).toBe('1000');
    const paths = Array.from(el.querySelectorAll('path'));
    expect(paths.map((path) => path.getAttribute('d'))).toEqual(['M0 0L10 0L10 10Z', 'M20 20L30 20L30 30Z']);
    expect(paths.map((path) => path.getAttribute('fill'))).toEqual(['#ffffff', '#ff8800']);
  });

  it('writes no defs without gradients', () => {
    render(PLAIN);

    expect(el.querySelector('defs')).toBeNull();
  });

  it('defines a radial gradient in user space with its transform matrix and stops', () => {
    render(WITH_GRADIENTS);

    const gradient = el.querySelector('defs radialGradient');
    expect(gradient?.getAttribute('id')).toBe('ring-1');
    expect(gradient?.getAttribute('gradientUnits')).toBe('userSpaceOnUse');
    expect(gradient?.getAttribute('gradientTransform')).toBe('matrix(80 0 0 80 10 60)');
    const stops = Array.from(gradient?.querySelectorAll('stop') ?? []);
    expect(stops.map((stop) => [stop.getAttribute('offset'), stop.getAttribute('stop-color'), stop.getAttribute('stop-opacity')])).toEqual([
      ['0.09', '#fa8f21', '1'],
      ['0.78', '#d82d7e', '0'],
    ]);
  });

  it('defines a linear gradient with its direction and stops', () => {
    render(WITH_GRADIENTS);

    const gradient = el.querySelector('defs linearGradient');
    expect(gradient?.getAttribute('id')).toBe('text-1');
    expect([gradient?.getAttribute('x1'), gradient?.getAttribute('y1'), gradient?.getAttribute('x2'), gradient?.getAttribute('y2')]).toEqual([
      '0',
      '1',
      '1',
      '0',
    ]);
    expect(gradient?.querySelectorAll('stop')).toHaveLength(2);
  });

  it('references the gradients from the layer fills', () => {
    render(WITH_GRADIENTS);

    expect(Array.from(el.querySelectorAll('path')).map((path) => path.getAttribute('fill'))).toEqual(['url(#ring-1)', 'url(#text-1)']);
  });

  it('creates the gradient elements in the SVG namespace', () => {
    render(WITH_GRADIENTS);

    expect(el.querySelector('radialGradient')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(el.querySelector('stop')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('updates when the document changes', () => {
    render(PLAIN);

    fixture.componentRef.setInput('document', WITH_GRADIENTS);
    fixture.detectChanges();

    expect(el.querySelector('defs')).not.toBeNull();
  });
});
