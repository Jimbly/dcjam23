import { fontStyleColored } from 'glov/client/font';
import { dataError } from 'glov/common/data_error';
import { crawlerGameState } from './crawler_play';
import * as dawnbringer from './dawnbringer32';
import { dialogPush } from './dialog_system';
import { statusSet } from './status';

type DialogFunc = (() => void) | ((param: string) => void);

let style_text_phys = fontStyleColored(null, dawnbringer.font_colors[21]);
let style_text_spirit = fontStyleColored(null, dawnbringer.font_colors[0]);


const DIALOGS: Partial<Record<string, DialogFunc>> = {
  sign: function (param: string) {
    dialogPush({
      text: param,
      transient: true,
    });
  },
  greet: function (param: string) {
    let level = crawlerGameState().level!;
    if (level.props && level.props.realm === 'spirit') {
      statusSet('greet', param, style_text_spirit);
    } else {
      statusSet('greet', param, style_text_phys);
    }
  },
};

export function dialog(id: string, param?: unknown): void {
  // TODO
  let dlg = DIALOGS[id];
  if (!dlg) {
    dataError(`Unknown dialog "${id}"`);
    return;
  }
  (dlg as ((param: unknown) => void))(param);
}
