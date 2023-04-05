export type GoodAvail = Record<number, [number, number]>;  // floor -> [count, cost]
export type GoodDef = {
  name: string;
  realm: 'phys' | 'spirit' | 'both';
  avail: GoodAvail;
  key?: string;
};
function spiritWants(s1: number, s2: number, s3: number): GoodAvail {
  let ret: GoodAvail = {};
  ret[4] = [0, s1];
  ret[5] = [0, s2];
  ret[6] = [0, s3];
  return ret;
}
function physWants(p1: number, p2: number, p3: number): GoodAvail {
  let ret: GoodAvail = {};
  ret[1] = [0, p1];
  ret[2] = [0, p2];
  ret[3] = [0, p3];
  return ret;
}
const SELL_AMT = 15;
function spiritSells(cost: number, s1: number, s2: number, s3: number): GoodAvail {
  let ret: GoodAvail = {};
  if (s1) {
    ret[1+3] = [SELL_AMT, cost];
  }
  if (s2) {
    ret[2+3] = [SELL_AMT, cost];
  }
  if (s3) {
    ret[3+3] = [SELL_AMT, cost];
  }
  return ret;
}
function physSells(cost: number, p1: number, p2: number, p3: number): GoodAvail {
  let ret: GoodAvail = {};
  if (p1) {
    ret[1] = [SELL_AMT, cost];
  }
  if (p2) {
    ret[2] = [SELL_AMT, cost];
  }
  if (p3) {
    ret[3] = [SELL_AMT, cost];
  }
  return ret;
}
export const GOODS: Partial<Record<string, GoodDef>> = {
  supply: {
    name: 'Supplies',
    realm: 'both',
    avail: {
      1: [99, 5],
      2: [99, 5],
      3: [99, 5],
      4: [99, 5],
      5: [99, 5],
      6: [99, 5],
    },
  },

  phys1: {
    name: 'Spoons',
    realm: 'phys',
    avail: {
      ...spiritWants(22, 31, 43),
      ...physSells(15, 1, 0, 0),
    },
  },
  phys2: {
    name: 'Table Legs',
    realm: 'phys',
    avail: {
      ...spiritWants(37, 52, 72),
      ...physSells(25, 1, 0, 0),
    },
  },
  phys3: {
    name: 'Dead Leaves',
    realm: 'phys',
    avail: {
      ...spiritWants(117, 139, 168),
      ...physSells(60, 0, 1, 0),
    },
  },
  phys4: {
    name: 'Fresh Soil',
    realm: 'phys',
    avail: {
      ...spiritWants(175, 209, 252),
      ...physSells(60, 0, 1, 0),
    },
  },
  phys5: {
    name: 'Books',
    realm: 'phys',
    avail: {
      ...spiritWants(177, 251, 341),
      ...physSells(120, 1, 0, 1),
    },
  },
  phys6: {
    name: 'Stone Carvings',
    realm: 'phys',
    avail: {
      ...spiritWants(292, 349, 420),
      ...physSells(150, 0, 1, 1),
    },
  },
  phys7: {
    name: 'Metal Trinkets',
    realm: 'phys',
    avail: {
      ...spiritWants(475, 437, 483),
      ...physSells(170, 0, 0, 1),
    },
  },

  spirit1: {
    name: 'Bottled Joy',
    realm: 'spirit',
    avail: {
      ...physWants(29, 39, 56),
      ...spiritSells(20, 1, 0, 0),
    },
  },
  spirit2: {
    name: 'Distil\'n of Anger',
    realm: 'spirit',
    avail: {
      ...physWants(44, 58, 84),
      ...spiritSells(30, 1, 0, 0),
    },
  },
  spirit3: {
    name: 'Canned Greed',
    realm: 'spirit',
    avail: {
      ...physWants(147, 163, 180),
      ...spiritSells(70, 0, 1, 0),
    },
  },
  spirit4: {
    name: 'Nostalgia Syrup',
    realm: 'spirit',
    avail: {
      ...physWants(210, 232, 257),
      ...spiritSells(100, 0, 1, 0),
    },
  },
  spirit5: {
    name: 'Despair Dust',
    realm: 'spirit',
    avail: {
      ...physWants(191, 253, 364),
      ...spiritSells(130, 1, 0, 1),
    },
  },
  spirit6: {
    name: 'Generosity Gel',
    realm: 'spirit',
    avail: {
      ...physWants(314, 349, 385),
      ...spiritSells(150, 0, 1, 1),
    },
  },
  spirit7: {
    name: 'Bliss Extract',
    realm: 'spirit',
    avail: {
      ...physWants(578, 559, 569),
      ...spiritSells(200, 0, 0, 1),
    },
  },

  mcguff1: {
    name: 'Painting of Belov\'d',
    realm: 'phys',
    avail: {
      1: [1, 200],
    },
    key: 'mcguff1',
  },
  mcguff2: {
    name: 'Dad\'s Pocketwatch',
    realm: 'phys',
    avail: {
      3: [1, 5000],
    },
    key: 'mcguff2',
  },
  mcguff3: {
    name: 'Childhood Mem\'ry',
    realm: 'spirit',
    avail: {
      5: [1, 5000],
    },
    key: 'mcguff3',
  },
  mcguff4: {
    name: 'Hope',
    realm: 'spirit',
    avail: {
      6: [1, 5000],
    },
    key: 'mcguff4',
  },
};
