#!/usr/bin/env ts-node

import { createCanvas, loadImage } from "canvas";
import fs from "fs";

// カラーパレット例 (8色)
const PALETTE: [number, number, number][] = [
    [0, 0, 0],       // Black
    [255, 255, 255], // White
    [255, 0, 0],     // Red
    [0, 255, 0],     // Green
    [0, 0, 255],     // Blue
    [255, 255, 0],   // Yellow
    [0, 255, 255],   // Cyan
    [255, 0, 255],   // Magenta
];

// 最近傍の色を見つける
function findClosestPaletteColor(r: number, g: number, b: number): [number, number, number] {
    let minDistance = Infinity;
    let closestColor: [number, number, number] = [0, 0, 0];

    for (const [pr, pg, pb] of PALETTE) {
        const distance = Math.sqrt(
            (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
        );
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = [pr, pg, pb];
        }
    }

    return closestColor;
}

// Floyd-Steinbergディザリング
function floydSteinbergDithering(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const result = new Uint8ClampedArray(data);

    const getPixelIndex = (x: number, y: number) => (y * width + x) * 4;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = getPixelIndex(x, y);
            const oldColor: [number, number, number] = [
                result[index],
                result[index + 1],
                result[index + 2],
            ];
            const newColor = findClosestPaletteColor(
                oldColor[0],
                oldColor[1],
                oldColor[2]
            );

            // 書き込み
            result[index] = newColor[0];
            result[index + 1] = newColor[1];
            result[index + 2] = newColor[2];

            const error = [
                oldColor[0] - newColor[0],
                oldColor[1] - newColor[1],
                oldColor[2] - newColor[2],
            ];

            // 誤差拡散
            const distributeError = (dx: number, dy: number, factor: number) => {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nIndex = getPixelIndex(nx, ny);
                    result[nIndex] += error[0] * factor;
                    result[nIndex + 1] += error[1] * factor;
                    result[nIndex + 2] += error[2] * factor;
                }
            };

            distributeError(1, 0, 7 / 16);
            distributeError(-1, 1, 3 / 16);
            distributeError(0, 1, 5 / 16);
            distributeError(1, 1, 1 / 16);
        }
    }

    return new ImageData(result, width, height);
}

// メイン処理
async function processImage(inputPath: string, outputPath: string) {
    const image = await loadImage(inputPath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, image.width, image.height);
    const modifiedImageData = {
        ...imageData,
        colorSpace: "srgb",
    };

    const ditheredData = floydSteinbergDithering(modifiedImageData as ImageData);
    ctx.putImageData(ditheredData, 0, 0);

    const out = fs.createWriteStream(outputPath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on("finish", () => console.log(`Image saved to ${outputPath}`));
}

// コマンドライン引数の処理
async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error("Usage: ts-node main.ts <input image> <output image>");
        process.exit(1);
    }

    const [inputPath, outputPath] = args;

    if (!fs.existsSync(inputPath)) {
        console.error(`Error: Input file "${inputPath}" does not exist.`);
        process.exit(1);
    }

    await processImage(inputPath, outputPath).catch((error) => {
        console.error("Error processing image:", error);
        process.exit(1);
    });
    console.log(`success to generate image: ${outputPath}`)
}

(async () => {
    await main();
})();