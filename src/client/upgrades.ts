export type Upgrade = {
  name: string;
  merc_capacity: number;
  good_capacity: number;
  cost: number;
  realm: 'phys' | 'spirit' | 'none';
};
export const UPGRADES: Upgrade[] = [{
  name: 'None',
  merc_capacity: 0,
  good_capacity: 0,
  cost: 0,
  realm: 'none',
}, {
  name: 'Introductory Offer',
  merc_capacity: 1,
  good_capacity: 10,
  cost: 100,
  realm: 'phys',

}, {
  name: 'Seeker',
  merc_capacity: 4,
  good_capacity: 12,
  cost: 180,
  realm: 'spirit',
}, {
  name: 'Trader',
  merc_capacity: 2,
  good_capacity: 15,
  cost: 200,
  realm: 'phys',

}, {
  name: 'Hunter',
  merc_capacity: 5,
  good_capacity: 17,
  cost: 350,
  realm: 'spirit',
}, {
  name: 'Merchantman',
  merc_capacity: 3,
  good_capacity: 20,
  cost: 400,
  realm: 'phys',

}, {
  name: 'Defender',
  merc_capacity: 6,
  good_capacity: 20,
  cost: 800,
  realm: 'spirit',
}, {
  name: 'Hauler',
  merc_capacity: 4,
  good_capacity: 30,
  cost: 900,
  realm: 'phys',
}];
