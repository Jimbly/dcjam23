/* eslint @typescript-eslint/no-use-before-define:off */
import { dataError } from 'glov/common/data_error';
import { crawlerScriptAPI } from './crawler_play';
import { dialogPush, dialogTextStyle } from './dialog_system';
import { playerHasKeyGood } from './play';
import { statusSet } from './status';

type DialogFunc = (() => void) | ((param: string) => void);

const DIALOGS: Partial<Record<string, DialogFunc>> = {
  sign: function (param: string) {
    dialogPush({
      text: param,
      transient: true,
    });
  },
  greet: function (param: string) {
    statusSet('greet', param, dialogTextStyle()).counter = 3000;
  },
  welcome: function () {
    if (crawlerScriptAPI().keyGet('mcguff1')) {
      // already activated, completely hide
      return;
    }
    if (!playerHasKeyGood('mcguff1')) {
      // player must have already sold it
      return;
    }
    dialogPush({
      text: 'Hello there!\n' +
        'We were expecting you.  I hear you\'re interested in being a trader!',
      buttons: [{
        label: 'How do I get started?',
        cb: 'welcome_trader',
      }, {
        label: 'I want to be an adventurer!',
        cb: 'welcome_adventure',
      }],
    });
  },
  welcome_adventure: function () {
    dialogPush({
      text: 'Sorry, you don\'t really look like you\'d last very long out there on your own...',
      buttons: [{
        label: 'A trader it is, then...',
        cb: 'welcome_trader',
      }],
    });
  },
  welcome_trader: function () {
    dialogPush({
      text: 'You can sell that keepsake you brought with you at the General Store.' +
        '  That\'ll get you enough money to buy yourself a Covenant, hire a Mercenary, and' +
        ' buy some Supplies and Trade Goods.',
      buttons: [{
        label: 'What\'s a Covenant?',
        cb: 'welcome_covenant',
      }],
    });
  },
  welcome_covenant: function () {
    dialogPush({
      text: 'A Covenant is a kind of contract, it dictates how many Trade Goods you can bring out' +
        ' of town, as well as how many Mercenaries can accompany you.  Stop by the Ministry of Trade' +
        ' once you\'ve got a few coins to get one.',
      buttons: [{
        label: 'I\'ll do that!',
      }],
    });
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
