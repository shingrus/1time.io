import {SHARE_DURATION_OPTIONS} from './util.js';

export type Lang = 'en' | 'es' | 'fr' | 'ja' | 'id' | 'de' | 'pt';
type ShareKind = 'secret' | 'file';

export const langs: Lang[] = ['en', 'es', 'fr', 'ja', 'id', 'de', 'pt'];

export const langNames: Record<Lang, string> = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    ja: '日本語',
    id: 'Bahasa Indonesia',
    de: 'Deutsch',
    pt: 'Português',
};

export type Alternates = Record<Lang, string>;

export const pageAlternates = {
    home: {en: '/', es: '/es/', fr: '/fr/', ja: '/ja/', id: '/id/', de: '/de/', pt: '/pt/'},
    password: {
        en: '/share-password-securely/',
        es: '/es/compartir-contrasena/',
        fr: '/fr/envoyer-mot-de-passe/',
        ja: '/ja/password/',
        id: '/id/kirim-password/',
        de: '/de/passwort-sicher-versenden/',
        pt: '/pt/enviar-senha/',
    },
    file: {
        en: '/secure-file-sharing/',
        es: '/es/compartir-archivos/',
        fr: '/fr/envoyer-fichier-securise/',
        ja: '/ja/file/',
        id: '/id/kirim-file/',
        de: '/de/dateien-sicher-versenden/',
        pt: '/pt/enviar-arquivos/',
    },
} satisfies Record<string, Alternates>;

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
    sendAnother: string;
    reference: string;
    fileTitle: string;
    chooseFile: string;
    dropFile: string;
    fileHint: (maxMb: number) => string;
    chooseAnother: string;
    removeFile: string;
    addFiles: string;
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
        sendAnother: 'Send another secret',
        reference: 'Reference',
        fileTitle: 'Send a one-time file download link',
        chooseFile: 'Choose files',
        dropFile: 'or drop files here',
        fileHint: (maxMb) => `Any file type, up to ${maxMb} MB in total`,
        chooseAnother: 'Choose another',
        removeFile: 'Remove file',
        addFiles: 'Add files',
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
        sendAnother: 'Enviar otro secreto',
        reference: 'Referencia',
        fileTitle: 'Envía documentos y archivos de forma segura',
        chooseFile: 'Elegir archivos',
        dropFile: 'o arrástralos aquí',
        fileHint: (maxMb) => `Cualquier tipo de archivo, hasta ${maxMb} MB en total`,
        chooseAnother: 'Elegir otro',
        removeFile: 'Quitar archivo',
        addFiles: 'Añadir archivos',
    },
    fr: {
        shareTitle: 'Créer un lien à usage unique',
        secretLabel: 'Message secret',
        secretPlaceholder: 'Collez un mot de passe, une clé API ou une note privée',
        createLink: 'Créer le lien',
        passphraseLabel: 'Phrase secrète facultative que le destinataire devra connaître',
        passphrasePlaceholder: 'Phrase secrète (facultatif)',
        expireAfter: 'Expire après',
        durations: {3600: '1 heure', 86400: '1 jour', 259200: '3 jours', 604800: '7 jours', 2592000: '30 jours'},
        usageAllowed: {secret: 'Nombre de lectures', file: 'Nombre de téléchargements'},
        usage: (count, kind) => `${count} ${kind === 'file' ? 'téléchargement' : 'lecture'}${count === 1 ? '' : 's'}`,
        setPassphrase: 'Ajouter une phrase secrète',
        encryptionNote: 'Chiffré de bout en bout dans votre navigateur. La clé ne parvient jamais à nos serveurs.',
        linkReadyTitle: 'Votre lien secret à usage unique est prêt',
        linkReadyExpiry: 'Expire dans 1 jour',
        linkReadyUses: '1 lecture',
        linkInputLabel: 'Lien secret à usage unique',
        copy: 'Copier',
        shareLink: 'Partager le lien',
        linkActions: 'Actions du lien',
        sendAnother: 'Envoyer un autre secret',
        reference: 'Référence',
        fileTitle: 'Envoyer un fichier en toute sécurité',
        chooseFile: 'Choisir des fichiers',
        dropFile: 'ou déposez-les ici',
        fileHint: (maxMb) => `Tous types de fichiers, jusqu’à ${maxMb} Mo au total`,
        chooseAnother: 'En choisir un autre',
        removeFile: 'Retirer le fichier',
        addFiles: 'Ajouter des fichiers',
    },
    ja: {
        shareTitle: 'ワンタイムURLで安全に送る',
        secretLabel: '送る内容',
        secretPlaceholder: 'パスワードやAPIキー、メモを貼り付け',
        createLink: 'ワンタイムURLを作成',
        passphraseLabel: '任意の合言葉（設定すると受信者にも入力が必要です）',
        passphrasePlaceholder: '合言葉（任意）',
        expireAfter: '有効期限',
        durations: {3600: '1時間', 86400: '1日', 259200: '3日', 604800: '7日', 2592000: '30日'},
        usageAllowed: {secret: '閲覧回数', file: 'ダウンロード回数'},
        usage: (count) => (count === 1 ? '1回のみ' : `${count}回まで`),
        setPassphrase: '合言葉を設定',
        encryptionNote: 'ブラウザ内でエンドツーエンド暗号化。復号キーがサーバーに届くことはありません。',
        linkReadyTitle: 'ワンタイムURLができました',
        linkReadyExpiry: '有効期限 1日',
        linkReadyUses: '閲覧1回',
        linkInputLabel: 'ワンタイムURL',
        copy: 'コピー',
        shareLink: 'リンクを共有',
        linkActions: 'リンクの操作',
        sendAnother: 'もう1件送る',
        reference: '参照',
        fileTitle: 'ワンタイムURLでファイルを安全に送る',
        chooseFile: 'ファイルを選択',
        dropFile: 'またはここにドロップ',
        fileHint: (maxMb) => `複数選択可・形式を問わず合計${maxMb}MBまで`,
        chooseAnother: '別のファイルを選ぶ',
        removeFile: '選択を解除',
        addFiles: 'ファイルを追加',
    },
    id: {
        shareTitle: 'Buat link sekali pakai',
        secretLabel: 'Teks rahasia',
        secretPlaceholder: 'Tempel password, API key, atau catatan pribadi',
        createLink: 'Buat link',
        passphraseLabel: 'Kode akses opsional yang harus diketahui penerima',
        passphrasePlaceholder: 'Kode akses (opsional)',
        expireAfter: 'Masa berlaku',
        durations: {3600: '1 jam', 86400: '1 hari', 259200: '3 hari', 604800: '7 hari', 2592000: '30 hari'},
        usageAllowed: {secret: 'Jumlah akses', file: 'Jumlah unduhan'},
        usage: (count, kind) => `${count} kali ${kind === 'file' ? 'diunduh' : 'dibuka'}`,
        setPassphrase: 'Tambahkan kode akses',
        encryptionNote: 'Dienkripsi end-to-end di browser kamu. Kuncinya tidak pernah sampai ke server kami.',
        linkReadyTitle: 'Link sekali pakai kamu sudah siap',
        linkReadyExpiry: 'Berlaku 1 hari',
        linkReadyUses: '1 kali dibuka',
        linkInputLabel: 'Link rahasia sekali pakai',
        copy: 'Salin',
        shareLink: 'Bagikan link',
        linkActions: 'Aksi link',
        sendAnother: 'Kirim rahasia lain',
        reference: 'Referensi',
        fileTitle: 'Kirim file dan foto KTP dengan aman',
        chooseFile: 'Pilih file',
        dropFile: 'atau seret file ke sini',
        fileHint: (maxMb) => `Semua jenis file, bisa beberapa sekaligus, total maksimal ${maxMb} MB`,
        chooseAnother: 'Pilih file lain',
        removeFile: 'Hapus file',
        addFiles: 'Tambah file',
    },
    de: {
        shareTitle: 'Einmal-Link erstellen',
        secretLabel: 'Geheime Nachricht',
        secretPlaceholder: 'Passwort, API-Schlüssel oder private Notiz einfügen',
        createLink: 'Link erstellen',
        passphraseLabel: 'Optionale Passphrase, die der Empfänger kennen muss',
        passphrasePlaceholder: 'Passphrase (optional)',
        expireAfter: 'Läuft ab nach',
        durations: {3600: '1 Stunde', 86400: '1 Tag', 259200: '3 Tagen', 604800: '7 Tagen', 2592000: '30 Tagen'},
        usageAllowed: {secret: 'Erlaubte Aufrufe', file: 'Erlaubte Downloads'},
        usage: (count, kind) => (kind === 'file'
            ? `${count} ${count === 1 ? 'Download' : 'Downloads'}`
            : `${count} ${count === 1 ? 'Aufruf' : 'Aufrufe'}`),
        setPassphrase: 'Passphrase festlegen',
        encryptionNote: 'Ende-zu-Ende-verschlüsselt in Ihrem Browser. Der Schlüssel erreicht nie unsere Server.',
        linkReadyTitle: 'Ihr Einmal-Link ist fertig',
        linkReadyExpiry: 'Läuft ab in 1 Tag',
        linkReadyUses: '1 Aufruf',
        linkInputLabel: 'Geheimer Einmal-Link',
        copy: 'Kopieren',
        shareLink: 'Link teilen',
        linkActions: 'Link-Aktionen',
        sendAnother: 'Weitere Nachricht senden',
        reference: 'Referenz',
        fileTitle: 'Dateien sicher versenden',
        chooseFile: 'Dateien auswählen',
        dropFile: 'oder Dateien hierher ziehen',
        fileHint: (maxMb) => `Jeder Dateityp, insgesamt bis ${maxMb} MB`,
        chooseAnother: 'Andere wählen',
        removeFile: 'Datei entfernen',
        addFiles: 'Dateien hinzufügen',
    },
    pt: {
        shareTitle: 'Criar um link de uso único',
        secretLabel: 'Mensagem secreta',
        secretPlaceholder: 'Cole uma senha, uma chave de API ou uma nota privada',
        createLink: 'Criar link',
        passphraseLabel: 'Frase secreta opcional que o destinatário precisará saber',
        passphrasePlaceholder: 'Frase secreta (opcional)',
        expireAfter: 'Expira em',
        durations: {3600: '1 hora', 86400: '1 dia', 259200: '3 dias', 604800: '7 dias', 2592000: '30 dias'},
        usageAllowed: {secret: 'Visualizações permitidas', file: 'Downloads permitidos'},
        usage: (count, kind) => (kind === 'file'
            ? `${count} ${count === 1 ? 'download' : 'downloads'}`
            : `${count} ${count === 1 ? 'visualização' : 'visualizações'}`),
        setPassphrase: 'Definir frase secreta',
        encryptionNote: 'Criptografado de ponta a ponta no seu navegador. A chave nunca chega aos nossos servidores.',
        linkReadyTitle: 'Seu link secreto de uso único está pronto',
        linkReadyExpiry: 'Expira em 1 dia',
        linkReadyUses: '1 visualização',
        linkInputLabel: 'Link secreto de uso único',
        copy: 'Copiar',
        shareLink: 'Compartilhar link',
        linkActions: 'Ações do link',
        sendAnother: 'Enviar outro segredo',
        reference: 'Referência',
        fileTitle: 'Enviar arquivos com segurança',
        chooseFile: 'Escolher arquivos',
        dropFile: 'ou arraste os arquivos aqui',
        fileHint: (maxMb) => `Qualquer tipo de arquivo, até ${maxMb} MB no total`,
        chooseAnother: 'Escolher outro',
        removeFile: 'Remover arquivo',
        addFiles: 'Adicionar arquivos',
    },
};

interface NavText {
    githubLabel: string;
    about: string;
    privacy: string;
    contact: string;
}

export const navText: Record<Exclude<Lang, 'en'>, NavText> = {
    es: {
        githubLabel: 'Ver en GitHub',
        about: 'Acerca de',
        privacy: 'Privacidad',
        contact: 'Contacto',
    },
    fr: {
        githubLabel: 'Voir sur GitHub',
        about: 'À propos',
        privacy: 'Confidentialité',
        contact: 'Contact',
    },
    ja: {
        githubLabel: 'GitHubで見る',
        about: '1time.ioについて',
        privacy: 'プライバシー',
        contact: 'お問い合わせ',
    },
    id: {
        githubLabel: 'Lihat di GitHub',
        about: 'Tentang',
        privacy: 'Privasi',
        contact: 'Kontak',
    },
    de: {
        githubLabel: 'Auf GitHub ansehen',
        about: 'Über uns',
        privacy: 'Datenschutz',
        contact: 'Kontakt',
    },
    pt: {
        githubLabel: 'Ver no GitHub',
        about: 'Sobre',
        privacy: 'Privacidade',
        contact: 'Contato',
    },
};

interface LinkReadyText {
    title: string;
    usesOne: string;
    usesOther: string;
    warning: string;
    reset: string;
    inputLabel: string;
}

interface IslandText {
    busy: string;
    createError: string;
    uploading: string;
    progressEncrypting: string;
    progressUploading: string;
    progressPreparing: string;
    helpEncrypting: string;
    helpUploading: string;
    tooLarge: string;
    linkFailed: string;
    uploadFailed: string;
    multiSummary: string;
    zipNote: string;
    removeAll: string;
    expiry: string;
    copied: string;
    alreadyCopied: string;
    linkReady: Record<ShareKind, LinkReadyText>;
}

// Text the islands write after an interaction. English stays as the islands'
// built-in default, so English pages carry none of these attributes.
const islandText: Record<Exclude<Lang, 'en'>, IslandText> = {
    es: {
        busy: 'Cifrando...',
        createError: 'No se pudo crear el enlace. Inténtalo de nuevo.',
        uploading: 'Subiendo {percent}%...',
        progressEncrypting: 'Cifrando el archivo en tu navegador...',
        progressUploading: 'Subiendo el archivo cifrado...',
        progressPreparing: 'Preparando',
        helpEncrypting: 'El archivo se cifra en tu dispositivo antes de subirlo.',
        helpUploading: 'Al servidor solo se envía el archivo cifrado.',
        tooLarge: 'El archivo supera el límite de {mb} MB',
        linkFailed: 'No se pudo crear el enlace del archivo. Inténtalo de nuevo.',
        uploadFailed: 'No se pudo cifrar o subir el archivo. Inténtalo de nuevo.',
        multiSummary: '{count} archivos · {size}',
        zipNote: 'Se envían en un solo archivo zip',
        removeAll: 'Quitar todos',
        expiry: 'Caduca en {duration}',
        copied: 'Copiado',
        alreadyCopied: 'Ya está copiado',
        linkReady: {
            secret: {
                title: 'Tu enlace secreto de un solo uso está listo',
                usesOne: '{count} vista',
                usesOther: '{count} vistas',
                warning: 'Esta página es el único lugar donde existe el enlace. No podemos volver a mostrarlo ni leer el secreto: '
                    + 'la clave va en el fragmento #, que nunca llega a nuestros servidores.',
                reset: 'Enviar otro secreto',
                inputLabel: 'Enlace secreto de un solo uso',
            },
            file: {
                title: 'Tu enlace de archivo de un solo uso está listo',
                usesOne: '{count} descarga',
                usesOther: '{count} descargas',
                warning: 'Esta página es el único lugar donde existe el enlace. No podemos volver a mostrarlo ni leer el archivo: '
                    + 'la clave va en el fragmento #, que nunca llega a nuestros servidores.',
                reset: 'Enviar otro archivo',
                inputLabel: 'Enlace de archivo de un solo uso',
            },
        },
    },
    fr: {
        busy: 'Chiffrement…',
        createError: 'Impossible de créer le lien. Veuillez réessayer.',
        uploading: 'Envoi {percent} %…',
        progressEncrypting: 'Chiffrement du fichier dans votre navigateur…',
        progressUploading: 'Envoi du fichier chiffré…',
        progressPreparing: 'Préparation',
        helpEncrypting: 'Le fichier est chiffré sur votre appareil avant l’envoi.',
        helpUploading: 'Seul le fichier chiffré est envoyé au serveur.',
        tooLarge: 'Le fichier dépasse la limite de {mb} Mo',
        linkFailed: 'Impossible de créer le lien du fichier. Veuillez réessayer.',
        uploadFailed: 'Impossible de chiffrer ou d’envoyer le fichier. Veuillez réessayer.',
        multiSummary: '{count} fichiers · {size}',
        zipNote: 'Envoyés dans un seul fichier zip',
        removeAll: 'Tout retirer',
        expiry: 'Expire dans {duration}',
        copied: 'Copié',
        alreadyCopied: 'Déjà copié',
        linkReady: {
            secret: {
                title: 'Votre lien secret à usage unique est prêt',
                usesOne: '{count} lecture',
                usesOther: '{count} lectures',
                warning: 'Ce lien n’existe que sur cette page. Nous ne pouvons ni l’afficher à nouveau ni lire le secret : '
                    + 'la clé se trouve après le #, une partie que le navigateur n’envoie jamais à nos serveurs.',
                reset: 'Envoyer un autre secret',
                inputLabel: 'Lien secret à usage unique',
            },
            file: {
                title: 'Votre lien de téléchargement à usage unique est prêt',
                usesOne: '{count} téléchargement',
                usesOther: '{count} téléchargements',
                warning: 'Ce lien n’existe que sur cette page. Nous ne pouvons ni l’afficher à nouveau ni lire le fichier : '
                    + 'la clé se trouve après le #, une partie que le navigateur n’envoie jamais à nos serveurs.',
                reset: 'Envoyer un autre fichier',
                inputLabel: 'Lien de téléchargement à usage unique',
            },
        },
    },
    ja: {
        busy: '暗号化中…',
        createError: 'リンクを作成できませんでした。もう一度お試しください。',
        uploading: 'アップロード中 {percent}%…',
        progressEncrypting: 'ブラウザでファイルを暗号化しています…',
        progressUploading: '暗号化したファイルをアップロードしています…',
        progressPreparing: '準備中',
        helpEncrypting: 'ファイルはアップロード前にお使いの端末で暗号化されます。',
        helpUploading: 'サーバーに送られるのは暗号化されたファイルだけです。',
        tooLarge: 'ファイルが上限の{mb}MBを超えています',
        linkFailed: 'ファイルのリンクを作成できませんでした。もう一度お試しください。',
        uploadFailed: 'ファイルの暗号化またはアップロードに失敗しました。もう一度お試しください。',
        multiSummary: 'ファイル{count}件 · {size}',
        zipNote: '1つのZIPにまとめて送信します',
        removeAll: 'すべて解除',
        expiry: '有効期限 {duration}',
        copied: 'コピーしました',
        alreadyCopied: 'コピー済み',
        linkReady: {
            secret: {
                title: 'ワンタイムURLができました',
                usesOne: '閲覧{count}回',
                usesOther: '閲覧{count}回まで',
                warning: 'このURLが表示されるのはこのページだけです。再表示はできず、私たちにも内容は読めません。'
                    + '復号キーは「#」より後ろにあり、サーバーには送られないためです。',
                reset: 'もう1件送る',
                inputLabel: 'ワンタイムURL',
            },
            file: {
                title: 'ファイルのワンタイムURLができました',
                usesOne: 'ダウンロード{count}回',
                usesOther: 'ダウンロード{count}回まで',
                warning: 'このURLが表示されるのはこのページだけです。再表示はできず、私たちにもファイルの中身は読めません。'
                    + '復号キーは「#」より後ろにあり、サーバーには送られないためです。',
                reset: '別のファイルを送る',
                inputLabel: 'ファイルのワンタイムURL',
            },
        },
    },
    id: {
        busy: 'Mengenkripsi…',
        createError: 'Gagal membuat link. Coba lagi.',
        uploading: 'Mengunggah {percent}%…',
        progressEncrypting: 'Mengenkripsi file di browser kamu…',
        progressUploading: 'Mengunggah file terenkripsi…',
        progressPreparing: 'Menyiapkan',
        helpEncrypting: 'File dienkripsi di perangkat kamu sebelum diunggah.',
        helpUploading: 'Yang dikirim ke server hanya file terenkripsi.',
        tooLarge: 'Ukuran file melebihi batas {mb} MB',
        linkFailed: 'Gagal membuat link file. Coba lagi.',
        uploadFailed: 'Gagal mengenkripsi atau mengunggah file. Coba lagi.',
        multiSummary: '{count} file · {size}',
        zipNote: 'Dikirim sebagai satu file zip',
        removeAll: 'Hapus semua',
        expiry: 'Berlaku {duration}',
        copied: 'Tersalin',
        alreadyCopied: 'Sudah tersalin',
        linkReady: {
            secret: {
                title: 'Link sekali pakai kamu sudah siap',
                usesOne: '{count} kali dibuka',
                usesOther: '{count} kali dibuka',
                warning: 'Link ini hanya ada di halaman ini. Kami tidak bisa menampilkannya lagi dan tidak bisa membaca isinya: '
                    + 'kuncinya ada setelah tanda #, bagian yang tidak pernah dikirim ke server kami.',
                reset: 'Kirim rahasia lain',
                inputLabel: 'Link rahasia sekali pakai',
            },
            file: {
                title: 'Link download sekali pakai kamu sudah siap',
                usesOne: '{count} kali diunduh',
                usesOther: '{count} kali diunduh',
                warning: 'Link ini hanya ada di halaman ini. Kami tidak bisa menampilkannya lagi dan tidak bisa membaca file-nya: '
                    + 'kuncinya ada setelah tanda #, bagian yang tidak pernah dikirim ke server kami.',
                reset: 'Kirim file lain',
                inputLabel: 'Link download sekali pakai',
            },
        },
    },
    de: {
        busy: 'Verschlüsselung läuft…',
        createError: 'Der Link konnte nicht erstellt werden. Bitte versuchen Sie es erneut.',
        uploading: 'Hochladen {percent} %…',
        progressEncrypting: 'Datei wird in Ihrem Browser verschlüsselt…',
        progressUploading: 'Verschlüsselte Datei wird hochgeladen…',
        progressPreparing: 'Vorbereitung',
        helpEncrypting: 'Die Datei wird vor dem Hochladen auf Ihrem Gerät verschlüsselt.',
        helpUploading: 'Zum Server wird nur die verschlüsselte Datei gesendet.',
        tooLarge: 'Die Datei überschreitet das Limit von {mb} MB',
        linkFailed: 'Der Datei-Link konnte nicht erstellt werden. Bitte versuchen Sie es erneut.',
        uploadFailed: 'Die Datei konnte nicht verschlüsselt oder hochgeladen werden. Bitte versuchen Sie es erneut.',
        multiSummary: '{count} Dateien · {size}',
        zipNote: 'Werden als eine ZIP-Datei gesendet',
        removeAll: 'Alle entfernen',
        expiry: 'Läuft ab in {duration}',
        copied: 'Kopiert',
        alreadyCopied: 'Bereits kopiert',
        linkReady: {
            secret: {
                title: 'Ihr Einmal-Link ist fertig',
                usesOne: '{count} Aufruf',
                usesOther: '{count} Aufrufe',
                warning: 'Dieser Link existiert nur auf dieser Seite. Wir können ihn nicht erneut anzeigen und den Inhalt nicht lesen: '
                    + 'Der Schlüssel steht hinter dem #, einem Teil, den der Browser nie an unsere Server sendet.',
                reset: 'Weitere Nachricht senden',
                inputLabel: 'Geheimer Einmal-Link',
            },
            file: {
                title: 'Ihr Einmal-Link zum Download ist fertig',
                usesOne: '{count} Download',
                usesOther: '{count} Downloads',
                warning: 'Dieser Link existiert nur auf dieser Seite. Wir können ihn nicht erneut anzeigen und die Datei nicht lesen: '
                    + 'Der Schlüssel steht hinter dem #, einem Teil, den der Browser nie an unsere Server sendet.',
                reset: 'Weitere Datei senden',
                inputLabel: 'Einmal-Link zum Download',
            },
        },
    },
    pt: {
        busy: 'Criptografando…',
        createError: 'Não foi possível criar o link. Tente novamente.',
        uploading: 'Enviando {percent}%…',
        progressEncrypting: 'Criptografando o arquivo no seu navegador…',
        progressUploading: 'Enviando o arquivo criptografado…',
        progressPreparing: 'Preparando',
        helpEncrypting: 'O arquivo é criptografado no seu dispositivo antes do envio.',
        helpUploading: 'Só o arquivo criptografado é enviado ao servidor.',
        tooLarge: 'O arquivo ultrapassa o limite de {mb} MB',
        linkFailed: 'Não foi possível criar o link do arquivo. Tente novamente.',
        uploadFailed: 'Não foi possível criptografar ou enviar o arquivo. Tente novamente.',
        multiSummary: '{count} arquivos · {size}',
        zipNote: 'Enviados em um único arquivo zip',
        removeAll: 'Remover todos',
        expiry: 'Expira em {duration}',
        copied: 'Copiado',
        alreadyCopied: 'Já copiado',
        linkReady: {
            secret: {
                title: 'Seu link secreto de uso único está pronto',
                usesOne: '{count} visualização',
                usesOther: '{count} visualizações',
                warning: 'Este link só existe nesta página. Não podemos mostrá-lo de novo nem ler o segredo: '
                    + 'a chave fica depois do #, uma parte que o navegador nunca envia aos nossos servidores.',
                reset: 'Enviar outro segredo',
                inputLabel: 'Link secreto de uso único',
            },
            file: {
                title: 'Seu link de download de uso único está pronto',
                usesOne: '{count} download',
                usesOther: '{count} downloads',
                warning: 'Este link só existe nesta página. Não podemos mostrá-lo de novo nem ler o arquivo: '
                    + 'a chave fica depois do #, uma parte que o navegador nunca envia aos nossos servidores.',
                reset: 'Enviar outro arquivo',
                inputLabel: 'Link de download de uso único',
            },
        },
    },
};

export function messageFormData(lang: Lang) {
    if (lang === 'en') return {};
    const t = islandText[lang];
    return {
        'data-busy-label': t.busy,
        'data-error': t.createError,
    };
}

export function fileFormData(lang: Lang) {
    if (lang === 'en') return {};
    const t = islandText[lang];
    return {
        'data-busy-label': t.busy,
        'data-uploading-label': t.uploading,
        'data-progress-encrypting': t.progressEncrypting,
        'data-progress-uploading': t.progressUploading,
        'data-progress-preparing': t.progressPreparing,
        'data-help-encrypting': t.helpEncrypting,
        'data-help-uploading': t.helpUploading,
        'data-too-large': t.tooLarge,
        'data-link-failed': t.linkFailed,
        'data-upload-failed': t.uploadFailed,
        'data-multi-summary': t.multiSummary,
        'data-zip-note': t.zipNote,
        'data-remove-all': t.removeAll,
    };
}

export function linkReadyData(lang: Lang, kind: ShareKind) {
    if (lang === 'en') return {};
    const t = islandText[lang];
    const r = t.linkReady[kind];
    return {
        'data-title': r.title,
        'data-expiry': t.expiry,
        'data-uses-one': r.usesOne,
        'data-uses-other': r.usesOther,
        'data-warning': r.warning,
        'data-reset': r.reset,
        'data-input-label': r.inputLabel,
        'data-copied': t.copied,
        'data-already-copied': t.alreadyCopied,
    };
}
