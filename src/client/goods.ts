export type GoodDef = {
  name: string;
  realm: 'phys' | 'spirit';
};
export const GOODS: Partial<Record<string, GoodDef>> = {
  spoon: {
    name: 'Spoons',
    realm: 'phys',
  },
  joy: {
    name: 'Bottled Joy',
    realm: 'spirit',
  },
  anger: {
    name: 'Distil\'n of Anger',
    realm: 'spirit',
  },
};
