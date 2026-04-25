import * as events from '../../src/events.js';

// --------------------------------------------------
// on
// --------------------------------------------------
describe('events', () => {
  it('should export api', () => {
    expect(events.on).to.be.an('function');
    expect(events.off).to.be.an('function');
    expect(events.emit).to.be.an('function');
    expect(events.query).to.be.an('function');
    expect(events.once).to.be.an('function');
  });

  // --------------------------------------------------
  // on
  // --------------------------------------------------
  describe('on', () => {
    afterEach(() => {
      delete events.callbacks.foo;
    });

    it('should add the event to the callbacks object', () => {
      function func() {}
      events.on('foo', func);

      expect(events.callbacks.foo).to.be.an('array');
      expect(events.callbacks.foo[0]).to.equal(func);
    });

    it('should append the event if it already exists', () => {
      function func1() {}
      function func2() {}
      events.on('foo', func1);
      events.on('foo', func2);

      expect(events.callbacks.foo).to.be.an('array');
      expect(events.callbacks.foo[0]).to.equal(func1);
      expect(events.callbacks.foo[1]).to.equal(func2);
    });
  });

  // --------------------------------------------------
  // off
  // --------------------------------------------------
  describe('off', () => {
    function func() {}

    beforeEach(() => {
      events.on('foo', func);
    });

    afterEach(() => {
      delete events.callbacks.foo;
    });

    it('should remove the callback from the event', () => {
      events.off('foo', func);

      expect(events.callbacks.foo.length).to.equal(0);
    });

    it('should only remove the callback', () => {
      function func1() {}
      function func2() {}
      events.on('foo', func1);
      events.on('foo', func2);

      events.off('foo', func);

      expect(events.callbacks.foo.length).to.equal(2);
      expect(events.callbacks.foo[0]).to.equal(func1);
      expect(events.callbacks.foo[1]).to.equal(func2);
    });

    it('should not error if the callback was not added before', () => {
      function fn() {
        events.off('foo', () => {});
      }

      expect(fn).to.not.throw();
    });

    it('should not error if the event was not added before', () => {
      function fn() {
        events.off('myEvent', () => {});
      }

      expect(fn).to.not.throw();
    });
  });

  // --------------------------------------------------
  // emit
  // --------------------------------------------------
  describe('emit', () => {
    let func = sinon.spy();

    beforeEach(() => {
      func.resetHistory();
      events.on('foo', func);
    });

    afterEach(() => {
      delete events.callbacks.foo;
    });

    it('should call the callback', () => {
      events.emit('foo');

      expect(func.called).to.equal(true);
    });

    it('should pass all parameters to the callback', () => {
      events.emit('foo', 1, 2, 3);

      expect(func.calledWith(1, 2, 3)).to.equal(true);
    });

    it('should call the callbacks in order', () => {
      let func1 = sinon.spy();
      let func2 = sinon.spy();
      events.on('foo', func1);
      events.on('foo', func2);

      events.emit('foo');

      sinon.assert.callOrder(func, func1, func2);
    });

    it('should not error if the event was not added before', () => {
      function fn() {
        events.emit('myEvent', () => {});
      }

      expect(fn).to.not.throw();
    });
  });

  // --------------------------------------------------
  // once
  // --------------------------------------------------
  describe('once', () => {
    afterEach(() => {
      delete events.callbacks.foo;
    });

    it('should fire the callback when the event is emitted', () => {
      let spy = sinon.spy();
      events.once('foo', spy);
      events.emit('foo', 1, 2, 3);

      expect(spy.calledOnceWith(1, 2, 3)).to.equal(true);
    });

    it('should remove the callback after it fires', () => {
      let spy = sinon.spy();
      events.once('foo', spy);
      events.emit('foo');
      events.emit('foo');
      events.emit('foo');

      expect(spy.callCount).to.equal(1);
      expect(events.callbacks.foo).to.have.lengthOf(0);
    });

    it('should not clobber other listeners on the same event', () => {
      let onceSpy = sinon.spy();
      let onSpy = sinon.spy();
      events.on('foo', onSpy);
      events.once('foo', onceSpy);

      events.emit('foo');
      events.emit('foo');

      expect(onceSpy.callCount).to.equal(1);
      expect(onSpy.callCount).to.equal(2);
    });

    it('should return a canceller that removes the listener before fire', () => {
      let spy = sinon.spy();
      let cancel = events.once('foo', spy);
      cancel();
      events.emit('foo');

      expect(spy.called).to.equal(false);
      expect(events.callbacks.foo).to.have.lengthOf(0);
    });

    it('should not error when the canceller is called after the event has fired', () => {
      let cancel = events.once('foo', () => {});
      events.emit('foo');

      expect(cancel).to.not.throw();
    });
  });

  // --------------------------------------------------
  // query
  // --------------------------------------------------
  describe('query', () => {
    afterEach(() => {
      delete events.callbacks.foo;
    });

    it('should return undefined if no callback is registered', () => {
      expect(events.query('foo')).to.equal(undefined);
    });

    it('should return undefined if all callbacks return nullish', () => {
      events.on('foo', () => undefined);
      events.on('foo', () => null);

      expect(events.query('foo')).to.equal(undefined);
    });

    it('should return the first non-nullish value from a callback', () => {
      events.on('foo', () => undefined);
      events.on('foo', () => 'second');
      events.on('foo', () => 'third');

      expect(events.query('foo')).to.equal('second');
    });

    it('should short-circuit once a callback returns a non-nullish value', () => {
      let spy = sinon.spy();
      events.on('foo', () => 'hit');
      events.on('foo', spy);

      events.query('foo');

      expect(spy.called).to.equal(false);
    });

    it('should pass all parameters to the callbacks', () => {
      let spy = sinon.spy();
      events.on('foo', spy);

      events.query('foo', 1, 2, 3);

      expect(spy.calledWith(1, 2, 3)).to.equal(true);
    });

    it('should return falsy non-nullish values like 0 and empty string', () => {
      events.on('foo', () => 0);

      expect(events.query('foo')).to.equal(0);
    });
  });
});
