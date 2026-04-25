// @ifdef TILEENGINE_LDTK
import { query } from './events.js';

// Tiled high-bit flip flags (see tileEngine.js). LDtk tile `f` is a
// 2-bit value where bit 0 = X flip and bit 1 = Y flip; no diagonal.
let FLIPPED_HORIZONTALLY = 0x80000000;
let FLIPPED_VERTICALLY = 0x40000000;

/**
 * Pick a level from an LDtk project by identifier or numeric index.
 */
function pickLevel(levels, selector) {
  if (selector == null) return levels[0];
  if (typeof selector == 'string') {
    return levels.find(l => l.identifier == selector);
  }
  return levels[selector];
}

/**
 * A level-editor importer that converts an [LDtk](https://ldtk.io/) project JSON into a config object consumable by [TileEngine](api/tileEngine). This keeps the tile-rendering path shared across editors without adding a class hierarchy: each editor gets an importer, not an engine.
 *
 * ```js
 * import { load, dataAssets, LDtk, TileEngine } from 'kontra';
 *
 * load('project.ldtk', 'tileset.png').then(() => {
 *   let config = LDtk(dataAssets['project'], { level: 'Level_0' });
 *   let tileEngine = TileEngine(config);
 * });
 * ```
 *
 * v1 limitations (throw in DEBUG builds):
 * - externally-saved levels are not supported — save the project with all levels bundled
 * - all layers in a level must share the same grid size
 * - layer pixel offsets must be zero (kontra has no per-layer offset)
 *
 * Entities layers and IntGrid layers without auto-rules are skipped — they produce no renderable tiles. Tile stacking within a cell is preserved by expanding the stacked tiles into separate kontra layers in display order.
 *
 * @function LDtk
 *
 * @param {Object} project - Parsed LDtk project JSON.
 * @param {Object} [options] - Import options.
 * @param {String|Number} [options.level=0] - Level identifier (e.g. `"Level_0"`) or numeric index into `project.levels`.
 *
 * @returns {{width: Number, height: Number, tilewidth: Number, tileheight: Number, tilesets: Object[], layers: Object[]}} A [TileEngine](api/tileEngine) config object with `width`, `height`, `tilewidth`, `tileheight`, `tilesets`, and `layers`.
 */
export default function LDtk(project, options = {}) {
  let { levels = [], defs = {}, externalLevels } = project;
  let level = pickLevel(levels, options.level);

  // @ifdef DEBUG
  if (!level) {
    throw Error(`LDtk level "${options.level}" not found in project`);
  }
  if (externalLevels || level.externalRelPath) {
    throw Error(
      `LDtk externally-saved levels are not supported; save the project with levels bundled`
    );
  }
  // @endif

  // determine uniform grid size from renderable layers using the
  // original LDtk order so mismatch errors match the user's project
  let allLayers = level.layerInstances || [];
  let sourceOrder = allLayers.filter(l => l.__type != 'Entities');
  let gridSize = sourceOrder[0] ? sourceOrder[0].__gridSize : 0;

  // @ifdef DEBUG
  sourceOrder.map(l => {
    if (l.__gridSize != gridSize) {
      throw Error(
        `LDtk layer "${l.__identifier}" has grid size ${l.__gridSize}, expected ${gridSize} (mixed grid sizes are not supported)`
      );
    }
    if (l.__pxTotalOffsetX || l.__pxTotalOffsetY) {
      throw Error(
        `LDtk layer "${l.__identifier}" has a non-zero pixel offset (per-layer offsets are not supported)`
      );
    }
  });
  // @endif

  // resolve tileset paths relative to the LDtk project file's url
  let base = query('dm', project) || location.href;
  let tilesetDefs = defs.tilesets || [];
  let tilesetByUid = {};
  tilesetDefs.map(t => {
    tilesetByUid[t.uid] = t;
  });

  // build kontra layers bottom-first (kontra renders first → last)
  let renderOrder = sourceOrder.slice().reverse();

  // collect tilesets actually referenced by renderable layers, in
  // first-seen order, assigning firstgids so tile IDs in different
  // tilesets don't collide in the kontra gid space
  let tilesets = [];
  let firstgidByUid = {};
  let nextGid = 1;
  renderOrder.map(layer => {
    let uid = layer.overrideTilesetUid ?? layer.__tilesetDefUid;
    if (uid == null || firstgidByUid[uid] != null) return;
    let def = tilesetByUid[uid];
    if (!def) return;
    firstgidByUid[uid] = nextGid;
    let cols = def.__cWid;
    let rows = def.__cHei;

    // LDtk has no native per-tile animation, but TilesetDef
    // .customData is a free-form string field. Users who want
    // animated tiles write Tiled-shaped JSON there
    // (e.g. `{"animation":[{"tileid":0,"duration":100}]}`); we
    // forward those entries to TileEngine's animated-tile support.
    // Invalid JSON or entries without an `animation` key are
    // ignored so customData keeps working for any other use.
    let tiles = [];
    (def.customData || []).map(entry => {
      let parsed;
      try {
        parsed = JSON.parse(entry.data);
      } catch {
        return;
      }
      if (parsed && parsed.animation) {
        tiles.push({ id: entry.tileId, animation: parsed.animation });
      }
    });

    tilesets.push({
      firstgid: nextGid,
      image: new URL(def.relPath, base).href,
      tilewidth: def.tileGridSize,
      tileheight: def.tileGridSize,
      margin: def.padding,
      spacing: def.spacing,
      columns: cols,
      ...(tiles.length && { tiles })
    });
    nextGid += cols * rows;
  });

  // build kontra layers, expanding stacked tiles into separate
  // layers so render order is preserved
  let cWid = gridSize ? level.pxWid / gridSize : 0;
  let cHei = gridSize ? level.pxHei / gridSize : 0;
  let layers = [];
  renderOrder.map(layer => {
    let tiles = (layer.gridTiles || []).concat(
      layer.autoLayerTiles || []
    );
    if (!tiles.length) return;

    let uid = layer.overrideTilesetUid ?? layer.__tilesetDefUid;
    let firstgid = firstgidByUid[uid];
    if (firstgid == null) return;

    // bucket tiles by cell, preserving array order (= z-order)
    let buckets = {};
    let maxStack = 1;
    tiles.map(tile => {
      let col = (tile.px[0] / gridSize) | 0;
      let row = (tile.px[1] / gridSize) | 0;
      let idx = row * cWid + col;
      let bucket = (buckets[idx] = buckets[idx] || []);
      let encoded = tile.t + firstgid;
      if (tile.f & 1) encoded |= FLIPPED_HORIZONTALLY;
      if (tile.f & 2) encoded |= FLIPPED_VERTICALLY;
      bucket.push(encoded);
      if (bucket.length > maxStack) maxStack = bucket.length;
    });

    // emit one kontra layer per stack level
    for (let k = 0; k < maxStack; k++) {
      let data = new Array(cWid * cHei).fill(0);
      Object.keys(buckets).map(idx => {
        let encoded = buckets[idx][k];
        if (encoded) data[idx] = encoded;
      });
      layers.push({
        name:
          maxStack > 1
            ? `${layer.__identifier}_${k}`
            : layer.__identifier,
        data,
        opacity: layer.__opacity,
        visible: layer.visible
      });
    }
  });

  return {
    width: cWid,
    height: cHei,
    tilewidth: gridSize,
    tileheight: gridSize,
    tilesets,
    layers
  };
}
// @endif
