import GameLoop from '../../src/gameLoop.js';
import { _reset, init, getContext } from '../../src/core.js';
import {
  on,
  callbacks,
  _reset as resetEvents
} from '../../src/events.js';
import { noop } from '../../src/utils.js';
import { simulateEvent } from '../utils.js';

// --------------------------------------------------
// gameloop
// --------------------------------------------------
describe('gameLoop', () => {
  let loop;

  afterEach(() => {
    loop && loop.stop();
  });

  // --------------------------------------------------
  // init
  // --------------------------------------------------
  describe('init', () => {
    it('should log an error if not passed required functions', () => {
      function func() {
        GameLoop();
      }

      expect(func).to.throw();
    });

    it('should set context if kontra.init is called after created', () => {
      _reset();

      let loop = GameLoop({
        render: noop
      });

      expect(loop.context).to.be.undefined;

      let canvas = document.createElement('canvas');
      canvas.width = canvas.height = 600;
      init(canvas);

      expect(loop.context).to.equal(canvas.getContext('2d'));
    });

    it('should not override context when set if kontra.init is called after created', () => {
      _reset();

      let loop = GameLoop({
        render: noop,
        context: true
      });

      let canvas = document.createElement('canvas');
      canvas.width = canvas.height = 600;
      init(canvas);

      expect(loop.context).to.equal(true);
    });

    it('should not register an init listener when init has already fired', () => {
      // issue #414: construction after init must not leak
      resetEvents();
      GameLoop({ render: noop });

      expect(callbacks.init).to.satisfy(
        c => c == null || c.length == 0
      );
    });
  });

  // --------------------------------------------------
  // start
  // --------------------------------------------------
  describe('start', () => {
    it('should call requestAnimationFrame', () => {
      sinon.stub(window, 'requestAnimationFrame').callsFake(noop);

      loop = GameLoop({
        render: noop,
        clearCanvas: false
      });

      loop.start();

      expect(window.requestAnimationFrame.called).to.be.true;
    });

    it('should unset isStopped', () => {
      loop.isStopped = true;
      loop.start();

      expect(loop.isStopped).to.be.false;
    });

    it('should call requestAnimationFrame only once if called twice', () => {
      sinon.stub(window, 'requestAnimationFrame').callsFake(noop);

      loop = GameLoop({
        render: noop,
        clearCanvas: false
      });

      loop.start();
      loop.start();

      expect(window.requestAnimationFrame.calledOnce).to.be.true;
    });
  });

  // --------------------------------------------------
  // stop
  // --------------------------------------------------
  describe('stop', () => {
    it('should call cancelAnimationFrame', () => {
      sinon.stub(window, 'cancelAnimationFrame').callsFake(noop);

      loop = GameLoop({
        render: noop,
        clearCanvas: false
      });

      loop.stop();

      expect(window.cancelAnimationFrame.called).to.be.true;
    });

    it('should set isStopped', () => {
      loop.isStopped = false;
      loop.stop();

      expect(loop.isStopped).to.be.true;
    });
  });

  // --------------------------------------------------
  // frame
  // --------------------------------------------------
  describe('frame', () => {
    it('should call the update function and pass it dt', done => {
      loop = GameLoop({
        update: sinon.spy(),
        render: noop,
        clearCanvas: false
      });

      loop.start();

      setTimeout(() => {
        expect(loop.update.called).to.be.true;
        expect(loop.update.getCall(0).args[0]).to.equal(1 / 60);
        done();
      }, 250);
    });

    it('should call the render function', done => {
      loop = GameLoop({
        render: sinon.spy(),
        clearCanvas: false
      });

      loop.start();

      setTimeout(() => {
        expect(loop.render.called).to.be.true;
        done();
      }, 250);
    });

    it('should exit early if time elapsed is greater than 1000ms', () => {
      let count = 0;

      loop = GameLoop({
        update() {
          count++;
        },
        render: noop,
        clearCanvas: false
      });

      loop._last = performance.now() - 1500;
      loop._frame();

      expect(count).to.equal(0);
    });

    it('should make multiple calls to the update function if enough time has elapsed', () => {
      let count = 0;

      loop = GameLoop({
        update() {
          count++;
        },
        render: noop,
        clearCanvas: false
      });

      loop._last = performance.now() - (1e3 / 60) * 2.5;
      loop._frame();

      expect(count).to.equal(2);
    });

    it('should cap catch-up updates per frame when maxCatchUp is set', () => {
      let count = 0;

      loop = GameLoop({
        update() {
          count++;
        },
        render: noop,
        clearCanvas: false,
        maxCatchUp: 2
      });

      // 10 frames of accumulated time — without the cap this would
      // run 10 update calls. with maxCatchUp=2 only two should fire.
      loop._last = performance.now() - (1e3 / 60) * 10;
      loop._frame();

      expect(count).to.equal(2);
    });

    it('should drop the accumulator when maxCatchUp is hit so the next frame does not spiral', () => {
      let count = 0;

      loop = GameLoop({
        update() {
          count++;
        },
        render: noop,
        clearCanvas: false,
        maxCatchUp: 2
      });

      // first frame burns through 10 frames worth of accumulated
      // time but only fires twice (capped)
      loop._last = performance.now() - (1e3 / 60) * 10;
      loop._frame();
      expect(count).to.equal(2);

      // a normal-length frame after the cap should fire once, not
      // resume the queued backlog. (1.5× delta keeps the
      // subtraction clear of the >= threshold under float roundoff
      // — the same trick the "multiple calls" test uses.)
      count = 0;
      loop._last = performance.now() - (1e3 / 60) * 1.5;
      loop._frame();
      expect(count).to.equal(1);
    });

    it('should change the frame rate if passed fps', () => {
      let count = 0;

      loop = GameLoop({
        update() {
          count++;
        },
        render: noop,
        clearCanvas: false,
        fps: 30
      });

      loop._last = performance.now() - (1e3 / 60) * 2.5;
      loop._frame();

      expect(count).to.equal(1);
    });

    it('should call clearCanvas by default', () => {
      loop = GameLoop({
        render: noop
      });
      let context = getContext();

      sinon.stub(context, 'clearRect').callsFake(noop);

      loop._last = performance.now() - 1e3 / 60;
      loop._frame();

      expect(context.clearRect.called).to.be.true;
    });

    it('should not clear the canvas if clearCanvas is false', () => {
      loop = GameLoop({
        render: noop,
        clearCanvas: false
      });
      let context = getContext();

      sinon.stub(context, 'clearRect').callsFake(noop);

      loop._last = performance.now() - 1e3 / 60;
      loop._frame();

      expect(context.clearRect.called).to.be.false;
    });

    it('should call clearCanvas on the passed in context', () => {
      let context = {
        canvas: {
          width: 0,
          height: 0
        },
        clearRect: sinon.stub().callsFake(noop)
      };

      loop = GameLoop({
        render: noop,
        context
      });

      loop._last = performance.now() - 1e3 / 60;
      loop._frame();

      expect(context.clearRect.called).to.be.true;
    });

    it('should emit the tick event', () => {
      let spy = sinon.spy();
      on('tick', spy);

      loop = GameLoop({
        render: noop
      });
      loop._last = performance.now() - 1001 / 60;
      loop._frame();

      expect(spy.called).to.be.true;
    });

    it('should emit the tick event for each loop update', () => {
      let spy = sinon.spy();
      on('tick', spy);

      loop = GameLoop({
        render: noop
      });
      loop._last = performance.now() - 2001 / 60;
      loop._frame();

      expect(spy.calledTwice).to.be.true;
    });

    it('should not update if page is blurred', done => {
      loop = GameLoop({
        update() {
          throw new Error('should not get here');
        },
        render: noop
      });
      simulateEvent('blur');
      loop._last = performance.now() - 1e3 / 60;
      loop._frame();

      setTimeout(done, 100);
    });

    it('should update if page is blurred when blur is true', done => {
      loop = GameLoop({
        blur: true,
        update() {
          done();
        },
        render: noop
      });
      simulateEvent('blur');
      loop._last = performance.now() - Math.ceil(1e3 / 60);
      loop._frame();

      throw new Error('should not get here');
    });
  });
});
