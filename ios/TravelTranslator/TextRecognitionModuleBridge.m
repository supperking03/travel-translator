#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(TextRecognitionModule, NSObject)

RCT_EXTERN_METHOD(
  recognizeText:(NSString *)imageUri
  sourceLangCode:(NSString *)sourceLangCode
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  recognizeTextWithBoxes:(NSString *)imageUri
  sourceLangCode:(NSString *)sourceLangCode
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
