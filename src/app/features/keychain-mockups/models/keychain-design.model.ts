export type DesignGroup = 'eco' | 'eco-round' | 'loop' | 'metal';

export type SlotAccept = 'mark' | 'text';

export interface DesignRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesignSlot {
  id: string;
  label: string;
  accepts: readonly SlotAccept[];
  rect: DesignRect;
  rotated: boolean;
  metal?: boolean;
  scaleFactor?: number;
}

export interface KeychainDesign {
  id: string;
  group: DesignGroup;
  imageUrl: string;
  container: DesignRect;
  photo: DesignRect | null;
  photoRotated: boolean;
  fit: 'contain' | 'stretch';
  slots: readonly DesignSlot[];
}
