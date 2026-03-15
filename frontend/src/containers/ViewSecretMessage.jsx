import React, {useState} from 'react';
import {useLocation, useNavigate} from "react-router-dom";
import axios from 'axios';
import CryptoJS from 'crypto-js'
import {Constants, copyTextToClipboard} from '../utils/util';

import "./Container.css";

export default function ViewSecretMessage() {
    const location = useLocation();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [secretMessage, setSecretMessage] = useState("");
    const [secretKey, setSecretKey] = useState("");
    const [needSecretKey, setNeedSecretKey] = useState("");
    const [isWrongKey, setIsWrongKey] = useState(false);
    const [isNoMessage, setIsNoMessage] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleChange = (event) => {
        setSecretKey(event.target.value);
    };

    const getLinkKey = () => {
        if (location.hash && location.hash.length > 1) {
            return location.hash.slice(1);
        }
        if (location.pathname.startsWith("/v/")) {
            return location.pathname.slice(3);
        }
        return "";
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        setIsLoading(true);
        setIsWrongKey(false);

        const link = getLinkKey();
        if (!link || link.length <= Constants.randomKeyLen) {
            setIsLoading(false);
            setIsNoMessage(true);
            return;
        }

        const randomKey = link.substring(0, Constants.randomKeyLen);
        const id = link.substring(Constants.randomKeyLen);
        const fullSecretKey = secretKey + randomKey;
        const hashedKey = CryptoJS.SHA256(fullSecretKey).toString();

        try {
            const response = await axios.post(Constants.apiBaseUrl + 'get', {
                id,
                hashedKey,
            });

            if (response.data.status === "ok" &&
                typeof (response.data.cryptedMessage) !== "undefined" &&
                response.data.cryptedMessage.length > 0
            ) {
                const decryptedData = CryptoJS.AES.decrypt(response.data.cryptedMessage, fullSecretKey);
                const decryptedMessage = decryptedData.toString(CryptoJS.enc.Utf8);
                setIsLoading(false);
                setSecretMessage(decryptedMessage);
                return;
            }

            if (response.data.status === "wrong key") {
                setIsLoading(false);
                setIsWrongKey(true);
                setNeedSecretKey(true);
                return;
            }

            if (response.data.status === "no message") {
                setIsLoading(false);
                setIsNoMessage(true);
                return;
            }
        } catch (error) {}

        setIsLoading(false);
    };

    const handleCopy = async () => {
        const didCopy = await copyTextToClipboard(secretMessage);
        if (didCopy) {
            setCopied(true);
        }
    };

    return (
        <div className="Left">
            {secretMessage.length === 0 && !isNoMessage &&
            <p>You are about to read the secret message. Once you read it will be destroyed.</p>
            }
            <form onSubmit={handleSubmit}>
                {secretMessage.length === 0 && !isNoMessage && needSecretKey &&
                <div className="form-group">
                    <label htmlFor="secretKey" aria-describedby="keyHelp">Secret Key</label>
                    <input
                        className="form-control input-lg"
                        id="secretKey"
                        placeholder="Secret Key"
                        value={secretKey}
                        onChange={handleChange}
                        type="text"
                    />
                </div>
                }
                {secretMessage.length > 0 &&
                <div className="panel panel-default">
                    <div className="panel-heading">
                        <h3 className="panel-title">One-time message:</h3>
                    </div>
                    <div className="panel-body"><pre>{secretMessage}</pre></div>
                    <div className="panel-footer text-center">
                        <button
                            className="btn btn-success btn-sm center-block"
                            onClick={handleCopy}
                            type="button"
                        >{!copied ? "Copy to clipboard" : "Copied"}</button>
                    </div>
                </div>
                }
                {secretMessage.length === 0 && !isNoMessage &&
                <div className="Center">
                    <button
                        className="btn btn-success btn-lg center-block"
                        type="submit"
                        disabled={isLoading}
                    >
                        {!isLoading ? "Read the message" : "Loading..."}
                    </button>
                </div>
                }
                {(secretMessage.length > 0 || isNoMessage) &&
                <div className="Center">
                    <p className="small">
                        Message was destroyed.
                    </p>
                    <button
                        className="btn btn-primary btn-lg center-block"
                        type="button"
                        onClick={() => navigate('/')}
                    >
                        Create New
                    </button>
                </div>
                }
            </form>

        </div>
    );
}
