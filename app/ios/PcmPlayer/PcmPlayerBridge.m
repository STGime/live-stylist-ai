/**
 * Obj-C bridge exposing the Swift PcmPlayer class to React Native.
 * Methods declared here match the @objc selectors on the Swift side.
 */
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PcmPlayer, NSObject)

RCT_EXTERN_METHOD(start)
RCT_EXTERN_METHOD(enqueue:(NSString *)base64)
RCT_EXTERN_METHOD(flush)
RCT_EXTERN_METHOD(stop)
RCT_EXTERN_METHOD(routeToSpeaker)

// NativeEventEmitter stubs (defensive — RN warns without these on some setups).
RCT_EXTERN_METHOD(addListener:(NSString *)eventName)
RCT_EXTERN_METHOD(removeListeners:(double)count)

@end
