/* eslint max-len:off*/
const fs = require('fs');
let s = fs.readFileSync('goods.tsv', 'utf8');

let labels = [
  'phys1',
  'phys2',
  'phys3',
  'phys4',
  'phys5',
  'phys6',
  'phys7',
  'spirit1',
  'spirit2',
  'spirit3',
  'spirit4',
  'spirit5',
  'spirit6',
  'spirit7',
];

s.split('\n').forEach((line, idx) => {
  line = line.split('\t');
  let label = labels[idx];
  let phys = label.startsWith('phys');
  let widx = phys ? 19 : 10;
  console.log(`  ${label}: {
    name: '${line[0]}',
    realm: '${label.slice(0, -1)}',
    avail: {
      ...${phys ? 'spirit' : 'phys'}Wants(${line[widx]}, ${line[widx+3]}, ${line[widx+6]}),
      ...${phys ? 'phys' : 'spirit'}Sells(${line[7]},${line.slice(phys ? 1 : 4, phys ? 4 : 7).map((a) => (a==='X'?' 1':' 0'))}),
    },
  },`);
});
