import * as kontra from '../../kontra.js';

kontra.on('myEvent', () => {
  console.log('fired!');
});
kontra.off('myEvent', () => {});
kontra.emit('myEvent');

// args
kontra.on('myEvent', (num, str, bool, obj) => {
  console.log({num, str, bool, obj});
});
kontra.emit('myEvent', 1, 'string', true, {});

// query
kontra.on('findUser', (id) => ({id, name: 'alice'}));
let user = kontra.query('findUser', 42);
let noArgs = kontra.query('other');
