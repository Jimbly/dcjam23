export type GoodDef = {
  name: string;
  realm: 'phys' | 'spirit';
};
export const GOODS: Partial<Record<string, GoodDef>> = {
  spoon: {
    name: 'Spoon',
    realm: 'phys',
  },
  joy: {
    name: 'Bottled Joy',
    realm: 'spirit',
  },
};
