/* eslint @typescript-eslint/no-use-before-define:off */
import * as urlhash from 'glov/client/urlhash';
import { dataError } from 'glov/common/data_error';
import { CrawlerScriptEventMapIcon } from '../common/crawler_script';
import { NORTH } from '../common/crawler_state';
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
  setScore,
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

function keyGet(k: string): boolean {
  return crawlerScriptAPI().keyGet(k);
}

function keySet(k: string): void {
  crawlerScriptAPI().keySet(k);
}


const DIALOGS: Partial<Record<string, DialogFunc>> = {
  sign: function (param: string) {
    dialogPush({
      name: '',
      text: param,
      transient: true,
    });
  },
  greet: function (param: string) {
    statusSet('greet', param, dialogTextStyle()).counter = 3000;
  },
  welcome: function () {
    if (keyGet('mcguff1')) {
      // already activated, completely hide
      return;
    }
    if (!playerHasKeyGood('mcguff1')) {
      // player must have already sold it
      return;
    }
    dialogPush({
      name: 'Altair',
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
      name: 'Altair',
      text: 'Sorry, you don\'t really look like you\'d last very long out there on your own...',
      buttons: [{
        label: 'A trader it is, then...',
        cb: 'welcome_trader',
      }],
    });
  },
  welcome_trader: function () {
    dialogPush({
      name: 'Altair',
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
      name: 'Altair',
      text: 'A Covenant is a kind of contract, it dictates how many Trade Goods you can bring out' +
        ' of town, as well as how many Mercenaries can accompany you.  Stop by the Ministry of Trade' +
        ' once you\'ve got a few coins to get one.',
      buttons: [{
        label: 'I\'ll do that!',
      }],
    });
  },

  spiritonwelcome: function () {
    if (keyGet('swelc')) {
      return dialogPush({
        name: 'Greeter',
        text: 'Welcome to Spiriton!  Remember, 3 Supplies is enough to get to our neighbors.',
        transient: true,
      });
    }
    keySet('swelc');
    dialogPush({
      name: 'Greeter',
      text: 'Oh my!  What do we have here?  A traveler from the Physical realm?',
      buttons: [{
        label: 'Uh... hi!',
        cb: function () {
          dialogPush({
            name: 'Greeter',
            text: 'That is not a proper response to a question...  You are welcome nonetheless!',
            buttons: [{
              label: 'Sorry, and thanks.',
              cb: 'swelc1',
            }],
          });
        },
      }, {
        label: 'That I am!',
        cb: 'swelc1',
      }],
    });
  },
  swelc1: function () {
    dialogPush({
      name: 'Greeter',
      text: 'It is amazing one such as you managed to survive crossing The Divide!',
      buttons: [{
        label: 'It really wasn\'t very long...',
        cb: 'swelc2',
      }, {
        label: 'I know!  What is this place?',
        cb: 'swelc3',
      }],
    });
  },
  swelc2: function () {
    dialogPush({
      name: 'Greeter',
      text: 'Well, the developer ran out of time, and the artists left him mid-project, and' +
      ' let us just pretend it was a difficult crossing.',
      buttons: [{
        label: 'Fair enough...  What is this place?',
        cb: 'swelc3',
      }],
    });
  },
  swelc3: function () {
    dialogPush({
      name: 'Greeter',
      text: 'You really are new... This is Spiriton, one of the three cities in the Spiritual Realm.' +
        '  Being entirely noncorporeal ourselves, we are unable to travel to the Physical Realm, so we will pay' +
        ' handsomely for any goods you brought with you.',
      buttons: [{
        label: 'Anything you want in particular?',
        cb: 'swelc4',
      }],
    });
  },
  swelc4: function () {
    dialogPush({
      name: 'Greeter',
      text: 'Me?  Nothing specific, but Merchant in the market will buy anything physical, and will pay more' +
        ' the more difficult the path from the city to where it can be purchased.  Paths are more difficult' +
        ' due to the amount of Supplies required to patch up the bridge long enough to cross.',
      buttons: [{
        label: 'I repaired a bridge on the way here...',
        cb: 'swelc5',
      }],
    });
  },
  swelc5: function () {
    dialogPush({
      name: 'Greeter',
      text: 'Sadly, the bridge will probably crumble again by the time you get back to it.  Time passes oddly' +
        ' inside towns, for those such as us.  The most difficult journeys may require up to 12 Supplies between' +
        ' towns, but from here 3 Supplies is enough to get to all of the neighboring towns.',
      buttons: [{
        label: 'Thanks for the information!',
      }],
    });
  },


  quest_icon: function (quest_key: string): CrawlerScriptEventMapIcon {
    let key = `quest${quest_key}`;
    if (keyGet(key)) {
      return CrawlerScriptEventMapIcon.NONE;
    } else {
      return CrawlerScriptEventMapIcon.EXCLAIMATION;
    }
  },
  quest: function (quest_key: string) {
    let key = `quest${quest_key}`;
    type Quest = {
      text_have?: string;
      text_need?: string;
      need: Good;
      name: string;
    };
    const QUEST: Record<string, Quest> = {
      1: {
        need: {
          type: 'phys2',
          count: 1,
          cost: 50,
        },
        text_need: 'I\'ll pay you 50 if you bring me a box of Table Legs.',
        name: 'Jenned',
      },
    };
    let quest = QUEST[quest_key];
    if (!quest) {
      return void statusSet('error', `Unknown quest "${key}"`);
    }
    if (keyGet(key)) {
      return dialogPush({
        name: quest.name,
        text: 'Thanks for helping me out earlier!',
        transient: true,
      });
    }
    let good_name = GOODS[quest.need.type]!.name;
    if (playerHasGood(quest.need)) {
      dialogPush({
        name: quest.name,
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
            me.data.town_counter++;
            me.data.money += quest.need.cost;
            statusPush(`+${quest.need.cost} Coins`);
            statusPush(`-${quest.need.count} ${good_name}`);
            keySet(key);
            setScore();
          },
        }],
      });
    } else {
      dialogPush({
        name: quest.name,
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
    const NAMES: Record<number, string> = {
      1: 'Mags',
      2: 'Megs',
      3: 'Mogs',
      4: 'Greeter',
      5: 'Welcomer',
      6: 'Steward',
    };
    let name = NAMES[myEnt().data.floor] || '';
    let reasons = leaveTownBlocked();
    if (!reasons) {
      let me = myEnt();
      let { data } = me;
      if (data.journeys === 0 && data.town_visits === 0) {
        dialogPush({
          name,
          text: 'Good luck out there!  Follow the road Spiritward to get to Spiriton.',
          transient: true,
        });
      } else if (data.journeys === 0) {
        dialogPush({
          name,
          text: 'Remember, head Spiritward to get to Spiriton.',
          transient: true,
        });
      }
      return;
    }
    dialogPush({
      name,
      text: 'Hey there!  Don\'t leave just yet, make sure you have' +
        ` ${reasons.join(' and ')}.`,
      buttons: [{
        label: 'Okay',
        cb: function () {
          crawlerController().forceMove(NORTH);
        },
      }],
    });
  },
  final: function () {
    dialogPush({
      name: '',
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
