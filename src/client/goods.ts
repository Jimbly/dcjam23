const spritesheet_ui = require('./img/ui');

export type GoodAvail = Record<number, [number, number]>;  // floor -> [count, cost]
export type GoodDef = {
  name: string;
  realm: 'phys' | 'spirit' | 'both';
  avail: GoodAvail;
  key?: string;
  icon?: number;
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
  } else {
    ret[1+3] = [0, cost];
  }
  if (s2) {
    ret[2+3] = [SELL_AMT, cost];
  } else {
    ret[2+3] = [0, cost];
  }
  if (s3) {
    ret[3+3] = [SELL_AMT, cost];
  } else {
    ret[3+3] = [0, cost];
  }
  ret[0] = [SELL_AMT, cost];
  return ret;
}
function physSells(cost: number, p1: number, p2: number, p3: number): GoodAvail {
  let ret: GoodAvail = {};
  if (p1) {
    ret[1] = [SELL_AMT, cost];
  } else {
    ret[1] = [0, cost];
  }
  if (p2) {
    ret[2] = [SELL_AMT, cost];
  } else {
    ret[2] = [0, cost];
  }
  if (p3) {
    ret[3] = [SELL_AMT, cost];
  } else {
    ret[3] = [0, cost];
  }
  ret[0] = [SELL_AMT, cost];
  return ret;
}
export const GOODS: Partial<Record<string, GoodDef>> = {
  supply: {
    name: 'Supplies',
    realm: 'both',
    avail: {
      0: [99, 5],
      1: [99, 5],
      2: [99, 5],
      3: [99, 5],
      4: [99, 5],
      5: [99, 5],
      6: [99, 5],
    },
    icon: spritesheet_ui.FRAME_ICON_SUPPLY,
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
      ...spiritWants(35, 48, 65),
      ...physSells(25, 1, 0, 0),
    },
  },
  phys3: {
    name: 'Dead Leaves',
    realm: 'phys',
    avail: {
      ...spiritWants(100, 116, 135),
      ...physSells(60, 0, 1, 0),
    },
  },
  phys4: {
    name: 'Fresh Soil',
    realm: 'phys',
    avail: {
      ...spiritWants(141, 162, 187),
      ...physSells(90, 0, 1, 0),
    },
  },
  phys5: {
    name: 'Books',
    realm: 'phys',
    avail: {
      ...spiritWants(148, 186, 231),
      ...physSells(120, 1, 0, 1),
    },
  },
  phys6: {
    name: 'Stone Carvings',
    realm: 'phys',
    avail: {
      ...spiritWants(280, 316, 361),
      ...physSells(190, 0, 1, 1),
    },
  },
  phys7: {
    name: 'Metal Trinkets',
    realm: 'phys',
    avail: {
      ...spiritWants(520, 485, 527),
      ...physSells(250, 0, 0, 1),
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
      ...physWants(55, 70, 97),
      ...spiritSells(40, 1, 0, 0),
    },
  },
  spirit3: {
    name: 'Canned Greed',
    realm: 'spirit',
    avail: {
      ...physWants(116, 126, 136),
      ...spiritSells(70, 0, 1, 0),
    },
  },
  spirit4: {
    name: 'Nostalgia Syrup',
    realm: 'spirit',
    avail: {
      ...physWants(170, 183, 196),
      ...spiritSells(110, 0, 1, 0),
    },
  },
  spirit5: {
    name: 'Despair Dust',
    realm: 'spirit',
    avail: {
      ...physWants(161, 191, 247),
      ...spiritSells(130, 1, 0, 1),
    },
  },
  spirit6: {
    name: 'Generosity Gel',
    realm: 'spirit',
    avail: {
      ...physWants(279, 299, 321),
      ...spiritSells(180, 0, 1, 1),
    },
  },
  spirit7: {
    name: 'Bliss Extract',
    realm: 'spirit',
    avail: {
      ...physWants(576, 561, 569),
      ...spiritSells(270, 0, 0, 1),
    },
  },

  mcguff1: {
    name: 'Painting of Belov\'d',
    realm: 'phys',
    avail: {
      0: [1, 5000],
      1: [1, 5000],
    },
    key: 'mcguff1',
    icon: spritesheet_ui.FRAME_ICON_KEY,
  },
  mcguff2: {
    name: 'Dad\'s Pocketwatch',
    realm: 'phys',
    avail: {
      0: [1, 5000],
      3: [1, 5000],
    },
    key: 'mcguff2',
    icon: spritesheet_ui.FRAME_ICON_KEY,
  },
  mcguff3: {
    name: 'Childhood Mem\'ry',
    realm: 'spirit',
    avail: {
      0: [1, 5000],
      5: [1, 5000],
    },
    key: 'mcguff3',
    icon: spritesheet_ui.FRAME_ICON_KEY,
  },
  mcguff4: {
    name: 'Hope',
    realm: 'spirit',
    avail: {
      0: [1, 5000],
      6: [1, 5000],
    },
    key: 'mcguff4',
    icon: spritesheet_ui.FRAME_ICON_KEY,
  },
};
