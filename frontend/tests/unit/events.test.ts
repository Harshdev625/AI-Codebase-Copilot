import { globalEvents, EVENTS } from '@/lib/events';

describe('EventBus', () => {
  it('subscribes and emits events', () => {
    const mockCallback = jest.fn();
    const unsubscribe = globalEvents.on('test:event', mockCallback);

    globalEvents.emit('test:event', { foo: 'bar' });
    expect(mockCallback).toHaveBeenCalledWith({ foo: 'bar' });

    unsubscribe();
    globalEvents.emit('test:event', { foo: 'baz' });
    expect(mockCallback).toHaveBeenCalledTimes(1); // Not called again
  });

  it('handles multiple subscribers', () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();

    globalEvents.on(EVENTS.UNAUTHORIZED, cb1);
    globalEvents.on(EVENTS.UNAUTHORIZED, cb2);

    globalEvents.emit(EVENTS.UNAUTHORIZED);
    expect(cb1).toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });

  it('catches and logs errors from subscribers without crashing', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const cbError = () => { throw new Error('Subscriber error'); };
    const cbSuccess = jest.fn();

    globalEvents.on('error:event', cbError);
    globalEvents.on('error:event', cbSuccess);

    expect(() => {
      globalEvents.emit('error:event');
    }).not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith('Error in event listener for error:event:', expect.any(Error));
    expect(cbSuccess).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
