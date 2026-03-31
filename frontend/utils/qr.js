export async function createQrSvg(value) {
    const {default: qrcode} = await import('qrcode-generator');
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    return qr.createSvgTag(4, 4);
}
