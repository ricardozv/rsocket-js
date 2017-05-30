/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

'use strict';

jest.mock('fbjs/lib/warning').useFakeTimers();

describe('Flowable', () => {
  const Flowable = require('../Flowable').default;
  const {genMockSubscriber} = require('../__mocks__/MockFlowableSubscriber');
  const warning = require('fbjs/lib/warning');

  beforeEach(() => {
    warning.mockClear();
  });

  it('evaluates the source lazily', () => {
    const source = jest.fn();
    new Flowable(source); // eslint-disable-line no-new
    expect(source.mock.calls.length).toBe(0);
  });

  it('calls onSubscribe() when subscribed', () => {
    const source = jest.fn();
    const flowable = new Flowable(source);
    flowable.subscribe();
    expect(source.mock.calls.length).toBe(1);
  });

  it('calls cancel()', () => {
    const cancel = jest.fn();
    const source = subscriber => subscriber.onSubscribe({cancel});
    const flowable = new Flowable(source);
    flowable.subscribe({
      onSubscribe(subscription) {
        subscription.cancel();
      },
    });
    expect(cancel.mock.calls.length).toBe(1);
  });

  it('calls request()', () => {
    const request = jest.fn();
    const source = subscriber => subscriber.onSubscribe({request});
    const flowable = new Flowable(source);
    flowable.subscribe({
      onSubscribe(subscription) {
        subscription.request(42);
      },
    });
    expect(request.mock.calls.length).toBe(1);
    expect(request.mock.calls[0][0]).toBe(42);
  });

  describe('onComplete()', () => {
    it('ignores and warns if called before onSubscribe()', () => {
      const source = sub => sub.onComplete();
      const flowable = new Flowable(source);
      const subscriber = genMockSubscriber();
      flowable.subscribe(subscriber);
      expect(warning.mock.calls.length).toBe(1);
      expect(subscriber.onComplete.mock.calls.length).toBe(0);
      expect(subscriber.onError.mock.calls.length).toBe(0);
      expect(subscriber.onNext.mock.calls.length).toBe(0);
    });

    it('calls subscriber.onComplete() when completed', () => {
      const source = sub => {
        sub.onSubscribe();
        sub.onComplete();
      };
      const flowable = new Flowable(source);
      const subscriber = genMockSubscriber();
      flowable.subscribe(subscriber);
      expect(warning.mock.calls.length).toBe(0);
      expect(subscriber.onComplete.mock.calls.length).toBe(1);
      expect(subscriber.onError.mock.calls.length).toBe(0);
      expect(subscriber.onNext.mock.calls.length).toBe(0);
    });

    it('calls subscriber.onError() if onComplete() throws', () => {
      const source = sub => {
        sub.onSubscribe();
        sub.onComplete();
      };
      const flowable = new Flowable(source);
      const error = new Error('wtf');
      const subscriber = genMockSubscriber({
        onComplete() {
          throw error;
        },
      });
      flowable.subscribe(subscriber);
      expect(warning.mock.calls.length).toBe(0);
      expect(subscriber.onComplete.mock.calls.length).toBe(1);
      expect(subscriber.onError.mock.calls.length).toBe(1);
      expect(subscriber.onError.mock.calls[0][0]).toBe(error);
      expect(subscriber.onNext.mock.calls.length).toBe(0);
    });

    it('does not call teardown logic if onComplete() throws', () => {
      const cancel = jest.fn();
      const source = sub => {
        sub.onSubscribe({cancel});
        sub.onComplete();
      };
      const flowable = new Flowable(source);
      const error = new Error('wtf');
      const subscriber = genMockSubscriber({
        onComplete() {
          throw error;
        },
      });
      flowable.subscribe(subscriber);
      expect(warning.mock.calls.length).toBe(0);
      expect(subscriber.onComplete.mock.calls.length).toBe(1);
      expect(subscriber.onError.mock.calls.length).toBe(1);
      expect(subscriber.onError.mock.calls[0][0]).toBe(error);
      expect(subscriber.onNext.mock.calls.length).toBe(0);
      expect(cancel.mock.calls.length).toBe(0);
    });

    it('ignores and warns if called after onError()', () => {
      const error = new Error('wtf');
      const source = sub => {
        sub.onSubscribe();
        sub.onError(error);
        sub.onComplete();
      };
      const flowable = new Flowable(source);
      const subscriber = genMockSubscriber();
      flowable.subscribe(subscriber);
      expect(warning.mock.calls.length).toBe(1);
      expect(subscriber.onComplete.mock.calls.length).toBe(0);
      expect(subscriber.onError.mock.calls.length).toBe(1);
      expect(subscriber.onError.mock.calls[0][0]).toBe(error);
      expect(subscriber.onNext.mock.calls.length).toBe(0);
    });
  });

  describe('onError()', () => {
    it('may be called before onSubscribe()', () => {
      const error = new Error('wtf');
      const source = sub => sub.onError(error);
      const flowable = new Flowable(source);
      const subscriber = genMockSubscriber();
      flowable.subscribe(subscriber);
      expect(warning.mock.calls.length).toBe(0);
      expect(subscriber.onComplete.mock.calls.length).toBe(0);
      expect(subscriber.onError.mock.calls.length).toBe(1);
      expect(subscriber.onError.mock.calls[0][0]).toBe(error);
      expect(subscriber.onNext.mock.calls.length).toBe(0);
    });

    it('calls when rejected explicitly', () => {
      const error = new Error('wtf');
      const source = sub => {
        sub.onSubscribe();
        sub.onError(error);
      };
      const flowable = new Flowable(source);
      const subscriber = genMockSubscriber();
      flowable.subscribe(subscriber);
      expect(warning.mock.calls.length).toBe(0);
      expect(subscriber.onComplete.mock.calls.length).toBe(0);
      expect(subscriber.onError.mock.calls.length).toBe(1);
      expect(subscriber.onError.mock.calls[0][0]).toBe(error);
      expect(subscriber.onNext.mock.calls.length).toBe(0);
    });

    it('throws if onError() throws', () => {
      const cancel = jest.fn();
      const source = sub => {
        sub.onSubscribe({cancel});
        sub.onError(new Error('foo'));
      };
      const flowable = new Flowable(source);
      const error = new Error('wtf');
      const subscriber = genMockSubscriber({
        onError() {
          throw error;
        },
      });
      expect(() => {
        flowable.subscribe(subscriber);
      }).toThrow(error.message);
    });

    it('ignores and warns if called after onComplete()', () => {
      const error = new Error('wtf');
      const source = sub => {
        sub.onSubscribe();
        sub.onComplete();
        sub.onError(error);
      };
      const flowable = new Flowable(source);
      const subscriber = genMockSubscriber();
      flowable.subscribe(subscriber);
      expect(warning.mock.calls.length).toBe(1);
      expect(subscriber.onComplete.mock.calls.length).toBe(1);
      expect(subscriber.onError.mock.calls.length).toBe(0);
      expect(subscriber.onNext.mock.calls.length).toBe(0);
    });
  });

  describe('onNext()', () => {
    it('ignores and warns if called before onSubscribe()', () => {
      const source = sub => sub.onNext(42);
      const flowable = new Flowable(source);
      const subscriber = genMockSubscriber();
      flowable.subscribe(subscriber);
      expect(warning.mock.calls.length).toBe(1);
      expect(subscriber.onComplete.mock.calls.length).toBe(0);
      expect(subscriber.onError.mock.calls.length).toBe(0);
      expect(subscriber.onNext.mock.calls.length).toBe(0);
    });

    it('ignores and warns if called before a value is requested', () => {
      const source = sub => {
        sub.onSubscribe();
        sub.onNext(42);
      };
      const flowable = new Flowable(source);
      const subscriber = genMockSubscriber();
      flowable.subscribe(subscriber);
      expect(warning.mock.calls.length).toBe(1);
      expect(subscriber.onComplete.mock.calls.length).toBe(0);
      expect(subscriber.onError.mock.calls.length).toBe(0);
      expect(subscriber.onNext.mock.calls.length).toBe(0);
    });

    it('calls when a value is requested', () => {
      const request = jest.fn();
      const source = sub => {
        sub.onSubscribe({request});
        sub.onNext(42);
      };
      const flowable = new Flowable(source);
      const subscriber = genMockSubscriber({
        onSubscribe(sub) {
          sub.request(1);
        },
      });
      flowable.subscribe(subscriber);
      expect(warning.mock.calls.length).toBe(0);
      expect(subscriber.onComplete.mock.calls.length).toBe(0);
      expect(subscriber.onError.mock.calls.length).toBe(0);
      expect(subscriber.onNext.mock.calls.length).toBe(1);
      expect(subscriber.onNext.mock.calls[0][0]).toBe(42);
      expect(request.mock.calls.length).toBe(1);
      expect(request.mock.calls[0][0]).toBe(1);
    });

    it('queues calls to request() from within onNext()', () => {
      const request = jest.fn();
      const source = sub => {
        sub.onSubscribe({request});
        sub.onNext(42);
      };
      const flowable = new Flowable(source);
      let sub;
      const subscriber = genMockSubscriber({
        onNext() {
          sub.request(2);
        },
        onSubscribe(_sub) {
          sub = _sub;
          sub.request(1);
        },
      });
      flowable.subscribe(subscriber);
      expect(warning.mock.calls.length).toBe(0);
      expect(subscriber.onComplete.mock.calls.length).toBe(0);
      expect(subscriber.onError.mock.calls.length).toBe(0);
      expect(subscriber.onNext.mock.calls.length).toBe(1);
      expect(subscriber.onNext.mock.calls[0][0]).toBe(42);
      expect(request.mock.calls.length).toBe(1); // not immediately called a second time
      expect(request.mock.calls[0][0]).toBe(1);
      jest.runAllTimers();
      expect(request.mock.calls.length).toBe(2); // called after timeout
      expect(request.mock.calls[1][0]).toBe(2);
    });

    it('calls onError() if onNext() throws', () => {
      const error = new Error('wtf');
      const source = sub => {
        sub.onSubscribe();
        sub.onNext(42);
      };
      const flowable = new Flowable(source);
      const subscriber = genMockSubscriber({
        onNext() {
          throw error;
        },
        onSubscribe(sub) {
          sub.request(1);
        },
      });
      flowable.subscribe(subscriber);
      expect(warning.mock.calls.length).toBe(0);
      expect(subscriber.onComplete.mock.calls.length).toBe(0);
      expect(subscriber.onError.mock.calls.length).toBe(1);
      expect(subscriber.onError.mock.calls[0][0]).toBe(error);
      expect(subscriber.onNext.mock.calls.length).toBe(1);
    });

    it('calls teardown logic if onNext() throws', () => {
      const cancel = jest.fn();
      const request = jest.fn();
      const source = sub => {
        sub.onSubscribe({cancel, request});
        sub.onNext(42);
      };
      const flowable = new Flowable(source);
      const subscriber = genMockSubscriber({
        onNext() {
          throw new Error('wtf');
        },
        onSubscribe(sub) {
          sub.request(1);
        },
      });
      flowable.subscribe(subscriber);
      expect(cancel.mock.calls.length).toBe(1);
    });

    it('ignores values and warns if more published than requested', () => {
      const source = sub => {
        sub.onSubscribe();
        sub.onNext(42);
        sub.onNext(4242); // publish two values
      };
      const flowable = new Flowable(source);
      const subscriber = genMockSubscriber({
        onSubscribe(sub) {
          sub.request(1); // only request 1
        },
      });
      flowable.subscribe(subscriber);
      expect(warning.mock.calls.length).toBe(1);
      expect(subscriber.onComplete.mock.calls.length).toBe(0);
      expect(subscriber.onError.mock.calls.length).toBe(0);
      expect(subscriber.onNext.mock.calls.length).toBe(1);
    });

    it('publishes unlimited values after request(max)', () => {
      const source = sub => {
        sub.onSubscribe();
        sub.onNext(42);
        sub.onNext(4242); // publish two values
      };
      const max = 1;
      const flowable = new Flowable(source, max);
      const subscriber = genMockSubscriber({
        onSubscribe(sub) {
          sub.request(max);
        },
      });
      flowable.subscribe(subscriber);
      expect(warning.mock.calls.length).toBe(0);
      expect(subscriber.onComplete.mock.calls.length).toBe(0);
      expect(subscriber.onError.mock.calls.length).toBe(0);
      expect(subscriber.onNext.mock.calls.length).toBe(2);
      expect(subscriber.onNext.mock.calls[0][0]).toBe(42);
      expect(subscriber.onNext.mock.calls[1][0]).toBe(4242);
    });
  });

  describe('map()', () => {
    it('transforms values', () => {
      const request = jest.fn();
      const source = sub => {
        sub.onSubscribe({request});
        sub.onNext(42);
      };
      const flowable = new Flowable(source);
      const subscriber = genMockSubscriber({
        onSubscribe(sub) {
          sub.request(1);
        },
      });
      flowable.map(x => x * 2).subscribe(subscriber);
      expect(warning.mock.calls.length).toBe(0);
      expect(subscriber.onComplete.mock.calls.length).toBe(0);
      expect(subscriber.onError.mock.calls.length).toBe(0);
      expect(subscriber.onNext.mock.calls.length).toBe(1);
      expect(subscriber.onNext.mock.calls[0][0]).toBe(84);
      expect(request.mock.calls.length).toBe(1);
      expect(request.mock.calls[0][0]).toBe(1);
    });

    it('calls teardown logic if onNext() throws', () => {
      const cancel = jest.fn();
      const request = jest.fn();
      const source = sub => {
        sub.onSubscribe({cancel, request});
        sub.onNext(42);
      };
      const flowable = new Flowable(source);
      const error = new Error('wtf');
      const subscriber = genMockSubscriber({
        onNext() {
          throw error;
        },
        onSubscribe(sub) {
          sub.request(1);
        },
      });
      flowable.map(x => x * 2).subscribe(subscriber);
      expect(subscriber.onComplete.mock.calls.length).toBe(0);
      expect(subscriber.onError.mock.calls.length).toBe(1);
      expect(subscriber.onError.mock.calls[0][0]).toBe(error);
      expect(subscriber.onNext.mock.calls.length).toBe(1);
      expect(cancel.mock.calls.length).toBe(1);
    });

    it('calls onError() and teardown logic if transform function throws', () => {
      const cancel = jest.fn();
      const request = jest.fn();
      const source = sub => {
        sub.onSubscribe({cancel, request});
        sub.onNext(42);
      };
      const flowable = new Flowable(source);
      const subscriber = genMockSubscriber({
        onSubscribe(sub) {
          sub.request(1);
        },
      });
      const error = new Error('wtf');
      const transform = () => {
        throw error;
      };
      flowable.map(transform).subscribe(subscriber);
      expect(subscriber.onComplete.mock.calls.length).toBe(0);
      expect(subscriber.onError.mock.calls.length).toBe(1);
      expect(subscriber.onError.mock.calls[0][0]).toBe(error);
      expect(subscriber.onNext.mock.calls.length).toBe(0);
      expect(cancel.mock.calls.length).toBe(1);
    });
  });
});
