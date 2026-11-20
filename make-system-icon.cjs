const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const imported = require("png-to-ico");
const pngToIco = imported.default || imported;

(async () => {
    const input = "src/assets/system-logo.svg";
    const output = "src/assets/system.ico";
    const temp = "src/assets/icon-sizes";

    if (!fs.existsSync(input)) {
        throw new Error("SVG não encontrado.");
    }

    fs.mkdirSync(temp, { recursive: true });

    const sizes = [256, 128, 64, 48, 32, 16];
    const images = [];

    for (const size of sizes) {
        const file = path.join(temp, `system-${size}.png`);

        await sharp(input, { density: 300 })
            .resize(size, size, {
                fit: "contain",
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png()
            .toFile(file);

        images.push(file);
    }

    const ico = await pngToIco(images);
    fs.writeFileSync(output, ico);

    console.log("Ícone Windows criado:", output);
})().catch(error => {
    console.error(error);
    process.exit(1);
});