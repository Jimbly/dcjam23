import assert from 'assert';
import { cmd_parse } from 'glov/client/cmds';
import * as engine from 'glov/client/engine';
import { getFrameIndex } from 'glov/client/engine';
import { ClientEntityManagerInterface } from 'glov/client/entity_manager_client';
import {
  ALIGN,
  Font,
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
} from 'glov/client/input';
import { ScrollArea, scrollAreaCreate } from 'glov/client/scroll_area';
import { MenuItem } from 'glov/client/selection_box';
import * as settings from 'glov/client/settings';
import { SimpleMenu, simpleMenuCreate } from 'glov/client/simple_menu';
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
  uiPanel,
} from 'glov/client/ui';
import * as urlhash from 'glov/client/urlhash';
import walltime from 'glov/client/walltime';
import { webFSAPI } from 'glov/client/webfs';
import {
  TraitFactory,
  traitFactoryCreate,
} from 'glov/common/trait_factory';
import {
  ClientChannelWorker,
  DataObject,
  EntityID,
} from 'glov/common/types';
import {
  clamp,
  clone,
  lerp,
} from 'glov/common/util';
import {
  Vec2,
  v2set,
  v2sub,
  vec2,
  vec4,
} from 'glov/common/vmath';
import {
  CrawlerLevel,
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
  EntityCrawlerClient,
  crawlerEntitiesAt,
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
  SavedGameData,
  crawlerBuildModeActivate,
  crawlerController,
  crawlerGameState,
  crawlerLoadOfflineGame,
  crawlerPlayStartup,
  crawlerRenderFrame,
  crawlerRenderFramePrep,
  crawlerSaveGame,
  crawlerSaveGameGetData,
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
  GoodDef,
} from './goods';
import { jamTraitsStartup } from './jam_events';
import { levelGenTest } from './level_gen_test';
import { renderAppStartup } from './render_app';
import {
  statusTick,
} from './status';

const spritesheet_ui = require('./img/ui');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { floor, max, min, round } = Math;

declare module 'glov/client/settings' {
  export let ai_pause: 0 | 1; // TODO: move to ai.ts
  export let show_fps: 0 | 1;
  export let volume: number;
}

declare module 'glov/client/ui' {
  interface UISprites {
    panel_mini: UISprite;
    panel_mini_red: UISprite;
  }
}

const MINIMAP_RADIUS = 3;
const MINIMAP_X = 261;
const MINIMAP_Y = 3;
const MINIMAP_W = 5+7*(MINIMAP_RADIUS*2 + 1);
const VIEWPORT_X0 = 3;
const VIEWPORT_Y0 = 3;

type Entity = EntityDemoClient;

let font: Font;
let tiny_font: Font;

let frame_wall_time = 0;
let loading_level = false;

let controller: CrawlerController;

let pause_menu_up = false;
let inventory_up = false;
let recruit_up = false;

let last_level: CrawlerLevel | null = null;

let button_sprites: Record<ButtonStateString, Sprite>;
let button_sprites_down: Record<ButtonStateString, Sprite>;
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

// function entityManager(): ClientEntityManagerInterface<Entity> {
//   return crawlerEntityManager() as ClientEntityManagerInterface<Entity>;
// }

const PAUSE_MENU_W = 160;
let pause_menu: SimpleMenu;
function pauseMenu(): void {
  if (!pause_menu) {
    pause_menu = simpleMenuCreate({
      x: (game_width - PAUSE_MENU_W)/2,
      y: 80,
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
    name: 'Volume',
    //plus_minus: true,
    slider: true,
    value_inc: 0.05,
    value_min: 0,
    value_max: 1,
  }, {
    name: isOnline() ? 'Return to Title' : 'Save and Exit',
    cb: function () {
      if (!isOnline()) {
        crawlerSaveGame();
      }
      urlhash.go('');
    },
  }];
  if (isLocal()) {
    items.push({
      name: 'Exit without saving',
      cb: function () {
        urlhash.go('');
      },
    });
  }

  let volume_item = items[1];
  volume_item.value = settings.volume;
  volume_item.name = `Volume: ${(settings.volume * 100).toFixed(0)}`;

  pause_menu.run({
    slider_w: 80,
    items,
  });

  settings.set('volume', pause_menu.getItem(1).value);

  ui.menuUp();
}

function playerHasKeyGood(good_def: GoodDef): boolean {
  assert(good_def.key);
  let me = myEnt();
  let { goods } = me.data;
  for (let ii = 0; ii < goods.length; ++ii) {
    let pgd = GOODS[goods[ii].type];
    assert(pgd);
    if (goods[ii] && pgd.key === good_def.key) {
      return true;
    }
  }
  return false;
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
        if (playerHasKeyGood(good_def)) {
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


const style_by_realm = {
  phys: fontStyle(null, {
    color: 0xFFFFFFff,
  }),
  spirit: fontStyle(null, {
    color: 0x000000ff,
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
    font.drawSizedAligned(style_text, x, y + (settings.pixely > 1 ? 0.5 : 0), z+2,
      ui.font_height, ALIGN.HVCENTERFIT,
      w, h, `${hp} / ${hp_max}`);
  }
}

const OVERLAY_PAD = 4;
const OVERLAY_X0 = 1;
const OVERLAY_Y0 = 1;
const OVERLAY_W = game_width - 2;
const OVERLAY_H = game_height - 2;
const OVERLAY_PLAYER_X0 = game_width / 2;
const OVERLAY_SUB_W = OVERLAY_W / 2;


let inventory_last_frame: number = -1;
let inventory_goods: string[];
let inventory_scroll: ScrollArea;
function inventoryMenu(): void {
  if (!inventory_up) {
    return;
  }
  recruit_up = false;
  let reset = false;
  if (inventory_last_frame !== getFrameIndex() - 1) {
    reset = true;
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
    font.draw({
      align: ALIGN.HCENTER,
      x, y, z,
      w,
      text: 'PLAYER',
    });
    y += ui.font_height + 1;
    spritesheet_ui.sprite.draw({
      x: x + w/2 + 4, y: y + 2, z, w: 8, h: 8,
      frame: spritesheet_ui.FRAME_ICON_COIN,
    });
    font.draw({
      style: style_money,
      align: ALIGN.HLEFT,
      x: x + w/2 + 4 + 9, y, z,
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
      x, y, z, w: w/2,
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
      x: OVERLAY_X0 + OVERLAY_W/2 - 2, y: y - 10, z, w: 8, h: 8,
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
    x: OVERLAY_X0 + 3, y: y - 2, w: OVERLAY_W - 6, h: y1 - OVERLAY_PAD - y + 3,
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
    if (trader_good) {
      let show_buy_button = Boolean(!trader_only_buys || trader_good.count);
      if (!trader_good.count && good_def.key) {
        // don't even show name, player must have one
        show_buy_button = false;
      } else {
        font.draw({
          style: style_by_realm[good_def.realm],
          align: ALIGN.HLEFT,
          x: trader_x, y, z,
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
      font.draw({
        style: trader_good.count && trader_good.cost > data.money ? style_not_allowed : style_money,
        align: ALIGN.HCENTERFIT,
        x: value_x, y, z,
        w: value_w,
        text: `${trader_good.cost}`,
      });
      let num_to_buy = 1;
      if (shift()) {
        num_to_buy = min(trader_good.count, floor(data.money / trader_good.cost), data.good_capacity - num_goods);
      }
      if (show_buy_button && ui.buttonText({
        x: button_buy_x, y: y - button_y_offs,
        w: button_w, z,
        text: '->',
        sound: 'buy',
        tooltip: `Buy ${num_to_buy}`,
        disabled: trader_good.count === 0 || trader_good.cost > data.money || overloaded,
      })) {
        if (!player_good) {
          player_good = {
            type: good_id,
            count: 0,
            cost: 0,
          };
          data.goods.push(player_good);
        }
        player_good.cost = (player_good.cost * player_good.count + trader_good.cost * num_to_buy) /
          (player_good.count + num_to_buy);
        trader_good.count-= num_to_buy;
        player_good.count+= num_to_buy;
        data.money -= trader_good.cost * num_to_buy;
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
    if (player_good) {
      let good_name_x = player_count_x + 1;
      if (good_def.key) {
        // show no count
      } else {
        font.draw({
          align: ALIGN.HCENTER,
          x: player_count_x, y, z,
          w: count_w,
          text: `${player_good.count}`,
        });
        good_name_x += count_w;
      }
      font.draw({
        style: style_by_realm[good_def.realm],
        align: ALIGN.HLEFT,
        x: good_name_x, y, z,
        w,
        text: good_def.name,
      });
      if (trader_good) {
        let num_to_sell = 1;
        if (shift()) {
          num_to_sell = player_good.count;
        }
        if (ui.buttonText({
          x: button_sell_x, y: y - button_y_offs,
          w: button_w, z,
          text: '<-',
          sound: 'sell',
          tooltip: `Sell ${num_to_sell}`,
        })) {
          player_good.count -= num_to_sell;
          trader_good.count += num_to_sell;
          data.money += trader_good.cost * num_to_sell;
          if (!player_good.count) {
            data.goods = data.goods.filter((elem) => elem.type !== good_id);
          }
        }
      } else if (!trader && (!good_def.key || engine.DEBUG && shift())) {
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
}

let MERC_LIST: Merc[] = [{
  portrait: 1,
  hp: 10, hp_max: 10,
  attack: 1, defense: 1,
  cost: 10,
}, {
  portrait: 2,
  hp: 10, hp_max: 10,
  attack: 1, defense: 3,
  cost: 20,
}, {
  portrait: 3,
  hp: 10, hp_max: 10,
  attack: 3, defense: 0,
  cost: 30,
}, {
  portrait: 4,
  hp: 1, hp_max: 1,
  attack: 1, defense: 0,
  cost: 1,
}];

let style_dead = fontStyleColored(null, dawnbringer.font_colors[25]);
let color_black = vec4(0, 0, 0, 1);

const MERC_H = 26;
const MERC_W = 41;
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
        align: ALIGN.HLEFT,
        x: x2 + 9, y: y1, z, w: 12, h: 8,
        size: 8,
        text: is_player ? `${merc.hp}/${merc.hp_max}` : `${merc.hp_max}`,
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
      x: x + w/2 + 4, y: y + 2, z, w: 8, h: 8,
      frame: spritesheet_ui.FRAME_ICON_COIN,
    });
    font.draw({
      style: style_money,
      align: ALIGN.HLEFT,
      x: x + w/2 + 4 + 9, y, z,
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
      x, y, z, w: w/2,
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

  let shop = MERC_LIST;
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
      data.mercs.push(clone(merc));
    }

    uiPanel({
      x, y, z, w: 72 + 56 + 3, h: MERC_H,
      sprite: ui.sprites.panel_mini,
    });
    y += MERC_H;
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
  })) {
    data.money -= missing_hp;
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
    if (merc && ui.button({
      x: x + 90, y: y + 3, w: 56, z,
      text: merc.hp > 0 ? 'Retire' : '"Retire"',
      sound: 'drop',
      // disabled: ii === 0 && mercs.length === 1,
    })) {
      mercs.splice(ii, 1);
    }

    uiPanel({
      x, y, z, w: 90 + 56 + 3, h: MERC_H,
      sprite: ui.sprites.panel_mini,
    });
    y += MERC_H;
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
  let me = crawlerMyEnt();
  // search, needs game_state, returns list of foes
  let ents: Entity[] = entitiesAdjacentTo(crawlerGameState(),
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

export function onEnterCell(pos: Vec2): void {
  // if (engagedEnemy()) {
  //   controller.cancelAllMoves();
  // }
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
    x + w/2, y + h/2 - 16, z,
    ui.font_height, ALIGN.HCENTER|ALIGN.VBOTTOM,
    0, 0, 'You have died.');

  if (ui.buttonText({
    x: x + w/2 - ui.button_width/2, y: y + h/2, z,
    text: 'Respawn',
  })) {
    controller.goToFloor(0, 'stairs_in', 'respawn');
  }

  return true;
}

const BUTTON_W = 26;

const MOVE_BUTTONS_X0 = 261;
const MOVE_BUTTONS_Y0 = 179;

const MERC_BOTTOM_Y = MOVE_BUTTONS_Y0 - 2;
const MERC_X0 = MOVE_BUTTONS_X0;

let last_merc_pos: Vec2[] = [];
export function mercPos(index: number): Vec2 {
  return last_merc_pos[index];
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
      x: xx, y: yy, z, w: MERC_W, h: MERC_H,
      sprite: dead ? ui.sprites.panel_mini_red : ui.sprites.panel_mini,
    });
    last_merc_pos[ii] = last_merc_pos[ii] || vec2();
    v2set(last_merc_pos[ii], xx, yy);
    drawMerc(merc, xx, yy, z, false, true);
    if (x === MERC_X0) {
      x += MERC_W;
    } else {
      x = MERC_X0;
      y -= MERC_H;
    }
  }
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

  const build_mode = buildModeActive();
  let frame_map_view = mapViewActive();
  let frame_combat = engagedEnemy();
  let overlay_menu_up = pause_menu_up || inventory_up || recruit_up;
  let minimap_display_h = build_mode ? BUTTON_W : MINIMAP_W;
  let show_compass = !build_mode;
  let compass_h = show_compass ? 11 : 0;
  let minimap_h = minimap_display_h + compass_h;

  if (build_mode && !controller.ignoreGameplay()) {
    let build_y = MINIMAP_Y + minimap_h + 2;
    crawlerBuildModeUI({
      x: MINIMAP_X,
      y: build_y,
      w: game_width - MINIMAP_X - 2,
      h: MOVE_BUTTONS_Y0 - build_y - 2,
      map_view: frame_map_view,
    });

  }


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
      button_sprites: toggled_down ? button_sprites_down : button_sprites,
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
  let menu_pads = [PAD.BACK];
  if (menu_up) {
    menu_pads.push(PAD.B);
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
    inventory_up = recruit_up = false;
  }

  inventoryMenu();
  recruitMenu();

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

  let dt = getScaledFrameDt();
  if (frame_combat) {
    button(1, 1, 8, 'flee', [KEYS.S, KEYS.NUMPAD2, KEYS.NUMPAD5], [PAD.B, PAD.DOWN]);

    doCombat(frame_combat, dt * (shift() ? 3 : 1), menu_up || isMenuUp(), Boolean(up_edge.flee));
  } else {
    cleanupCombat(dt * (shift() ? 3 : 1));
  }

  controller.doPlayerMotion({
    dt,
    button_x0: MOVE_BUTTONS_X0,
    button_y0: MOVE_BUTTONS_Y0,
    no_visible_ui: frame_map_view,
    button_w: BUTTON_W,
    button_sprites,
    disable_move: moveBlocked() || overlay_menu_up,
    disable_player_impulse: Boolean(frame_combat),
    show_buttons: !frame_combat,
    do_debug_move: engine.defines.LEVEL_GEN || build_mode,
    show_debug: Boolean(settings.show_fps),
  });

  // Check for intentional events
  // if (!build_mode) {
  //   button(2, -3, 7, 'inventory', [KEYS.I], [PAD.X], inventory_up);
  // }
  //
  // if (up_edge.inventory) {
  //   inventory_up = !inventory_up;
  // }

  if (keyUpEdge(KEYS.B)) {
    crawlerBuildModeActivate(!build_mode);
  }

  if (up_edge.menu) {
    if (menu_up) {
      if (mapViewActive()) {
        mapViewSetActive(false);
      } else if (build_mode) {
        crawlerBuildModeActivate(false);
      } else {
        // close whatever other menu
        inventory_up = recruit_up = false;
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
  if (!overlay_menu_up && keyDownEdge(KEYS.M)) {
    mapViewToggle();
  }
  let game_state = crawlerGameState();
  let script_api = crawlerScriptAPI();
  if (frame_map_view) {
    if (engine.defines.LEVEL_GEN) {
      if (levelGenTest(game_state)) {
        controller.initPosFromLevelDebug();
      }
    }
    crawlerMapViewDraw(game_state, 0, 0, game_width, game_height, 0, Z.MAP,
      engine.defines.LEVEL_GEN, script_api, overlay_menu_up);
  } else {
    crawlerMapViewDraw(game_state, MINIMAP_X, MINIMAP_Y, MINIMAP_W, minimap_display_h, compass_h, Z.MAP,
      false, script_api, overlay_menu_up);
  }

  if (!menu_up) {
    drawMercs();
  }

  statusTick(VIEWPORT_X0, VIEWPORT_Y0, Z.STATUS, render_width, render_height);

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
  let overlay_menu_up = pause_menu_up || inventory_up || recruit_up;
  if (!(map_view || isMenuUp() || overlay_menu_up)) {
    spotSuppressPad();
  }

  profilerStopStart('chat');
  getChatUI().run({
    hide: map_view || overlay_menu_up || !isOnline(),
    x: 3,
    y: 196,
    border: 2,
    scroll_grow: 2,
    always_scroll: !map_view && !overlay_menu_up && !buildModeOverlayActive(),
    cuddly_scroll: true,
  });
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
      settings.ai_pause || engine.defines.LEVEL_GEN || overlay_menu_up || engagedEnemy(), script_api);
  }

  if (crawlerCommWant()) {
    crawlerCommStart();
  }

  crawlerEntityManager().actionListFlush();

  getChatUI().runLate();
  profilerStop();
  profilerStopFunc();
}

function onPlayerMove(old_pos: Vec2, new_pos: Vec2): void {
  // let game_state = crawlerGameState();
  // aiOnPlayerMoved(game_state, myEnt(), old_pos, new_pos,
  //   settings.ai_pause || engine.defines.LEVEL_GEN, script_api);
}

function onInitPos(): void {
  // autoAttackCancel();
}

function playInitShared(online: boolean): void {
  controller = crawlerController();

  controller.setOnPlayerMove(onPlayerMove);
  controller.setOnInitPos(onInitPos);

  last_level = null;
  pause_menu_up = false;
  inventory_up = false;
  recruit_up = false;
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

function saveUponLeavingTown(me: Entity): void {
  me.data.last_save_in_town = '';
  me.data.last_save_in_town = JSON.stringify(crawlerSaveGameGetData());
}

export function restartInTown(): void {
  let me = myEnt();
  assert(me);
  let data = me.data.last_save_in_town;
  assert(data);
  let data2 = JSON.parse(data) as SavedGameData;
  crawlerLoadOfflineGame(data2);
  me = myEnt();
  assert(me);
  me.data.last_save_in_town = data;
}

function resetFloorOnJourney(entity_manager: ClientEntityManagerInterface,
  floor_id: number, level: CrawlerLevel
) : void {
  assert(!entity_manager.isOnline());
  let { entities } = entity_manager;
  for (let ent_id_str in entities) {
    let ent_id = Number(ent_id_str);
    let ent = entities[ent_id]!;
    if (ent.is_enemy && ent.data.floor === floor_id) {
      entity_manager.deleteEntity(ent_id, 'respawn');
    }
  }

  if (level.initial_entities) {
    let initial_entities = clone(level.initial_entities);
    for (let ii = 0; ii < initial_entities.length; ++ii) {
      initial_entities[ii].floor = floor_id;
      let ent = entity_manager.addEntityFromSerialized(initial_entities[ii]);
      if (!ent.is_enemy) {
        entity_manager.deleteEntity(ent.id, 'respawn');
      }
    }
  }
}

function initLevel(entity_manager: ClientEntityManagerInterface,
  floor_id: number, level: CrawlerLevel
) : void {
  let me = entity_manager.getMyEnt();
  assert(me);
  if (level.props.is_town && floor_id !== me.data.last_journey_town) {
    me.data.last_journey_town = floor_id;
    me.data.journeys++;
  }
  if (last_level && last_level.props.is_town) {
    // Save our state as of when we left town last
    me.data.town_visits++;
    saveUponLeavingTown(me);
  }
  last_level = level;
  if (me.data.floor_town_init[floor_id] !== me.data.town_visits) {
    resetFloorOnJourney(entity_manager, floor_id, level);
    me.data.floor_town_init[floor_id] = me.data.town_visits;
  }
}

settings.register({
  ai_pause: {
    default_value: 0,
    type: cmd_parse.TYPE_INT,
    range: [0, 1],
  },
});

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
        floor: 5,
        stats: { hp: 10, hp_max: 10 },
        money: 100,
        good_capacity: 10,
        merc_capacity: 1,
      },
      loading_state: playOfflineLoading,
    },
    play_state: play,
    on_init_level_offline: initLevel,
  });
  let ent_factory = traitFactoryCreate<Entity, DataObject>();
  jamTraitsStartup(ent_factory);
  aiTraitsClientStartup(ent_factory);
  crawlerEntityTraitsClientStartup({
    ent_factory: ent_factory as unknown as TraitFactory<EntityCrawlerClient, DataObject>,
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

  renderAppStartup();
  combatStartup();
  crawlerLoadData(webFSAPI());
  crawlerMapViewStartup();
}
