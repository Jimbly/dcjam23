import {
  CrawlerScriptAPI,
  CrawlerScriptEventMapIcon,
  CrawlerScriptWhen,
  crawlerScriptRegisterEvent,
} from '../common/crawler_script';
import { CrawlerCell } from '../common/crawler_state';
import { startShopping } from './play';


crawlerScriptRegisterEvent({
  key: 'shop', // no param?
  when: CrawlerScriptWhen.POST,
  map_icon: CrawlerScriptEventMapIcon.SHOP1,
  func: (api: CrawlerScriptAPI, cell: CrawlerCell, param: string) => {
    api.status('floor_abs', 'Shopping time!');
    startShopping();
  },
});

export function jamEventsStartup(): void {
  // ?
}
