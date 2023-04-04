import { Font, fontStyleColored } from 'glov/client/font';
import * as ui from 'glov/client/ui';
import {
  v2same,
  vec4,
} from 'glov/common/vmath';
import { JSVec2, JSVec3 } from '../common/crawler_state';
import { crawlerMyEnt } from './crawler_entity_client';
import { crawlerScriptAPI } from './crawler_play';
import * as dawnbringer from './dawnbringer32';

const { floor } = Math;

const FADE_TIME = 1000;
const STATUS_PAD_TOP = 2;
const STATUS_PAD_BOTTOM = 4;

export type DialogParam = {
  text: string;
  transient: boolean;
};

let active_dialog: DialogParam | null = null;
class DialogState {
  pos: JSVec2 = crawlerScriptAPI().pos.slice(0) as JSVec2;
  fade_time = 0;
}
let active_state: DialogState;


let temp_color = vec4(1, 1, 1, 1);
let style_status = fontStyleColored(null, dawnbringer.font_colors[21]);
let font: Font;


export function dialogMoveLocked(): boolean {
  return Boolean(active_dialog && !active_dialog.transient);
}

const HPAD = 4;
export function dialogRun(dt: number): void {
  let x = 11;
  let y = 143;
  let w = 240;
  let h = 61;
  let z = Z.DIALOG;
  if (!active_dialog) {
    return;
  }
  if (active_dialog.transient && !active_state.fade_time) {
    let my_pos = crawlerMyEnt().getData<JSVec3>('pos')!;
    if (!v2same(my_pos, active_state.pos)) {
      active_state.fade_time = FADE_TIME;
    }
  }
  let alpha = 1;
  if (active_state.fade_time) {
    if (dt >= active_state.fade_time) {
      active_dialog = null;
      return;
    }
    active_state.fade_time -= dt;
    alpha = active_state.fade_time / FADE_TIME;
  }

  let { text } = active_dialog;
  let size = ui.font_height;
  let dims = font.dims(style_status, w - HPAD * 2, 0, size, text);
  y += h - dims.h - STATUS_PAD_BOTTOM;
  font.draw({
    style: style_status,
    size,
    x: x + HPAD, y, z, w: w - HPAD * 2,
    align: font.ALIGN.HCENTER|font.ALIGN.HWRAP,
    text: text,
    alpha,
  });
  let text_w = dims.w;
  text_w += 6;
  temp_color[3] = alpha;
  ui.panel({
    x: x + floor((w - text_w)/2) - HPAD,
    y: y - STATUS_PAD_TOP, z: z - 1,
    w: text_w + HPAD * 2,
    h: dims.h + STATUS_PAD_TOP + STATUS_PAD_BOTTOM,
    color: temp_color,
  });
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
