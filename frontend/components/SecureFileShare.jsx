'use client';

import {lazy, Suspense, useRef, useState} from "react";
import {Constants, SHARE_DURATION_OPTIONS} from '../utils/util';
import {encryptFile} from '../utils/fileProtocol';
import {saveFile} from '../utils/fileApi';

const ShowNewLink = lazy(() => import('./ShowNewLink'));

function LinkReadyFallback() {
    return (
        <p className="link-ready-fallback" style={{color: 'var(--text-secondary)', padding: '20px 0', textAlign: 'center'}}>
            Preparing secure link...
        </p>
    );
}

export default function SecureFileShare() {
    const [secretKey, setSecretKey] = useState("");
    const [duration, setDuration] = useState(Constants.defaultDuration);
    const [newLink, setNewLink] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileError, setFileError] = useState("");
    const [dragActive, setDragActive] = useState(false);
    const [isEncrypting, setIsEncrypting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef(null);

    const isLoading = isEncrypting || isUploading;

    const clearSelectedFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const validateAndSelectFile = (file) => {
        if (!file) {
            return false;
        }

        if (file.size > Constants.maxFileSizeBytes) {
            clearSelectedFile();
            setFileError(`File is too large. Maximum size is ${Constants.maxFileSizeBytes / (1024 * 1024)} MB.`);
            return false;
        }

        setFileError("");
        setSelectedFile(file);
        return true;
    };

    const handleFileSelect = (event) => {
        validateAndSelectFile(event.target.files?.[0]);
    };

    const handleDrop = (event) => {
        event.preventDefault();
        setDragActive(false);
        validateAndSelectFile(event.dataTransfer.files?.[0]);
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        setDragActive(true);
    };

    const handleDragLeave = () => {
        setDragActive(false);
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const resetProgress = () => {
        setIsEncrypting(false);
        setIsUploading(false);
        setUploadProgress(0);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!selectedFile) {
            return;
        }

        setFileError("");
        setIsEncrypting(true);
        setIsUploading(false);
        setUploadProgress(0);

        try {
            const {encryptedBlob, hashedKey, randomKey} = await encryptFile(selectedFile, secretKey);

            setIsEncrypting(false);
            setIsUploading(true);
            const data = await saveFile(
                encryptedBlob,
                hashedKey,
                duration,
                (progress) => setUploadProgress(Math.min(100, Math.max(0, Math.round(progress * 100)))),
            );

            if (data.status === 'ok' && data.newId) {
                clearSelectedFile();
                resetProgress();
                setSecretKey("");
                setDuration(Constants.defaultDuration);
                setNewLink(`${window.location.origin}/f/#${randomKey}${data.newId}`);
                return;
            }

            setFileError("Could not create the file link. Please try again.");
        } catch (error) {
            setFileError("Could not encrypt or upload the file. Please try again.");
        }

        resetProgress();
    };

    if (newLink) {
        return (
            <Suspense fallback={<LinkReadyFallback />}>
                <ShowNewLink
                    newLink={newLink}
                    onReset={() => setNewLink("")}
                />
            </Suspense>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="form-field">
                <label className="form-label">Your file, end-to-end encrypted.</label>
                <div
                    className={`file-drop-zone ${dragActive ? 'file-drop-zone-active' : ''} ${selectedFile ? 'file-drop-zone-has-file' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        style={{display: 'none'}}
                    />
                    {selectedFile ? (
                        <div className="file-selected">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <span className="file-selected-name">{selectedFile.name}</span>
                            <span className="file-selected-size">{formatFileSize(selectedFile.size)}</span>
                            <button
                                type="button"
                                className="file-selected-remove"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    clearSelectedFile();
                                    setFileError("");
                                }}
                                aria-label="Remove file"
                            >&times;</button>
                        </div>
                    ) : (
                        <div className="file-drop-prompt">
                            <span className="file-drop-btn">
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
                                    <path d="M3 10h18" />
                                </svg>
                                Choose a file
                            </span>
                            <p>or drop it here</p>
                            <p className="file-drop-limit">Max {Constants.maxFileSizeBytes / (1024 * 1024)} MB</p>
                        </div>
                    )}
                </div>
                {fileError && (
                    <p className="form-help form-help-error">{fileError}</p>
                )}
            </div>

            {isLoading && (
                <div className="file-progress" aria-live="polite">
                    <div className="file-progress-head">
                        <span className="file-progress-label">
                            {isEncrypting ? 'Encrypting file in your browser...' : 'Uploading encrypted file...'}
                        </span>
                        <span className="file-progress-value">
                            {isUploading ? `${uploadProgress}%` : 'Preparing'}
                        </span>
                    </div>
                    <div className={`file-progress-track ${isEncrypting ? 'file-progress-track-indeterminate' : ''}`}>
                        <div
                            className="file-progress-fill"
                            style={{width: isUploading ? `${uploadProgress}%` : '42%'}}
                        />
                    </div>
                    <p className="form-help">
                        {isEncrypting
                            ? 'Encryption happens locally before the file is uploaded.'
                            : 'Only the encrypted file is being sent to the server.'}
                    </p>
                </div>
            )}

            <div className="form-actions share-primary-actions">
                <button
                    className="btn btn-primary btn-lg"
                    disabled={!selectedFile || isLoading}
                    type="submit"
                >
                    {isEncrypting
                        ? 'Encrypting...'
                        : isUploading
                            ? `Uploading ${uploadProgress}%...`
                            : 'Create file link'}
                </button>
            </div>

            <div className="options-grid">
                <div className="form-field" style={{marginBottom: 0}}>
                    <label className="form-label" htmlFor="secretKey">Additional passphrase</label>
                    <input
                        className="form-input"
                        id="secretKey"
                        placeholder="Optional extra security"
                        value={secretKey}
                        onChange={(event) => setSecretKey(event.target.value)}
                        type="text"
                    />
                    <p className="form-help">Recipient will need this to decrypt</p>
                </div>
                <div className="form-field" style={{marginBottom: 0}}>
                    <label className="form-label" htmlFor="duration">Expire after</label>
                    <select
                        className="form-select"
                        id="duration"
                        value={duration}
                        onChange={(event) => setDuration(Number(event.target.value))}
                    >
                        {SHARE_DURATION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <p className="form-help">Link expires even if unread</p>
                </div>
            </div>
        </form>
    );
}
