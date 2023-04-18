import assert from 'assert';
import { cmd_parse } from 'glov/client/cmds';
import * as engine from 'glov/client/engine';
import {
  getFrameDt,
  getFrameIndex,
} from 'glov/client/engine';
import { ClientEntityManagerInterface } from 'glov/client/entity_manager_client';
import {
  ALIGN,
  Font,
  FontStyle,
  fontStyle,
  fontStyleColored,
} from 'glov/client/font';
import * as input from 'glov/client/input';
import {
  KEYS,
  PAD,
  keyDown,
  keyDownEdge,
  keyUpEdge,
  padButtonDown,
  padButtonUpEdge,
} from 'glov/client/input';
import * as score_system from 'glov/client/score.js';
import { ScrollArea, scrollAreaCreate } from 'glov/client/scroll_area';
import { MenuItem } from 'glov/client/selection_box';
import * as settings from 'glov/client/settings';
import { SimpleMenu, simpleMenuCreate } from 'glov/client/simple_menu';
import {
  FADE,
  GlovSoundSetUp,
  soundPlay,
  soundPlayMusic,
  soundResumed,
} from 'glov/client/sound';
import {
  spotSuppressPad,
} from 'glov/client/spot';
import {
  Sprite,
  UISprite,
  spriteCreate,
} from 'glov/client/sprites';
import * as ui from 'glov/client/ui';
import {
  ButtonStateString,
  isMenuUp,
  playUISound,
  uiPanel,
} from 'glov/client/ui';
import * as urlhash from 'glov/client/urlhash';
import walltime from 'glov/client/walltime';
import { webFSAPI } from 'glov/client/webfs';
import {
  ClientChannelWorker,
  EntityID,
} from 'glov/common/types';
import {
  clamp,
  clone,
  lerp,
} from 'glov/common/util';
import {
  Vec2,
  Vec3,
  v2set,
  v2sub,
  v3copy,
  v3same,
  vec2,
  vec4,
} from 'glov/common/vmath';
import { getEffCell } from '../common/crawler_script';
import {
  BLOCK_MOVE,
  BLOCK_VIS,
  CrawlerCell,
  CrawlerLevel,
  DIR_CELL,
  DirType,
  crawlerLoadData,
  dirFromDelta,
} from '../common/crawler_state';
import {
  aiDoFloor,
  aiTraitsClientStartup,
  entitiesAdjacentTo,
} from './ai';
import { cleanupCombat, combatStartup, doCombat, mercPosOverrideWeight } from './combat';
// import './client_cmds';
import { buildModeActive, buildModeOverlayActive, crawlerBuildModeUI } from './crawler_build_mode';
import {
  crawlerCommStart,
  crawlerCommWant,
  getChatUI,
} from './crawler_comm';
import { CrawlerController } from './crawler_controller';
import {
  crawlerEntitiesAt,
  crawlerEntityClientStartupEarly,
  crawlerEntityManager,
  crawlerEntityTraitsClientStartup,
  crawlerMyEnt,
  crawlerMyEntOptional,
  isLocal,
  isOnline,
} from './crawler_entity_client';
import {
  crawlerMapViewDraw,
  crawlerMapViewStartup,
  mapViewActive,
  mapViewSetActive,
  mapViewToggle,
} from './crawler_map_view';
import {
  crawlerBuildModeActivate,
  crawlerController,
  crawlerCurSavePlayTime,
  crawlerGameState,
  crawlerPlayInitOffline,
  crawlerPlayStartup,
  crawlerPlayWantMode,
  crawlerRenderFrame,
  crawlerRenderFramePrep,
  crawlerSaveGame,
  crawlerScriptAPI,
  getScaledFrameDt,
} from './crawler_play';
import {
  crawlerRenderViewportGet,
  crawlerRenderViewportSet,
  renderPrep,
} from './crawler_render';
import {
  crawlerEntInFront,
  crawlerRenderEntitiesPrep,
  crawlerRenderEntitiesStartup,
} from './crawler_render_entities';
import { crawlerScriptAPIDummyServer } from './crawler_script_api_client';
import { crawlerOnScreenButton } from './crawler_ui';
import * as dawnbringer from './dawnbringer32';
import './dialog_data'; // for side effects
import {
  dialogMoveLocked,
  dialogReset,
  dialogRun,
  dialogStartup,
} from './dialog_system';
import {
  EntityDemoClient,
  Good,
  Merc,
  entityManager,
} from './entity_demo_client';
// import { EntityDemoClient } from './entity_demo_client';
import {
  game_height,
  game_width,
  render_height,
  render_width,
} from './globals';
import {
  GOODS,
} from './goods';
import { jamTraitsStartup, statusShort } from './jam_events';
import { levelGenTest } from './level_gen_test';
import { MERC_LIST } from './mercs';
import { renderAppStartup } from './render_app';
import {
  statusPush,
  statusSet,
  statusTick,
} from './status';
import { UPGRADES } from './upgrades';

const spritesheet_ui = require('./img/ui');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { floor, max, min, round, sqrt } = Math;

declare module 'glov/client/settings' {
  export let ai_pause: 0 | 1; // TODO: move to ai.ts
  export let show_fps: 0 | 1;
  export let volume_sound: number;
  export let volume_music: number;
  export let turn_toggle: 0 | 1;
}

declare module 'glov/client/ui' {
  interface UISprites {
    panel_mini: UISprite;
    panel_mini_red: UISprite;
  }
}

const MINIMAP_RADIUS = 3;
const MINIMAP_X = 262;
const MINIMAP_Y = 3;
const MINIMAP_W = 5+7*(MINIMAP_RADIUS*2 + 1);
const COMPASS_X = 104;
const COMPASS_Y = 2;
const VIEWPORT_X0 = 3;
const VIEWPORT_Y0 = 6;

const BUTTON_W = 26;

type Entity = EntityDemoClient;

let font: Font;
let tiny_font: Font;

let frame_wall_time = 0;
let loading_level = false;

let controller: CrawlerController;

let pause_menu_up = false;
let inventory_up = false;
let recruit_up = false;
let upgrade_up = false;

let last_level: CrawlerLevel | null = null;

let bg_sprite: Sprite;
let button_sprites: Record<ButtonStateString, Sprite>;
let button_sprites_down: Record<ButtonStateString, Sprite>;
let button_sprites_notext: Record<ButtonStateString, Sprite>;
let button_sprites_notext_down: Record<ButtonStateString, Sprite>;
type BarSprite = {
  bg: Sprite;
  hp: Sprite;
  empty: Sprite;
};
let bar_sprites: {
  healthbar: BarSprite;
};
let portraits: Sprite;

export function myEnt(): Entity {
  return crawlerMyEnt() as Entity;
}

function myEntOptional(): Entity | undefined {
  return crawlerMyEntOptional() as Entity | undefined;
}

function calcNetWorth(): number {
  let { data } = myEnt();
  let { goods, money, mercs, upgrade } = data;
  let ret = money;
  ret += UPGRADES[upgrade].cost;
  for (let ii = 0; ii < goods.length; ++ii) {
    let good = goods[ii];
    let { cost } = good;
    if (good.type === 'supply') {
      cost = 5;
    }
    if (cost && isFinite(cost)) {
      ret += cost * good.count;
    }
  }
  for (let ii = 0; ii < mercs.length; ++ii) {
    ret += mercs[ii].cost;
  }
  let script_api = crawlerScriptAPI();
  for (let ii = 0; ii < 4; ++ii) {
    if (script_api.keyGet(`mcguff1${ii}`)) {
      ret += 5000;
    }
  }
  return round(ret);
}

// function entityManager(): ClientEntityManagerInterface<Entity> {
//   return crawlerEntityManager() as ClientEntityManagerInterface<Entity>;
// }

const PAUSE_MENU_W = 160;
let pause_menu: SimpleMenu;
function pauseMenu(): void {
  if (!pause_menu) {
    pause_menu = simpleMenuCreate({
      x: floor((game_width - PAUSE_MENU_W)/2),
      y: 50,
      z: Z.MODAL + 2,
      width: PAUSE_MENU_W,
    });
  }
  let items: MenuItem[] = [{
    name: 'Return to game',
    cb: function () {
      pause_menu_up = false;
    },
  }, {
    name: 'SFX Vol',
    slider: true,
    value_inc: 0.05,
    value_min: 0,
    value_max: 1,
  }, {
    name: 'Mus Vol',
    slider: true,
    value_inc: 0.05,
    value_min: 0,
    value_max: 1,
  }, {
    name: `Turn: ${settings.turn_toggle ? 'A/S/4/6/←/→': 'Q/E/7/9/LB/RB'}`,
    cb: () => {
      settings.set('turn_toggle', 1 - settings.turn_toggle);
    },
  }, {
    name: 'Cheat',
    cb: () => {
      pause_menu_up = false;
      ui.modalDialog({
        title: 'Enter Cheat Mode?',
        text: 'Too hard?  Tired of the grind?  This will give you lots of money, the best upgrades,' +
          ' and all key items.\n\n' +
          'This should let you experience the end-game content, however it will disable high scores.  Really cheat?',
        buttons: {
          yes: () => {
            let script_api = crawlerScriptAPI();
            let { data } = myEnt();
            data.cheat = true;
            data.money = 99999;
            data.upgrade = 6;
            data.merc_capacity = UPGRADES[data.upgrade].merc_capacity;
            data.good_capacity = UPGRADES[data.upgrade].good_capacity;
            data.mercs = [];
            for (let ii = 0; ii < data.merc_capacity; ++ii) {
              let merc = clone(MERC_LIST[4 + (ii % 2)]);
              data.mercs.push(merc);
            }
            data.goods = [{
              type: 'supply',
              count: data.good_capacity,
              cost: 5,
            }];
            for (let ii = 1; ii <= 4; ++ii) {
              if (!script_api.keyGet(`mcguff${ii}`)) {
                data.goods.push({
                  type: `mcguff${ii}`,
                  count: 1,
                  cost: 5000,
                });
              }
            }

          },
          no: null,
        },
      });
    },
  }];
  if (isLocal()) {
    items.push({
      name: 'Save game',
      cb: function () {
        crawlerSaveGame('manual');
        statusPush('Game saved.');
        pause_menu_up = false;
      },
    });
  }
  items.push({
    name: isOnline() ? 'Return to Title' : 'Save and Exit',
    cb: function () {
      if (!isOnline()) {
        crawlerSaveGame('manual');
      }
      urlhash.go('');
    },
  });
  if (isLocal()) {
    // let slot = urlhash.get('slot') || '1';
    // let manual_data = localStorageGetJSON<SavedGameData>(`savedgame_${slot}.manual`, {});
    // let auto_data = localStorageGetJSON<SavedGameData>(`savedgame_${slot}.auto`, {});
    // if (manual_data.timestamp) {
    //   items.push({
    //     name: 'Load Game',
    //     cb: function () {
    //       // ?
    //     },
    //   });
    // }

    items.push({
      name: 'Exit without saving',
      cb: function () {
        urlhash.go('');
      },
    });
  }

  let volume_item = items[1];
  volume_item.value = settings.volume_sound;
  volume_item.name = `SFX Vol: ${(settings.volume_sound * 100).toFixed(0)}`;
  volume_item = items[2];
  volume_item.value = settings.volume_music;
  volume_item.name = `Mus Vol: ${(settings.volume_music * 100).toFixed(0)}`;

  pause_menu.run({
    slider_w: 80,
    items,
  });

  settings.set('volume_sound', pause_menu.getItem(1).value);
  settings.set('volume_music', pause_menu.getItem(2).value);

  ui.menuUp();
}

export function playerHasKeyGood(key: string): boolean {
  assert(key);
  let me = myEnt();
  let { goods } = me.data;
  for (let ii = 0; ii < goods.length; ++ii) {
    let pgd = GOODS[goods[ii].type];
    assert(pgd);
    if (goods[ii] && pgd.key === key) {
      return true;
    }
  }
  return false;
}

export function playerHasGood(good: Good): boolean {
  let me = myEnt();
  let { goods } = me.data;
  for (let ii = 0; ii < goods.length; ++ii) {
    let pg = goods[ii];
    if (pg.type === good.type && pg.count >= good.count) {
      return true;
    }
  }
  return false;
}

export function playerSupplies(): number {
  let me = myEnt();
  let { goods } = me.data;
  for (let ii = 0; ii < goods.length; ++ii) {
    let pg = goods[ii];
    if (pg.type === 'supply') {
      return pg.count;
    }
  }
  return 0;
}

export function playerConsumeGood(good: Good): void {
  let me = myEnt();
  let { goods } = me.data;
  for (let ii = 0; ii < goods.length; ++ii) {
    let pg = goods[ii];
    if (pg.type === good.type && pg.count >= good.count) {
      pg.count -= good.count;
      if (!pg.count) {
        goods.splice(ii, 1);
      }
      return;
    }
  }
  assert(false);
}

export function playerAddSupply(count: number): void {
  let me = myEnt();
  let { data } = me;
  let matching_good: Good | null = null;
  // let num_goods = 0;
  for (let ii = 0; ii < data.goods.length; ++ii) {
    let good = data.goods[ii];
    if (good.type === 'supply') {
      matching_good = good;
    }
    // let good_def = GOODS[good.type];
    // assert(good_def);
    // if (!good_def.key) {
    //   num_goods += data.goods[ii].count;
    // }
  }
  // let overloaded = num_goods >= data.good_capacity;
  if (matching_good) {
    matching_good.count += count;
    matching_good.cost = (matching_good.cost * matching_good.count) /
      (matching_good.count + count);
  } else {
    data.goods.push({
      type: 'supply',
      count,
      cost: 0,
    });
  }

  statusShort(`+${count} Supply`);
}

export function playerAddMoney(count: number): void {
  myEnt().data.money += count;
  statusPush(`+${count} Money`);
  setScore(); // eslint-disable-line @typescript-eslint/no-use-before-define
}

function initGoods(trader: Entity): void {
  let data = trader.data;
  let floor_id = data.floor;
  // let level = game_state.level!;
  // let realm = level.props.realm;
  let goods = [];
  for (let good_id in GOODS) {
    let good_def = GOODS[good_id]!;
    let { avail } = good_def;
    let pair = avail[floor_id];
    if (pair) {
      let count = pair[0];
      if (good_def.key) {
        if (crawlerScriptAPI().keyGet(good_def.key)) {
          // already activated, completely hide
          continue;
        }
        if (playerHasKeyGood(good_def.key)) {
          // player has it, do not stock another one
          count = 0;
        }
      }
      goods.push({
        type: good_id,
        count,
        cost: pair[1],
      });
    }
  }
  data.goods = goods;
}

const style_text = fontStyle(null, {
  color: 0xFFFFFFff,
  outline_width: 4,
  outline_color: 0x000000ff,
});

const style_not_interested = fontStyle(null, {
  color: 0x404040ff,
});
const style_not_allowed = fontStyle(null, {
  color: 0x800000ff,
});


const style_by_realm: Record<string, FontStyle> = {
  both: fontStyle(null, {
    color: dawnbringer.font_colors[9],
  }),
  phys: fontStyle(null, {
    color: dawnbringer.font_colors[21],
  }),
  spirit: fontStyle(null, {
    color: dawnbringer.font_colors[0],
  }),
  key_phys: fontStyle(null, {
    color: dawnbringer.font_colors[21],
    outline_width: 3,
    outline_color: dawnbringer.font_colors[5],
  }),
  key_spirit: fontStyle(null, {
    color: dawnbringer.font_colors[0],
    outline_width: 3,
    outline_color: dawnbringer.font_colors[5],
  }),
};

const style_money = fontStyle(null, {
  color: 0xFFFF80ff,
});

function shift(): boolean {
  return keyDown(KEYS.SHIFT) || padButtonDown(PAD.LEFT_TRIGGER) || padButtonDown(PAD.RIGHT_TRIGGER);
}

function drawBar(
  bar: BarSprite,
  x: number, y: number, z: number,
  w: number, h: number,
  p: number,
): void {
  const MIN_VIS_W = 4;
  let full_w = round(p * w);
  if (p > 0 && p < 1) {
    full_w = clamp(full_w, MIN_VIS_W, w - MIN_VIS_W/2);
  }
  let empty_w = w - full_w;
  ui.drawBox({
    x, y, z,
    w, h,
  }, bar.bg, 1);
  if (full_w) {
    ui.drawBox({
      x, y,
      w: full_w, h,
      z: z + 1,
    }, bar.hp, 1);
  }
  if (empty_w) {
    let temp_x = x + full_w;
    if (full_w) {
      temp_x -= 2;
      empty_w += 2;
    }
    ui.drawBox({
      x: temp_x, y,
      w: empty_w, h,
      z: z + 1,
    }, bar.empty, 1);
  }
}

export function drawHealthBar(
  x: number, y: number, z: number,
  w: number, h: number,
  hp: number, hp_max: number,
  show_text: boolean
): void {
  drawBar(bar_sprites.healthbar, x, y, z, w, h, hp / hp_max);
  if (show_text) {
    tiny_font.drawSizedAligned(style_text, x, y + (settings.pixely > 1 ? 0.5 : 0), z+2,
      8, ALIGN.HVCENTERFIT,
      w, h, `${hp}`);
  }
}

const OVERLAY_PAD = 4;
const OVERLAY_X0 = 1;
const OVERLAY_Y0 = 1;
const OVERLAY_W = game_width - 2;
const OVERLAY_H = game_height - 2;
const OVERLAY_PLAYER_X0 = floor(game_width / 2);
const OVERLAY_SUB_W = floor(OVERLAY_W / 2);


let inventory_last_frame: number = -1;
let inventory_goods: string[];
let inventory_scroll: ScrollArea;
let buy_mode_max = false;
let inventory_profit = 0;
function inventoryMenu(): boolean {
  if (!inventory_up) {
    return false;
  }
  recruit_up = false;
  upgrade_up = false;
  let reset = false;
  if (inventory_last_frame !== getFrameIndex() - 1) {
    reset = true;
    inventory_profit = 0;
    inventory_scroll?.resetScroll();
  }
  inventory_last_frame = getFrameIndex();
  let me = myEnt();
  let data = me.data;
  let other_ents = crawlerEntitiesAt(entityManager(), data.pos, data.floor, true) as Entity[];
  let trader: Entity | null = null;
  let floor_id = crawlerGameState().floor_id;
  for (let ii = 0; ii < other_ents.length; ++ii) {
    let ent = other_ents[ii];
    if (ent.is_trader) {
      trader = ent;
    }
  }

  if (trader) {
    if (trader.data.last_init !== data.journeys) {
      // Init trade goods if the player has completed a journey
      initGoods(trader);
      trader.data.last_init = data.journeys;
    }
  }

  let z = Z.OVERLAY_UI;

  let local_buy_max = Boolean((buy_mode_max ? 1 : 0) ^ (shift() ? 1 : 0));
  if (trader && data.journeys && ui.buttonText({
    x: floor(OVERLAY_X0 + (OVERLAY_W - ui.button_width) / 2),
    y: OVERLAY_Y0 + OVERLAY_H - ui.button_height - OVERLAY_PAD,
    z,
    text: local_buy_max ? 'Buy/Sell: MAX' : 'Buy/Sell: 1',
    tooltip: 'Hint: Hold SHIFT or LeftTrigger to toggle',
  })) {
    buy_mode_max = !buy_mode_max;
  }

  if (!data.upgrade && data.money) {
    font.draw({
      align: ALIGN.HCENTER|ALIGN.HWRAP,
      x: OVERLAY_X0 + 10, y: 128, z,
      w: OVERLAY_W - 20,
      text: 'Kalded: What a lovely painting!  I\'ll hold on to that in case you want to buy it back later.' +
        '  I can\'t sell any Trade Goods to you until you sign a Covenant.  Talk to Frodrurth' +
        ' at the Ministry of Trade and then come see me again!',
    });
  }

  const y1 = OVERLAY_Y0 + OVERLAY_H;
  // half width
  const w = OVERLAY_SUB_W - OVERLAY_PAD * 2;

  // Player inventory header
  const inv_x = OVERLAY_PLAYER_X0 + OVERLAY_PAD;
  let overloaded: boolean;
  let num_goods = 0;
  {
    let x = inv_x;
    let y = OVERLAY_Y0 + OVERLAY_PAD;
    if (inventory_profit) {
      font.draw({
        align: ALIGN.HRIGHT,
        x, y: y1 - ui.font_height - 3, z,
        w,
        text: `Profit: ${round(inventory_profit)}`,
      });
    } else if (!trader) {
      font.draw({
        align: ALIGN.HRIGHT,
        x, y: y1 - ui.font_height - 3, z,
        w,
        text: `Net Worth: ${calcNetWorth()}`,
      });
    }
    font.draw({
      align: ALIGN.HCENTER,
      x, y, z,
      w,
      text: 'PLAYER',
    });
    y += ui.font_height + 1;
    spritesheet_ui.sprite.draw({
      x: x + floor(w/2) + 4, y: y + 2, z, w: 8, h: 8,
      frame: spritesheet_ui.FRAME_ICON_COIN,
    });
    font.draw({
      style: style_money,
      align: ALIGN.HLEFT,
      x: x + floor(w/2) + 4 + 9, y, z,
      text: `${data.money}`,
    });

    for (let ii = 0; ii < data.goods.length; ++ii) {
      let good_def = GOODS[data.goods[ii].type];
      assert(good_def);
      if (!good_def.key) {
        num_goods += data.goods[ii].count;
      }
    }
    overloaded = num_goods >= data.good_capacity;
    font.draw({
      style: overloaded ? style_not_allowed : undefined,
      align: ALIGN.HCENTER,
      x, y, z, w: floor(w/2),
      text: `${num_goods} / ${data.good_capacity}`,
    });
  }

  // Shop header
  const trader_x = OVERLAY_X0 + OVERLAY_PAD;
  if (trader) {
    let x = trader_x;
    let y = OVERLAY_Y0 + OVERLAY_PAD;
    font.draw({
      align: ALIGN.HCENTER,
      x, y, z,
      w,
      text: 'SHOP',
    });
    y += ui.font_height + 1;
    y += ui.font_height + 1;
  }

  // Goods list
  if (reset) {
    let good_sets = [data.goods];
    if (trader) {
      good_sets.unshift(trader.data.goods);
    }
    let done: Record<string, boolean> = {};
    inventory_goods = [];
    good_sets.forEach(function (list) {
      for (let ii = 0; ii < list.length; ++ii) {
        let good = list[ii];
        if (!done[good.type]) {
          done[good.type] = true;
          inventory_goods.push(good.type);
        }
      }
    });
  }

  let y = 36;
  if (trader) {
    spritesheet_ui.sprite.draw({
      x: OVERLAY_X0 + floor(OVERLAY_W/2) - 2, y: y - 10, z, w: 8, h: 8,
      frame: spritesheet_ui.FRAME_ICON_COIN,
    });
    // font.draw({
    //   align: ALIGN.HCENTER,
    //   x: OVERLAY_X0, y: y - ui.font_height - 2, z,
    //   w: OVERLAY_W,
    //   text: 'Value',
    // });
  }

  if (!inventory_scroll) {
    inventory_scroll = scrollAreaCreate({
      z,
      background_color: null,
      auto_hide: true,
    });
  }

  inventory_scroll.keyboardScroll();

  inventory_scroll.begin({
    x: OVERLAY_X0 + 3, y: y - 2, w: OVERLAY_W - 6,
    h: y1 - OVERLAY_PAD - y + 2 + (trader ? -ui.button_height : -ui.font_height),
  });
  y = 2;

  const button_w = ui.button_height;
  const count_w = 6*3;
  const value_w = 6*4;
  const value_x = floor(0 + (OVERLAY_W - value_w) / 2);
  const button_buy_x = value_x - 1 - button_w;
  const trader_count_x = button_buy_x - value_w - 1;
  const button_sell_x = value_x + value_w + 1;
  const player_count_x = button_sell_x + button_w + 1;
  const button_y_offs = floor((ui.button_height - ui.font_height) / 2);


  let goods = data.goods;
  for (let ii = 0; ii < inventory_goods.length; ++ii) {
    let good_id = inventory_goods[ii];
    let good_def = GOODS[good_id];
    assert(good_def);
    let player_good: Good | null = null;
    for (let jj = 0; jj < goods.length; ++jj) {
      let good = goods[jj];
      if (good.type === good_id) {
        player_good = good;
      }
    }
    let trader_good: Good | null = null;
    if (trader) {
      for (let jj = 0; jj < trader.data.goods.length; ++jj) {
        let good = trader.data.goods[jj];
        if (good.type === good_id) {
          trader_good = good;
        }
      }
    }
    let trader_only_buys = trader_good && good_def.avail[floor_id] && !good_def.avail[floor_id][0];
    if (trader_only_buys && !trader_good?.count && !player_good?.count) {
      continue;
    }
    let style = style_by_realm[good_def.key ? `key_${good_def.realm}` : good_def.realm];
    let trader_cost = 0;
    if (trader_good) {
      trader_cost = trader_good.cost;
      if (trader_good.type === 'mcguff1' && trader_good.count === 0 && !crawlerScriptAPI().keyGet('sold_mcguff1')) {
        trader_cost = 200;
      }
      let show_buy_button = Boolean(!trader_only_buys || trader_good.count);
      let show_value = true;
      if (!trader_good.count && good_def.key) {
        // don't even show name, player must have one
        show_buy_button = false;
        if (!player_good) {
          show_value = false;
        }
      } else {
        let xx = trader_x;
        if (good_def.icon) {
          spritesheet_ui.sprite.draw({
            x: xx, y: y + 2, z,
            w: 8, h: 8,
            frame: good_def.icon,
          });
          xx += 9 + (good_def.key ? 1 : 0);
        }
        font.draw({
          style,
          align: ALIGN.HLEFT,
          x: xx, y, z,
          w,
          text: good_def.name,
        });
      }
      if (good_def.key) {
        // show no count
      } else if (!trader_only_buys || trader_good.count) {
        font.draw({
          style: trader_only_buys || trader_good.count ? undefined : style_not_allowed,
          align: ALIGN.HCENTER,
          x: trader_count_x, y, z,
          w: count_w,
          text: `${trader_good.count}`,
        });
      }
      if (show_value) {
        font.draw({
          style: trader_good.count && trader_cost > data.money ? style_not_allowed : style_money,
          align: ALIGN.HCENTERFIT,
          x: value_x, y, z,
          w: value_w,
          text: `${trader_cost}`,
        });
      }
      let num_to_buy = 1;
      if (local_buy_max) {
        num_to_buy = min(trader_good.count, floor(data.money / trader_cost), data.good_capacity - num_goods);
      }
      if (show_buy_button && ui.buttonText({
        x: button_buy_x, y: y - button_y_offs,
        w: button_w, z,
        text: '→',
        sound: 'buy',
        tooltip: `Buy ${num_to_buy}`,
        disabled: trader_good.count === 0 || trader_cost > data.money ||
          overloaded && !good_def.key,
        auto_focus: good_id === 'supply' && reset,
      })) {
        if (!player_good) {
          player_good = {
            type: good_id,
            count: 0,
            cost: 0,
          };
          data.goods.push(player_good);
        }
        player_good.cost = (player_good.cost * player_good.count + trader_cost * num_to_buy) /
          (player_good.count + num_to_buy);
        trader_good.count-= num_to_buy;
        player_good.count+= num_to_buy;
        data.money -= trader_cost * num_to_buy;
        data.town_counter++;
        if (good_def.key) {
          setScore(); // eslint-disable-line @typescript-eslint/no-use-before-define
        }
      }
    } else if (trader && !good_def.key) {
      font.draw({
        style: style_not_interested,
        align: ALIGN.HRIGHT,
        x: value_x + value_w, y, z,
        w: 0,
        text: 'Not interested',
      });
    }
    if (player_good || good_id === 'supply') {
      let good_name_x = player_count_x + 1;
      if (good_def.key) {
        // show no count
      } else {
        font.draw({
          align: ALIGN.HCENTER,
          x: player_count_x, y, z,
          w: count_w,
          text: `${player_good?.count || 0}`,
        });
        good_name_x += count_w;
      }
      if (good_def.icon) {
        spritesheet_ui.sprite.draw({
          x: good_name_x, y: y + 2, z,
          w: 8, h: 8,
          frame: good_def.icon,
        });
        good_name_x += 9 + (good_def.key ? 1 : 0);
      }
      font.draw({
        style,
        align: ALIGN.HLEFT,
        x: good_name_x, y, z,
        w,
        text: good_def.name,
      });
      if (trader_good && player_good) {
        let num_to_sell = 1;
        if (local_buy_max) {
          num_to_sell = player_good.count;
        }
        if (ui.buttonText({
          x: button_sell_x, y: y - button_y_offs,
          w: button_w, z,
          text: '←',
          sound: 'sell',
          tooltip: `Sell ${num_to_sell}`,
        })) {
          player_good.count -= num_to_sell;
          trader_good.count += num_to_sell;
          let dmoney = trader_cost * num_to_sell;
          inventory_profit += dmoney - player_good.cost * num_to_sell;
          data.money += dmoney;
          data.town_counter++;
          if (!player_good.count) {
            data.goods = data.goods.filter((elem) => elem.type !== good_id);
          }
          setScore(); // eslint-disable-line @typescript-eslint/no-use-before-define
          crawlerScriptAPI().keySet(`sold_${good_id}`);
        }
      } else if (!trader && (!good_def.key || engine.DEBUG && shift()) && player_good) {
        if (ui.buttonText({
          x: button_sell_x, y: y - button_y_offs,
          w: button_w, z,
          text: 'X',
          tooltip: 'Trash',
          sound: 'drop',
        })) {
          player_good.count--;
          if (!player_good.count) {
            data.goods = data.goods.filter((elem) => elem.type !== good_id);
          }
        }
      }
    } else if (trader_only_buys) {
      ui.buttonText({
        x: button_sell_x, y: y - button_y_offs,
        w: button_w, z,
        text: '<-',
        sound: 'sell',
        tooltip: 'Sell',
        disabled: true,
      });
    }

    y += ui.button_height + 1;
  }

  inventory_scroll.end(y);

  if (trader) {
    uiPanel({
      x: OVERLAY_X0, y: OVERLAY_Y0,
      w: OVERLAY_W, h: OVERLAY_H, z: z - 1,
    });
  } else {
    uiPanel({
      x: OVERLAY_PLAYER_X0, y: OVERLAY_Y0,
      w: OVERLAY_SUB_W, h: OVERLAY_H, z: z - 1,
    });
  }
  return Boolean(trader);
}

let style_dead = fontStyleColored(null, dawnbringer.font_colors[25]);
let color_black = vec4(0, 0, 0, 1);

const MERC_H = 26;
const MERC_W = 42;
function drawMerc(merc: Merc | null, x: number, y: number, z: number, expanded: boolean, is_player: boolean): void {
  let x1 = x + 19 + (expanded ? 2 : 0);
  let x2 = x1 + 24;
  let y1 = y + 2;
  let y2 = y1 + 8;
  let dead = merc && merc.hp <= 0;
  let style = dead ? style_dead : undefined;
  let color = dead ? color_black : undefined;
  portraits.draw({
    x: x + 2, y: y1, z, w: 16, h: 16,
    frame: dead ? 63 : (merc && merc.portrait || 0),
  });
  if (merc) {
    spritesheet_ui.sprite.draw({
      x: x1, y: y1, z, w: 8, h: 8,
      frame: spritesheet_ui.FRAME_ICON_ATTACK,
      color,
    });
    tiny_font.draw({
      style,
      align: ALIGN.HCENTER,
      x: x1 + 8, y: y1, z, w: 12, h: 8,
      size: 8,
      text: `${merc.attack}`,
    });
    spritesheet_ui.sprite.draw({
      x: x1, y: y2, z, w: 8, h: 8,
      frame: spritesheet_ui.FRAME_ICON_DEFENSE,
      color,
    });
    tiny_font.draw({
      style,
      align: ALIGN.HCENTER,
      x: x1 + 8, y: y2, z, w: 12, h: 8,
      size: 8,
      text: `${merc.defense}`,
    });
    if (expanded) {
      spritesheet_ui.sprite.draw({
        x: x2, y: y1, z, w: 8, h: 8,
        frame: spritesheet_ui.FRAME_ICON_HP,
      });
      tiny_font.draw({
        style: merc.hp ? undefined : style_not_allowed,
        align: ALIGN.HLEFT,
        x: x2 + 9, y: y1, z, w: 12, h: 8,
        size: 8,
        text: merc.hp ? is_player ? `${merc.hp}/${merc.hp_max}` : `${merc.hp_max}` : '0',
      });
      if (!is_player) {
        spritesheet_ui.sprite.draw({
          x: x2, y: y2, z, w: 8, h: 8,
          frame: spritesheet_ui.FRAME_ICON_COIN,
        });
        tiny_font.draw({
          style: merc.cost > myEnt().data.money ? style_not_allowed : undefined,
          align: ALIGN.HLEFT,
          x: x2 + 9, y: y2, z, w: 12, h: 8,
          size: 8,
          text: `${merc.cost}`,
        });
      }
    }
    if (!expanded || is_player && merc.hp < merc.hp_max) {
      drawHealthBar(x + 2, y + 18, z + 1, MERC_W - 4, 6, merc.hp, merc.hp_max, false);
    }
  }
}

function recruitMenu(): void {
  if (!recruit_up) {
    return;
  }

  let me = myEnt();
  let data = me.data;

  let z = Z.OVERLAY_UI;
  // const y1 = OVERLAY_Y0 + OVERLAY_H;
  // half width
  const w = OVERLAY_SUB_W - OVERLAY_PAD * 2;


  font.draw({
    align: ALIGN.HCENTER,
    x: OVERLAY_X0, y: OVERLAY_Y0 + OVERLAY_PAD, z,
    w: OVERLAY_W,
    text: 'MERCENARIES',
  });

  // Player inventory header
  const inv_x = OVERLAY_PLAYER_X0 + OVERLAY_PAD;
  let num_mercs = 0;
  let overloaded = false;
  let missing_hp = 0;
  {
    let x = inv_x;
    let y = OVERLAY_Y0 + OVERLAY_PAD;
    font.draw({
      align: ALIGN.HCENTER,
      x, y, z,
      w,
      text: 'Retinue',
    });
    y += ui.font_height + 1;
    spritesheet_ui.sprite.draw({
      x: x + floor(w/2) + 4, y: y + 2, z, w: 8, h: 8,
      frame: spritesheet_ui.FRAME_ICON_COIN,
    });
    font.draw({
      style: style_money,
      align: ALIGN.HLEFT,
      x: x + floor(w/2) + 4 + 9, y, z,
      text: `${data.money}`,
    });

    for (let ii = 0; ii < data.mercs.length; ++ii) {
      let merc = data.mercs[ii];
      if (merc) {
        num_mercs++;
        if (merc.hp > 0) {
          missing_hp += merc.hp_max - merc.hp;
        }
      }
    }
    overloaded = num_mercs >= data.merc_capacity;
    font.draw({
      style: overloaded ? style_not_allowed : undefined,
      align: ALIGN.HCENTER,
      x, y, z, w: floor(w/2),
      text: `${num_mercs} / ${data.merc_capacity}`,
    });
  }

  // Shop header
  const trader_x = OVERLAY_X0 + OVERLAY_PAD;
  let x = trader_x;
  let y = OVERLAY_Y0 + OVERLAY_PAD;
  font.draw({
    align: ALIGN.HCENTER,
    x, y, z,
    w,
    text: 'Tavern',
  });
  y += ui.font_height + 1;
  y += ui.font_height + 1;

  let y_save = y;

  let realm = crawlerGameState().level!.props.realm;
  let shop = MERC_LIST.filter((a) => a.realm === realm);
  for (let ii = 0; ii < shop.length; ++ii) {
    let merc = shop[ii];
    drawMerc(merc, x, y, z, true, false);

    if (ui.buttonText({
      text: 'Recruit',
      x: x + 72, y: y + 3, w: 56, z,
      disabled: overloaded || merc.cost >= data.money,
      sound: 'buy',
    })) {
      data.money -= merc.cost;
      merc = clone(merc);
      merc.bought_crumble_counter = data.crumble_counter;
      data.mercs.push(merc);
      data.town_counter++;
    }

    uiPanel({
      x, y, z, w: 72 + 56 + 3, h: MERC_H,
      sprite: ui.sprites.panel_mini,
    });
    y += MERC_H - 2;
  }

  y = y_save;
  x = OVERLAY_PLAYER_X0;

  let { mercs, merc_capacity } = data;
  let heal_label = `Heal   ${missing_hp} (  ${missing_hp})`;
  let heal_label_w = font.getStringWidth(null, ui.font_height, heal_label);
  let prefix_w = font.getStringWidth(null, ui.font_height, 'Heal ');
  let middle_w = font.getStringWidth(null, ui.font_height, `  ${missing_hp} (`);
  if (ui.buttonText({
    x, y, z,
    text: heal_label,
    disabled: !missing_hp || data.money < missing_hp,
    sound: 'heal',
    auto_focus: true,
  })) {
    data.money -= missing_hp;
    data.town_counter++;
    for (let ii = 0; ii < mercs.length; ++ii) {
      let merc = mercs[ii];
      if (merc && merc.hp > 0) {
        merc.hp = merc.hp_max;
      }
    }
  }
  let text_x0 = floor(x + (ui.button_width - heal_label_w) / 2);
  spritesheet_ui.sprite.draw({
    x: text_x0 + prefix_w, y: y + 4, z, w: 8, h: 8,
    frame: spritesheet_ui.FRAME_ICON_HP,
  });
  spritesheet_ui.sprite.draw({
    x: text_x0 + prefix_w + middle_w, y: y + 4, z, w: 8, h: 8,
    frame: spritesheet_ui.FRAME_ICON_COIN,
  });
  y += ui.button_height + 1;

  for (let ii = 0; ii < merc_capacity; ++ii) {
    let merc = mercs[ii];
    if (merc) {
      drawMerc(merc, x, y, z, true, true);
    } else {
      font.draw({
        color: dawnbringer.font_colors[25],
        x, y: y - 1, z,
        w: 90 + 56 + 3, h: MERC_H,
        align: ALIGN.HVCENTER,
        text: 'Empty Slot',
      });
    }
    let undo = merc && merc.bought_crumble_counter === data.crumble_counter;
    if (merc && ui.button({
      x: x + 90, y: y + 3, w: 56, z,
      text: undo ? 'Undo' : merc.hp > 0 ? 'Retire' : '"Retire"',
      sound: 'drop',
      // disabled: ii === 0 && mercs.length === 1,
    })) {
      if (undo) {
        data.money += merc.cost;
      }
      mercs.splice(ii, 1);
    }

    uiPanel({
      x, y, z, w: 90 + 56 + 3, h: MERC_H,
      sprite: ui.sprites.panel_mini,
    });
    y += MERC_H - 2;
  }


  uiPanel({
    x: OVERLAY_X0, y: OVERLAY_Y0,
    w: OVERLAY_W, h: OVERLAY_H, z: z - 1,
  });
}

let covenant_style = fontStyle(null, {
  color: dawnbringer.font_colors[8],
  outline_color: dawnbringer.font_colors[0],
  outline_width: 2,
});

function upgradeMenu(): void {
  if (!upgrade_up) {
    return;
  }

  let me = myEnt();
  let data = me.data;

  let z = Z.OVERLAY_UI;
  // const y1 = OVERLAY_Y0 + OVERLAY_H;
  // half width
  const w = OVERLAY_SUB_W - OVERLAY_PAD * 2;


  font.draw({
    align: ALIGN.HCENTER,
    x: OVERLAY_X0, y: OVERLAY_Y0 + OVERLAY_PAD, z,
    w: OVERLAY_W,
    text: 'COVENANTS',
  });


  let num_mercs = 0;
  let num_goods = 0;
  for (let ii = 0; ii < data.mercs.length; ++ii) {
    if (data.mercs[ii]) {
      ++num_mercs;
    }
  }
  for (let ii = 0; ii < data.goods.length; ++ii) {
    if (data.goods[ii] && !GOODS[data.goods[ii].type]!.key) {
      num_goods += data.goods[ii].count;
    }
  }

  // Player inventory header
  const inv_x = OVERLAY_PLAYER_X0 + OVERLAY_PAD;
  {
    let x = inv_x;
    let y = OVERLAY_Y0 + OVERLAY_PAD;
    y += ui.font_height + 1;
    font.draw({
      align: ALIGN.HCENTER,
      x, y, z,
      w,
      text: 'Player',
    });
    let text_w = font.draw({
      style: style_money,
      align: ALIGN.HRIGHT,
      x, w: w - BUTTON_W, y, z,
      text: `${data.money}`,
    });
    spritesheet_ui.sprite.draw({
      x: x + w - BUTTON_W - text_w - 8 - 2, y: y + 2, z, w: 8, h: 8,
      frame: spritesheet_ui.FRAME_ICON_COIN,
    });
    y += ui.font_height + 9;

    font.draw({
      x, y, z, w: floor(w/2),
      text: 'Current Covenant:',
    });
    y += ui.font_height + 1;
    font.draw({
      style: covenant_style,
      x, y, z, w: floor(w/2),
      text: `${UPGRADES[data.upgrade].name}`,
    });
    y += ui.font_height + 1;
    if (data.upgrade) {
      font.draw({
        x, y, z, w: floor(w/2),
        text: `Trade Goods: ${num_goods} / ${data.good_capacity}`,
      });
      y += ui.font_height + 1;
      font.draw({
        x, y, z, w: floor(w/2),
        text: `Mercenaries: ${num_mercs} / ${data.merc_capacity}`,
      });
      y += ui.font_height + 1;
    }
  }

  // Shop header
  const trader_x = OVERLAY_X0 + OVERLAY_PAD;
  let x = trader_x;
  let y = OVERLAY_Y0 + OVERLAY_PAD;
  y += ui.font_height + 1;
  font.draw({
    align: ALIGN.HCENTER,
    x, y, z,
    w,
    text: 'Ministry of Trade',
  });
  y += ui.font_height + 9;

  let realm = crawlerGameState().level!.props.realm;
  let shop = UPGRADES.filter((upgrade) => upgrade.realm === realm);
  for (let ii = 0; ii < shop.length; ++ii) {
    let upgrade = shop[ii];


    font.draw({
      style: covenant_style,
      x, y, z, w: floor(w/2),
      text: `${upgrade.name}`,
    });
    let text_w = font.draw({
      style: upgrade.cost > data.money ? style_not_allowed : style_money,
      align: ALIGN.HRIGHT,
      x, y, z, w,
      text: `${upgrade.cost}`,
    });
    spritesheet_ui.sprite.draw({
      x: x + w - text_w - 8 - 2, y: y + 2, z, w: 8, h: 8,
      frame: spritesheet_ui.FRAME_ICON_COIN,
    });
    y += ui.font_height + 1;
    font.draw({
      style: num_goods > upgrade.good_capacity ? style_not_allowed : undefined,
      x, y, z, w: floor(w/2),
      text: `Trade Goods: ${upgrade.good_capacity}`,
    });
    let idx = UPGRADES.indexOf(upgrade);
    if (ui.buttonText({
      text: 'Sign',
      x: x + w - 56, y: y + 3, w: 56, z,
      disabled: num_goods > upgrade.good_capacity || num_mercs > upgrade.merc_capacity ||
        upgrade.cost >= data.money || data.upgrade === idx ||
        upgrade.good_capacity <= data.good_capacity && upgrade.merc_capacity <= data.merc_capacity,
      sound: 'buy',
    })) {
      data.town_counter++;
      data.money -= upgrade.cost;
      data.upgrade = idx;
      data.merc_capacity = upgrade.merc_capacity;
      data.good_capacity = upgrade.good_capacity;
    }
    y += ui.font_height + 1;
    font.draw({
      style: num_mercs > upgrade.merc_capacity ? style_not_allowed : undefined,
      x, y, z, w: floor(w/2),
      text: `Mercenaries: ${upgrade.merc_capacity}`,
    });
    y += ui.font_height + 1;

    y += 5;

    // uiPanel({
    //   x, y, z, w: 72 + 56 + 3, h: MERC_H,
    //   sprite: ui.sprites.panel_mini,
    // });
  }

  uiPanel({
    x: OVERLAY_X0, y: OVERLAY_Y0,
    w: OVERLAY_W, h: OVERLAY_H, z: z - 1,
  });
}


function engagedEnemy(): Entity | null {
  if (buildModeActive() || engine.defines.PEACE) {
    return null;
  }
  let game_state = crawlerGameState();
  let me = crawlerMyEnt();
  // search, needs game_state, returns list of foes
  let ents: Entity[] = entitiesAdjacentTo(game_state,
    entityManager(),
    me.data.floor, me.data.pos, crawlerScriptAPI());
  ents = ents.filter((ent: Entity) => {
    return ent.is_enemy && ent.isAlive();
  });
  if (ents.length) {
    return ents[0];
  }
  return null;
}

function moveBlocked(): boolean {
  return false;
}

export function startShopping(): void {
  inventory_up = true;
}

export function startRecruiting(): void {
  recruit_up = true;
}

export function startUpgrade(): void {
  upgrade_up = true;
}

// TODO: move into crawler_play?
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function addFloater(ent_id: EntityID, message: string | null, anim: string): void {
  let ent = crawlerEntityManager().getEnt(ent_id);
  if (ent) {
    if (message) {
      if (!ent.floaters) {
        ent.floaters = [];
      }
      ent.floaters.push({
        start: engine.frame_timestamp,
        msg: message,
      });
    }
    if (ent.triggerAnimation) {
      ent.triggerAnimation(anim);
    }
  }
}

function moveBlockDead(): boolean {
  controller.setFadeOverride(0.75);

  let y = VIEWPORT_Y0;
  let w = render_width;
  let x = VIEWPORT_X0;
  let h = render_height;
  let z = Z.UI;

  font.drawSizedAligned(null,
    x + floor(w/2), y + floor(h/2) - 16, z,
    ui.font_height, ALIGN.HCENTER|ALIGN.VBOTTOM,
    0, 0, 'You have died.');

  if (ui.buttonText({
    x: x + floor(w/2 - ui.button_width/2), y: y + floor(h/2), z,
    text: 'Respawn',
  })) {
    controller.goToFloor(0, 'stairs_in', 'respawn');
  }

  return true;
}

const MOVE_BUTTONS_X0 = MINIMAP_X;
const MOVE_BUTTONS_Y0 = 146;

const MERC_BOTTOM_Y = MOVE_BUTTONS_Y0 - 2;
const MERC_X0 = MOVE_BUTTONS_X0;

let last_merc_pos: Vec2[] = [];
export function mercPos(index: number): Vec2 {
  return last_merc_pos[index];
}

export function victoryProgress(): number {
  let count = 0;
  let script_api = crawlerScriptAPI();
  count += script_api.keyGet('mcguff1') ? 1 : 0;
  count += script_api.keyGet('mcguff2') ? 1 : 0;
  count += script_api.keyGet('mcguff3') ? 1 : 0;
  count += script_api.keyGet('mcguff4') ? 1 : 0;
  if (count === 4) {
    return 5;
  }
  let me = myEnt();
  let { goods } = me.data;
  for (let ii = 0; ii < goods.length; ++ii) {
    let good = goods[ii];
    if (GOODS[good.type]!.key) {
      count++;
    }
  }
  return count;
}

export type Score = {
  victory: number;
  money: number;
  seconds: number;
};
export type LevelDef = {
  name: string;
};
const level_def: LevelDef = {
  name: 'the',
};
const level_list: LevelDef[] = [level_def];
export function getLevelList(): LevelDef[] {
  return level_list;
}

export function setScore(): void {
  if (myEnt().data.cheat) {
    return;
  }
  let score: Score = {
    seconds: round(crawlerCurSavePlayTime() / 1000),
    money: calcNetWorth(),
    victory: victoryProgress(),
  };
  score_system.setScore(0, score);
}

const CURRENCY_X0 = MINIMAP_X;
const CURRENCY_Y0 = 60;
const CURRENCY_W = 82;
function drawCurrency(): void {
  let me = myEntOptional();
  if (!me) {
    return;
  }
  let x = CURRENCY_X0 - 1;
  let y = CURRENCY_Y0;
  let w = CURRENCY_W;
  let z = Z.UI;
  let money = me.data.money;
  let bigmoney = money > 9999;
  spritesheet_ui.sprite.draw({
    x, y, z, w: 8, h: 8,
    frame: spritesheet_ui.FRAME_ICON_KEY,
  });
  let victp = victoryProgress();
  tiny_font.draw({
    color: dawnbringer.font_colors[19],
    align: ALIGN.HLEFT,
    size: 8,
    x: x + 10 + (bigmoney ? -1 : 0), y, z,
    text: victp === 5 ? 'WIN ' : `${victoryProgress()}/4`,
  });
  x += 33;

  if (bigmoney) {
    x -= 8;
  }
  spritesheet_ui.sprite.draw({
    x, y, z, w: 8, h: 8,
    frame: spritesheet_ui.FRAME_ICON_SUPPLY,
  });
  tiny_font.draw({
    color: dawnbringer.font_colors[20],
    align: ALIGN.HLEFT,
    size: 8,
    x: x + 10 + (bigmoney ? -1 : 0), y, z,
    text: `${playerSupplies()}`,
  });

  let text_w = tiny_font.draw({
    color: dawnbringer.font_colors[8],
    align: ALIGN.HRIGHT,
    size: 8,
    x: CURRENCY_X0, y, z,
    w,
    text: `${money}`,
  });
  spritesheet_ui.sprite.draw({
    x: CURRENCY_X0 + w - text_w - 10 + (bigmoney ? 1 : 0), y, z, w: 8, h: 8,
    frame: spritesheet_ui.FRAME_ICON_COIN,
  });
}

function drawMercs(): void {
  let me = myEntOptional();
  if (!me) {
    return;
  }
  let { mercs, merc_capacity } = me.data;
  let vp = crawlerRenderViewportGet();
  let attack_x = vp.x + vp.w * 0.667;
  let attack_y = vp.y + vp.h / 2;

  let x = MERC_X0;
  let y = MERC_BOTTOM_Y - MERC_H;
  let z = Z.UI;
  for (let ii = 0; ii < merc_capacity; ++ii) {
    let merc = mercs[ii];
    let weight = mercPosOverrideWeight(ii);
    let xx = x;
    let yy = y;
    if (weight) {
      xx = lerp(weight, xx, attack_x);
      yy = lerp(weight * 0.5, yy, attack_y);
    }
    let dead = merc && merc.hp <= 0;
    uiPanel({
      x: xx, y: yy, z: dead ? z-0.1 : z-0.2, w: MERC_W, h: MERC_H,
      sprite: dead ? ui.sprites.panel_mini_red : ui.sprites.panel_mini,
    });
    last_merc_pos[ii] = last_merc_pos[ii] || vec2();
    v2set(last_merc_pos[ii], xx, yy);
    drawMerc(merc, xx, yy, z, false, true);
    if (x === MERC_X0) {
      x += MERC_W - 2;
    } else {
      x = MERC_X0;
      y -= MERC_H - 2;
    }
  }
}

export function bridgeRepairCost(cell: CrawlerCell): number {
  let cost = 1;
  let { events } = cell;
  if (events) {
    for (let ii = 0; ii < events.length; ++ii) {
      let event = events[ii];
      if (event.id === 'bridge') {
        let n = Number(event.param);
        if (isFinite(n)) {
          cost = n;
        }
      }
    }
  }
  return cost;
}

export function canRepairBridge2(): boolean {
  let me = myEntOptional();
  return me && me.data.journeys > 0 || false;
}

function drawHints(): void {
  let cell = controller.getCellInFront();
  if (!cell) {
    return;
  }

  let cell_desc = getEffCell(crawlerScriptAPI(), cell);
  if (cell_desc.code === 'BRIDGE') {
    let cost = bridgeRepairCost(cell);
    if (canRepairBridge2() || cost !== 2) {
      statusSet('bridge', `Repair cost: ${cost} Suppl${cost === 1 ? 'y' : 'ies'}`).fade();
    } else {
      statusSet('bridge', 'This way is blocked until after visiting Spiriton.').fade();
    }
  }
}


let last_can_hear: [number, number, number] = [0,0,0];
let can_hear: Record<number, number> = {};
let can_hear_w: number = 0;
const MAX_CAN_HEAR_SEARCH = 7;
function updateCanHearMap(): void {
  let { floor_id, level } = crawlerGameState();
  let me = myEntOptional();
  if (!me || !level) {
    return;
  }
  let { pos } = me.data;
  let key: Vec3 = [floor_id, pos[0], pos[1]];
  if (v3same(last_can_hear, key)) {
    return;
  }
  v3copy(last_can_hear, key);
  let { w } = level;
  can_hear_w = w;
  const DIDX = [1, w, -1, -w];
  can_hear = {};
  let todo: number[] = [];
  let done: Record<number, boolean> = {};
  function search(posidx: number, dist: number): void {
    can_hear[posidx] = dist;
    done[posidx] = true;
    if (dist < MAX_CAN_HEAR_SEARCH) {
      todo.push(posidx, dist);
    }
  }
  let script_api = crawlerScriptAPI();
  script_api.setLevel(level);
  search(pos[0] + pos[1] * w, 0);
  while (todo.length) {
    let p = todo[0];
    let d = todo[1];
    todo.splice(0, 2);
    let x = p % w;
    let y = (p - x) / w;
    for (let ii = 0 as DirType; ii < 4; ++ii) {
      let neighbor = p + DIDX[ii];
      if (done[neighbor]) {
        continue;
      }
      let check_pos = [x, y] as const;
      script_api.setPos(check_pos);
      if (level.wallsBlock(check_pos, ii, script_api) === (BLOCK_VIS | BLOCK_MOVE)) {
        // blocked completely
      } else {
        search(neighbor, d + 1);
      }
    }
  }
}

function calcDanger(): number {
  updateCanHearMap();
  // for (let xx = 0; xx < can_hear_w; ++xx) {
  //   for (let yy = 0; yy < 30; ++yy) {
  //     let idx = xx + yy * can_hear_w;
  //     let d = can_hear[idx];
  //     if (d !== undefined) {
  //       tiny_font.draw({ x: xx*8, y: game_height - yy * 8, z: 2000, text: String(d) });
  //     }
  //   }
  // }
  let { floor_id/*, pos*/ } = crawlerGameState();
  let { entities } = entityManager();
  let nearest = Infinity;
  for (let ent_id_str in entities) {
    let ent = entities[ent_id_str]!;
    if (ent.data.floor === floor_id &&
      ent.is_enemy && ent.isAlive() && ent.type_id !== 'chest'
    ) {
      // nearest = min(nearest, v2dist(pos, ent.data.pos) - ent.danger_dist);
      let d = can_hear[ent.data.pos[0] + ent.data.pos[1] * can_hear_w];
      if (d !== undefined) {
        nearest = min(nearest, d - ent.danger_dist);
      }
    }
  }

  return nearest;
}

let music = [
  '',
  'bgm_phys',
  'bgm_spirit',
  'bgm_path_danger',
  'bgm_path_explore',
];
let active_music = 0;
let music_danger = 0;
let force_no_music = false;
export function forceNoMusic(force: boolean): void {
  force_no_music = force;
}
const SAFE_DIST = 4.5;
const DANGER_DIST = 2.5;
export function tickMusic(is_title: boolean, force_danger: boolean): void {
  let desired;
  if (buildModeActive() || !settings.volume_music || force_no_music) {
    desired = 0;
  } else if (is_title) {
    desired = active_music ? 1 : 0;
  } else {
    let level = crawlerGameState().level;
    if (!level) {
      desired = 0;
    } else {
      if (level.props.realm === 'phys') {
        desired = 1;
        music_danger = 0;
      } else if (level.props.realm === 'spirit') {
        desired = 2;
        music_danger = 0;
      } else {
        let danger = calcDanger();
        if (!isFinite(danger) || danger >= SAFE_DIST) {
          music_danger = 0;
        } else {
          let ddanger = getFrameDt() / 4000;
          music_danger += (DANGER_DIST - danger) * ddanger;
          music_danger = clamp(music_danger, 0, 1);
        }
        if (force_danger) {
          music_danger = 1;
        }
        if (active_music === 4) {
          if (music_danger > 0.5) {
            desired = 3;
          } else {
            desired = 4;
          }
        } else if (active_music === 3) {
          if (music_danger < 0.25) {
            desired = 4;
          } else {
            desired = 3;
          }
        } else {
          desired = music_danger > 0.5 ? 3 : 4;
        }
      }
    }
  }
  if (desired !== active_music) {
    if (!desired) {
      soundPlayMusic(music[active_music], 0, FADE);
    } else {
      soundPlayMusic(music[desired], 1, FADE);
    }
    active_music = desired;
  }
}


const BELLS = [
  [36,31, 9, 'bells_phys'],
  [22,23, 9, 'bells_phys'],
  [10,21, 9, 'bells_phys'],
  [10,7, 9, 'bells_phys'], // 'bells_spir'],
  [22,6, 9, 'bells_phys'], // 'bells_spir'],
  [37,8, 9, 'bells_phys'], // 'bells_spir'],

  [15,8, 10, 'bells_phys'], // 'bells_spir'],
  [12,8, 10, 'bells_phys'], // 'bells_spir'],
  [9,8, 10, 'bells_phys'], // 'bells_spir'],
  [6,8, 10, 'bells_phys'], // 'bells_spir'],
  [3,8, 10, 'bells_phys'], // 'bells_spir'],
];
const BELL_DIST = 5.5;
let bell_last_play: GlovSoundSetUp | null = null;
function tickBells(is_danger: boolean): void {
  if (is_danger || !soundResumed()) {
    return;
  }
  updateCanHearMap();
  if (bell_last_play && !bell_last_play.playing()) {
    bell_last_play = null;
  }

  let game_state = crawlerGameState();
  let { floor_id } = game_state;
  let nearest = -1;
  let nearest_dist = Infinity;
  for (let ii = 0; ii < BELLS.length; ++ii) {
    let bell = BELLS[ii];
    if (bell[2] === floor_id) {
      let bx = bell[0] as number;
      let by = bell[1] as number;
      let d = can_hear[bx + by * can_hear_w];
      if (d !== undefined) {
        let dsq = d * d;
        if (dsq < nearest_dist) {
          nearest = ii;
          nearest_dist = dsq;
        }
      }
      // let dsq = v2distSq(bell as JSVec2, game_state.pos);
      // if (dsq < nearest_dist) {
      //   nearest = ii;
      //   nearest_dist = dsq;
      // }
    }
  }

  let volume = 0;
  let name = '';
  if (nearest !== -1) {
    volume = clamp(1 - sqrt(nearest_dist) / BELL_DIST, 0, 1) * 2;
    name = BELLS[nearest][3] as string;
  }
  if (bell_last_play && !volume) {
    bell_last_play.fade(0, 250);
    bell_last_play = null;
  }
  if (bell_last_play && name && bell_last_play.name !== name) {
    bell_last_play.fade(0, 250);
    bell_last_play = null;
  }
  if (volume) {
    if (bell_last_play) {
      bell_last_play.volume(volume);
    } else {
      bell_last_play = soundPlay(name, volume);
    }
  }
}

function useNoText(): boolean {
  return input.inputTouchMode() || input.inputPadMode() || settings.turn_toggle;
}

let temp_delta = vec2();
function playCrawl(): void {
  profilerStartFunc();

  let down = {
    menu: 0,
    inv: 0,
    flee: 0,
  };
  type ValidKeys = keyof typeof down;
  let up_edge = {
    menu: 0,
    inv: 0,
    flee: 0,
  } as Record<ValidKeys, number>;

  let dt = getScaledFrameDt();

  const frame_map_view = mapViewActive();
  const is_fullscreen_ui = inventoryMenu() || recruit_up || upgrade_up;
  let dialog_viewport = {
    x: VIEWPORT_X0 + 8,
    w: render_width - 16,
    y: VIEWPORT_Y0,
    h: render_height + 4,
    z: Z.STATUS,
    pad_top: 2,
    pad_bottom: 4,
  };
  if (is_fullscreen_ui || frame_map_view) {
    dialog_viewport.x = 0;
    dialog_viewport.w = game_width;
    dialog_viewport.y = 0;
    dialog_viewport.h = game_height - 3;
  }
  dialogRun(dt, dialog_viewport);

  const build_mode = buildModeActive();
  let frame_combat = engagedEnemy();
  let locked_dialog = dialogMoveLocked();
  let overlay_menu_up = pause_menu_up || inventory_up || recruit_up || upgrade_up;
  let minimap_display_h = build_mode ? BUTTON_W : MINIMAP_W;
  let show_compass = !build_mode;
  let compass_h = show_compass ? 11 : 0;

  if (build_mode && !controller.ignoreGameplay()) {
    let build_y = MINIMAP_Y + minimap_display_h + 2;
    crawlerBuildModeUI({
      x: MINIMAP_X,
      y: build_y,
      w: game_width - MINIMAP_X - 2,
      h: MOVE_BUTTONS_Y0 - build_y - 2,
      map_view: frame_map_view,
    });

  }

  tickMusic(false, Boolean(frame_combat && frame_combat.type_id !== 'chest'));
  tickBells(Boolean(frame_combat));

  let button_x0: number;
  let button_y0: number;

  let disabled = controller.hasMoveBlocker();

  function button(
    rx: number, ry: number,
    frame: number,
    key: ValidKeys,
    keys: number[],
    pads: number[],
    toggled_down?: boolean
  ): void {
    let z;
    let no_visible_ui = frame_map_view;
    let my_disabled = disabled;
    if (key === 'menu') {
      no_visible_ui = false;
      if (frame_map_view) {
        z = Z.MAP + 1;
      } else if (pause_menu_up) {
        z = Z.MODAL + 1;
      } else {
        z = Z.MENUBUTTON;
      }
    } else {
      if (overlay_menu_up && toggled_down) {
        no_visible_ui = true;
      } else {
        my_disabled = my_disabled || overlay_menu_up;
      }
    }
    let ret = crawlerOnScreenButton({
      x: button_x0 + (BUTTON_W + 2) * rx,
      y: button_y0 + (BUTTON_W + 2) * ry,
      z,
      w: BUTTON_W, h: BUTTON_W,
      frame,
      keys,
      pads,
      no_visible_ui,
      do_up_edge: true,
      disabled: my_disabled,
      button_sprites: useNoText() ?
        toggled_down ? button_sprites_notext_down : button_sprites_notext :
        toggled_down ? button_sprites_down : button_sprites,
    });
    // down_edge[key] += ret.down_edge;
    down[key] += ret.down;
    up_edge[key] += ret.up_edge;
  }


  // Escape / open/close menu button - *before* pauseMenu()
  button_x0 = 317;
  button_y0 = 3;
  let menu_up = frame_map_view || build_mode || overlay_menu_up;
  let menu_keys = [KEYS.ESC];
  let menu_pads = [PAD.START];
  if (menu_up) {
    menu_pads.push(PAD.B, PAD.BACK);
  }
  button(0, 0, menu_up ? 10 : 6, 'menu', menu_keys, menu_pads);
  if (!build_mode) {
    button(0, 1, 7, 'inv', [KEYS.I], [PAD.Y], inventory_up);
    if (up_edge.inv) {
      inventory_up = !inventory_up;
    }
  }

  if (pause_menu_up) {
    pauseMenu();
  }

  if (buildModeActive()) {
    inventory_up = recruit_up = upgrade_up = false;
  }

  if (frame_combat && engagedEnemy() !== crawlerEntInFront()) {
    // turn to face
    let me = crawlerMyEnt();
    let dir = dirFromDelta(v2sub(temp_delta, frame_combat.data.pos, me.data.pos));
    controller.forceFaceDir(dir);
  } else {
    controller.forceFaceDir(null);
  }

  button_x0 = MOVE_BUTTONS_X0;
  button_y0 = MOVE_BUTTONS_Y0;

  if (frame_combat) {
    let is_boss = frame_combat.data.stats.hp_max > 30; // boss
    if (!is_boss) {
      button(1, 1, 8, 'flee', [KEYS.S, KEYS.NUMPAD2, KEYS.NUMPAD5], [PAD.B, PAD.DOWN]);
    }

    doCombat(frame_combat, dt * (shift() ? 3 : 1), menu_up || isMenuUp(), Boolean(up_edge.flee));
  } else {
    cleanupCombat(dt * (shift() ? 3 : 1));
  }

  controller.doPlayerMotion({
    dt,
    button_x0: MOVE_BUTTONS_X0,
    button_y0: build_mode ? game_height - 16 : MOVE_BUTTONS_Y0,
    no_visible_ui: frame_map_view,
    button_w: build_mode ? 6 : BUTTON_W,
    button_sprites: useNoText() ? button_sprites_notext : button_sprites,
    disable_move: moveBlocked() || overlay_menu_up,
    disable_player_impulse: Boolean(frame_combat || locked_dialog),
    show_buttons: !frame_combat && !locked_dialog,
    do_debug_move: engine.defines.LEVEL_GEN || build_mode,
    show_debug: settings.show_fps ? { x: VIEWPORT_X0, y: VIEWPORT_Y0 + (build_mode ? 3 : 0) } : null,
  });

  // Check for intentional events
  // if (!build_mode) {
  //   button(2, -3, 7, 'inventory', [KEYS.I], [PAD.X], inventory_up);
  // }
  //
  // if (up_edge.inventory) {
  //   inventory_up = !inventory_up;
  // }

  if (engine.DEBUG && keyUpEdge(KEYS.B)) {
    crawlerBuildModeActivate(!build_mode);
    inventory_up = recruit_up = upgrade_up = false;
  }

  if (up_edge.menu) {
    if (menu_up) {
      if (build_mode && mapViewActive()) {
        mapViewSetActive(false);
        // but stay in build mode
      } else if (build_mode) {
        crawlerBuildModeActivate(false);
      } else {
        // close everything
        mapViewSetActive(false);
        inventory_up = recruit_up = upgrade_up = false;
      }
      pause_menu_up = false;
    } else {
      pause_menu_up = true;
    }
  }

  if (!frame_map_view) {
    if (!build_mode) {
      // Do game UI/stats here
    }
    // Do modal UIs here
  } else {
    if (input.click({ button: 2 })) {
      mapViewToggle();
    }
  }
  if (!overlay_menu_up && (keyDownEdge(KEYS.M) || padButtonUpEdge(PAD.BACK))) {
    playUISound('button_click');
    mapViewToggle();
  }
  recruitMenu();
  upgradeMenu();
  let game_state = crawlerGameState();
  let script_api = crawlerScriptAPI();
  if (frame_map_view) {
    if (engine.defines.LEVEL_GEN) {
      if (levelGenTest(game_state)) {
        controller.initPosFromLevelDebug();
      }
    }
    crawlerMapViewDraw(game_state, 0, 0, game_width, game_height, 0, Z.MAP,
      engine.defines.LEVEL_GEN, script_api, overlay_menu_up,
      floor((game_width - MINIMAP_W)/2), COMPASS_Y);
  } else {
    crawlerMapViewDraw(game_state, MINIMAP_X, MINIMAP_Y, MINIMAP_W, minimap_display_h, compass_h, Z.MAP,
      false, script_api, overlay_menu_up,
      COMPASS_X, COMPASS_Y);
    if (!build_mode) {
      drawCurrency();
    }
  }
  bg_sprite.draw({
    x: 0, y: 0, w: game_width, h: game_height, z: 1,
  });


  if (!menu_up) {
    drawMercs();
  }

  if (!menu_up && !frame_combat) {
    drawHints();
  }

  statusTick(dialog_viewport);
  // if (is_fullscreen_ui || frame_map_view) {
  //   statusTick(0, 0, Z.STATUS, game_width, game_height - 1);
  // } else {
  //   if (dialog_y) {
  //     statusTick(VIEWPORT_X0, VIEWPORT_Y0 + 2, Z.STATUS, render_width, dialog_y - VIEWPORT_Y0);
  //   } else {
  //     statusTick(VIEWPORT_X0, VIEWPORT_Y0 + 6, Z.STATUS, render_width, render_height);
  //   }
  // }

  profilerStopFunc();
}

function playerMotion(): void {
  if (!controller.canRun()) {
    return;
  }

  if (!controller.hasMoveBlocker() && !myEnt().isAlive()) {
    controller.setMoveBlocker(moveBlockDead);
  }

  playCrawl();

  if (settings.show_fps && !controller.getTransitioningFloor()) {
    // Debug UI
    // let y = ui.font_height * 3;
    // let z = Z.DEBUG;
    // ui.print(null, 0, y, z, `Walltime: ${frame_wall_time.toString().slice(-6)}`);
    // y += ui.font_height;
    // ui.print(null, 0, y, z, `Queue: ${queueLength()}${interp_queue[0].double_time ? ' double-time' : ''}`);
    // y += ui.font_height;
    // ui.print(null, 0, y, z, `Attack: ${frame_wall_time - queued_attack.start_time}/${queued_attack.windup}`);
    // y += ui.font_height;
  }
}

function drawEntitiesPrep(): void {
  crawlerRenderEntitiesPrep();
  let game_state = crawlerGameState();
  let level = game_state.level;
  if (!level) {
    // eslint-disable-next-line no-useless-return
    return; // still loading
  }
  // let game_entities = entityManager().entities;
  // let ent_in_front = crawlerEntInFront();
  // if (ent_in_front && myEnt().isAlive()) {
  //   let target_ent = game_entities[ent_in_front]!;
  //   drawEnemyStats(target_ent);
  //   autoAttack(target_ent);
  // } else {
  //   autoAttack(null);
  // }
}

export function play(dt: number): void {
  profilerStartFunc();
  let game_state = crawlerGameState();
  if (crawlerCommWant()) {
    // Must have been disconnected?
    crawlerCommStart();
    return profilerStopFunc();
  }
  profilerStart('top');
  crawlerEntityManager().tick();
  frame_wall_time = max(frame_wall_time, walltime()); // strictly increasing

  const map_view = mapViewActive();
  let overlay_menu_up = pause_menu_up || inventory_up || recruit_up || upgrade_up || dialogMoveLocked();
  if (overlay_menu_up || isMenuUp()) {
    controller.cancelQueuedMoves();
  }
  if (!(map_view || isMenuUp() || overlay_menu_up)) {
    spotSuppressPad();
  }

  profilerStopStart('chat');
  if (engine.DEBUG) { // JAM
    getChatUI().run({
      hide: map_view || overlay_menu_up || !isOnline() || buildModeOverlayActive() || true, // JAM: true
      x: 3,
      y: game_height - getChatUI().h,
      border: 2,
      scroll_grow: 2,
      always_scroll: false, // !map_view && !overlay_menu_up && !buildModeOverlayActive(), // JAM
      cuddly_scroll: true,
    });
  }
  profilerStopStart('mid');

  if (keyDownEdge(KEYS.F3)) {
    settings.set('show_fps', 1 - settings.show_fps);
  }
  // if (keyDownEdge(KEYS.F)) {
  //   settings.set('filter', 1 - settings.filter);
  //   renderResetFilter();
  // }

  profilerStopStart('playerMotion');
  playerMotion();

  crawlerRenderFramePrep();

  profilerStopStart('render prep');
  renderPrep(controller.getRenderPrepParam());
  drawEntitiesPrep();

  controller.flushMapUpdate();

  crawlerRenderFrame();

  if (!loading_level && !buildModeActive()) {
    let script_api = crawlerScriptAPI();
    script_api.is_visited = true; // Always visited for AI
    aiDoFloor(game_state.floor_id, game_state, entityManager(), engine.defines,
      settings.ai_pause || engine.defines.LEVEL_GEN || overlay_menu_up || engagedEnemy() ||
      dialogMoveLocked(), script_api);
  }

  if (crawlerCommWant()) {
    crawlerCommStart();
  }

  crawlerEntityManager().actionListFlush();

  if (engine.DEBUG) {
    getChatUI().runLate();
  }
  profilerStop();
  profilerStopFunc();
}

function onInitPos(): void {
  // autoAttackCancel();
}

function playInitShared(online: boolean): void {
  controller = crawlerController();

  controller.setOnInitPos(onInitPos);

  last_level = null;
  pause_menu_up = false;
  inventory_up = false;
  recruit_up = false;
  upgrade_up = false;
  dialogReset();
}


function playOfflineLoading(): void {
  // TODO
}

function playInitOffline(): void {
  playInitShared(false);
}

function playInitEarly(room: ClientChannelWorker): void {

  // let room_public_data = room.getChannelData('public') as { seed: string };
  // game_state.setSeed(room_public_data.seed);

  playInitShared(true);
}

export function autosave(): void {
  crawlerSaveGame('auto');
  statusShort('Auto-saved.');
}

export function restartFromLastSave(): void {
  crawlerPlayWantMode('recent');
  crawlerPlayInitOffline();
}

function resetFloorOnJourney(entity_manager: ClientEntityManagerInterface,
  floor_id: number, level: CrawlerLevel
) : void {
  assert(!entity_manager.isOnline());
  let { entities } = entity_manager;
  for (let ent_id_str in entities) {
    let ent_id = Number(ent_id_str);
    let ent = entities[ent_id]!;
    if (ent.respawns && ent.data.floor === floor_id) {
      entity_manager.deleteEntity(ent_id, 'respawn');
    }
  }

  if (level.initial_entities) {
    let initial_entities = clone(level.initial_entities);
    for (let ii = 0; ii < initial_entities.length; ++ii) {
      initial_entities[ii].floor = floor_id;
      let ent = entity_manager.addEntityFromSerialized(initial_entities[ii]);
      if (!ent.respawns) {
        entity_manager.deleteEntity(ent.id, 'respawn');
      }
    }
  }

  let { w, h } = level;
  let script_api = crawlerScriptAPI();
  for (let yy = 0; yy < h; ++yy) {
    for (let xx = 0; xx < w; ++xx) {
      let cell = level.getCell(xx, yy)!;
      if (cell.desc.code === 'BRIDGE') {
        let key_name = cell.getKeyNameForWall(DIR_CELL);
        if (key_name) {
          script_api.keyClear(key_name);
        }
      }
    }
  }
}

function initLevel(entity_manager: ClientEntityManagerInterface,
  floor_id: number, level: CrawlerLevel
) : void {
  let me = entity_manager.getMyEnt();
  assert(me);
  let { data } = me;
  if (level.props.is_town && floor_id !== data.last_journey_town) {
    data.last_journey_town = floor_id;
    data.journeys++;
    autosave();
  }
  if (last_level && !last_level.props.is_town && level.props.is_town) {
    // Save our state as of when we left town last
    data.town_visits++;
  }
  if (!level.props.is_town && data.town_counter !== data.last_crumble_town_counter) {
    data.last_crumble_town_counter = data.town_counter;
    data.crumble_counter++;
    autosave();
    if (data.town_visits > 0) {
      statusPush('Time has passed...\n' +
        'Some threats return.\n' +
        'Bridges collapse.');
    }
  }
  last_level = level;
  if (data.floor_town_init[floor_id] !== data.crumble_counter) {
    resetFloorOnJourney(entity_manager, floor_id, level);
    data.floor_town_init[floor_id] = data.crumble_counter;
  }
}

settings.register({
  ai_pause: {
    default_value: 0,
    type: cmd_parse.TYPE_INT,
    range: [0, 1],
  },
  turn_toggle: {
    default_value: 0,
    type: cmd_parse.TYPE_INT,
    range: [0, 1],
  },
});

let style_text_phys = fontStyleColored(null, dawnbringer.font_colors[21]);
let style_text_spirit = fontStyleColored(null, dawnbringer.font_colors[0]);
export function dialogTextStyle(): FontStyle {
  let level = crawlerGameState().level;
  if (level && level.props && level.props.realm === 'spirit') {
    return style_text_spirit;
  } else {
    return style_text_phys;
  }
}

export function playStartup(tiny_font_in: Font): void {
  ({ font } = ui);
  tiny_font = tiny_font_in;
  crawlerScriptAPIDummyServer(true); // No script API running on server
  crawlerPlayStartup({
    // on_broadcast: onBroadcast,
    play_init_online: playInitEarly,
    play_init_offline: playInitOffline,
    offline_data: {
      new_player_data: {
        type: 'player',
        pos: [0, 0, 0],
        floor: 1,
        last_journey_town: 1,
        stats: { hp: 10, hp_max: 10 },
        money: 0,
        good_capacity: 0,
        goods: [{
          type: 'mcguff1',
          count: 1,
        }],
        merc_capacity: 0,
      },
      loading_state: playOfflineLoading,
    },
    play_state: play,
    on_init_level_offline: initLevel,
  });
  crawlerEntityClientStartupEarly();
  jamTraitsStartup();
  aiTraitsClientStartup();
  crawlerEntityTraitsClientStartup({
    name: 'EntityDemoClient',
    Ctor: EntityDemoClient,
  });
  crawlerRenderEntitiesStartup(font);
  crawlerRenderViewportSet({
    x: VIEWPORT_X0,
    y: VIEWPORT_Y0,
    w: render_width,
    h: render_height,
  });
  // crawlerRenderSetUIClearColor(dawnbringer.colors[14]);

  let button_param = {
    filter_min: gl.NEAREST,
    filter_mag: gl.NEAREST,
    ws: [26, 26, 26],
    hs: [26, 26, 26, 26],
  };
  button_sprites = {
    regular: spriteCreate({
      name: 'buttons/buttons',
      ...button_param,
    }),
    down: spriteCreate({
      name: 'buttons/buttons_down',
      ...button_param,
    }),
    rollover: spriteCreate({
      name: 'buttons/buttons_rollover',
      ...button_param,
    }),
    disabled: spriteCreate({
      name: 'buttons/buttons_disabled',
      ...button_param,
    }),
  };
  button_sprites_down = {
    regular: button_sprites.down,
    down: button_sprites.regular,
    rollover: button_sprites.rollover,
    disabled: button_sprites.disabled,
  };
  button_sprites_notext = {
    regular: spriteCreate({
      name: 'buttons/buttons_notext',
      ...button_param,
    }),
    down: spriteCreate({
      name: 'buttons/buttons_notext_down',
      ...button_param,
    }),
    rollover: spriteCreate({
      name: 'buttons/buttons_notext_rollover',
      ...button_param,
    }),
    disabled: spriteCreate({
      name: 'buttons/buttons_notext_disabled',
      ...button_param,
    }),
  };
  button_sprites_notext_down = {
    regular: button_sprites_notext.down,
    down: button_sprites_notext.regular,
    rollover: button_sprites_notext.rollover,
    disabled: button_sprites_notext.disabled,
  };

  let bar_param = {
    filter_min: gl.NEAREST,
    filter_mag: gl.NEAREST,
    ws: [2, 4, 2],
    hs: [2, 4, 2],
  };
  let healthbar_bg = spriteCreate({
    name: 'healthbar_bg',
    ...bar_param,
  });
  bar_sprites = {
    healthbar: {
      bg: healthbar_bg,
      hp: spriteCreate({
        name: 'healthbar_hp',
        ...bar_param,
      }),
      empty: spriteCreate({
        name: 'healthbar_empty',
        ...bar_param,
      }),
    },
  };

  portraits = spriteCreate({
    name: 'portraits',
    filter_min: gl.NEAREST,
    filter_mag: gl.NEAREST,
    ws: [16, 16, 16, 16, 16, 16, 16, 16],
    hs: [16, 16, 16, 16, 16, 16, 16, 16],
  });

  bg_sprite = spriteCreate({
    name: 'ui/bg',
    filter_min: gl.NEAREST,
    filter_mag: gl.NEAREST,
  });

  renderAppStartup();
  combatStartup(tiny_font);
  dialogStartup({
    font,
    text_style_cb: dialogTextStyle,
  });
  crawlerLoadData(webFSAPI());
  crawlerMapViewStartup(false, dawnbringer.colors[8]);

  const ENCODE_SEC = 100000;
  const ENCODE_MONEY = 100000;
  function encodeScore(score: Score): number {
    let spart = max(0, ENCODE_SEC - 1 - score.seconds);
    let mpart = min(ENCODE_MONEY - 1, score.money) * ENCODE_SEC;
    let vpart = score.victory * ENCODE_MONEY * ENCODE_SEC;
    return vpart + mpart + spart;
  }

  function parseScore(value: number): Score {
    let seconds = value % ENCODE_SEC;
    value = (value - seconds) / ENCODE_SEC;
    seconds = ENCODE_SEC - 1 - seconds;
    let money = value % ENCODE_MONEY;
    let victory = (value - money) / ENCODE_MONEY;
    return {
      victory,
      money,
      seconds,
    };
  }

  score_system.init(encodeScore, parseScore, level_list, 'DCJ23');
  score_system.updateHighScores();
}
