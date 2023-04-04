/*eslint global-require:off, comma-spacing:error*/
import * as local_storage from 'glov/client/local_storage.js'; // eslint-disable-line import/order
local_storage.setStoragePrefix('dcjam2023'); // Before requiring anything else that might load from this

import { chatUICreate } from 'glov/client/chat_ui';
import { cmd_parse } from 'glov/client/cmds';
import * as engine from 'glov/client/engine';
import { Font, fontCreate } from 'glov/client/font';
import * as net from 'glov/client/net';
import * as settings from 'glov/client/settings';
import { spriteSetGet } from 'glov/client/sprite_sets';
import { spritesheetTextureOpts } from 'glov/client/spritesheet';
import { textureDefaultFilters } from 'glov/client/textures';
import * as ui from 'glov/client/ui';
import { v4set } from 'glov/common/vmath';
// import './client_cmds.js'; // for side effects
import { crawlerBuildModeStartup } from './crawler_build_mode';
import { crawlerOnPixelyChange } from './crawler_play.js';
import { game_height, game_width } from './globals';
import { jamEventsStartup } from './jam_events';
import { playStartup } from './play';
import { titleInit, titleStartup } from './title';

Z.BACKGROUND = 1;
Z.SPRITES = 10;
Z.PARTICLES = 20;
Z.CHAT = 60;
Z.UI = 100;
Z.MAP = Z.UI + 5; // also minimap
Z.OVERLAY_UI = 110;
Z.MENUBUTTON = 120;
Z.FLOATERS = 125;
Z.DIALOG = 130;
Z.STATUS = 140;
Z.CHAT_FOCUSED = 100;
Z.PARTICLES = 150;

// let fonts: Font[] | undefined;

export let tiny_font: Font;

crawlerOnPixelyChange(function (new_value: number): void {
  // assert(fonts);
  // engine.setFonts(fonts[new_value] || fonts[2]);
});

export let chat_ui: ReturnType<typeof chatUICreate>;

export function main(): void {
  if (engine.DEBUG || true) {
    net.init({
      engine,
      cmd_parse,
      auto_create_user: true,
      allow_anon: true,
    });
  }

  // Default style
  if (!'simple hires') {
    settings.set('pixely', 0);
    settings.set('filter', 0);
    settings.set('entity_split', 0);
    settings.set('entity_nosplit_use_near', 1);
  } else if (!'simple lowres') {
    settings.set('pixely', 1);
    settings.set('filter', 0);
    settings.set('entity_split', 0);
    settings.set('entity_nosplit_use_near', 1);
  } else if ('CRT filter') {
    settings.set('pixely', 2);
    settings.set('hybrid', 1);
    settings.set('filter', 0);
    settings.set('entity_split', 0);
    settings.set('entity_nosplit_use_near', 1);
  } else if (!'split logic') {
    settings.set('pixely', 1);
    settings.set('filter', 0);
    settings.set('entity_split', 1);
  } else if (!'split logic filter') {
    settings.set('pixely', 1);
    settings.set('filter', 1);
    settings.set('entity_split', 1);
  }

  // const font_info_04b03x2 = require('./img/font/04b03_8x2.json');
  // const font_info_04b03x1 = require('./img/font/04b03_8x1.json');
  const font_info_palanquin32 = require('./img/font/palanquin32.json');
  let pixely = settings.pixely === 2 ? 'strict' : settings.pixely ? 'on' : false;
  //let font = { info: require('./img/font/bitfantasy.json'), texture: 'font/bitfantasy' };
  let font = { info: require('./img/font/celtictime.json'), texture: 'font/celtictime' };
  // if (pixely === 'strict') {
  //   font = { info: font_info_04b03x1, texture: 'font/04b03_8x1' };
  // } else if (pixely && pixely !== 'off') {
  //   font = { info: font_info_04b03x2, texture: 'font/04b03_8x2' };
  // } else {
  //   font = { info: font_info_palanquin32, texture: 'font/palanquin32' };
  // }
  settings.set('use_fbos', 1); // Needed for our effects

  spritesheetTextureOpts('whitebox', { force_mipmaps: true });

  if (!engine.startup({
    game_width,
    game_height,
    pixely,
    font,
    viewport_postprocess: true,
    antialias: false,
    znear: 11,
    zfar: 3200,
    do_borders: true,
    show_fps: false,
    ui_sprites: {
      ...spriteSetGet('pixely'),
      // color_set_shades: [1, 1, 1],
      // button: { name: 'button', ws: [3, 20, 3], hs: [26] },
      button_rollover: { name: 'pixely/button_rollover', ws: [4, 5, 4], hs: [13] },
      // button_down: { name: 'button_down', ws: [3, 20, 3], hs: [26] },
      // button_disabled: { name: 'button_disabled', ws: [3, 20, 3], hs: [26] },
      buttonselected_regular: { name: 'pixely/buttonselected', ws: [4, 5, 4], hs: [13] },
      buttonselected_down: { name: 'pixely/buttonselected_down', ws: [4, 5, 4], hs: [13] },
      buttonselected_rollover: { name: 'pixely/buttonselected', ws: [4, 5, 4], hs: [13] },
      buttonselected_disabled: { name: 'pixely/buttonselected_disabled', ws: [4, 5, 4], hs: [13] },
      panel: { name: 'pixely/panel', ws: [3, 2, 3], hs: [3, 10, 3] },
      panel_mini: { name: 'pixely/panel_mini', ws: [3, 2, 3], hs: [3, 2, 3] },
      panel_mini_red: { name: 'pixely/panel_mini_red', ws: [3, 2, 3], hs: [3, 2, 3] },
      // menu_entry: { name: 'menu_entry', ws: [4, 5, 4], hs: [13] },
      // menu_selected: { name: 'menu_selected', ws: [4, 5, 4], hs: [13] },
      // menu_down: { name: 'menu_down', ws: [4, 5, 4], hs: [13] },
      // menu_header: { name: 'menu_header', ws: [4, 5, 12], hs: [13] },
      // scrollbar_bottom: { name: 'scrollbar_bottom', ws: [11], hs: [11] },
      // scrollbar_trough: { name: 'scrollbar_trough', ws: [11], hs: [16] },
      // scrollbar_top: { name: 'scrollbar_top', ws: [11], hs: [11] },
      // scrollbar_handle_grabber: { name: 'scrollbar_handle_grabber', ws: [11], hs: [11] },
      // scrollbar_handle: { name: 'scrollbar_handle', ws: [11], hs: [3, 5, 3] },
    },
    ui_sounds: {
      user_join: 'user_join',
      user_leave: 'user_leave',
      msg_in: 'msg_in',
      msg_err: 'msg_err',
      msg_out_err: 'msg_out_err',
      msg_out: 'msg_out',
      buy: 'buy',
      heal: 'heal',
      sell: 'sell',
      drop: 'drop',
      victory: 'victory',
      footstep: ['footstep/footstep1', 'footstep/footstep2', 'footstep/footstep3', 'footstep/footstep4'],
    },
  })) {
    return;
  }
  let build_font = fontCreate(font_info_palanquin32, 'font/palanquin32');
  tiny_font = fontCreate(require('./img/font/04b03_8x1.json'), 'font/04b03_8x1');
  // fonts = [
  //   fontCreate(font_info_palanquin32, 'font/palanquin32'),
  //   fontCreate(font_info_bitfantasy, 'font/bitfantasy'),
  //   fontCreate(font_info_celtictime, 'font/celtictime'),
  // ];

  gl.clearColor(0, 0, 0, 1);

  // Actually not too bad:
  if (settings.filter) {
    textureDefaultFilters(gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR);
  }

  ui.scaleSizes(15 / 32);
  ui.setFontHeight(11);
  ui.setPanelPixelScale(1);
  v4set(ui.color_panel, 1, 1, 1, 1);
  // ui.uiSetFontStyleFocused(fontStyle(ui.uiGetFontStyleFocused(), {
  //   outline_width: 2.5,
  //   outline_color: dawnbringer.font_colors[8],
  // }));

  chat_ui = chatUICreate({
    max_len: 1000,
    w: 256,
    h: 38,
    outline_width: 3,
    fade_start_time: [10000, 5000],
    fade_time: [1000, 1000],
  });

  jamEventsStartup();
  crawlerBuildModeStartup(build_font);
  playStartup(tiny_font);
  titleStartup();

  engine.setState(titleInit);
}
