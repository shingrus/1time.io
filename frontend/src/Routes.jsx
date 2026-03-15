import React from "react";
import {Route, Routes} from "react-router-dom";
import NewMessage from "./containers/NewMessage";
import ShowNewLink from "./containers/ShowNewLink";
import ViewSecretMessage from "./containers/ViewSecretMessage"
import ViewError from './containers/ErrorComponent';


export default function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<NewMessage />} />
            <Route path="/index.html" element={<NewMessage />} />
            <Route path="/new" element={<ShowNewLink />} />
            <Route path="/v/*" element={<ViewSecretMessage />} />
            <Route path="*" element={<ViewError />} />
        </Routes>
    );
}
