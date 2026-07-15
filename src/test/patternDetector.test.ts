import * as assert from 'assert';
import * as vscode from 'vscode';
import { PatternDetector } from '../patternDetector';
import { TailwindConverter } from '../tailwindConverter';

suite('PatternDetector Test Suite', () => {
    let detector: PatternDetector;
    let converter: TailwindConverter;

    setup(() => {
        converter = new TailwindConverter();
        detector = new PatternDetector(converter);
    });

    suite('findPixelClasses', () => {
        test('should find pixel classes in HTML class attributes', () => {
            const text = '<div class="p-16px m-8px w-100px">Content</div>';
            const baseRange = new vscode.Range(0, 0, 0, text.length);
            
            const matches = detector.findPixelClasses(text, baseRange);
            
            assert.strictEqual(matches.length, 3);
            
            // Check first match (p-16px)
            assert.strictEqual(matches[0].originalText, 'p-16px');
            assert.strictEqual(matches[0].convertedText, 'p-4');
            assert.strictEqual(matches[0].property, 'p');
            assert.strictEqual(matches[0].pixelValue, 16);
            assert.strictEqual(matches[0].isCustomValue, false);
            
            // Check second match (m-8px)
            assert.strictEqual(matches[1].originalText, 'm-8px');
            assert.strictEqual(matches[1].convertedText, 'm-2');
            assert.strictEqual(matches[1].property, 'm');
            assert.strictEqual(matches[1].pixelValue, 8);
            assert.strictEqual(matches[1].isCustomValue, false);
            
            // Check third match (w-100px - custom value)
            assert.strictEqual(matches[2].originalText, 'w-100px');
            assert.strictEqual(matches[2].convertedText, 'w-[100px]');
            assert.strictEqual(matches[2].property, 'w');
            assert.strictEqual(matches[2].pixelValue, 100);
            assert.strictEqual(matches[2].isCustomValue, true);
        });

        test('should find pixel classes in JSX className attributes', () => {
            const text = '<div className="px-12px py-24px gap-x-16px">Content</div>';
            const baseRange = new vscode.Range(0, 0, 0, text.length);
            
            const matches = detector.findPixelClasses(text, baseRange);
            
            assert.strictEqual(matches.length, 3);
            assert.strictEqual(matches[0].originalText, 'px-12px');
            assert.strictEqual(matches[0].convertedText, 'px-3');
            assert.strictEqual(matches[1].originalText, 'py-24px');
            assert.strictEqual(matches[1].convertedText, 'py-6');
            assert.strictEqual(matches[2].originalText, 'gap-x-16px');
            assert.strictEqual(matches[2].convertedText, 'gap-x-4');
        });

        test('should handle multiple class attributes in same text', () => {
            const text = '<div class="p-16px"><span class="m-8px">Text</span></div>';
            const baseRange = new vscode.Range(0, 0, 0, text.length);
            
            const matches = detector.findPixelClasses(text, baseRange);
            
            assert.strictEqual(matches.length, 2);
            assert.strictEqual(matches[0].originalText, 'p-16px');
            assert.strictEqual(matches[1].originalText, 'm-8px');
        });

        test('should detect font size and font weight classes', () => {
            const text = '<h1 class="text-24px font-700">Heading</h1>';
            const baseRange = new vscode.Range(0, 0, 0, text.length);

            const matches = detector.findPixelClasses(text, baseRange);

            assert.strictEqual(matches.length, 2);
            assert.strictEqual(matches[0].originalText, 'text-24px');
            assert.strictEqual(matches[0].convertedText, 'text-2xl');
            assert.strictEqual(matches[0].property, 'text');
            assert.strictEqual(matches[0].pixelValue, 24);
            assert.strictEqual(matches[0].isCustomValue, false);

            assert.strictEqual(matches[1].originalText, 'font-700');
            assert.strictEqual(matches[1].convertedText, 'font-bold');
            assert.strictEqual(matches[1].property, 'font');
            assert.strictEqual(matches[1].pixelValue, 700);
            assert.strictEqual(matches[1].isCustomValue, false);
        });

        test('should detect fractional pixel values', () => {
            const text = '<div class="p-2.5px m-0.5px">Content</div>';
            const baseRange = new vscode.Range(0, 0, 0, text.length);

            const matches = detector.findPixelClasses(text, baseRange);

            assert.strictEqual(matches.length, 2);
            assert.strictEqual(matches[0].originalText, 'p-2.5px');
            assert.strictEqual(matches[0].pixelValue, 2.5);
            assert.strictEqual(matches[0].convertedText, 'p-[2.5px]');
            assert.strictEqual(matches[1].originalText, 'm-0.5px');
            assert.strictEqual(matches[1].pixelValue, 0.5);
            assert.strictEqual(matches[1].convertedText, 'm-[0.5px]');
        });

        test('should ignore non-pixel classes', () => {
            const text = '<div class="p-4 m-2 bg-blue-500 text-lg p-16px">Content</div>';
            const baseRange = new vscode.Range(0, 0, 0, text.length);
            
            const matches = detector.findPixelClasses(text, baseRange);
            
            assert.strictEqual(matches.length, 1);
            assert.strictEqual(matches[0].originalText, 'p-16px');
        });

        test('should ignore unsupported CSS properties', () => {
            const text = '<div class="color-16px bg-8px p-16px">Content</div>';
            const baseRange = new vscode.Range(0, 0, 0, text.length);
            
            const matches = detector.findPixelClasses(text, baseRange);
            
            assert.strictEqual(matches.length, 1);
            assert.strictEqual(matches[0].originalText, 'p-16px');
        });

        test('should handle empty class attributes', () => {
            const text = '<div class="">Content</div>';
            const baseRange = new vscode.Range(0, 0, 0, text.length);
            
            const matches = detector.findPixelClasses(text, baseRange);
            
            assert.strictEqual(matches.length, 0);
        });

        test('should handle text without class attributes', () => {
            const text = '<div>Content without classes</div>';
            const baseRange = new vscode.Range(0, 0, 0, text.length);
            
            const matches = detector.findPixelClasses(text, baseRange);
            
            assert.strictEqual(matches.length, 0);
        });

        test('should calculate correct ranges for matches', () => {
            const text = '<div class="p-16px m-8px">Content</div>';
            const baseRange = new vscode.Range(1, 5, 1, 5 + text.length);
            
            const matches = detector.findPixelClasses(text, baseRange);
            
            assert.strictEqual(matches.length, 2);
            
            // First match should start after 'class="'
            const expectedStart1 = new vscode.Position(1, 5 + 12); // 'class="'.length = 7, but we need to account for the actual position
            assert.strictEqual(matches[0].range.start.line, 1);
            assert.ok(matches[0].range.start.character > 5);
            
            // Ranges should not overlap
            assert.ok(matches[0].range.end.character <= matches[1].range.start.character);
        });
    });

    suite('utility methods', () => {
        test('validateSupportedProperty should validate CSS properties', () => {
            assert.strictEqual(detector.validateSupportedProperty('p-16px'), true);
            assert.strictEqual(detector.validateSupportedProperty('m-8px'), true);
            assert.strictEqual(detector.validateSupportedProperty('gap-x-12px'), true);
            assert.strictEqual(detector.validateSupportedProperty('text-16px'), true);
            assert.strictEqual(detector.validateSupportedProperty('font-700'), true);
            assert.strictEqual(detector.validateSupportedProperty('color-16px'), false);
            assert.strictEqual(detector.validateSupportedProperty('bg-8px'), false);
        });

        test('extractProperty should extract CSS property from class name', () => {
            assert.strictEqual(detector.extractProperty('p-16px'), 'p');
            assert.strictEqual(detector.extractProperty('gap-x-24px'), 'gap-x');
            assert.strictEqual(detector.extractProperty('mt-8px'), 'mt');
            assert.strictEqual(detector.extractProperty('invalid'), null);
            assert.strictEqual(detector.extractProperty('p-16'), null);
        });

        test('extractPixelValue should extract pixel value from class name', () => {
            assert.strictEqual(detector.extractPixelValue('p-16px'), 16);
            assert.strictEqual(detector.extractPixelValue('m-100px'), 100);
            assert.strictEqual(detector.extractPixelValue('w-0px'), 0);
            assert.strictEqual(detector.extractPixelValue('invalid'), null);
            assert.strictEqual(detector.extractPixelValue('p-16'), null);
        });

        test('updateConverter should update the converter instance', () => {
            const newConverter = new TailwindConverter({ 'custom': 15 });
            detector.updateConverter(newConverter);
            
            const text = '<div class="p-15px">Content</div>';
            const baseRange = new vscode.Range(0, 0, 0, text.length);
            
            const matches = detector.findPixelClasses(text, baseRange);
            
            assert.strictEqual(matches.length, 1);
            assert.strictEqual(matches[0].convertedText, 'p-custom');
        });
    });

    suite('edge cases', () => {
        test('should handle multiline class attributes', () => {
            const text = `<div class="p-16px
                                 m-8px
                                 w-100px">Content</div>`;
            const baseRange = new vscode.Range(0, 0, 3, 0);
            
            const matches = detector.findPixelClasses(text, baseRange);
            
            assert.strictEqual(matches.length, 3);
            assert.strictEqual(matches[0].originalText, 'p-16px');
            assert.strictEqual(matches[1].originalText, 'm-8px');
            assert.strictEqual(matches[2].originalText, 'w-100px');
        });

        test('should handle single quotes in class attributes', () => {
            const text = "<div class='p-16px m-8px'>Content</div>";
            const baseRange = new vscode.Range(0, 0, 0, text.length);
            
            const matches = detector.findPixelClasses(text, baseRange);
            
            assert.strictEqual(matches.length, 2);
            assert.strictEqual(matches[0].originalText, 'p-16px');
            assert.strictEqual(matches[1].originalText, 'm-8px');
        });

        test('should handle complex CSS property names', () => {
            const text = '<div class="gap-x-16px gap-y-24px inset-8px">Content</div>';
            const baseRange = new vscode.Range(0, 0, 0, text.length);
            
            const matches = detector.findPixelClasses(text, baseRange);
            
            assert.strictEqual(matches.length, 3);
            assert.strictEqual(matches[0].property, 'gap-x');
            assert.strictEqual(matches[1].property, 'gap-y');
            assert.strictEqual(matches[2].property, 'inset');
        });

        test('should handle zero pixel values', () => {
            const text = '<div class="p-0px m-0px">Content</div>';
            const baseRange = new vscode.Range(0, 0, 0, text.length);
            
            const matches = detector.findPixelClasses(text, baseRange);
            
            assert.strictEqual(matches.length, 2);
            assert.strictEqual(matches[0].pixelValue, 0);
            assert.strictEqual(matches[0].convertedText, 'p-0');
            assert.strictEqual(matches[1].pixelValue, 0);
            assert.strictEqual(matches[1].convertedText, 'm-0');
        });
    });
});
