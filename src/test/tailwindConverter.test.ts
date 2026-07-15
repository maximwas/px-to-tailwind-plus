import * as assert from 'assert';
import { TailwindConverter } from '../tailwindConverter';

suite('TailwindConverter Test Suite', () => {
    let converter: TailwindConverter;

    setup(() => {
        converter = new TailwindConverter();
    });

    suite('convertPixelClass', () => {
        test('should convert standard padding classes', () => {
            assert.strictEqual(converter.convertPixelClass('p-16px'), 'p-4');
            assert.strictEqual(converter.convertPixelClass('px-8px'), 'px-2');
            assert.strictEqual(converter.convertPixelClass('py-24px'), 'py-6');
            assert.strictEqual(converter.convertPixelClass('pt-32px'), 'pt-8');
            assert.strictEqual(converter.convertPixelClass('pr-12px'), 'pr-3');
            assert.strictEqual(converter.convertPixelClass('pb-20px'), 'pb-5');
            assert.strictEqual(converter.convertPixelClass('pl-4px'), 'pl-1');
        });

        test('should convert standard margin classes', () => {
            assert.strictEqual(converter.convertPixelClass('m-16px'), 'm-4');
            assert.strictEqual(converter.convertPixelClass('mx-8px'), 'mx-2');
            assert.strictEqual(converter.convertPixelClass('my-24px'), 'my-6');
            assert.strictEqual(converter.convertPixelClass('mt-32px'), 'mt-8');
            assert.strictEqual(converter.convertPixelClass('mr-12px'), 'mr-3');
            assert.strictEqual(converter.convertPixelClass('mb-20px'), 'mb-5');
            assert.strictEqual(converter.convertPixelClass('ml-4px'), 'ml-1');
        });

        test('should convert width and height classes', () => {
            assert.strictEqual(converter.convertPixelClass('w-64px'), 'w-16');
            assert.strictEqual(converter.convertPixelClass('h-128px'), 'h-32');
        });

        test('should convert gap classes', () => {
            assert.strictEqual(converter.convertPixelClass('gap-16px'), 'gap-4');
            assert.strictEqual(converter.convertPixelClass('gap-x-8px'), 'gap-x-2');
            assert.strictEqual(converter.convertPixelClass('gap-y-24px'), 'gap-y-6');
        });

        test('should convert positioning classes', () => {
            assert.strictEqual(converter.convertPixelClass('top-16px'), 'top-4');
            assert.strictEqual(converter.convertPixelClass('right-8px'), 'right-2');
            assert.strictEqual(converter.convertPixelClass('bottom-24px'), 'bottom-6');
            assert.strictEqual(converter.convertPixelClass('left-32px'), 'left-8');
            assert.strictEqual(converter.convertPixelClass('inset-12px'), 'inset-3');
        });

        test('should convert font size classes', () => {
            assert.strictEqual(converter.convertPixelClass('text-12px'), 'text-xs');
            assert.strictEqual(converter.convertPixelClass('text-16px'), 'text-base');
            assert.strictEqual(converter.convertPixelClass('text-24px'), 'text-2xl');
            assert.strictEqual(converter.convertPixelClass('text-17px'), 'text-[17px]');
        });

        test('should convert font weight classes', () => {
            assert.strictEqual(converter.convertPixelClass('font-700'), 'font-bold');
            assert.strictEqual(converter.convertPixelClass('font-weight-600'), 'font-semibold');
            assert.strictEqual(converter.convertPixelClass('font-350'), 'font-[350]');
        });

        test('should handle fractional spacing values', () => {
            assert.strictEqual(converter.convertPixelClass('p-2.5px'), 'p-[2.5px]');
            assert.strictEqual(converter.convertPixelClass('m-0.25px'), 'm-[0.25px]');
        });

        test('should create custom values for non-standard pixels', () => {
            assert.strictEqual(converter.convertPixelClass('p-17px'), 'p-[17px]');
            assert.strictEqual(converter.convertPixelClass('m-25px'), 'm-[25px]');
            assert.strictEqual(converter.convertPixelClass('w-100px'), 'w-[100px]');
        });

        test('should handle zero values', () => {
            assert.strictEqual(converter.convertPixelClass('p-0px'), 'p-0');
            assert.strictEqual(converter.convertPixelClass('m-0px'), 'm-0');
        });

        test('should handle large standard values', () => {
            assert.strictEqual(converter.convertPixelClass('p-384px'), 'p-96');
            assert.strictEqual(converter.convertPixelClass('w-320px'), 'w-80');
        });

        test('should return null for unsupported properties', () => {
            assert.strictEqual(converter.convertPixelClass('color-16px'), null);
            assert.strictEqual(converter.convertPixelClass('bg-8px'), null);
            assert.strictEqual(converter.convertPixelClass('shadow-12px'), null);
        });

        test('should return null for invalid formats', () => {
            assert.strictEqual(converter.convertPixelClass('p-16'), null);
            assert.strictEqual(converter.convertPixelClass('p-px'), null);
            assert.strictEqual(converter.convertPixelClass('16px'), null);
            assert.strictEqual(converter.convertPixelClass('p-16em'), null);
        });
    });

    suite('isPixelClass', () => {
        test('should identify valid pixel classes', () => {
            assert.strictEqual(converter.isPixelClass('p-16px'), true);
            assert.strictEqual(converter.isPixelClass('m-8px'), true);
            assert.strictEqual(converter.isPixelClass('w-100px'), true);
            assert.strictEqual(converter.isPixelClass('gap-x-24px'), true);
            assert.strictEqual(converter.isPixelClass('font-700'), true);
            assert.strictEqual(converter.isPixelClass('font-weight-600'), true);
        });

        test('should reject invalid pixel classes', () => {
            assert.strictEqual(converter.isPixelClass('p-16'), false);
            assert.strictEqual(converter.isPixelClass('color-16px'), false);
            assert.strictEqual(converter.isPixelClass('p-16em'), false);
            assert.strictEqual(converter.isPixelClass('16px'), false);
            assert.strictEqual(converter.isPixelClass('font-bold'), false);
        });
    });

    suite('getPixelValue', () => {
        test('should get pixel values for standard Tailwind classes', () => {
            assert.strictEqual(converter.getPixelValue('p-4'), 16);
            assert.strictEqual(converter.getPixelValue('m-2'), 8);
            assert.strictEqual(converter.getPixelValue('w-16'), 64);
            assert.strictEqual(converter.getPixelValue('gap-6'), 24);
            assert.strictEqual(converter.getPixelValue('text-lg'), 18);
            assert.strictEqual(converter.getPixelValue('text-2xl'), 24);
        });

        test('should get pixel values for custom classes', () => {
            assert.strictEqual(converter.getPixelValue('p-[17px]'), 17);
            assert.strictEqual(converter.getPixelValue('m-[25px]'), 25);
            assert.strictEqual(converter.getPixelValue('w-[100px]'), 100);
            assert.strictEqual(converter.getPixelValue('text-[17px]'), 17);
            assert.strictEqual(converter.getPixelValue('m-[2.5px]'), 2.5);
        });

        test('should return null for invalid classes', () => {
            assert.strictEqual(converter.getPixelValue('p-999'), null);
            assert.strictEqual(converter.getPixelValue('color-4'), null);
            assert.strictEqual(converter.getPixelValue('invalid'), null);
        });
    });

    suite('custom spacing scale', () => {
        test('should use custom spacing scale when provided', () => {
            const customConverter = new TailwindConverter({
                'xs': 2,
                'sm': 6,
                'md': 10
            });

            assert.strictEqual(customConverter.convertPixelClass('p-2px'), 'p-xs');
            assert.strictEqual(customConverter.convertPixelClass('m-6px'), 'm-sm');
            assert.strictEqual(customConverter.convertPixelClass('w-10px'), 'w-md');
        });

        test('should fall back to default scale when custom not found', () => {
            const customConverter = new TailwindConverter({
                'xs': 2
            });

            assert.strictEqual(customConverter.convertPixelClass('p-2px'), 'p-xs');
            assert.strictEqual(customConverter.convertPixelClass('p-16px'), 'p-4'); // default
        });

        test('should update custom spacing scale', () => {
            converter.updateCustomSpacingScale({
                'custom': 15
            });

            assert.strictEqual(converter.convertPixelClass('p-15px'), 'p-custom');
        });

        test('should support fractional custom spacing scale', () => {
            const customConverter = new TailwindConverter({
                'fractional': 2.5
            });

            assert.strictEqual(customConverter.convertPixelClass('p-2.5px'), 'p-fractional');
        });
    });

    suite('utility methods', () => {
        test('should return supported properties', () => {
            const properties = converter.getSupportedProperties();
            assert.ok(properties.includes('p'));
            assert.ok(properties.includes('m'));
            assert.ok(properties.includes('w'));
            assert.ok(properties.includes('gap-x'));
            assert.ok(properties.includes('top'));
        });

        test('should return default spacing scale', () => {
            const scale = converter.getDefaultSpacingScale();
            assert.strictEqual(scale[4], 16);
            assert.strictEqual(scale[8], 32);
            assert.strictEqual(scale[96], 384);
        });
    });
});
