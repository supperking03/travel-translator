import Foundation
import ImageIO
import UIKit
import Vision
import React

@objc(TextRecognitionModule)
final class TextRecognitionModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool { false }

  // ── Existing: plain text ─────────────────────────────────────────────────────
  @objc(recognizeText:sourceLangCode:resolver:rejecter:)
  func recognizeText(
    _ imageUri: String,
    sourceLangCode: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let cgImage = loadCGImage(from: imageUri, reject: reject) else { return }

    let request = VNRecognizeTextRequest { request, error in
      if let error { reject("vision_failed", error.localizedDescription, error); return }
      guard let observations = request.results as? [VNRecognizedTextObservation] else {
        resolve(""); return
      }
      let lines = observations
        .compactMap { $0.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
      resolve(lines.joined(separator: "\n"))
    }
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = shouldUseLanguageCorrection(for: sourceLangCode)
    request.minimumTextHeight = 0.015
    applyRecognitionLanguages(sourceLangCode, to: request)
    perform(request, on: cgImage, reject: reject)
  }

  // ── New: text blocks with normalized bounding boxes ──────────────────────────
  @objc(recognizeTextWithBoxes:sourceLangCode:resolver:rejecter:)
  func recognizeTextWithBoxes(
    _ imageUri: String,
    sourceLangCode: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let cgImage = loadCGImage(from: imageUri, reject: reject) else { return }

    let request = VNRecognizeTextRequest { request, error in
      if let error { reject("vision_failed", error.localizedDescription, error); return }
      guard let observations = request.results as? [VNRecognizedTextObservation] else {
        resolve([]); return
      }

      var blocks: [[String: Any]] = []
      for obs in observations {
        guard let candidate = obs.topCandidates(1).first else { continue }
        let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { continue }

        // Vision bbox: origin bottom-left, normalized 0–1
        // Flip Y so origin is top-left (standard screen coords)
        let bbox = obs.boundingBox
        blocks.append([
          "text":   text,
          "x":      bbox.minX,
          "y":      1.0 - bbox.maxY,
          "width":  bbox.width,
          "height": bbox.height,
        ])
      }
      resolve(blocks)
    }
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = shouldUseLanguageCorrection(for: sourceLangCode)
    request.minimumTextHeight = 0.015
    applyRecognitionLanguages(sourceLangCode, to: request)
    perform(request, on: cgImage, reject: reject)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  private func loadCGImage(from imageUri: String, reject: RCTPromiseRejectBlock) -> CGImage? {
    guard let url = URL(string: imageUri) else {
      reject("invalid_uri", "Invalid image URI", nil); return nil
    }
    let normalized = url.isFileURL ? url : URL(fileURLWithPath: imageUri)
    guard let src = CGImageSourceCreateWithURL(normalized as CFURL, nil),
          let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
      reject("image_load_failed", "Unable to load image", nil); return nil
    }
    return img
  }

  private func applyRecognitionLanguages(_ sourceLangCode: String?, to request: VNRecognizeTextRequest) {
    guard let sourceLangCode else { return }
    let normalized = sourceLangCode.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard !normalized.isEmpty, normalized != "auto" else { return }

    let languages = visionRecognitionLanguages(for: normalized)
    guard !languages.isEmpty else { return }

    request.recognitionLanguages = languages
  }

  private func shouldUseLanguageCorrection(for sourceLangCode: String?) -> Bool {
    guard let sourceLangCode else { return true }
    let normalized = sourceLangCode.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard !normalized.isEmpty, normalized != "auto" else { return true }

    switch normalized {
    case "zh", "zh-tw", "yue", "ja", "ko":
      return false
    default:
      return true
    }
  }

  private func visionRecognitionLanguages(for sourceLangCode: String) -> [String] {
    switch sourceLangCode {
    case "en": return ["en-US", "en-GB"]
    case "zh": return ["zh-Hans", "zh-Hant"]
    case "zh-tw": return ["zh-Hant", "zh-Hans"]
    case "yue": return ["zh-Hant", "zh-Hans"]
    case "ja": return ["ja-JP"]
    case "ko": return ["ko-KR"]
    case "vi": return ["vi-VN"]
    case "th": return ["th-TH"]
    case "id": return ["id-ID"]
    case "fr": return ["fr-FR"]
    case "de": return ["de-DE"]
    case "es": return ["es-ES"]
    case "pt": return ["pt-BR", "pt-PT"]
    case "it": return ["it-IT"]
    case "ru": return ["ru-RU"]
    case "ar": return ["ar-SA"]
    case "hi": return ["hi-IN"]
    case "bn": return ["bn-IN"]
    case "nl": return ["nl-NL"]
    case "pl": return ["pl-PL"]
    case "tr": return ["tr-TR"]
    case "el": return ["el-GR"]
    case "he": return ["he-IL"]
    case "uk": return ["uk-UA"]
    case "sv": return ["sv-SE"]
    case "fil": return ["fil-PH"]
    case "my": return ["my-MM"]
    case "km": return ["km-KH"]
    case "lo": return ["lo-LA"]
    case "ne": return ["ne-NP"]
    case "si": return ["si-LK"]
    case "ur": return ["ur-PK"]
    case "ms": return ["ms-MY"]
    default: return []
    }
  }

  private func perform(_ request: VNRecognizeTextRequest, on cgImage: CGImage, reject: @escaping RCTPromiseRejectBlock) {
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    DispatchQueue.global(qos: .userInitiated).async {
      do { try handler.perform([request]) }
      catch { reject("vision_failed", error.localizedDescription, error) }
    }
  }
}
