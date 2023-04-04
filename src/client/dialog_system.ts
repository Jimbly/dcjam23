import { Font, FontStyle, fontStyleColored } from 'glov/client/font';
import {
  KEYS,
  PAD,
  eatAllInput,
  keyDown,
  mouseDownAnywhere,
  padButtonDown,
} from 'glov/client/input';
import * as ui from 'glov/client/ui';
import {
  v2same,
  vec4,
} from 'glov/common/vmath';
import { JSVec2, JSVec3 } from '../common/crawler_state';
import { buildModeActive } from './crawler_build_mode';
import { crawlerMyEnt } from './crawler_entity_client';
import { crawlerGameState, crawlerScriptAPI } from './crawler_play';
import * as dawnbringer from './dawnbringer32';
import { dialog } from './dialog_data';

const { ceil, floor } = Math;

const FADE_TIME = 1000;
const STATUS_PAD_TOP = 2;
const STATUS_PAD_BOTTOM = 4;

export type DialogButton = {
  label: string;
  cb?: string | (() => void);
};
export type DialogParam = {
  text: string;
  transient?: boolean;
  buttons?: DialogButton[];
};

let active_dialog: DialogParam | null = null;
class DialogState {
  pos: JSVec2 = crawlerScriptAPI().pos.slice(0) as JSVec2;
  fade_time = 0;
  counter = 0;
  ff_down = true;
  buttons_vis = false;
}
let active_state: DialogState;


let temp_color = vec4(1, 1, 1, 1);
let font: Font;

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

function ff(): boolean {
  return keyDown(KEYS.SPACE) || keyDown(KEYS.ENTER) ||
    padButtonDown(PAD.LEFT_TRIGGER) || padButtonDown(PAD.RIGHT_TRIGGER) ||
    padButtonDown(PAD.A) || padButtonDown(PAD.B) ||
    mouseDownAnywhere();
}


export function dialogMoveLocked(): boolean {
  return Boolean(active_dialog && !active_dialog.transient);
}

const HPAD = 4;
const BUTTON_HEAD = 4;
const BUTTON_PAD = 1;
export function dialogRun(dt: number): number {
  if (buildModeActive()) {
    active_dialog = null;
  }
  let x = 11;
  let y = 143;
  let w = 240;
  let h = 61;
  let z = Z.DIALOG;
  if (!active_dialog) {
    return 0;
  }
  let { transient, text, buttons } = active_dialog;
  active_state.counter += dt;
  let { buttons_vis, counter } = active_state;
  if (transient && !active_state.fade_time) {
    let my_pos = crawlerMyEnt().getData<JSVec3>('pos')!;
    if (!v2same(my_pos, active_state.pos)) {
      active_state.fade_time = FADE_TIME;
    }
  }
  let alpha = 1;
  if (active_state.fade_time) {
    if (dt >= active_state.fade_time) {
      active_dialog = null;
      return 0;
    }
    active_state.fade_time -= dt;
    alpha = active_state.fade_time / FADE_TIME;
  }

  let num_buttons = buttons && buttons.length || 0;
  let buttons_h = num_buttons * ui.button_height + (num_buttons ? BUTTON_HEAD + (num_buttons - 1) * BUTTON_PAD : 0);
  let size = ui.font_height;
  let style = dialogTextStyle();
  let dims = font.dims(style, w - HPAD * 2, 0, size, text);
  y += h - dims.h - STATUS_PAD_BOTTOM - buttons_h;
  let text_len = ceil(counter / 18);
  let text_full = text_len >= text.length;
  if (!transient) {
    if (!text_full && !active_state.ff_down) {
      if (ff()) {
        active_state.ff_down = true;
        text_full = true;
        active_state.counter += 10000000;
      }
    }
    if (active_state.ff_down) {
      // Eat these keys until released
      active_state.ff_down = ff();
    }
    font.draw({
      style,
      size,
      x: x + HPAD, y, z, w: w - HPAD * 2,
      align: font.ALIGN.HLEFT|font.ALIGN.HWRAP,
      text: text_full ? text : text.slice(0, text_len),
      alpha,
    });
  } else {
    font.draw({
      style,
      size,
      x: x + HPAD, y, z, w: w - HPAD * 2,
      align: font.ALIGN.HCENTER|font.ALIGN.HWRAP,
      text: text_full ? text : text.slice(0, text_len),
      alpha,
    });
  }
  let yy = y + dims.h + BUTTON_HEAD;

  if (text_full && !active_state.ff_down) {
    for (let ii = 0; ii < num_buttons; ++ii) {
      let button = buttons![ii];
      if (ui.buttonText({
        auto_focus: ii === 0,
        focus_steal: ii === 0 && (num_buttons === 1 || !buttons_vis),
        text: button.label,
        x: x + 4,
        w: w - HPAD * 2,
        y: yy,
        z,
      })) {
        active_dialog = null;
        if (button.cb) {
          if (typeof button.cb === 'string') {
            dialog(button.cb);
          } else {
            button.cb();
          }
        }
      }
      yy += ui.button_height + BUTTON_PAD;
    }
    active_state.buttons_vis = true;
  }

  temp_color[3] = alpha;
  if (transient && dims.h === ui.font_height) {
    let text_w = dims.w;
    ui.panel({
      x: x + floor((w - text_w)/2) - HPAD,
      y: y - STATUS_PAD_TOP, z: z - 1,
      w: text_w + HPAD * 2,
      h: dims.h + STATUS_PAD_TOP + STATUS_PAD_BOTTOM,
      color: temp_color,
    });
  } else {
    ui.panel({
      x,
      y: y - STATUS_PAD_TOP, z: z - 1,
      w,
      h: dims.h + STATUS_PAD_TOP + STATUS_PAD_BOTTOM + buttons_h,
      color: temp_color,
    });
  }

  if (!transient) {
    eatAllInput();
  }

  return y - STATUS_PAD_TOP;
}

export function dialogPush(param: DialogParam): void {
  active_dialog = param;
  active_state = new DialogState();
}

export function dialogReset(): void {
  //
}

export function dialogStartup(font_in: Font): void {
  font = font_in;
}