import { clone } from 'glov/common/util';
import {
  CrawlerScriptAPI,
  CrawlerScriptEventMapIcon,
  CrawlerScriptWhen,
  crawlerScriptRegisterEvent,
} from '../common/crawler_script';
import {
  CrawlerCell,
  JSVec3,
} from '../common/crawler_state';
import { EntityDemoClient, StatsData } from './entity_demo_client';
import { GOODS } from './goods';
import {
  myEnt,
  startRecruiting,
  startShopping,
} from './play';

import type { TraitFactory } from 'glov/common/trait_factory';
import type { DataObject } from 'glov/common/types';

type Entity = EntityDemoClient;


crawlerScriptRegisterEvent({
  key: 'shop',
  when: CrawlerScriptWhen.POST,
  map_icon: CrawlerScriptEventMapIcon.SHOP1,
  func: (api: CrawlerScriptAPI, cell: CrawlerCell, param: string) => {
    startShopping();
  },
});
crawlerScriptRegisterEvent({
  key: 'recruit',
  when: CrawlerScriptWhen.POST,
  map_icon: CrawlerScriptEventMapIcon.SHOP2,
  func: (api: CrawlerScriptAPI, cell: CrawlerCell, param: string) => {
    startRecruiting();
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
            api.status('key', `You reverently place your ${good_def.name} on the altar`);
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
              api.status('final', 'The gateway is now open');
            }
            goods.splice(ii, 1);
            return;
          }
        }
        let good_def = GOODS[param];
        if (good_def) {
          api.status('key', 'You long to place your ' +
            `${good_def.name} on the altar`);
        } else {
          api.status('key', `Unknown good def ${param}`);
        }
      }
    }
  },
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
