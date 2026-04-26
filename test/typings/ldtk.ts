import * as kontra from '../../kontra.js';

let project = {
  levels: [{identifier: 'Level_0', layerInstances: []}],
  defs: {tilesets: []}
};

let configDefault = kontra.LDtk(project);
let configByName = kontra.LDtk(project, {level: 'Level_0'});
let configByIndex = kontra.LDtk(project, {level: 0});

// returned config plugs directly into TileEngine
kontra.TileEngine(configDefault);
kontra.TileEngine(configByName);
kontra.TileEngine(configByIndex);
