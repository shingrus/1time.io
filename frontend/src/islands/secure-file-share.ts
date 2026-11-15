import {Constants} from '../lib/util.js';
import {encryptFile} from '../lib/fileProtocol.js';
import {formatBytes} from '../lib/fileApi.js';
import {saveFile} from '../lib/fileUpload.js';
import {showLinkReady} from './show-link-ready.js';

const form = document.querySelector<HTMLFormElement>('#secure-file-form');
if (form) {
    const dropTarget = form.querySelector<HTMLElement>('.share-card')!;
    const dropZone = form.querySelector<HTMLElement>('[data-drop-zone]')!;
    const fileInput = form.querySelector<HTMLInputElement>('[data-file-input]')!;
    const selectedEl = form.querySelector<HTMLElement>('[data-file-selected]')!;
    const selectedRow = form.querySelector<HTMLElement>('.file-state-selected')!;
    const selectedName = form.querySelector<HTMLElement>('[data-file-name]')!;
    const selectedSize = form.querySelector<HTMLElement>('[data-file-size]')!;
    const selectionCard = form.querySelector<HTMLElement>('.file-selection-card')!;
    const addBtn = form.querySelector<HTMLButtonElement>('[data-file-add]')!;
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

    let selectedFiles: File[] = [];
    let multiFile: typeof import('./multi-file.js') | null = null;
    let selectionToken = 0;
    let isEncrypting = false;
    let isUploading = false;
    let uploadProgress = 0;

    const maxMb = Math.round(Constants.maxFileSizeBytes / (1024 * 1024));
    const text = form.dataset;
    const createLabel = submitBtn.textContent ?? 'Create one-time link';
    // formatBytes always keeps one decimal; whole numbers read better without it.
    const sizeLabel = (bytes: number) => formatBytes(bytes).replace('.0 ', ' ');

    const setNote = (msg: string) => {
        noteEl.textContent = msg;
        noteEl.toggleAttribute('hidden', !msg);
    };

    const renderSelection = () => {
        const hasFile = selectedFiles.length > 0;
        const hasSizeError = !errorCard.hidden;
        dropZone.toggleAttribute('hidden', hasFile || hasSizeError);
        selectedEl.toggleAttribute('hidden', !hasFile);
        selectedRow.toggleAttribute('hidden', selectedFiles.length > 1);
        if (selectedFiles.length === 1) {
            selectedName.textContent = selectedFiles[0].name;
            selectedSize.textContent = sizeLabel(selectedFiles[0].size);
        }
        if (selectedFiles.length > 1) {
            multiFile!.renderList(selectedRow, selectedFiles, text, sizeLabel, removeFileAt, clearSelection);
        } else {
            multiFile?.clearList();
        }
        setNote('');
        updateSubmit();
    };

    const updateSubmit = () => {
        const loading = isEncrypting || isUploading;
        submitBtn.disabled = !selectedFiles.length || loading;
        submitBtn.textContent = isEncrypting
            ? text.busyLabel ?? 'Encrypting...'
            : isUploading
                ? (text.uploadingLabel ?? 'Uploading {percent}%...').replace('{percent}', String(uploadProgress))
                : createLabel;
    };

    const renderProgress = () => {
        const loading = isEncrypting || isUploading;
        progressEl.toggleAttribute('hidden', !loading);
        selectionCard.inert = loading;
        if (!loading) return;
        progressLabel.textContent = isEncrypting
            ? text.progressEncrypting ?? 'Encrypting file in your browser...'
            : text.progressUploading ?? 'Uploading encrypted file...';
        progressValue.textContent = isUploading ? `${uploadProgress}%` : text.progressPreparing ?? 'Preparing';
        progressTrack.classList.toggle('file-progress-track-indeterminate', isEncrypting);
        progressFill.style.width = isUploading ? `${uploadProgress}%` : '42%';
        progressHelp.textContent = isEncrypting
            ? text.helpEncrypting ?? 'Encryption happens locally before the file is uploaded.'
            : text.helpUploading ?? 'Only the encrypted file is being sent to the server.';
    };

    const clearSelection = () => {
        selectionToken++;
        selectedFiles = [];
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

    const rejectTooLarge = (sub: string, bytes: number) => {
        const title = (text.tooLarge ?? 'File exceeds the {mb} MB limit').replace('{mb}', String(maxMb));
        if (selectedFiles.length) {
            setNote(title);
        } else {
            errorTitle.textContent = title;
            errorSub.textContent = sub;
            errorCard.toggleAttribute('hidden', false);
            renderSelection();
        }
        const mb = Math.round(bytes / (1024 * 1024));
        fetch(`/stat-reject-limit-${mb}mb`, {method: 'HEAD', keepalive: true}).catch(() => {});
    };

    const selectFile = (file: File | undefined | null) => {
        if (!file) return;
        if (file.size > Constants.maxFileSizeBytes) {
            rejectTooLarge(`${file.name} · ${sizeLabel(file.size)}`, file.size);
            return;
        }
        errorCard.toggleAttribute('hidden', true);
        selectedFiles = [file];
        renderSelection();
    };

    const selectFiles = (added: File[]) => {
        if (!added.length || isEncrypting || isUploading) return;
        if (added.length === 1 && !selectedFiles.length) return selectFile(added[0]);
        const token = selectionToken;
        (multiFile ? Promise.resolve(multiFile) : import('./multi-file.js'))
            .then((loaded) => {
                if (token !== selectionToken || isEncrypting || isUploading) return;
                multiFile = loaded;
                const files = [...selectedFiles, ...added];
                if (files.length < 2) return selectFile(files[0]);
                const zipBytes = loaded.zipSize(files);
                if (zipBytes > Constants.maxFileSizeBytes) {
                    rejectTooLarge(loaded.multiSummary(files, text, sizeLabel), zipBytes);
                    return;
                }
                errorCard.toggleAttribute('hidden', true);
                selectedFiles = files;
                renderSelection();
            })
            .catch(() => {
                if (token !== selectionToken) return;
                setNote(text.uploadFailed ?? 'Could not encrypt or upload the file. Please try again.');
            });
    };

    const removeFileAt = (index: number) => {
        const hadFocus = selectionCard.contains(document.activeElement);
        selectedFiles = selectedFiles.filter((_, i) => i !== index);
        renderSelection();
        if (hadFocus) {
            const buttons = selectionCard.querySelectorAll<HTMLButtonElement>('.file-list .file-remove');
            (buttons[Math.min(index, selectedFiles.length - 1)] ?? removeBtn).focus();
        }
    };

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        const picked = Array.from(fileInput.files ?? []);
        fileInput.value = '';
        selectFiles(picked);
    });
    addBtn.addEventListener('click', () => {
        fileInput.click();
        if (!multiFile) import('./multi-file.js').then((loaded) => (multiFile ??= loaded)).catch(() => {});
    });
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
        if (isEncrypting || isUploading) return;
        dropZone.classList.add('file-drop-zone-active');
        selectionCard.classList.add('file-drop-zone-active');
    });
    dropTarget.addEventListener('dragleave', (e) => {
        if (e.relatedTarget instanceof Node && dropTarget.contains(e.relatedTarget)) return;
        dropZone.classList.remove('file-drop-zone-active');
        selectionCard.classList.remove('file-drop-zone-active');
    });
    dropTarget.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('file-drop-zone-active');
        selectionCard.classList.remove('file-drop-zone-active');
        selectFiles(Array.from(e.dataTransfer?.files ?? []));
    });

    updateSubmit();
    renderProgress();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedFiles.length) return;
        const files = [...selectedFiles];
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
            const {encryptedBytes, readTokenHash, randomKey} = await encryptFile(
                files.length > 1 ? await multiFile!.buildZip(files) : files[0],
                passphrase,
            );
            isEncrypting = false;
            isUploading = true;
            renderProgress();
            updateSubmit();
            const data = await saveFile(
                encryptedBytes,
                readTokenHash,
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
                    .then(({recordSecret}) =>
                        recordSecret({id: data.newId, kind: 'file', durationSeconds, views: selectedViews}))
                    .catch(() => {});
                if (files.length > 1) multiFile!.reportMultiFileSent();
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
                }, {uses: selectedViews, kind: 'file', durationLabel: durationSelect.selectedOptions[0].text});
                return;
            }
            setNote(text.linkFailed ?? 'Could not create the file link. Please try again.');
        } catch {
            setNote(text.uploadFailed ?? 'Could not encrypt or upload the file. Please try again.');
        }
        isEncrypting = false;
        isUploading = false;
        uploadProgress = 0;
        renderProgress();
        updateSubmit();
    });
}
