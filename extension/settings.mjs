import {ProtocolConstants} from './protocol.mjs';

export const SettingsDefaults = {
    host: `https://${ProtocolConstants.defaultHost}`,
    expiresInSeconds: 5 * 24 * 60 * 60,
};
