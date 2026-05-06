import Foundation
import ImageIO
import UIKit
import Vision
import React

@objc(TextRecognitionModule)
final class TextRecognitionModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(recognizeText:resolver:rejecter:)
  func recognizeText(
    _ imageUri: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let url = URL(string: imageUri) else {
      reject("invalid_uri", "Invalid image URI", nil)
      return
    }

    let normalizedURL = url.isFileURL ? url : URL(fileURLWithPath: imageUri)

    guard let imageSource = CGImageSourceCreateWithURL(normalizedURL as CFURL, nil),
          let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
      reject("image_load_failed", "Unable to load image for text recognition", nil)
      return
    }

    let request = VNRecognizeTextRequest { request, error in
      if let error {
        reject("vision_failed", error.localizedDescription, error)
        return
      }

      guard let observations = request.results as? [VNRecognizedTextObservation] else {
        resolve("")
        return
      }

      let lines = observations.compactMap { observation in
        observation.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines)
      }
      .filter { !$0.isEmpty }

      resolve(lines.joined(separator: "\n"))
    }

    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.minimumTextHeight = 0.015

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

    DispatchQueue.global(qos: .userInitiated).async {
      do {
        try handler.perform([request])
      } catch {
        reject("vision_failed", error.localizedDescription, error)
      }
    }
  }
}
