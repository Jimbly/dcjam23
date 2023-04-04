/* eslint @typescript-eslint/no-use-before-define:off */
import * as urlhash from 'glov/client/urlhash';
import { dataError } from 'glov/common/data_error';
import { CrawlerScriptEventMapIcon } from '../common/crawler_script';
import { EAST } from '../common/crawler_state';
import {
  crawlerController,
  crawlerScriptAPI,
} from './crawler_play';
import { dialogPush, dialogTextStyle } from './dialog_system';
import { Good } from './entity_demo_client';
import { GOODS } from './goods';
import { SUPPLY_GOOD } from './jam_events';
import {
  autosave,
  myEnt,
  playerConsumeGood,
  playerHasGood,
  playerHasKeyGood,
} from './play';
import { statusPush, statusSet } from './status';

type DialogFunc = (() => void) | ((param: string) => void) | ((param: string) => CrawlerScriptEventMapIcon);

function leaveTownBlocked(): string[] | null {
  let { data } = myEnt();
  if (data.town_visits > 0) {
    return null;
  }
  let reasons = [];
  if (!playerHasGood(SUPPLY_GOOD)) {
    reasons.push('at least one Supply');
  }
  if (!data.mercs.length) {
    reasons.push('at least one Mercenary');
  }
  if (data.goods.length < 2) {
    reasons.push('some Trade Goods');
  }
  return reasons.length ? reasons : null;
}

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
  quest_icon: function (quest_key: string): CrawlerScriptEventMapIcon {
    let key = `quest${quest_key}`;
    if (crawlerScriptAPI().keyGet(key)) {
      return CrawlerScriptEventMapIcon.NONE;
    } else {
      return CrawlerScriptEventMapIcon.EXCLAIMATION;
    }
  },
  quest: function (quest_key: string) {
    let key = `quest${quest_key}`;
    if (crawlerScriptAPI().keyGet(key)) {
      return dialogPush({
        text: 'Thanks for helping me out earlier!',
        transient: true,
      });
    }
    type Quest = {
      text_have?: string;
      text_need?: string;
      need: Good;
    };
    const QUEST: Record<string, Quest> = {
      1: {
        need: {
          type: 'phys2',
          count: 1,
          cost: 50,
        },
        text_need: 'I\'ll pay you 50 if you bring me a box of Table Legs.',
      },
    };
    let quest = QUEST[quest_key];
    if (!quest) {
      return void statusSet('error', `Unknown quest "${key}"`);
    }
    let good_name = GOODS[quest.need.type]!.name;
    if (playerHasGood(quest.need)) {
      dialogPush({
        text: quest.text_have || (`Ooh, some ${good_name}!  I love it!` +
          `  I'll pay you ${quest.need.cost} for ${quest.need.count}` +
          ' of them.'),
        buttons: [{
          label: 'Maybe later...',
        }, {
          label: 'It\'s a deal!',
          cb: function () {
            playerConsumeGood(quest.need);
            let me = myEnt();
            me.data.money += quest.need.cost;
            statusPush(`+${quest.need.cost} Coins`);
            statusPush(`-${quest.need.count} ${good_name}`);
            crawlerScriptAPI().keySet(key);
          },
        }],
      });
    } else {
      dialogPush({
        text: quest.text_need || (`I'll pay you ${quest.need.cost} if you bring me ${quest.need.count}` +
          ` ${good_name}.`),
        transient: true,
      });
    }
  },
  leavetown_icon: function (): CrawlerScriptEventMapIcon {
    if (leaveTownBlocked()) {
      return CrawlerScriptEventMapIcon.X;
    } else {
      return CrawlerScriptEventMapIcon.NONE;
    }
  },
  leavetown: function () {
    let reasons = leaveTownBlocked();
    if (!reasons) {
      let me = myEnt();
      let { data } = me;
      if (data.journeys === 0 && data.town_visits === 0) {
        dialogPush({
          text: 'Mags: Good luck out there!  Follow the road Spiritward to get to Spiriton.',
          transient: true,
        });
        autosave();
      } else if (data.journeys === 0) {
        dialogPush({
          text: 'Mags: Remember, head Spiritward to get to Spiriton.',
          transient: true,
        });
      }
      if (data.autosave_journey !== data.journeys) {
        data.autosave_journey = data.journeys;
        autosave();
      }
      return;
    }
    dialogPush({
      text: 'Mags: Hey there!  Don\'t leave just yet, make sure you have' +
        ` ${reasons.join(' and ')}.`,
      buttons: [{
        label: 'Okay',
        cb: function () {
          crawlerController().forceMove(EAST);
        },
      }],
    });
  },
  final: function () {
    dialogPush({
      text: 'I have reclaimed that which was lost.  Perhaps now I am whole again.' +
        '  For now...',
      buttons: [{
        label: 'Rest. (Return to main menu)',
        cb: function () {
          autosave();
          urlhash.go('');
        },
      }, {
        label: 'I\'ll explore some more.',
      }],
    });
  },
};

export function dialog(id: string, param?: unknown): void {
  let dlg = DIALOGS[id];
  if (!dlg) {
    dataError(`Unknown dialog "${id}"`);
    return;
  }
  (dlg as ((param: unknown) => void))(param);
}

export function dialogMapIcon(id: string, param?: unknown): CrawlerScriptEventMapIcon {
  let dlg = DIALOGS[`${id}_icon`];
  if (!dlg) {
    return CrawlerScriptEventMapIcon.NONE;
  }
  return (dlg as ((param: unknown) => CrawlerScriptEventMapIcon))(param);
}
