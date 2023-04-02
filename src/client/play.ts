import assert from 'assert';
import { cmd_parse } from 'glov/client/cmds';
import * as engine from 'glov/client/engine';
import { getFrameIndex } from 'glov/client/engine';
import { ClientEntityManagerInterface } from 'glov/client/entity_manager_client';
import {
  ALIGN,
  Font,
  fontStyle,
} from 'glov/client/font';
import * as input from 'glov/client/input';
import {
  KEYS,
  PAD,
  keyDown,
  keyDownEdge,
  keyUpEdge,
  padButtonDown,
  padButtonDownEdge,
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
  Vec2,
} from 'glov/common/vmath';
import {
  CrawlerLevel,
  crawlerLoadData,
} from '../common/crawler_state';
import {
  aiDoFloor, aiTraitsClientStartup,
} from './ai';
// import './client_cmds';
import { buildModeActive, crawlerBuildModeUI } from './crawler_build_mode';
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
  crawlerGameState,
  crawlerPlayStartup,
  crawlerRenderFrame,
  crawlerRenderFramePrep,
  crawlerSaveGame,
  crawlerScriptAPI,
  getScaledFrameDt,
} from './crawler_play';
import {
  crawlerRenderViewportSet,
  renderPrep,
} from './crawler_render';
import {
  crawlerRenderEntitiesPrep,
  crawlerRenderEntitiesStartup,
} from './crawler_render_entities';
import { crawlerScriptAPIDummyServer } from './crawler_script_api_client';
import { crawlerOnScreenButton } from './crawler_ui';
import {
  EntityDemoClient,
  Good,
  entityManager,
} from './entity_demo_client';
// import { EntityDemoClient } from './entity_demo_client';
import {
  game_height,
  game_width,
  render_height,
  render_width,
} from './globals';
import { GOODS } from './goods';
import { jamTraitsStartup } from './jam_events';
import { levelGenTest } from './level_gen_test';
import { renderAppStartup } from './render_app';
import {
  statusTick,
} from './status';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { floor, max, min, round } = Math;

declare module 'glov/client/settings' {
  export let ai_pause: 0 | 1; // TODO: move to ai.ts
  export let show_fps: 0 | 1;
  export let volume: number;
}

// const ATTACK_WINDUP_TIME = 1000;
const MINIMAP_RADIUS = 3;
const MINIMAP_X = 261;
const MINIMAP_Y = 3;
const MINIMAP_W = 5+7*(MINIMAP_RADIUS*2 + 1);
const VIEWPORT_X0 = 3;
const VIEWPORT_Y0 = 3;

type Entity = EntityDemoClient;

let font: Font;

let frame_wall_time = 0;
let loading_level = false;

let controller: CrawlerController;

let pause_menu_up = false;
let inventory_up = false;

let button_sprites: Record<ButtonStateString, Sprite>;
let button_sprites_down: Record<ButtonStateString, Sprite>;

function myEnt(): Entity {
  return crawlerMyEnt() as Entity;
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
      goods.push({
        type: good_id,
        count: pair[0],
        cost: pair[1],
      });
    }
  }
  data.goods = goods;
}

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


let inventory_last_frame: number = -1;
let inventory_goods: string[];
let inventory_scroll: ScrollArea;
function inventoryMenu(): void {
  if (buildModeActive()) {
    inventory_up = false;
  }
  if (!inventory_up) {
    return;
  }
  let reset = false;
  if (inventory_last_frame !== getFrameIndex() - 1) {
    reset = true;
  }
  inventory_last_frame = getFrameIndex();
  let me = myEnt();
  let data = me.data;
  let other_ents = crawlerEntitiesAt(entityManager(), data.pos, data.floor, true) as Entity[];
  let trader: Entity | null = null;
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
  const pad = 4;
  const x0 = 1;
  const y0 = 1;
  const total_w = game_width - 2;
  const inv_x0 = game_width/2;
  const inv_w = total_w / 2;
  const h = game_height - 2;
  const y1 = y0 + h;
  // half width
  const w = inv_w - pad * 2;

  // Player inventory header
  const inv_x = inv_x0 + pad;
  let overloaded: boolean;
  {
    let x = inv_x;
    let y = y0 + pad;
    font.draw({
      align: ALIGN.HCENTER,
      x, y, z,
      w,
      text: 'PLAYER',
    });
    y += ui.font_height + 1;
    font.draw({
      style: style_money,
      align: ALIGN.HLEFT,
      x: x + w/2 + 4, y, z, w: w/3,
      text: `$${data.money}`,
    });

    let num_goods = 0;
    for (let ii = 0; ii < data.goods.length; ++ii) {
      num_goods += data.goods[ii].count;
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
  const trader_x = x0 + pad;
  if (trader) {
    let x = trader_x;
    let y = y0 + pad;
    font.draw({
      align: ALIGN.HCENTER,
      x, y, z,
      w,
      text: 'SHOP',
    });
    y += ui.font_height + 1;
    // font.draw({
    //   align: ALIGN.HCENTER,
    //   x, y, z,
    //   w,
    //   text: `Money: ${data.money}`,
    // });
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
    font.draw({
      align: ALIGN.HCENTER,
      x: x0, y: y - ui.font_height - 2, z,
      w: total_w,
      text: 'Value',
    });
  }

  if (!inventory_scroll) {
    inventory_scroll = scrollAreaCreate({
      z,
      background_color: null,
    });
  }

  inventory_scroll.keyboardScroll();

  inventory_scroll.begin({
    x: x0 + 3, y: y - 2, w: total_w - 6, h: y1 - pad - y + 3,
  });
  y = 2;

  const button_w = ui.button_height;
  const count_w = 6*3;
  const value_w = 6*4;
  const value_x = floor(0 + (total_w - value_w) / 2);
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
    let is_for_buy_only = trader_good && !trader_good.count && !player_good;
    if (trader_good) {
      font.draw({
        style: style_by_realm[good_def.realm],
        align: ALIGN.HLEFT,
        x: trader_x, y, z,
        w,
        text: good_def.name,
      });
      if (!is_for_buy_only) {
        font.draw({
          style: is_for_buy_only || trader_good.count ? undefined : style_not_allowed,
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
        num_to_buy = min(trader_good.count, floor(data.money / trader_good.cost));
      }
      if (!is_for_buy_only && ui.buttonText({
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
    } else if (trader) {
      font.draw({
        style: style_not_interested,
        align: ALIGN.HRIGHT,
        x: value_x + value_w, y, z,
        w: 0,
        text: 'Not interested',
      });
    }
    if (player_good) {
      font.draw({
        align: ALIGN.HCENTER,
        x: player_count_x, y, z,
        w: count_w,
        text: `${player_good.count}`,
      });
      font.draw({
        style: style_by_realm[good_def.realm],
        align: ALIGN.HLEFT,
        x: player_count_x + count_w + 1, y, z,
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
      } else if (!trader) {
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
    } else if (is_for_buy_only) {
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
      x: x0, y: y0,
      w: total_w, h, z: z - 1,
    });
  } else {
    uiPanel({
      x: inv_x0, y: y0,
      w: inv_w, h, z: z - 1,
    });
  }
}

function moveBlocked(): boolean {
  return false;
}

export function startShopping(): void {
  inventory_up = true;
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

function playCrawl(): void {
  profilerStartFunc();

  let down = {
    menu: 0,
  };
  type ValidKeys = keyof typeof down;
  let up_edge = {
    menu: 0,
  } as Record<ValidKeys, number>;

  const build_mode = buildModeActive();
  let frame_map_view = mapViewActive();
  let overlay_menu_up = pause_menu_up || inventory_up;
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
      my_disabled = my_disabled || overlay_menu_up;
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

  if (pause_menu_up) {
    pauseMenu();
  }

  inventoryMenu();

  controller.doPlayerMotion({
    dt: getScaledFrameDt(),
    button_x0: MOVE_BUTTONS_X0,
    button_y0: MOVE_BUTTONS_Y0,
    no_visible_ui: frame_map_view,
    button_w: BUTTON_W,
    button_sprites,
    disable_move: moveBlocked() || overlay_menu_up,
    show_buttons: true,
    do_debug_move: engine.defines.LEVEL_GEN || build_mode,
    show_debug: Boolean(settings.show_fps),
  });

  button_x0 = MOVE_BUTTONS_X0;
  button_y0 = MOVE_BUTTONS_Y0;

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
        inventory_up = false;
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
  // TODO: use crawlerOnScreenButton
  if (!overlay_menu_up && (keyDownEdge(KEYS.I) || padButtonDownEdge(PAD.Y))) {
    inventory_up = true;
  } else if (inventory_up && (keyDownEdge(KEYS.I) || padButtonDownEdge(PAD.Y))) {
    inventory_up = false;
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
  let overlay_menu_up = pause_menu_up || inventory_up;
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
    always_scroll: !map_view,
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
      settings.ai_pause || engine.defines.LEVEL_GEN || overlay_menu_up, script_api);
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

  pause_menu_up = false;
  inventory_up = false;
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

function initLevel(entity_manager: ClientEntityManagerInterface,
  floor_id: number, level: CrawlerLevel
) : void {
  let me = entity_manager.getMyEnt();
  assert(me);
  if (level.props.is_town && floor_id !== me.data.last_journey_town) {
    me.data.last_journey_town = floor_id;
    me.data.journeys++;
  }
}

settings.register({
  ai_pause: {
    default_value: 0,
    type: cmd_parse.TYPE_INT,
    range: [0, 1],
  },
});

export function playStartup(): void {
  ({ font } = ui);
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

  renderAppStartup();
  crawlerLoadData(webFSAPI());
  crawlerMapViewStartup();
}
