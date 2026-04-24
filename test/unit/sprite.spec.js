import Sprite, { SpriteClass } from '../../src/sprite.js';
import { noop } from '../../src/utils.js';

// test-context:start
let testContext = {
  SPRITE_IMAGE: true,
  SPRITE_ANIMATION: true,
  GAMEOBJECT_RADIUS: true
};
// test-context:end

// --------------------------------------------------
// sprite
// --------------------------------------------------
describe(
  'sprite with context: ' + JSON.stringify(testContext, null, 4),
  () => {
    it('should export class', () => {
      expect(SpriteClass).to.be.a('function');
    });

    // --------------------------------------------------
    // init
    // --------------------------------------------------
    describe('init', () => {
      if (testContext.SPRITE_IMAGE) {
        it('should set the width and height of the sprite to an image if passed', () => {
          let img = new Image();
          img.width = 10;
          img.height = 20;

          let sprite = Sprite({
            image: img
          });

          expect(sprite.image).to.equal(img);
          expect(sprite.width).to.equal(10);
          expect(sprite.height).to.equal(20);
        });
      }

      if (testContext.SPRITE_IMAGE) {
        it('should allow user to override with and height of image', () => {
          let img = new Image();
          img.width = 10;
          img.height = 20;

          let sprite = Sprite({
            image: img,
            width: 20,
            height: 40
          });

          expect(sprite.image).to.equal(img);
          expect(sprite.width).to.equal(20);
          expect(sprite.height).to.equal(40);
        });
      }

      if (testContext.SPRITE_ANIMATION) {
        it('should set the width and height of the sprite to an animation if passed', () => {
          // simple animation object from spriteSheet
          let animations = {
            walk: {
              width: 10,
              height: 20,
              clone() {
                return this;
              }
            }
          };

          let sprite = Sprite({ animations });

          expect(sprite.animations).to.deep.equal(animations);
          expect(sprite.currentAnimation).to.equal(animations.walk);
          expect(sprite.width).to.equal(10);
          expect(sprite.height).to.equal(20);
        });
      }

      if (testContext.SPRITE_ANIMATION) {
        it('should clone any animations to prevent frame corruption', () => {
          let animations = {
            walk: {
              width: 10,
              height: 20,
              clone() {
                return this;
              }
            }
          };

          sinon.spy(animations.walk, 'clone');

          Sprite({
            animations
          });

          expect(animations.walk.clone.called).to.be.true;
        });
      }

      if (testContext.SPRITE_ANIMATION) {
        it('should honor the playAnimation constructor option (#418)', () => {
          let animations = {
            idle: {
              width: 10,
              height: 20,
              start: sinon.spy(),
              stop: sinon.spy(),
              clone() {
                return this;
              }
            },
            walk: {
              width: 10,
              height: 20,
              start: sinon.spy(),
              stop: sinon.spy(),
              clone() {
                return this;
              }
            }
          };

          let sprite = Sprite({
            animations,
            playAnimation: 'walk'
          });

          expect(sprite.currentAnimation).to.equal(animations.walk);
          expect(animations.walk.start.called).to.be.true;
          // the `playAnimation` option is a local init var, not a
          // real property on the sprite instance — it must not
          // shadow the Sprite.prototype.playAnimation method
          expect(sprite.playAnimation).to.be.a('function');
        });
      }

      if (testContext.SPRITE_IMAGE) {
        it('should accept a frame subregion and default width/height to it (#373)', () => {
          let img = new Image();
          img.width = 64;
          img.height = 64;

          let sprite = Sprite({
            image: img,
            frame: { x: 16, y: 32, width: 16, height: 16 }
          });

          expect(sprite.frame).to.eql({
            x: 16,
            y: 32,
            width: 16,
            height: 16
          });
          expect(sprite.width).to.equal(16);
          expect(sprite.height).to.equal(16);
        });

        it('should allow overriding width/height while using a frame', () => {
          let img = new Image();
          img.width = 64;
          img.height = 64;

          let sprite = Sprite({
            image: img,
            frame: { x: 0, y: 0, width: 16, height: 16 },
            width: 32,
            height: 32
          });

          expect(sprite.width).to.equal(32);
          expect(sprite.height).to.equal(32);
        });
      }
    });

    // --------------------------------------------------
    // update
    // --------------------------------------------------
    describe('update', () => {
      if (testContext.SPRITE_ANIMATION) {
        it('should update the animation', () => {
          // simple animation object from spriteSheet
          let animations = {
            walk: {
              width: 10,
              height: 20,
              update: sinon.stub().callsFake(noop),
              clone() {
                return this;
              }
            }
          };

          let sprite = Sprite({
            x: 10,
            y: 20,
            animations
          });
          sprite.update();

          expect(sprite.currentAnimation.update.called).to.be.true;
        });
      } else {
        it('should not update the animation', () => {
          let animations = {
            walk: {
              width: 10,
              height: 20,
              update: sinon.stub().callsFake(noop),
              clone() {
                return this;
              }
            }
          };

          let sprite = Sprite({
            x: 10,
            y: 20,
            animations,
            currentAnimation: animations.walk
          });
          sprite.update();

          expect(sprite.currentAnimation.update.called).to.be.false;
        });
      }
    });

    // --------------------------------------------------
    // render
    // --------------------------------------------------
    describe('render', () => {
      it('should draw a rect sprite', () => {
        let sprite = Sprite({
          x: 10,
          y: 20,
          color: true
        });

        sinon.stub(sprite.context, 'fillRect').callsFake(noop);

        sprite.render();

        expect(sprite.context.fillRect.called).to.be.true;
      });

      if (testContext.GAMEOBJECT_RADIUS) {
        it('should draw a circle sprite', () => {
          let sprite = Sprite({
            x: 10,
            y: 20,
            radius: 10,
            color: true
          });

          sinon.stub(sprite.context, 'arc').callsFake(noop);

          sprite.render();

          expect(sprite.context.arc.called).to.be.true;
        });
      }

      if (testContext.SPRITE_IMAGE) {
        it('should draw an image sprite', () => {
          let img = new Image();
          img.width = 10;
          img.height = 20;

          let sprite = Sprite({
            x: 10,
            y: 20,
            image: img
          });

          sinon.stub(sprite.context, 'drawImage').callsFake(noop);

          sprite.render();

          expect(sprite.context.drawImage.called).to.be.true;
        });

        it('should draw the frame subregion when set (#373)', () => {
          let img = new Image();
          img.width = 64;
          img.height = 64;

          let sprite = Sprite({
            image: img,
            frame: { x: 16, y: 32, width: 16, height: 16 }
          });

          sinon.stub(sprite.context, 'drawImage').callsFake(noop);
          sprite.render();

          // 9-arg form: image, sx, sy, sw, sh, dx, dy, dw, dh
          expect(
            sprite.context.drawImage.calledWith(
              img,
              16,
              32,
              16,
              16,
              0,
              0,
              16,
              16
            )
          ).to.be.true;
        });
      }

      if (testContext.SPRITE_ANIMATION) {
        it('should draw an animation sprite', () => {
          // simple animation object from spriteSheet
          let animations = {
            walk: {
              width: 10,
              height: 20,
              update: noop,
              render: noop,
              clone() {
                return this;
              }
            }
          };

          let sprite = Sprite({
            x: 10,
            y: 20,
            animations
          });

          sinon
            .stub(sprite.currentAnimation, 'render')
            .callsFake(noop);

          sprite.render();

          expect(sprite.currentAnimation.render.called).to.be.true;
        });
      }
    });

    // --------------------------------------------------
    // playAnimation
    // --------------------------------------------------
    describe('playAnimation', () => {
      if (testContext.SPRITE_ANIMATION) {
        it('should set the animation to play', () => {
          let animations = {
            walk: {
              width: 10,
              height: 20,
              reset: sinon.spy(),
              clone() {
                return this;
              },
              stop: noop,
              start: noop
            },
            idle: {
              width: 10,
              height: 20,
              reset: sinon.spy(),
              clone() {
                return this;
              },
              stop: noop,
              start: noop
            }
          };

          let sprite = Sprite({
            animations
          });

          expect(sprite.currentAnimation).to.equal(animations.walk);

          sprite.playAnimation('idle');

          expect(sprite.currentAnimation).to.equal(animations.idle);
        });
      } else {
        it('should not have animation property', () => {
          let sprite = Sprite();
          expect(sprite.animations).to.not.exist;
        });
      }
    });
  }
);
