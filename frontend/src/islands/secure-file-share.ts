import {Constants} from '../lib/util.js';
import {encryptFile} from '../lib/fileProtocol.js';
import {formatBytes, saveFile} from '../lib/fileApi.js';
import {showLinkReady} from './show-link-ready.js';

const form = document.querySelector<HTMLFormElement>('#secure-file-form');
if (form) {
    const dropZone = form.querySelector<HTMLElement>('[data-drop-zone]')!;
    const fileInput = form.querySelector<HTMLInputElement>('[data-file-input]')!;
    const promptEl = form.querySelector<HTMLElement>('[data-file-prompt]')!;
    const selectedEl = form.querySelector<HTMLElement>('[data-file-selected]')!;
    const selectedName = form.querySelector<HTMLElement>('[data-file-name]')!;
    const selectedSize = form.querySelector<HTMLElement>('[data-file-size]')!;
    const removeBtn = form.querySelector<HTMLButtonElement>('[data-file-remove]')!;
    const errorEl = form.querySelector<HTMLElement>('[data-file-error]')!;
    const progressEl = form.querySelector<HTMLElement>('[data-file-progress]')!;
    const progressLabel = form.querySelector<HTMLElement>('[data-progress-label]')!;
    const progressValue = form.querySelector<HTMLElement>('[data-progress-value]')!;
    const progressTrack = form.querySelector<HTMLElement>('[data-progress-track]')!;
    const progressFill = form.querySelector<HTMLElement>('[data-progress-fill]')!;
    const progressHelp = form.querySelector<HTMLElement>('[data-progress-help]')!;
    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const keyInput = form.querySelector<HTMLInputElement>('#secretKey')!;
    const durationSelect = form.querySelector<HTMLSelectElement>('#duration')!;
    const viewsSelect = form.querySelector<HTMLSelectElement>('#views')!;
    const optionsPanel = form.querySelector<HTMLElement>('[data-options-panel]')!;
    const optionChips = form.querySelectorAll<HTMLButtonElement>('.option-chip');

    let selectedFile: File | null = null;
    let isEncrypting = false;
    let isUploading = false;
    let uploadProgress = 0;

    const setOptionsOpen = (open: boolean) => {
        optionsPanel.toggleAttribute('hidden', !open);
        optionChips.forEach((chip) => chip.setAttribute('aria-expanded', String(open)));
    };
    const updateOptionChips = () => {
        optionChips.forEach((chip) => {
            const id = chip.dataset.chip;
            const text = id === 'duration'
                ? durationSelect.selectedOptions[0]?.textContent ?? '1 day'
                : id === 'views'
                    ? `${viewsSelect.value} download${viewsSelect.value === '1' ? '' : 's'}`
                    : keyInput.value ? 'passphrase added' : 'set passphrase';
            chip.querySelector<HTMLElement>('[data-chip-label]')!.textContent = text;
        });
    };
    optionChips.forEach((chip) => chip.addEventListener('click', () => {
        setOptionsOpen(true);
        form.querySelector<HTMLElement>('#' + chip.dataset.chip)?.focus();
    }));
    durationSelect.addEventListener('change', updateOptionChips);
    viewsSelect.addEventListener('change', updateOptionChips);
    keyInput.addEventListener('input', updateOptionChips);

    const setError = (msg: string) => {
        errorEl.textContent = msg;
        errorEl.toggleAttribute('hidden', !msg);
    };

    const renderSelection = () => {
        if (selectedFile) {
            promptEl.toggleAttribute('hidden', true);
            selectedEl.toggleAttribute('hidden', false);
            selectedName.textContent = selectedFile.name;
            selectedSize.textContent = formatBytes(selectedFile.size);
            dropZone.classList.add('file-drop-zone-has-file');
        } else {
            promptEl.toggleAttribute('hidden', false);
            selectedEl.toggleAttribute('hidden', true);
            dropZone.classList.remove('file-drop-zone-has-file');
        }
        updateSubmit();
    };

    const updateSubmit = () => {
        const loading = isEncrypting || isUploading;
        submitBtn.disabled = !selectedFile || loading;
        submitBtn.textContent = isEncrypting
            ? 'Encrypting...'
            : isUploading
                ? `Uploading ${uploadProgress}%...`
                : 'Create file link';
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
        renderSelection();
    };

    const selectFile = (file: File | undefined | null) => {
        if (!file) return;
        if (file.size > Constants.maxFileSizeBytes) {
            clearSelection();
            setError(`File is too large. Maximum size is ${Constants.maxFileSizeBytes / (1024 * 1024)} MB.`);
            const mb = Math.round(file.size / (1024 * 1024));
            fetch(`/stat-reject-limit-${mb}mb`, {method: 'HEAD', keepalive: true}).catch(() => {});
            return;
        }
        setError('');
        selectedFile = file;
        renderSelection();
    };

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => selectFile(fileInput.files?.[0]));
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearSelection();
        setError('');
    });
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('file-drop-zone-active');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('file-drop-zone-active');
    });
    dropZone.addEventListener('drop', (e) => {
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
        setError('');
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
                    .then(({recordSecret}) => recordSecret({id: data.newId, kind: 'file', durationSeconds}))
                    .catch(() => {});
                const link = `${window.location.origin}/f/#${randomKey}${data.newId}`;
                isEncrypting = false;
                isUploading = false;
                uploadProgress = 0;
                renderProgress();
                showLinkReady(form, link, () => {
                    clearSelection();
                    keyInput.value = '';
                    durationSelect.value = String(Constants.defaultDurationSeconds);
                    viewsSelect.value = '1';
                    updateOptionChips();
                    setOptionsOpen(false);
                    updateSubmit();
                }, {uses: selectedViews, kind: 'file'});
                return;
            }
            setError('Could not create the file link. Please try again.');
        } catch {
            setError('Could not encrypt or upload the file. Please try again.');
        }
        isEncrypting = false;
        isUploading = false;
        uploadProgress = 0;
        renderProgress();
        updateSubmit();
    });
}
