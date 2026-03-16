import React from "react";
import {Route, Routes} from "react-router-dom";
import NewMessage from "./containers/NewMessage";
import ShowNewLink from "./containers/ShowNewLink";
import ViewSecretMessage from "./containers/ViewSecretMessage"
import ViewError from './containers/ErrorComponent';
import About from './containers/About';
import PasswordGenerator from './containers/PasswordGenerator';

export default function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<NewMessage />} />
            <Route path="/index.html" element={<NewMessage />} />
            <Route path="/new" element={<ShowNewLink />} />
            <Route path="/password-generator" element={<PasswordGenerator />} />
            <Route path="/about" element={<About />} />
            <Route path="/v/*" element={<ViewSecretMessage />} />
            <Route path="*" element={<ViewError />} />
        </Routes>
    );
}
