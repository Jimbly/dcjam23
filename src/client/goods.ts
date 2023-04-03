export type GoodAvail = Record<number, [number, number]>;  // floor -> [count, cost]
export type GoodDef = {
  name: string;
  realm: 'phys' | 'spirit';
  avail: GoodAvail;
  key?: string;
};
function spiritWants(cost: number): GoodAvail {
  let ret: GoodAvail = {};
  ret[6] = [0, cost];
  return ret;
}
function physWants(cost: number): GoodAvail {
  let ret: GoodAvail = {};
  ret[5] = [0, cost];
  return ret;
}
export const GOODS: Partial<Record<string, GoodDef>> = {
  phys1: {
    name: 'Spoons',
    realm: 'phys',
    avail: {
      ...spiritWants(10),
      5: [7, 5],
    },
  },
  phys2: {
    name: 'Table Legs',
    realm: 'phys',
    avail: {
      ...spiritWants(20),
      5: [7, 14],
    },
  },
  phys3: {
    name: 'Dead Leaves',
    realm: 'phys',
    avail: {
      ...spiritWants(30),
      5: [7, 23],
    },
  },
  phys4: {
    name: 'Fresh Soil',
    realm: 'phys',
    avail: {
      ...spiritWants(40),
      5: [7, 32],
    },
  },
  phys5: {
    name: 'Books',
    realm: 'phys',
    avail: {
      ...spiritWants(50),
      5: [7, 40],
    },
  },
  phys6: {
    name: 'Stone Carvings',
    realm: 'phys',
    avail: {
      ...spiritWants(60),
      5: [7, 48],
    },
  },
  phys7: {
    name: 'Metal Trinkets',
    realm: 'phys',
    avail: {
      ...spiritWants(70),
      5: [7, 55],
    },
  },

  spirit1: {
    name: 'Canned Greed',
    realm: 'spirit',
    avail: {
      ...physWants(10),
      6: [7, 5],
    },
  },
  spirit2: {
    name: 'Bottled Joy',
    realm: 'spirit',
    avail: {
      ...physWants(20),
      6: [7, 14],
    },
  },
  spirit3: {
    name: 'Distil\'n of Anger',
    realm: 'spirit',
    avail: {
      ...physWants(30),
      6: [7, 23],
    },
  },
  spirit4: {
    name: 'Nostalgia Syrup',
    realm: 'spirit',
    avail: {
      ...physWants(40),
      6: [7, 32],
    },
  },
  spirit5: {
    name: 'Despair Dust',
    realm: 'spirit',
    avail: {
      ...physWants(50),
      6: [7, 40],
    },
  },
  spirit6: {
    name: 'Bliss Extract',
    realm: 'spirit',
    avail: {
      ...physWants(60),
      6: [7, 48],
    },
  },
  spirit7: {
    name: 'Generosity Gel',
    realm: 'spirit',
    avail: {
      ...physWants(70),
      6: [7, 55],
    },
  },
  mcguff1: {
    name: 'Painting of Beloved',
    realm: 'phys',
    avail: {
      5: [1, 999],
    },
    key: 'mcguff1',
  },
  mcguff2: {
    name: 'Dad\'s Pocketwatch',
    realm: 'phys',
    avail: {
      5: [1, 999],
    },
    key: 'mcguff2',
  },
  mcguff3: {
    name: 'Memories of Childhood',
    realm: 'spirit',
    avail: {
      6: [1, 999],
    },
    key: 'mcguff3',
  },
  mcguff4: {
    name: 'Hope',
    realm: 'spirit',
    avail: {
      6: [1, 999],
    },
    key: 'mcguff4',
  },
};
