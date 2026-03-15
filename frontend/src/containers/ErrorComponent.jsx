import React from 'react';
import {useNavigate} from "react-router-dom";

import "./Container.css";


export default function ViewError() {
    const navigate = useNavigate();

    return (<div className="Center">
            <p className="large" color="red">
                Page not found.
            </p>
            <button
                className="btn btn-primary btn-lg center-block"
                type="button"
                onClick={() => navigate('/')}
            >
                Create New
            </button>
        </div>)
}
