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
import {
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
