const path = require('path');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const m3u8Parser = require('m3u8-parser');

const OUTPUT_DIR = 'dist';
const PARTS_URL = 'https://tcsglobal.udemy.com/assets/16853986/files/922484/16853986/2019-02-26_13-47-06-b1e3436a372e718a5f3e6f8f50373a17/1/hls/AVC_1920x1080_3200k_AAC-HE_64k/aa0074a292591ce85d6b6aba123cbe853eac.m3u8?provider=verizon&token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJwYXRoIjoiOTIyNDg0LzE2ODUzOTg2LzIwMTktMDItMjZfMTMtNDctMDYtYjFlMzQzNmEzNzJlNzE4YTVmM2U2ZjhmNTAzNzNhMTcvMS8iLCJleHAiOjE2MDUyNjQyNzh9.pOpt30cWZwPy6ro61dNV95_k7oKLlJZcXyOY83uXOt8&v=1';
const parser = new m3u8Parser.Parser();

async function downloadPart(uri, outputFile) {
    const file = fs.createWriteStream(outputFile);
    const response = await fetch(uri);
    const stream = response.body.pipe(file);

    return new Promise((resolve, reject) => {
	stream.on('finish', resolve);
	stream.on('error', reject);
    });
}

async function downloadParts(m3uManifestUri, outputDir) {
    const response = await fetch(m3uManifestUri);
    const body = await response.text();

    parser.push(body);
    parser.end();

    const data = parser.manifest;
    const outputFiles = [];

    await fs.remove(outputDir);
    await fs.ensureDir(outputDir);

    for (const [index, segment] of data.segments.entries()) {
	const uri = segment.uri;
	const fileName = `part_${index}.ts`;
	const outputFile = path.join(outputDir, fileName);

	await downloadPart(uri, outputFile);
	outputFiles.push(fileName);
    }

    return outputFiles;
}

async function createManifest(parts, outputFile) {
    const partsText = parts
	.map((part) => `file '${part}'`)
	.join('\n');

    await fs.writeFile(outputFile, partsText, 'utf8');
}

(async () => {
    const parts = await downloadParts(PARTS_URL, OUTPUT_DIR);

    await createManifest(parts, path.join(OUTPUT_DIR, `manifest.txt`));

    // Use ffmpeg to concat and apply the video codecs
    // $ ffmpeg -f concat -safe 0 -i manifest.txt -c copy output.ts
    //
    // $ ffmpeg -f concat -safe 0 -i manifest.txt -c copy output.mp4 -codec:v "libx264" "-preset" "ultrafast"
})();
