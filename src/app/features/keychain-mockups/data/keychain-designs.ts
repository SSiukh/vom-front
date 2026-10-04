import type { KeychainType } from '../models/keychain.model';
import type { DesignGroup, DesignSlot, KeychainDesign } from '../models/keychain-design.model';

const MAIN_SLOT = 'main';
const SMALL_SLOT = 'small';
const ICON_SLOT = 'icon';
const METAL_ICON_SCALE = 0.6;

const ECO_CONTAINER = { x: 34, y: 208, width: 99, height: 269 };
const ECO_ROUND_CONTAINER = { x: 0, y: 158, width: 284, height: 317 };
const LOOP_CONTAINER = { x: 35, y: 192, width: 106, height: 288 };
const LOOP_STRAP = { x: 43, y: 230, width: 91, height: 250 };
const METAL_CONTAINER = { x: 27, y: 254, width: 117, height: 202 };

function mainSlot(rect: DesignSlot['rect'], rotated: boolean): DesignSlot {
  return { id: MAIN_SLOT, label: 'Основна зона', accepts: ['mark', 'text'], rect, rotated };
}

const KEYCHAIN_DESIGNS: readonly KeychainDesign[] = [
  {
    id: 'eco-v',
    group: 'eco',
    imageUrl: 'keychains/designs/eco-v.svg',
    container: ECO_CONTAINER,
    photo: null,
    photoRotated: false,
    fit: 'contain',
    slots: [mainSlot(ECO_CONTAINER, true)],
  },
  {
    id: 'eco-h',
    group: 'eco',
    imageUrl: 'keychains/designs/eco-h.svg',
    container: ECO_CONTAINER,
    photo: null,
    photoRotated: false,
    fit: 'contain',
    slots: [mainSlot(ECO_CONTAINER, false)],
  },
  {
    id: 'eco-round-v',
    group: 'eco-round',
    imageUrl: 'keychains/designs/eco-round-v.svg',
    container: ECO_ROUND_CONTAINER,
    photo: null,
    photoRotated: false,
    fit: 'contain',
    slots: [mainSlot(ECO_ROUND_CONTAINER, true)],
  },
  {
    id: 'eco-round-h',
    group: 'eco-round',
    imageUrl: 'keychains/designs/eco-round-h.svg',
    container: ECO_ROUND_CONTAINER,
    photo: null,
    photoRotated: false,
    fit: 'contain',
    slots: [mainSlot(ECO_ROUND_CONTAINER, false)],
  },
  {
    id: 'loop-icon',
    group: 'loop',
    imageUrl: 'keychains/designs/loop-icon.svg',
    container: LOOP_CONTAINER,
    photo: null,
    photoRotated: false,
    fit: 'stretch',
    slots: [
      {
        id: ICON_SLOT,
        label: 'Іконка',
        accepts: ['mark'],
        rect: { x: 42, y: 196, width: 92, height: 30 },
        rotated: false,
        metal: true,
        scaleFactor: METAL_ICON_SCALE,
      },
      mainSlot(LOOP_STRAP, true),
    ],
  },
  {
    id: 'loop',
    group: 'loop',
    imageUrl: 'keychains/designs/loop.svg',
    container: LOOP_CONTAINER,
    photo: null,
    photoRotated: false,
    fit: 'stretch',
    slots: [mainSlot(LOOP_STRAP, true)],
  },
  {
    id: 'metal-v-2',
    group: 'metal',
    imageUrl: 'keychains/designs/metal-v-2.svg',
    container: METAL_CONTAINER,
    photo: { x: 30, y: 262, width: 111, height: 128 },
    photoRotated: false,
    fit: 'contain',
    slots: [mainSlot({ x: 30, y: 392, width: 111, height: 58 }, false)],
  },
  {
    id: 'metal-v-3',
    group: 'metal',
    imageUrl: 'keychains/designs/metal-v-3.svg',
    container: METAL_CONTAINER,
    photo: { x: 30, y: 262, width: 111, height: 120 },
    photoRotated: false,
    fit: 'contain',
    slots: [
      mainSlot({ x: 30, y: 386, width: 111, height: 24 }, false),
      {
        id: SMALL_SLOT,
        label: 'Мала зона',
        accepts: ['mark', 'text'],
        rect: { x: 30, y: 412, width: 111, height: 36 },
        rotated: false,
      },
    ],
  },
  {
    id: 'metal-h-1',
    group: 'metal',
    imageUrl: 'keychains/designs/metal-h-1.svg',
    container: METAL_CONTAINER,
    photo: { x: 30, y: 262, width: 111, height: 190 },
    photoRotated: true,
    fit: 'contain',
    slots: [],
  },
  {
    id: 'metal-h-2',
    group: 'metal',
    imageUrl: 'keychains/designs/metal-h-2.svg',
    container: METAL_CONTAINER,
    photo: { x: 30, y: 334, width: 110, height: 120 },
    photoRotated: true,
    fit: 'contain',
    slots: [mainSlot({ x: 114, y: 266, width: 20, height: 64 }, true)],
  },
  {
    id: 'metal-h-3',
    group: 'metal',
    imageUrl: 'keychains/designs/metal-h-3.svg',
    container: METAL_CONTAINER,
    photo: { x: 30, y: 334, width: 110, height: 120 },
    photoRotated: true,
    fit: 'contain',
    slots: [
      mainSlot({ x: 118, y: 266, width: 18, height: 64 }, true),
      {
        id: SMALL_SLOT,
        label: 'Мала зона',
        accepts: ['mark', 'text'],
        rect: { x: 100, y: 284, width: 16, height: 40 },
        rotated: true,
      },
    ],
  },
  {
    id: 'metal-h-t',
    group: 'metal',
    imageUrl: 'keychains/designs/metal-h-t.svg',
    container: METAL_CONTAINER,
    photo: null,
    photoRotated: false,
    fit: 'contain',
    slots: [mainSlot(METAL_CONTAINER, true)],
  },
  {
    id: 'metal-v-t',
    group: 'metal',
    imageUrl: 'keychains/designs/metal-v-t.svg',
    container: METAL_CONTAINER,
    photo: null,
    photoRotated: false,
    fit: 'contain',
    slots: [mainSlot(METAL_CONTAINER, false)],
  },
  {
    id: 'metla-v-1',
    group: 'metal',
    imageUrl: 'keychains/designs/metla-v-1.svg',
    container: METAL_CONTAINER,
    photo: { x: 30, y: 262, width: 111, height: 190 },
    photoRotated: false,
    fit: 'contain',
    slots: [],
  },
];

export function designGroupOf(type: KeychainType): DesignGroup {
  if (type.family === 'metal') {
    return 'metal';
  }
  if (type.family === 'leather') {
    return 'loop';
  }
  return type.id === 'subleather-circle' ? 'eco-round' : 'eco';
}

export function designsInGroup(group: DesignGroup): readonly KeychainDesign[] {
  return KEYCHAIN_DESIGNS.filter((design) => design.group === group);
}
