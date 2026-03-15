import React, {useState} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {copyTextToClipboard} from '../utils/util';

import "./Container.css";

export default function ShowNewLink() {
    const location = useLocation();
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);
    const routeState = location.state;
    const newLink = routeState?.randomString
        ? `${window.location.origin}/v/#${routeState.randomString}${routeState.newId}`
        : "";

    const handleCopy = async () => {
        const didCopy = await copyTextToClipboard(newLink);
        if (didCopy) {
            setCopied(true);
        }
    };

    return (
        <div className="Center">
            <div className="form-group">
                <div className="input-group">
                    <span className="input-group-addon">Secret one-time link: </span>
                    <input className="form-control"
                                 aria-label="Secret one-time link"
                                 onClick={handleCopy}
                                 type="text"
                                 value={newLink}
                                 readOnly/>
                </div>
            </div>
            <div className="center-block">
            <div className="btn-toolbar">
                <button
                    className="btn btn-primary btn-lg"
                    type="button"

                    onClick={() => navigate('/')}
                >Create new</button>
                <button
                    className="btn btn-success btn-lg"
                    onClick={handleCopy}
                    type="button"
                >{!copied ? "Copy to clipboard" : "Copied"}
                </button>
            </div></div>
            <p className="small centered"><br/>
                This secret one-time link works only once. Once it's open the content will be
                DELETED. The Message was encrypted, so it's impossible for us to read it.
            </p>
        </div>
    );
}
