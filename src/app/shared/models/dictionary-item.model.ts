export interface DictionaryItem {
  id: string;
  code: string;
  label: string;
}

export interface ShipmentType extends DictionaryItem {
  isDefault: boolean;
}

export interface ProductType extends DictionaryItem {
  isCustom: boolean;
}

export interface ExpenseType extends DictionaryItem {
  requiresName: boolean;
}
