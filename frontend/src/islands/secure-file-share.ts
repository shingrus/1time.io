import {Constants} from '../lib/util.js';
import {encryptFile} from '../lib/fileProtocol.js';
import {formatBytes, saveFile} from '../lib/fileApi.js';
import {showLinkReady} from './show-link-ready.js';

const form = document.querySelector<HTMLFormElement>('#secure-file-form');
if (form) {
    const dropTarget = form.querySelector<HTMLElement>('.share-card')!;
    const dropZone = form.querySelector<HTMLElement>('[data-drop-zone]')!;
    const fileInput = form.querySelector<HTMLInputElement>('[data-file-input]')!;
    const selectedEl = form.querySelector<HTMLElement>('[data-file-selected]')!;
    const selectedName = form.querySelector<HTMLElement>('[data-file-name]')!;
    const selectedSize = form.querySelector<HTMLElement>('[data-file-size]')!;
    const removeBtn = form.querySelector<HTMLButtonElement>('[data-file-remove]')!;
    const errorCard = form.querySelector<HTMLElement>('[data-file-error-card]')!;
    const errorTitle = form.querySelector<HTMLElement>('[data-file-error]')!;
    const errorSub = form.querySelector<HTMLElement>('[data-file-error-sub]')!;
    const chooseAnotherBtn = form.querySelector<HTMLButtonElement>('[data-file-choose-another]')!;
    const noteEl = form.querySelector<HTMLElement>('[data-file-note]')!;
    const progressEl = form.querySelector<HTMLElement>('[data-file-progress]')!;
    const progressLabel = form.querySelector<HTMLElement>('[data-progress-label]')!;
    const progressValue = form.querySelector<HTMLElement>('[data-progress-value]')!;
    const progressTrack = form.querySelector<HTMLElement>('[data-progress-track]')!;
    const progressFill = form.querySelector<HTMLElement>('[data-progress-fill]')!;
    const progressHelp = form.querySelector<HTMLElement>('[data-progress-help]')!;
    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const keyInput = form.querySelector<HTMLInputElement>('#secretKey')!;
    const passphraseAddBtn = form.querySelector<HTMLButtonElement>('[data-passphrase-add]')!;
    const passphraseField = form.querySelector<HTMLElement>('[data-passphrase-field]')!;
    const durationSelect = form.querySelector<HTMLSelectElement>('#duration')!;
    const viewsSelect = form.querySelector<HTMLSelectElement>('#views')!;

    let selectedFile: File | null = null;
    let isEncrypting = false;
    let isUploading = false;
    let uploadProgress = 0;

    const maxMb = Constants.maxFileSizeBytes / (1024 * 1024);
    // formatBytes always keeps one decimal; whole numbers read better without it.
    const sizeLabel = (bytes: number) => formatBytes(bytes).replace('.0 ', ' ');

    const setNote = (msg: string) => {
        noteEl.textContent = msg;
        noteEl.toggleAttribute('hidden', !msg);
    };

    const renderSelection = () => {
        const hasFile = !!selectedFile;
        const hasSizeError = !errorCard.hidden;
        dropZone.toggleAttribute('hidden', hasFile || hasSizeError);
        selectedEl.toggleAttribute('hidden', !hasFile);
        if (selectedFile) {
            selectedName.textContent = selectedFile.name;
            selectedSize.textContent = sizeLabel(selectedFile.size);
        }
        setNote('');
        updateSubmit();
    };

    const updateSubmit = () => {
        const loading = isEncrypting || isUploading;
        submitBtn.disabled = !selectedFile || loading;
        submitBtn.textContent = isEncrypting
            ? 'Encrypting...'
            : isUploading
                ? `Uploading ${uploadProgress}%...`
                : 'Create one-time link';
    };

    const renderProgress = () => {
        const loading = isEncrypting || isUploading;
        progressEl.toggleAttribute('hidden', !loading);
        if (!loading) return;
        progressLabel.textContent = isEncrypting
            ? 'Encrypting file in your browser...'
            : 'Uploading encrypted file...';
        progressValue.textContent = isUploading ? `${uploadProgress}%` : 'Preparing';
        progressTrack.classList.toggle('file-progress-track-indeterminate', isEncrypting);
        progressFill.style.width = isUploading ? `${uploadProgress}%` : '42%';
        progressHelp.textContent = isEncrypting
            ? 'Encryption happens locally before the file is uploaded.'
            : 'Only the encrypted file is being sent to the server.';
    };

    const clearSelection = () => {
        selectedFile = null;
        fileInput.value = '';
        errorCard.toggleAttribute('hidden', true);
        renderSelection();
    };

    const resetPassphrase = () => {
        keyInput.value = '';
        passphraseField.toggleAttribute('hidden', true);
        passphraseAddBtn.toggleAttribute('hidden', false);
        passphraseAddBtn.setAttribute('aria-expanded', 'false');
    };

    const selectFile = (file: File | undefined | null) => {
        if (!file) return;
        if (file.size > Constants.maxFileSizeBytes) {
            selectedFile = null;
            fileInput.value = '';
            errorTitle.textContent = `File exceeds the ${maxMb} MB limit`;
            errorSub.textContent = `${file.name} · ${sizeLabel(file.size)}`;
            errorCard.toggleAttribute('hidden', false);
            renderSelection();
            const mb = Math.round(file.size / (1024 * 1024));
            fetch(`/stat-reject-limit-${mb}mb`, {method: 'HEAD', keepalive: true}).catch(() => {});
            return;
        }
        errorCard.toggleAttribute('hidden', true);
        selectedFile = file;
        renderSelection();
    };

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => selectFile(fileInput.files?.[0]));
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearSelection();
    });
    chooseAnotherBtn.addEventListener('click', () => {
        clearSelection();
        fileInput.click();
    });
    passphraseAddBtn.addEventListener('click', () => {
        passphraseAddBtn.toggleAttribute('hidden', true);
        passphraseAddBtn.setAttribute('aria-expanded', 'true');
        passphraseField.toggleAttribute('hidden', false);
        keyInput.focus();
    });
    dropTarget.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('file-drop-zone-active');
    });
    dropTarget.addEventListener('dragleave', (e) => {
        if (e.relatedTarget instanceof Node && dropTarget.contains(e.relatedTarget)) return;
        dropZone.classList.remove('file-drop-zone-active');
    });
    dropTarget.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('file-drop-zone-active');
        selectFile(e.dataTransfer?.files?.[0]);
    });

    updateSubmit();
    renderProgress();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedFile) return;
        const durationSeconds = Number(durationSelect.value);
        const selectedViews = Number(viewsSelect.value);
        const passphrase = keyInput.value;
        setNote('');
        isEncrypting = true;
        isUploading = false;
        uploadProgress = 0;
        renderProgress();
        updateSubmit();
        try {
            const {encryptedBlob, hashedKey, randomKey} = await encryptFile(selectedFile, passphrase);
            isEncrypting = false;
            isUploading = true;
            renderProgress();
            updateSubmit();
            const data = await saveFile(
                encryptedBlob,
                hashedKey,
                durationSeconds,
                selectedViews,
                (p: number) => {
                    uploadProgress = Math.min(100, Math.max(0, Math.round(p * 100)));
                    renderProgress();
                    updateSubmit();
                },
            );
            if (data.status === 'ok' && data.newId) {
                // Lazy so the my-secrets store stays off the file page's initial load.
                void import('../lib/mySecrets.js')
                    .then(({recordSecret}) => recordSecret({id: data.newId, kind: 'file', durationSeconds, views: selectedViews}))
                    .catch(() => {});
                const link = `${window.location.origin}/f/#${randomKey}${data.newId}`;
                isEncrypting = false;
                isUploading = false;
                uploadProgress = 0;
                renderProgress();
                await showLinkReady(form, link, () => {
                    clearSelection();
                    resetPassphrase();
                    durationSelect.value = String(Constants.defaultDurationSeconds);
                    viewsSelect.value = '1';
                    updateSubmit();
                }, {uses: selectedViews, kind: 'file', durationSeconds});
                return;
            }
            setNote('Could not create the file link. Please try again.');
        } catch {
            setNote('Could not encrypt or upload the file. Please try again.');
        }
        isEncrypting = false;
        isUploading = false;
        uploadProgress = 0;
        renderProgress();
        updateSubmit();
    });
}
