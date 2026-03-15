import React, {useState} from "react";
import {useNavigate} from "react-router-dom";
import axios from "axios"
import CryptoJS from 'crypto-js'
import {getRandomString, Constants} from '../utils/util';


import "./Container.css";

export default function NewMessage() {
    const navigate = useNavigate();
    const [secretMessage, setSecretMessage] = useState("");
    const [secretKey, setSecretKey] = useState("");
    const [duration, setDuration] = useState(Constants.defaultDuration);
    const [needOptions, setNeedOptions] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (event) => {
        const {id, value} = event.target;
        switch (id) {
        case "secretMessage":
            setSecretMessage(value);
            break;
        case "secretKey":
            setSecretKey(value);
            break;
        case "duration":
            setDuration(value);
            break;
        default:
            break;
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsLoading(true);

        const randomKey = getRandomString(Constants.randomKeyLen);
        const durationDays = parseInt(duration, 10);
        const fullSecretKey = secretKey + randomKey;
        const encryptedMessage = CryptoJS.AES.encrypt(secretMessage, fullSecretKey);
        const hashedKey = CryptoJS.SHA256(fullSecretKey);

        const payload = {
            secretMessage: encryptedMessage.toString(),
            hashedKey: hashedKey.toString(),
            duration: durationDays * 86400,
        };

        try {
            const response = await axios.post(Constants.apiBaseUrl + 'saveSecret', payload);
            if (response.data.status === "ok") {
                navigate("/new", {
                    state: {
                        randomString: randomKey,
                        newId: response.data.newId,
                    },
                });
                return;
            }
        } catch (error) {}

        setIsLoading(false);
    };

    return (
        <div className="Left">
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="secretMessage">One-time Message</label>
                    <textarea
                        autoFocus
                        className="form-control input-lg"
                        id="secretMessage"
                        placeholder="All content will be encrypted with the uniq key on the client side."
                        rows={4}
                        value={secretMessage}
                        onChange={handleChange}
                    />
                </div>
                {needOptions ?
                    <div className="form-group"><label htmlFor="secretKey" aria-describedby="keyHelp">Additional Secret Key:</label>
                        <input className="form-control"
                            id="secretKey"
                            placeholder="Secret Key"
                            value={secretKey}
                            onChange={handleChange}
                            type="text"
                        /><label htmlFor="duration" aria-describedby="DurationHelp">Keep message for: </label>
                        <select className="form-control" id="duration" value={duration} onChange={handleChange}>
                            <option value="1">1 day</option>
                            <option value="3">3 days</option>
                            <option value="7">7 days</option>
                            <option value="30">30 days</option>
                        </select></div> : null}

                <div className="form-group block">
                    <button
                        className="btn btn-default"
                        onClick={() => {
                            setNeedOptions(!needOptions);
                        }}
                        type="button"
                    >Options
                    </button>
                    <button
                        className="btn btn-success btn-lg pull-right"
                        disabled={secretMessage.length === 0 || isLoading}
                        type="submit"
                    >
                        {!isLoading ? "Get a link" : "Loading..."}
                    </button></div>
                <div className="form-group">
                    <p className="form-control-static small">Send passwords, one-time tokens, private messages or any sensitive
                        data with
                        strongly encrypted one-time link. When the user opens the link content is destroyed. It's
                        absolutely private. We don't have access to the stored data, because it's encrypted on the
                        client side with one-time password. The link available only for 7 days.</p>
                </div>
            </form>
        </div>
    );
}
