import { GameObjectClass } from './gameObject.js';

/**
 * A versatile way to update and draw your sprites. It can handle simple rectangles, images, and sprite sheet animations. It can be used for your main player object as well as tiny particles in a particle engine.
 * @class Sprite
 * @extends GameObject
 *
 * @param {Object} [properties] - Properties of the sprite.
 * @param {String} [properties.color] - Fill color for the game object if no image or animation is provided.
 * @param {HTMLImageElement|HTMLCanvasElement} [properties.image] - Use an image to draw the sprite.
 * @param {{x: Number, y: Number, width: Number, height: Number}} [properties.frame] - A subregion of `image` to draw (useful for drawing one cell of a static tilesheet). If set, `width`/`height` default to the frame size.
 * @param {{[name: String] : Animation}} [properties.animations] - An object of [Animations](api/animation) from a [Spritesheet](api/spriteSheet) to animate the sprite.
 * @param {String} [properties.playAnimation] - Name of the animation to start playing on construction (defaults to the first entry in `animations`).
 */
class Sprite extends GameObjectClass {
  /**
   * @docs docs/api_docs/sprite.js
   */

  init({
    /**
     * The color of the game object if it was passed as an argument.
     * @memberof Sprite
     * @property {String} color
     */

    // @ifdef SPRITE_IMAGE
    /**
     * The image the sprite will use when drawn if passed as an argument.
     * @memberof Sprite
     * @property {HTMLImageElement|HTMLCanvasElement} image
     */
    image,

    /**
     * A subregion of the [image](api/sprite#image) to draw instead of the whole thing — useful when the sprite's visual is a single cell of a larger tilesheet. `x` and `y` are the pixel offset into the image; `width` and `height` are the cell size. If set, the sprite's own `width`/`height` default to the frame's dimensions.
     * @memberof Sprite
     * @property {{x: Number, y: Number, width: Number, height: Number}} frame
     */
    frame,

    /**
     * The width of the sprite. If the sprite is a [rectangle sprite](api/sprite#rectangle-sprite), it uses the passed in value. For an [image sprite](api/sprite#image-sprite) it is the width of the image (or [frame](api/sprite#frame) if set). And for an [animation sprite](api/sprite#animation-sprite) it is the width of a single frame of the animation.
     * @memberof Sprite
     * @property {Number} width
     */
    width = frame ? frame.width : image ? image.width : undefined,

    /**
     * The height of the sprite. If the sprite is a [rectangle sprite](api/sprite#rectangle-sprite), it uses the passed in value. For an [image sprite](api/sprite#image-sprite) it is the height of the image (or [frame](api/sprite#frame) if set). And for an [animation sprite](api/sprite#animation-sprite) it is the height of a single frame of the animation.
     * @memberof Sprite
     * @property {Number} height
     */
    height = frame ? frame.height : image ? image.height : undefined,
    // @endif

    // @ifdef SPRITE_ANIMATION
    // destructured under a different local name so Object.assign
    // in super.init doesn't shadow the method of the same name
    playAnimation: _animation,
    // @endif

    ...props
  } = {}) {
    super.init({
      // @ifdef SPRITE_IMAGE
      image,
      frame,
      width,
      height,
      // @endif
      ...props
    });

    // @ifdef SPRITE_ANIMATION
    if (_animation) this.playAnimation(_animation);
    // @endif
  }

  // @ifdef SPRITE_ANIMATION
  /**
   * An object of [Animations](api/animation) from a [SpriteSheet](api/spriteSheet) to animate the sprite. Each animation is named so that it can can be used by name for the sprites [playAnimation()](api/sprite#playAnimation) function.
   *
   * ```js
   * import { Sprite, SpriteSheet } from 'kontra';
   *
   * let spriteSheet = SpriteSheet({
   *   // ...
   *   animations: {
   *     idle: {
   *       frames: 1,
   *       loop: false,
   *     },
   *     walk: {
   *       frames: [1,2,3]
   *     }
   *   }
   * });
   *
   * let sprite = Sprite({
   *   x: 100,
   *   y: 200,
   *   animations: spriteSheet.animations
   * });
   *
   * sprite.playAnimation('idle');
   * ```
   * @memberof Sprite
   * @property {{[name: String] : Animation}} animations
   */
  get animations() {
    return this._a;
  }

  set animations(value) {
    let prop, firstAnimation;
    // a = animations
    this._a = {};

    // clone each animation so no sprite shares an animation
    for (prop in value) {
      this._a[prop] = value[prop].clone();

      // default the current animation to the first one in the list
      firstAnimation = firstAnimation || this._a[prop];
    }

    /**
     * The currently playing Animation object if `animations` was passed as an argument.
     * @memberof Sprite
     * @property {Animation} currentAnimation
     */
    this.currentAnimation = firstAnimation;
    this.width = this.width || firstAnimation.width;
    this.height = this.height || firstAnimation.height;
  }

  /**
   * Set the currently playing animation of an animation sprite.
   *
   * ```js
   * import { Sprite, SpriteSheet } from 'kontra';
   *
   * let spriteSheet = SpriteSheet({
   *   // ...
   *   animations: {
   *     idle: {
   *       frames: 1
   *     },
   *     walk: {
   *       frames: [1,2,3]
   *     }
   *   }
   * });
   *
   * let sprite = Sprite({
   *   x: 100,
   *   y: 200,
   *   animations: spriteSheet.animations
   * });
   *
   * sprite.playAnimation('idle');
   * ```
   * @memberof Sprite
   * @function playAnimation
   *
   * @param {String} name - Name of the animation to play.
   */
  playAnimation(name) {
    this.currentAnimation?.stop();
    this.currentAnimation = this.animations[name];
    this.currentAnimation.start();
  }

  advance(dt) {
    super.advance(dt);
    this.currentAnimation?.update(dt);
  }
  // @endif

  draw() {
    // @ifdef SPRITE_IMAGE
    if (this.image) {
      let { image, frame, width, height } = this;
      if (frame) {
        this.context.drawImage(
          image,
          frame.x,
          frame.y,
          frame.width,
          frame.height,
          0,
          0,
          width,
          height
        );
      } else {
        this.context.drawImage(
          image,
          0,
          0,
          image.width,
          image.height
        );
      }
    }
    // @endif

    // @ifdef SPRITE_ANIMATION
    if (this.currentAnimation) {
      this.currentAnimation.render({
        x: 0,
        y: 0,
        width: this.width,
        height: this.height,
        context: this.context
      });
    }
    // @endif

    if (this.color) {
      this.context.fillStyle = this.color;

      // @ifdef GAMEOBJECT_RADIUS
      if (this.radius) {
        this.context.beginPath();
        this.context.arc(
          this.radius,
          this.radius,
          this.radius,
          0,
          Math.PI * 2
        );
        this.context.fill();
        return;
      }
      // @endif

      this.context.fillRect(0, 0, this.width, this.height);
    }
  }
}

export default function factory() {
  return new Sprite(...arguments);
}
export { Sprite as SpriteClass };
