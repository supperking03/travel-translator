import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { inflate } from 'pako';

export type ExtractFileTextResult = {
  text: string;
  warning?: 'pdf';
};

export function isSupportedTextImportFile(name?: string, mimeType?: string | null) {
  const lowerName = name?.toLowerCase() ?? '';
  const lowerMime = mimeType?.toLowerCase() ?? '';
  const ext = lowerName.includes('.') ? lowerName.split('.').pop() ?? '' : '';

  return (
    lowerMime.startsWith('text/') ||
    lowerMime.includes('json') ||
    lowerMime.includes('xml') ||
    lowerMime.includes('pdf') ||
    lowerMime.includes('wordprocessingml') ||
    ['txt', 'text', 'md', 'csv', 'json', 'xml', 'html', 'htm', 'log', 'yaml', 'yml', 'pdf', 'docx'].includes(ext)
  );
}

export async function extractTextFromFile(uri: string, name: string): Promise<ExtractFileTextResult> {
  const lower = name.toLowerCase();

  if (lower.endsWith('.docx')) {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const zip = await JSZip.loadAsync(b64, { base64: true });
    const xml = await zip.file('word/document.xml')?.async('string');
    if (!xml) return { text: '' };
    return { text: docxXmlToText(xml) };
  }

  if (lower.endsWith('.pdf')) {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const text = extractPdfText(base64ToBytes(b64));
    return text ? { text } : { text: '', warning: 'pdf' };
  }

  const content = await FileSystem.readAsStringAsync(uri, { encoding: 'utf8' });
  return { text: cleanText(content) };
}

function cleanText(text: string) {
  return text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function docxXmlToText(xml: string) {
  return cleanText(
    xml
      .replace(/<w:tab\b[^>]*\/?>/g, '\t')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:br\b[^>]*\/?>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'"),
  );
}

function extractPdfText(bytes: Uint8Array) {
  const latin = bytesToLatin1(bytes);
  const chunks: string[] = [];
  const streamRe = /stream\r?\n/g;
  let streamMatch: RegExpExecArray | null;

  while ((streamMatch = streamRe.exec(latin))) {
    const start = streamMatch.index + streamMatch[0].length;
    const end = latin.indexOf('endstream', start);
    if (end < 0) continue;

    const raw = latin.slice(start, end).replace(/\r?\n$/, '');
    let content = raw;
    try {
      content = bytesToLatin1(inflate(latin1ToBytes(raw)));
    } catch {
      // Some PDFs store uncompressed content streams.
    }

    const text = textFromPdfContentStream(content);
    if (text) chunks.push(text);
  }

  return cleanText(chunks.join('\n'));
}

function textFromPdfContentStream(content: string) {
  const parts: string[] = [];
  const tokenRe = /(\((?:\\.|[^\\()])*\)|\[(?:[^\][]|\\.)*\])\s*(Tj|TJ|'|")|T\*|\bTd\b|\bTD\b/g;
  let tokenMatch: RegExpExecArray | null;

  while ((tokenMatch = tokenRe.exec(content))) {
    if (!tokenMatch[1]) {
      parts.push('\n');
      continue;
    }

    const stringRe = /\((?:\\.|[^\\()])*\)/g;
    let stringMatch: RegExpExecArray | null;
    while ((stringMatch = stringRe.exec(tokenMatch[1]))) {
      parts.push(decodePdfString(stringMatch[0].slice(1, -1)));
    }
  }

  return parts.join('').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
}

function decodePdfString(text: string) {
  let output = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char !== '\\') {
      output += char;
      continue;
    }

    const next = text[i + 1];
    if (next >= '0' && next <= '7') {
      let octal = next;
      i += 1;
      for (let count = 0; count < 2 && text[i + 1] >= '0' && text[i + 1] <= '7'; count += 1) {
        octal += text[++i];
      }
      output += String.fromCharCode(parseInt(octal, 8));
      continue;
    }

    const escapes: Record<string, string> = {
      n: '\n',
      r: '\r',
      t: '\t',
      b: '\b',
      f: '\f',
      '(': '(',
      ')': ')',
      '\\': '\\',
    };
    output += escapes[next] ?? next ?? '';
    i += 1;
  }
  return output;
}

function base64ToBytes(base64: string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Int16Array(256).fill(-1);
  for (let i = 0; i < chars.length; i += 1) lookup[chars.charCodeAt(i)] = i;

  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const output = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let accumulator = 0;
  let offset = 0;

  for (let i = 0; i < clean.length; i += 1) {
    const value = lookup[clean.charCodeAt(i)];
    if (value < 0) continue;
    accumulator = (accumulator << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[offset++] = (accumulator >> bits) & 0xff;
    }
  }

  return output.subarray(0, offset);
}

function bytesToLatin1(bytes: Uint8Array) {
  let result = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return result;
}

function latin1ToBytes(text: string) {
  const output = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) output[i] = text.charCodeAt(i) & 0xff;
  return output;
}
