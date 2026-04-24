import LDtk from '../../src/ldtk.js';
import { on, callbacks } from '../../src/events.js';

// helpers for constructing minimal LDtk fixtures inline
function tilesetDef(props) {
  return {
    uid: 1,
    identifier: 'Tileset',
    relPath: 'tileset.png',
    pxWid: 32,
    pxHei: 32,
    tileGridSize: 16,
    spacing: 0,
    padding: 0,
    __cWid: 2,
    __cHei: 2,
    ...props
  };
}

function layer(props) {
  return {
    __identifier: 'L',
    __type: 'Tiles',
    __gridSize: 16,
    __cWid: 2,
    __cHei: 2,
    __opacity: 1,
    __pxTotalOffsetX: 0,
    __pxTotalOffsetY: 0,
    __tilesetDefUid: 1,
    gridTiles: [],
    autoLayerTiles: [],
    visible: true,
    ...props
  };
}

function level(props) {
  return {
    identifier: 'Level_0',
    iid: 'level-iid',
    pxWid: 32,
    pxHei: 32,
    // default to a single tile layer so level-selection tests
    // don't have to spell one out
    layerInstances: [layer()],
    ...props
  };
}

function project(props) {
  return {
    levels: [level()],
    defs: { tilesets: [tilesetDef()] },
    externalLevels: false,
    ...props
  };
}

describe('LDtk', () => {
  describe('level selection', () => {
    it('should pick the first level when no level option is given', () => {
      let config = LDtk(
        project({
          levels: [
            level({ identifier: 'Level_0' }),
            level({ identifier: 'Level_1' })
          ]
        })
      );
      expect(config.width).to.equal(2);
      expect(config.height).to.equal(2);
    });

    it('should pick a level by string identifier', () => {
      let config = LDtk(
        project({
          levels: [
            level({ identifier: 'Level_0', pxWid: 32, pxHei: 32 }),
            level({ identifier: 'Level_1', pxWid: 64, pxHei: 48 })
          ]
        }),
        { level: 'Level_1' }
      );
      expect(config.width).to.equal(4);
      expect(config.height).to.equal(3);
    });

    it('should pick a level by numeric index', () => {
      let config = LDtk(
        project({
          levels: [
            level({ pxWid: 16, pxHei: 16 }),
            level({ pxWid: 48, pxHei: 32 })
          ]
        }),
        { level: 1 }
      );
      expect(config.width).to.equal(3);
      expect(config.height).to.equal(2);
    });

    it('should throw when the requested level identifier is not found', () => {
      expect(() => LDtk(project(), { level: 'Missing' })).to.throw(
        /LDtk level "Missing" not found/
      );
    });

    it('should throw when the requested level index is out of range', () => {
      expect(() => LDtk(project(), { level: 5 })).to.throw(
        /LDtk level "5" not found/
      );
    });
  });

  describe('external levels', () => {
    it('should throw when project has externalLevels=true', () => {
      expect(() => LDtk(project({ externalLevels: true }))).to.throw(
        /externally-saved levels are not supported/
      );
    });

    it('should throw when a level has externalRelPath set', () => {
      expect(() =>
        LDtk(
          project({
            levels: [
              level({ externalRelPath: 'levels/Level_0.ldtkl' })
            ]
          })
        )
      ).to.throw(/externally-saved levels are not supported/);
    });
  });

  describe('grid uniformity', () => {
    it('should throw when layers have different grid sizes', () => {
      expect(() =>
        LDtk(
          project({
            levels: [
              level({
                layerInstances: [
                  layer({ __identifier: 'A', __gridSize: 16 }),
                  layer({ __identifier: 'B', __gridSize: 8 })
                ]
              })
            ]
          })
        )
      ).to.throw(/grid size 8, expected 16/);
    });

    it('should throw when a layer has a non-zero pixel offset', () => {
      expect(() =>
        LDtk(
          project({
            levels: [
              level({
                layerInstances: [
                  layer({
                    __identifier: 'Offset',
                    __pxTotalOffsetX: 4
                  })
                ]
              })
            ]
          })
        )
      ).to.throw(/non-zero pixel offset/);
    });

    it('should ignore entity layers when checking grid size', () => {
      // entity layers often have their own grid size but are
      // skipped by the importer, so they should not trigger the
      // uniformity check
      expect(() =>
        LDtk(
          project({
            levels: [
              level({
                layerInstances: [
                  {
                    __identifier: 'E',
                    __type: 'Entities',
                    __gridSize: 8,
                    entityInstances: []
                  },
                  layer({ __identifier: 'T', __gridSize: 16 })
                ]
              })
            ]
          })
        )
      ).to.not.throw();
    });
  });

  describe('layer conversion', () => {
    it('should convert a simple Tiles layer into a kontra layer', () => {
      let config = LDtk(
        project({
          levels: [
            level({
              layerInstances: [
                layer({
                  __identifier: 'Ground',
                  gridTiles: [
                    { px: [0, 0], t: 0, f: 0 },
                    { px: [16, 0], t: 1, f: 0 },
                    { px: [0, 16], t: 2, f: 0 },
                    { px: [16, 16], t: 3, f: 0 }
                  ]
                })
              ]
            })
          ]
        })
      );
      expect(config.layers).to.have.lengthOf(1);
      expect(config.layers[0].name).to.equal('Ground');
      expect(config.layers[0].data).to.eql([1, 2, 3, 4]);
    });

    it('should convert AutoLayer tiles', () => {
      let config = LDtk(
        project({
          levels: [
            level({
              layerInstances: [
                layer({
                  __identifier: 'Auto',
                  __type: 'AutoLayer',
                  autoLayerTiles: [
                    { px: [0, 0], t: 0, f: 0 },
                    { px: [16, 16], t: 3, f: 0 }
                  ]
                })
              ]
            })
          ]
        })
      );
      expect(config.layers[0].data).to.eql([1, 0, 0, 4]);
    });

    it('should convert IntGrid layers that have auto-rule tiles', () => {
      let config = LDtk(
        project({
          levels: [
            level({
              layerInstances: [
                layer({
                  __identifier: 'Collisions',
                  __type: 'IntGrid',
                  intGridCsv: [1, 0, 0, 1],
                  autoLayerTiles: [
                    { px: [0, 0], t: 2, f: 0 },
                    { px: [16, 16], t: 2, f: 0 }
                  ]
                })
              ]
            })
          ]
        })
      );
      expect(config.layers).to.have.lengthOf(1);
      expect(config.layers[0].data).to.eql([3, 0, 0, 3]);
    });

    it('should skip IntGrid layers without any tiles', () => {
      let config = LDtk(
        project({
          levels: [
            level({
              layerInstances: [
                layer({
                  __identifier: 'Pure',
                  __type: 'IntGrid',
                  __tilesetDefUid: null,
                  intGridCsv: [1, 0, 0, 1]
                })
              ]
            })
          ]
        })
      );
      expect(config.layers).to.have.lengthOf(0);
    });

    it('should skip Entities layers', () => {
      let config = LDtk(
        project({
          levels: [
            level({
              layerInstances: [
                {
                  __identifier: 'Entities',
                  __type: 'Entities',
                  __gridSize: 16,
                  entityInstances: [{ __identifier: 'Player' }]
                }
              ]
            })
          ]
        })
      );
      expect(config.layers).to.have.lengthOf(0);
    });

    it('should pass through opacity and visibility', () => {
      let config = LDtk(
        project({
          levels: [
            level({
              layerInstances: [
                layer({
                  __opacity: 0.5,
                  visible: false,
                  gridTiles: [{ px: [0, 0], t: 0, f: 0 }]
                })
              ]
            })
          ]
        })
      );
      expect(config.layers[0].opacity).to.equal(0.5);
      expect(config.layers[0].visible).to.equal(false);
    });

    it('should reverse layer order so LDtk top-first becomes kontra bottom-first', () => {
      let config = LDtk(
        project({
          levels: [
            level({
              layerInstances: [
                layer({
                  __identifier: 'Top',
                  gridTiles: [{ px: [0, 0], t: 0, f: 0 }]
                }),
                layer({
                  __identifier: 'Bottom',
                  gridTiles: [{ px: [0, 0], t: 1, f: 0 }]
                })
              ]
            })
          ]
        })
      );
      expect(config.layers.map(l => l.name)).to.eql([
        'Bottom',
        'Top'
      ]);
    });
  });

  describe('tile stacking', () => {
    it('should expand stacked tiles into separate layers in display order', () => {
      let config = LDtk(
        project({
          levels: [
            level({
              layerInstances: [
                layer({
                  __identifier: 'Stack',
                  gridTiles: [
                    { px: [0, 0], t: 0, f: 0 },
                    { px: [0, 0], t: 1, f: 0 },
                    { px: [0, 0], t: 2, f: 0 },
                    { px: [16, 0], t: 3, f: 0 }
                  ]
                })
              ]
            })
          ]
        })
      );
      expect(config.layers).to.have.lengthOf(3);
      expect(config.layers[0].name).to.equal('Stack_0');
      expect(config.layers[1].name).to.equal('Stack_1');
      expect(config.layers[2].name).to.equal('Stack_2');
      expect(config.layers[0].data).to.eql([1, 4, 0, 0]);
      expect(config.layers[1].data).to.eql([2, 0, 0, 0]);
      expect(config.layers[2].data).to.eql([3, 0, 0, 0]);
    });

    it('should not suffix layer names when stack depth is 1', () => {
      let config = LDtk(
        project({
          levels: [
            level({
              layerInstances: [
                layer({
                  __identifier: 'Flat',
                  gridTiles: [{ px: [0, 0], t: 0, f: 0 }]
                })
              ]
            })
          ]
        })
      );
      expect(config.layers[0].name).to.equal('Flat');
    });
  });

  describe('flip bits', () => {
    it('should map LDtk f=1 to the horizontal-flip bit', () => {
      let config = LDtk(
        project({
          levels: [
            level({
              layerInstances: [
                layer({ gridTiles: [{ px: [0, 0], t: 0, f: 1 }] })
              ]
            })
          ]
        })
      );
      // tile 0 + firstgid 1 = 1, with bit 31 set. >>>0
      // coerces to an unsigned 32-bit int for comparison.
      expect(config.layers[0].data[0] >>> 0).to.equal(0x80000001);
    });

    it('should map LDtk f=2 to the vertical-flip bit', () => {
      let config = LDtk(
        project({
          levels: [
            level({
              layerInstances: [
                layer({ gridTiles: [{ px: [0, 0], t: 1, f: 2 }] })
              ]
            })
          ]
        })
      );
      expect(config.layers[0].data[0] >>> 0).to.equal(0x40000002);
    });

    it('should map LDtk f=3 to both flip bits', () => {
      let config = LDtk(
        project({
          levels: [
            level({
              layerInstances: [
                layer({ gridTiles: [{ px: [0, 0], t: 2, f: 3 }] })
              ]
            })
          ]
        })
      );
      expect(config.layers[0].data[0] >>> 0).to.equal(0xc0000003);
    });
  });

  describe('tilesets', () => {
    it('should map tileset def properties onto the tileset entry', () => {
      let config = LDtk(
        project({
          defs: {
            tilesets: [
              tilesetDef({
                relPath: 'tiles.png',
                tileGridSize: 32,
                spacing: 2,
                padding: 1,
                __cWid: 4,
                __cHei: 3
              })
            ]
          },
          levels: [
            level({
              pxWid: 64,
              pxHei: 64,
              layerInstances: [
                layer({
                  __gridSize: 32,
                  gridTiles: [{ px: [0, 0], t: 0, f: 0 }]
                })
              ]
            })
          ]
        })
      );
      expect(config.tilesets).to.have.lengthOf(1);
      let ts = config.tilesets[0];
      expect(ts.firstgid).to.equal(1);
      expect(ts.tilewidth).to.equal(32);
      expect(ts.tileheight).to.equal(32);
      expect(ts.spacing).to.equal(2);
      expect(ts.margin).to.equal(1);
      expect(ts.columns).to.equal(4);
      // relPath resolved against location.href (no dm entry)
      expect(ts.image).to.match(/tiles\.png$/);
    });

    it('should assign sequential firstgids per tileset referenced by layers', () => {
      let config = LDtk(
        project({
          defs: {
            tilesets: [
              tilesetDef({
                uid: 1,
                relPath: 'a.png',
                __cWid: 2,
                __cHei: 2
              }),
              tilesetDef({
                uid: 2,
                relPath: 'b.png',
                __cWid: 3,
                __cHei: 1
              })
            ]
          },
          levels: [
            level({
              layerInstances: [
                // last in list = rendered on top in kontra,
                // uses tileset 2
                layer({
                  __identifier: 'Top',
                  __tilesetDefUid: 2,
                  gridTiles: [{ px: [0, 0], t: 0, f: 0 }]
                }),
                // first in list = rendered at the bottom,
                // uses tileset 1
                layer({
                  __identifier: 'Bottom',
                  __tilesetDefUid: 1,
                  gridTiles: [{ px: [0, 0], t: 0, f: 0 }]
                })
              ]
            })
          ]
        })
      );
      // first-seen order after reversal: tileset 1, then tileset 2
      expect(config.tilesets[0].image).to.match(/a\.png$/);
      expect(config.tilesets[0].firstgid).to.equal(1);
      expect(config.tilesets[1].image).to.match(/b\.png$/);
      expect(config.tilesets[1].firstgid).to.equal(5);

      // tile 0 in Bottom (tileset 1) encoded as 0 + 1 = 1
      expect(
        config.layers.find(l => l.name == 'Bottom').data[0]
      ).to.equal(1);
      // tile 0 in Top (tileset 2) encoded as 0 + 5 = 5
      expect(
        config.layers.find(l => l.name == 'Top').data[0]
      ).to.equal(5);
    });

    it('should honour overrideTilesetUid on a layer', () => {
      let config = LDtk(
        project({
          defs: {
            tilesets: [
              tilesetDef({ uid: 1, relPath: 'def.png' }),
              tilesetDef({ uid: 2, relPath: 'override.png' })
            ]
          },
          levels: [
            level({
              layerInstances: [
                layer({
                  __tilesetDefUid: 1,
                  overrideTilesetUid: 2,
                  gridTiles: [{ px: [0, 0], t: 0, f: 0 }]
                })
              ]
            })
          ]
        })
      );
      expect(config.tilesets).to.have.lengthOf(1);
      expect(config.tilesets[0].image).to.match(/override\.png$/);
    });

    it('should resolve tileset relPath against the url registered for the project data', () => {
      // simulate kontra's asset loader dataMap for this project
      let proj = project({
        defs: {
          tilesets: [tilesetDef({ relPath: 'assets/tiles.png' })]
        },
        levels: [
          level({
            layerInstances: [
              layer({ gridTiles: [{ px: [0, 0], t: 0, f: 0 }] })
            ]
          })
        ]
      });
      on('dm', obj =>
        obj == proj ? 'https://example.com/maps/project.ldtk' : null
      );

      let config = LDtk(proj);
      expect(config.tilesets[0].image).to.equal(
        'https://example.com/maps/assets/tiles.png'
      );

      delete callbacks.dm;
    });
  });

  describe('per-tile animation via customData', () => {
    function projWithCustomData(customData) {
      return project({
        defs: {
          tilesets: [tilesetDef({ customData })]
        },
        levels: [
          level({
            layerInstances: [
              layer({ gridTiles: [{ px: [0, 0], t: 0, f: 0 }] })
            ]
          })
        ]
      });
    }

    it('should forward Tiled-shaped animation JSON to the output tileset', () => {
      let config = LDtk(
        projWithCustomData([
          {
            tileId: 2,
            data: JSON.stringify({
              animation: [
                { tileid: 2, duration: 100 },
                { tileid: 3, duration: 100 }
              ]
            })
          }
        ])
      );
      expect(config.tilesets[0].tiles).to.eql([
        {
          id: 2,
          animation: [
            { tileid: 2, duration: 100 },
            { tileid: 3, duration: 100 }
          ]
        }
      ]);
    });

    it('should ignore customData entries that are not valid JSON', () => {
      let config = LDtk(
        projWithCustomData([
          { tileId: 0, data: 'this is just a label' },
          { tileId: 1, data: '' }
        ])
      );
      expect(config.tilesets[0].tiles).to.be.undefined;
    });

    it('should ignore JSON customData without an animation key', () => {
      let config = LDtk(
        projWithCustomData([
          { tileId: 0, data: JSON.stringify({ collision: 'solid' }) }
        ])
      );
      expect(config.tilesets[0].tiles).to.be.undefined;
    });

    it('should skip the customData scan when the tileset has none', () => {
      // bare project with no customData field at all
      let config = LDtk(project());
      expect(config.tilesets[0].tiles).to.be.undefined;
    });
  });

  describe('config shape', () => {
    it('should produce width/height in tiles and tilewidth/tileheight in pixels', () => {
      let config = LDtk(
        project({
          levels: [
            level({
              pxWid: 96,
              pxHei: 48,
              layerInstances: [
                layer({
                  __gridSize: 16,
                  gridTiles: [{ px: [0, 0], t: 0, f: 0 }]
                })
              ]
            })
          ]
        })
      );
      expect(config.width).to.equal(6);
      expect(config.height).to.equal(3);
      expect(config.tilewidth).to.equal(16);
      expect(config.tileheight).to.equal(16);
    });
  });
});
