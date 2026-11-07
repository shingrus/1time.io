import {SHARE_DURATION_OPTIONS} from './util.js';

export type Lang = 'en' | 'es';
type ShareKind = 'secret' | 'file';

export interface Alternates {
    en: string;
    es: string;
}

interface UiText {
    shareTitle: string;
    secretLabel: string;
    secretPlaceholder: string;
    createLink: string;
    passphraseLabel: string;
    passphrasePlaceholder: string;
    expireAfter: string;
    durations: Record<number, string>;
    usageAllowed: Record<ShareKind, string>;
    usage: (count: number, kind: ShareKind) => string;
    setPassphrase: string;
    encryptionNote: string;
    linkReadyTitle: string;
    linkReadyExpiry: string;
    linkReadyUses: string;
    linkInputLabel: string;
    copy: string;
    shareLink: string;
    linkActions: string;
    showQr: string;
    sendAnother: string;
    qrLabel: string;
    reference: string;
    fileTitle: string;
    chooseFile: string;
    dropFile: string;
    fileHint: (maxMb: number) => string;
    chooseAnother: string;
    removeFile: string;
}

export const ui: Record<Lang, UiText> = {
    en: {
        shareTitle: 'Send a one-time secret',
        secretLabel: 'Secret message',
        secretPlaceholder: 'Paste a password, API key, or private note',
        createLink: 'Create one-time link',
        passphraseLabel: 'Optional passphrase the recipient must know if set',
        passphrasePlaceholder: 'Optional passphrase',
        expireAfter: 'Expire after',
        durations: Object.fromEntries(SHARE_DURATION_OPTIONS.map(({value, label}) => [value, label])),
        usageAllowed: {secret: 'Views allowed', file: 'Downloads allowed'},
        usage: (count, kind) => `${count} ${kind === 'file' ? 'download' : 'view'}${count === 1 ? '' : 's'}`,
        setPassphrase: 'Set passphrase',
        encryptionNote: 'End-to-end encrypted in your browser. The key never reaches our servers.',
        linkReadyTitle: 'Your one-time secret link is ready',
        linkReadyExpiry: 'Expires in 1 day',
        linkReadyUses: '1 view',
        linkInputLabel: 'Secret one-time link',
        copy: 'Copy',
        shareLink: 'Share link',
        linkActions: 'Link actions',
        showQr: 'Show QR code',
        sendAnother: 'Send another secret',
        qrLabel: 'Secret link QR code',
        reference: 'Reference',
        fileTitle: 'Send a one-time file download link',
        chooseFile: 'Choose a file',
        dropFile: 'or drop file here',
        fileHint: (maxMb) => `Any file type, up to ${maxMb} MB`,
        chooseAnother: 'Choose another',
        removeFile: 'Remove file',
    },
    es: {
        shareTitle: 'Envía un secreto de un solo uso',
        secretLabel: 'Mensaje secreto',
        secretPlaceholder: 'Pega una contraseña, una clave API o una nota privada',
        createLink: 'Crear enlace',
        passphraseLabel: 'Frase de acceso opcional que el destinatario deberá conocer',
        passphrasePlaceholder: 'Frase de acceso opcional',
        expireAfter: 'Caduca en',
        durations: {3600: '1 hora', 86400: '1 día', 259200: '3 días', 604800: '7 días', 2592000: '30 días'},
        usageAllowed: {secret: 'Vistas permitidas', file: 'Descargas permitidas'},
        usage: (count, kind) => `${count} ${kind === 'file' ? 'descarga' : 'vista'}${count === 1 ? '' : 's'}`,
        setPassphrase: 'Añadir frase de acceso',
        encryptionNote: 'Cifrado de extremo a extremo en tu navegador. La clave nunca llega a nuestros servidores.',
        linkReadyTitle: 'Tu enlace secreto de un solo uso está listo',
        linkReadyExpiry: 'Caduca en 1 día',
        linkReadyUses: '1 vista',
        linkInputLabel: 'Enlace secreto de un solo uso',
        copy: 'Copiar',
        shareLink: 'Compartir enlace',
        linkActions: 'Acciones del enlace',
        showQr: 'Mostrar código QR',
        sendAnother: 'Enviar otro secreto',
        qrLabel: 'Código QR del enlace secreto',
        reference: 'Referencia',
        fileTitle: 'Envía documentos y archivos de forma segura',
        chooseFile: 'Elegir un archivo',
        dropFile: 'o arrástralo aquí',
        fileHint: (maxMb) => `Cualquier tipo de archivo, hasta ${maxMb} MB`,
        chooseAnother: 'Elegir otro',
        removeFile: 'Quitar archivo',
    },
};

// Text the islands write after an interaction. English stays as the islands'
// built-in default, so English pages carry none of these attributes.
export function messageFormData(lang: Lang) {
    if (lang === 'en') return {};
    return {
        'data-busy-label': 'Cifrando...',
        'data-error': 'No se pudo crear el enlace. Inténtalo de nuevo.',
    };
}

export function fileFormData(lang: Lang) {
    if (lang === 'en') return {};
    return {
        'data-busy-label': 'Cifrando...',
        'data-uploading-label': 'Subiendo {percent}%...',
        'data-progress-encrypting': 'Cifrando el archivo en tu navegador...',
        'data-progress-uploading': 'Subiendo el archivo cifrado...',
        'data-progress-preparing': 'Preparando',
        'data-help-encrypting': 'El archivo se cifra en tu dispositivo antes de subirlo.',
        'data-help-uploading': 'Al servidor solo se envía el archivo cifrado.',
        'data-too-large': 'El archivo supera el límite de {mb} MB',
        'data-link-failed': 'No se pudo crear el enlace del archivo. Inténtalo de nuevo.',
        'data-upload-failed': 'No se pudo cifrar o subir el archivo. Inténtalo de nuevo.',
    };
}

export function linkReadyData(lang: Lang, kind: ShareKind) {
    if (lang === 'en') return {};
    const isFile = kind === 'file';
    const item = isFile ? 'el archivo' : 'el secreto';
    return {
        'data-title': isFile ? 'Tu enlace de archivo de un solo uso está listo' : 'Tu enlace secreto de un solo uso está listo',
        'data-expiry': 'Caduca en {duration}',
        'data-uses-one': isFile ? '{count} descarga' : '{count} vista',
        'data-uses-other': isFile ? '{count} descargas' : '{count} vistas',
        'data-warning': `Esta página es el único lugar donde existe el enlace. No podemos volver a mostrarlo ni leer ${item}: `
            + 'la clave va en el fragmento #, que nunca llega a nuestros servidores.',
        'data-reset': isFile ? 'Enviar otro archivo' : 'Enviar otro secreto',
        'data-input-label': isFile ? 'Enlace de archivo de un solo uso' : 'Enlace secreto de un solo uso',
        'data-qr-label': isFile ? 'Código QR del enlace del archivo' : 'Código QR del enlace secreto',
        'data-copied': 'Copiado',
        'data-already-copied': 'Ya está copiado',
        'data-qr-show': 'Mostrar código QR',
        'data-qr-loading': 'Cargando QR...',
        'data-qr-hide': 'Ocultar código QR',
    };
}
