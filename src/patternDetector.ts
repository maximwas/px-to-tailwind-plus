import * as vscode from "vscode";
import { PixelClassMatch } from "./types";
import { TailwindConverter } from "./tailwindConverter";

export class PatternDetector {
  private converter: TailwindConverter;

  // Regex pattern to match pixel-based classes within class attributes
  private readonly PIXEL_CLASS_PATTERN = /(\w+(?:-\w+)*)-(\d+(?:\.\d+)?)px/g;

  private readonly FONT_WEIGHT_PATTERN = /(font(?:-weight)?)-(\d{3})\b/g;

  // Regex to find class attributes in HTML/JSX
  private readonly CLASS_ATTRIBUTE_PATTERN =
    /class(?:Name)?=["']([^"']*?)["']/g;

  constructor(converter: TailwindConverter) {
    this.converter = converter;
  }

  /**
   * Releases held references to allow garbage collection in tests
   */
  dispose(): void {
    try {
      // @ts-ignore
      this.converter = null;
    } catch (e) {}
  }

  /**
   * Finds all pixel-based classes within a text range
   * @param text - The text to search within
   * @param baseRange - The base range for calculating absolute positions
   * @returns Array of PixelClassMatch objects
   */
  findPixelClasses(text: string, baseRange: vscode.Range): PixelClassMatch[] {
    const matches: PixelClassMatch[] = [];

    // Find all class attributes first
    const classMatches = this.findClassAttributes(text, baseRange);

    // Then find pixel classes within each class attribute
    for (const classMatch of classMatches) {
      const pixelMatches = this.findPixelClassesInAttribute(
        classMatch.text,
        classMatch.range,
      );
      matches.push(...pixelMatches);
    }

    return matches;
  }

  /**
   * Finds class attributes within text
   * @param text - The text to search
   * @param baseRange - The base range for position calculation
   * @returns Array of class attribute matches
   */
  private findClassAttributes(
    text: string,
    baseRange: vscode.Range,
  ): Array<{ text: string; range: vscode.Range }> {
    const matches: Array<{ text: string; range: vscode.Range }> = [];
    let match;

    // Find all class attributes in the text
    const classAttributeRegex = /class(?:Name)?=["']([^"']*?)["']/g;
    while ((match = classAttributeRegex.exec(text)) !== null) {
      const fullMatch = match[0];
      const classValue = match[1];
      const startIndex = match.index;
      const endIndex = startIndex + fullMatch.length;

      // Calculate the position of just the class value (inside quotes)
      const classValueStart = startIndex + fullMatch.indexOf(classValue);
      const classValueEnd = classValueStart + classValue.length;

      const startPos = this.indexToPosition(
        text,
        classValueStart,
        baseRange.start,
      );
      const endPos = this.indexToPosition(text, classValueEnd, baseRange.start);

      matches.push({
        text: classValue,
        range: new vscode.Range(startPos, endPos),
      });
    }

    return matches;
  }

  /**
   * Finds pixel classes within a class attribute value
   * @param classText - The class attribute value
   * @param classRange - The range of the class attribute
   * @returns Array of PixelPixelClassMatch objects
   */
  private findPixelClassesInAttribute(
    classText: string,
    classRange: vscode.Range,
  ): PixelClassMatch[] {
    const matches: PixelClassMatch[] = [];
    let match;

    // Reset regex lastIndex
    this.PIXEL_CLASS_PATTERN.lastIndex = 0;

    while ((match = this.PIXEL_CLASS_PATTERN.exec(classText)) !== null) {
      const fullMatch = match[0];
      const property = match[1];
      const pixelValue = parseFloat(match[2]);
      const startIndex = match.index;
      const endIndex = startIndex + fullMatch.length;

      // Check if this is a valid pixel class that can be converted
      if (!this.converter.isPixelClass(fullMatch)) {
        continue;
      }

      // Convert the pixel class
      const convertedText = this.converter.convertPixelClass(fullMatch);
      if (!convertedText) {
        continue;
      }

      // Calculate absolute position within the document
      const startPos = this.offsetPosition(
        classRange.start,
        startIndex,
        classText,
      );
      const endPos = this.offsetPosition(classRange.start, endIndex, classText);

      // Determine if this is a custom value (uses square brackets)
      const isCustomValue =
        convertedText.includes("[") && convertedText.includes("]");

      matches.push({
        originalText: fullMatch,
        convertedText: convertedText,
        range: new vscode.Range(startPos, endPos),
        property: property,
        pixelValue: pixelValue,
        isCustomValue: isCustomValue,
      });
    }

    // Reset font weight regex
    this.FONT_WEIGHT_PATTERN.lastIndex = 0;

    while ((match = this.FONT_WEIGHT_PATTERN.exec(classText)) !== null) {
      const fullMatch = match[0];
      const property = match[1];
      const weightValue = parseInt(match[2]);
      const startIndex = match.index;
      const endIndex = startIndex + fullMatch.length;

      if (!this.converter.isPixelClass(fullMatch)) {
        continue;
      }

      const convertedText = this.converter.convertPixelClass(fullMatch);
      if (!convertedText) {
        continue;
      }

      const startPos = this.offsetPosition(
        classRange.start,
        startIndex,
        classText,
      );
      const endPos = this.offsetPosition(classRange.start, endIndex, classText);

      const isCustomValue =
        convertedText.includes("[") && convertedText.includes("]");

      matches.push({
        originalText: fullMatch,
        convertedText,
        range: new vscode.Range(startPos, endPos),
        property,
        pixelValue: weightValue,
        isCustomValue,
      });
    }

    return matches;
  }

  /**
   * Converts a string index to a VS Code Position
   * @param text - The text being indexed
   * @param index - The character index
   * @param basePosition - The base position to offset from
   * @returns VS Code Position
   */
  private indexToPosition(
    text: string,
    index: number,
    basePosition: vscode.Position,
  ): vscode.Position {
    const lines = text.substring(0, index).split("\n");
    const lineOffset = lines.length - 1;
    const characterOffset =
      lineOffset === 0 ? index : lines[lines.length - 1].length;

    return new vscode.Position(
      basePosition.line + lineOffset,
      lineOffset === 0
        ? basePosition.character + characterOffset
        : characterOffset,
    );
  }

  /**
   * Offsets a position by a character count within a string
   * @param basePosition - The base position
   * @param offset - Character offset
   * @param text - The text for line calculation
   * @returns Offset position
   */
  private offsetPosition(
    basePosition: vscode.Position,
    offset: number,
    text: string,
  ): vscode.Position {
    const beforeOffset = text.substring(0, offset);
    const lines = beforeOffset.split("\n");
    const lineOffset = lines.length - 1;
    const characterOffset =
      lineOffset === 0 ? offset : lines[lines.length - 1].length;

    return new vscode.Position(
      basePosition.line + lineOffset,
      lineOffset === 0
        ? basePosition.character + characterOffset
        : characterOffset,
    );
  }

  /**
   * Validates that a pixel class uses a supported CSS property
   * @param className - The class name to validate
   * @returns True if the property is supported
   */
  validateSupportedProperty(className: string): boolean {
    return this.converter.isPixelClass(className);
  }

  /**
   * Extracts the CSS property from a pixel class name
   * @param className - The class name (e.g., "p-16px")
   * @returns The CSS property (e.g., "p") or null if invalid
   */
  extractProperty(className: string): string | null {
    const match = className.match(/^(.+)-(\d+(?:\.\d+)?)px$/);
    return match ? match[1] : null;
  }

  /**
   * Extracts the pixel value from a pixel class name
   * @param className - The class name (e.g., "p-16px")
   * @returns The pixel value or null if invalid
   */
  extractPixelValue(className: string): number | null {
    const match = className.match(/^(.+)-(\d+(?:\.\d+)?)px$/);
    return match ? parseFloat(match[2]) : null;
  }

  /**
   * Updates the converter instance (useful for config changes)
   * @param converter - New converter instance
   */
  updateConverter(converter: TailwindConverter): void {
    this.converter = converter;
  }
}
