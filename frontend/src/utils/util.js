let arr = window.location.href.split("/");
let proto = process.env.NODE_ENV === 'development' ? "http:" : "https:";


export var Constants = {
    randomKeyLen: 12,
    defaultDuration: 7,
    isDebug: process.env.NODE_ENV === 'development',
    proto: process.env.NODE_ENV === proto,
    apiBaseUrl: process.env.NODE_ENV === 'development' ? proto + "//localhost:8080/api/" : proto +"//"+ arr[2] + "/api/",
};

const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
// create a key for symmetric encryption
// pass in the desired length of your key
export function getRandomString(stringLen) {
    let randomstring = '';

    for (let i = 0; i < stringLen; i++) {
        let rnum = Math.floor(Math.random() * chars.length);
        randomstring += chars[rnum];
    }
    return randomstring;
}

const passwordChars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789-_=+.,%:";
// generate a strong random password suggestion for the user
// uses crypto.getRandomValues instead of Math.random for better randomness
export function generatePassword() {
    let values = new Uint32Array(16);
    window.crypto.getRandomValues(values);
    let password = '';

    for (let i = 0; i < values.length; i++) {
        password += passwordChars[values[i] % passwordChars.length];
    }
    return password;
}




