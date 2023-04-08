export const SUPPLY_GOOD: Good = {
  type: 'supply',
  count: 1,
  cost: 0,
};

import { playUISound } from 'glov/client/ui';
import { clone } from 'glov/common/util';
import {
  CrawlerScriptAPI,
  CrawlerScriptEventMapIcon,
  CrawlerScriptWhen,
  crawlerScriptRegisterEvent,
  crawlerScriptRegisterFunc,
} from '../common/crawler_script';
import {
  CrawlerCell,
  DIR_CELL,
  DirTypeOrCell,
  JSVec3,
} from '../common/crawler_state';
import { crawlerMyEntOptional } from './crawler_entity_client';
import { dialog, dialogMapIcon } from './dialog_data';
import { EntityDemoClient, Good, StatsData } from './entity_demo_client';
import { GOODS } from './goods';
import {
  bridgeRepairCost,
  myEnt,
  playerConsumeGood,
  playerHasGood,
  setScore,
  startRecruiting,
  startShopping,
  startUpgrade,
} from './play';
import { statusPush } from './status';

import type { TraitFactory } from 'glov/common/trait_factory';
import type { DataObject } from 'glov/common/types';

export function statusShort(text: string): void {
  statusPush(text).counter = 3000;
}

type Entity = EntityDemoClient;

const NAMES: Record<string, Record<number, string>> = {
  shop: {
    1: 'Kalded',
    2: 'Ontadrez',
    3: 'Hiberk',
    4: 'Merchant',
    5: 'Trader',
    6: 'Seller',
  },
  recruit: {
    1: 'Tuldor',
    2: 'Medjer',
    3: 'Norken',
    4: 'Throne',
    5: 'Power',
    6: 'Dominion',
  },
  upgrade: {
    1: 'Frodrurth',
    2: 'Mezer',
    3: 'Ientison',
    4: 'Contractor',
    5: 'Inspector',
    6: 'Mayor',
  },
};

function floorID(): number {
  return myEnt().data.floor;
}

crawlerScriptRegisterEvent({
  key: 'key_set_snd',
  when: CrawlerScriptWhen.PRE, // Must be PRE so that the if happens before the server applies it
  // map_icon: CrawlerScriptEventMapIcon.EXCLAIMATION,
  func: (api: CrawlerScriptAPI, cell: CrawlerCell, param: string) => {
    if (!param && cell.props?.key_cell) {
      param = cell.props?.key_cell;
    }
    if (!param) {
      api.status('key_pickup', '"key_set" event requires a string parameter');
    } else {
      if (!api.keyGet(param)) {
        api.keySet(param);
        playUISound('unlock');
        //api.status('key_pickup', `Acquired key "${param}"`);
      }
    }
  },
});


crawlerScriptRegisterEvent({
  key: 'shop',
  when: CrawlerScriptWhen.POST,
  map_icon: CrawlerScriptEventMapIcon.SHOP1,
  func: (api: CrawlerScriptAPI, cell: CrawlerCell, param: string) => {
    if (param === 'false') {
      return;
    }
    let name = NAMES.shop[floorID()] || 'Merchant';
    dialog('greet', `${name}: Welcome to my shop!`);
    startShopping();
  },
});
crawlerScriptRegisterEvent({
  key: 'recruit',
  when: CrawlerScriptWhen.POST,
  map_icon: CrawlerScriptEventMapIcon.SHOP2,
  func: (api: CrawlerScriptAPI, cell: CrawlerCell, param: string) => {
    if (param === 'false') {
      return;
    }
    let name = NAMES.recruit[floorID()] || 'Innkeeper';
    if (!myEnt().data.merc_capacity) {
      return dialog('sign', `${name}: Come back after you've signed a Covenant.`);
    }
    dialog('greet', `${name}: Need some protection?`);
    startRecruiting();
  },
});
crawlerScriptRegisterEvent({
  key: 'upgrade',
  when: CrawlerScriptWhen.POST,
  map_icon: CrawlerScriptEventMapIcon.SHOP3,
  func: (api: CrawlerScriptAPI, cell: CrawlerCell, param: string) => {
    if (param === 'false') {
      return;
    }
    let name = NAMES.upgrade[floorID()] || 'Govtman';
    dialog('greet', `${name}: No refunds!`);
    startUpgrade();
  },
});

crawlerScriptRegisterEvent({
  key: 'pedastal', // key is both a key ID and good def ID
  when: CrawlerScriptWhen.POST,
  map_icon: CrawlerScriptEventMapIcon.NONE,
  func: (api: CrawlerScriptAPI, cell: CrawlerCell, param: string) => {
    if (!param && cell.props?.key_cell) {
      param = cell.props?.key_cell;
    }
    if (!param) {
      api.status('key', '"pedastal" event requires a string parameter');
    } else {
      if (!api.keyGet(param)) {
        let me = myEnt();
        let { goods } = me.data;
        for (let ii = 0; ii < goods.length; ++ii) {
          let good = goods[ii];
          let good_def = GOODS[good.type];
          if (good_def && good_def.key === param) {
            api.keySet(param);
            playUISound('pedastal');
            api.status('key', `You reverently place your ${good_def.name} on the altar.`);
            let has_all = true;
            for (let good_id in GOODS) {
              let key = GOODS[good_id]!.key;
              if (key) {
                if (!api.keyGet(key)) {
                  has_all = false;
                }
              }
            }
            if (has_all) {
              api.keySet('final');
              api.status('final', 'The gateway is now open!');
              setScore();
            }
            goods.splice(ii, 1);
            return;
          }
        }
        let good_def = GOODS[param];
        if (good_def) {
          api.status('key', 'You long to place your ' +
            `${good_def.name} on the altar.`);
        } else {
          api.status('key', `Unknown good def ${param}`);
        }
      }
    }
  },
});

crawlerScriptRegisterEvent({
  key: 'final',
  when: CrawlerScriptWhen.POST,
  map_icon: CrawlerScriptEventMapIcon.NONE,
  func: (api: CrawlerScriptAPI, cell: CrawlerCell, param: string) => {
    dialog('final');
  },
});

crawlerScriptRegisterEvent({
  key: 'sign',
  when: CrawlerScriptWhen.PRE,
  map_icon: CrawlerScriptEventMapIcon.NONE,
  func: (api: CrawlerScriptAPI, cell: CrawlerCell, param: string) => {
    dialog('sign', param || '...');
  },
});

crawlerScriptRegisterEvent({
  key: 'dialog', // id [string parameter]
  when: CrawlerScriptWhen.PRE,
  map_icon: (param: string) => {
    let idx = param.indexOf(' ');
    let id = param;
    if (idx !== -1) {
      id = param.slice(0, idx);
      param = param.slice(idx + 1);
    } else {
      param = '';
    }
    return dialogMapIcon(id, param);
  },
  func: (api: CrawlerScriptAPI, cell: CrawlerCell, param: string) => {
    if (!param) {
      return api.status('dialog', 'Missing dialog ID');
    }
    let idx = param.indexOf(' ');
    let id = param;
    if (idx !== -1) {
      id = param.slice(0, idx);
      param = param.slice(idx + 1);
    } else {
      param = '';
    }
    dialog(id, param);
  },
});

crawlerScriptRegisterEvent({
  key: 'bridge',
  when: CrawlerScriptWhen.PRE,
  map_icon: CrawlerScriptEventMapIcon.NONE,
  func: (api: CrawlerScriptAPI, cell: CrawlerCell, param: string) => {
    let key_name = cell.getKeyNameForWall(DIR_CELL);
    if (!key_name) {
      return statusPush('Missing key');
    }
    if (api.keyGet(key_name)) {
      return;
    }
    let count = bridgeRepairCost(cell);
    playerConsumeGood({
      type: 'supply',
      count,
      cost: 0,
    });
    playUISound('bridge_repair');
    statusShort('Bridge fixed');
    statusShort(`-${count} Supplies`);
    api.keySet(key_name);
  },
});

crawlerScriptRegisterFunc('BRIDGE', function (
  script_api: CrawlerScriptAPI, cell: CrawlerCell, dir: DirTypeOrCell
): boolean {
  if (!crawlerMyEntOptional()) {
    return false;
  }
  let count = bridgeRepairCost(cell);
  return playerHasGood({
    type: 'supply',
    count,
    cost: 0,
  });
});


export function jamEventsStartup(): void {
  // ?
}

export type TraderOpts = {
};
export type TraderState = {
  home_pos: JSVec3;
};
export type EntityTrader = EntityDemoClient & {
  trader_state: TraderState;
  trader_opts: TraderOpts;
};

export function jamTraitsStartup(ent_factory: TraitFactory<Entity, DataObject>): void {
  ent_factory.registerTrait<TraderOpts, TraderState>('trader', {
    properties: {
      is_trader: true,
    },
    default_opts: {},
    alloc_state: function (opts: TraderOpts, ent: Entity) {
      let ret: TraderState = {
        home_pos: ent.data.pos.slice(0) as JSVec3,
      };
      return ret;
    }
  });
  ent_factory.registerTrait<StatsData, undefined>('stats_default', {
    default_opts: {
      hp: 10,
      hp_max: 0, // inherit from hp
      attack: 4,
      defense: 4,
    },
    alloc_state: function (opts: StatsData, ent: Entity) {
      if (!ent.data.stats) {
        ent.data.stats = clone(opts);
        if (!ent.data.stats.hp_max) {
          ent.data.stats.hp_max = ent.data.stats.hp;
        }
      }
      return undefined;
    }
  });

}
