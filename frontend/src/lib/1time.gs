function oneTimeUnsigned_(signed) {
  return Uint8Array.from(signed);
}

function oneTimeSigned_(bytes) {
  return Array.from(new Int8Array(bytes.buffer, bytes.byteOffset, bytes.length));
}

function oneTimeUtf8_(text) {
  return oneTimeUnsigned_(Utilities.newBlob(text).getBytes());
}

function oneTimeHex_(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function oneTimeBase64Url_(bytes) {
  return Utilities.base64EncodeWebSafe(oneTimeSigned_(bytes)).replace(/=+$/, '');
}

function oneTimeFromBase64Url_(text) {
  return oneTimeUnsigned_(Utilities.base64DecodeWebSafe(text + '='.repeat((4 - (text.length % 4)) % 4)));
}

function oneTimeHmac_(key, message) {
  return oneTimeUnsigned_(Utilities.computeHmacSha256Signature(oneTimeSigned_(message), oneTimeSigned_(key)));
}

// No secure random API exists in Apps Script; Utilities.getUuid() (Java's UUID.randomUUID) is the only source.
function oneTimeRandomBytes_(count) {
  const uuids = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid();
  return oneTimeUnsigned_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, uuids)).slice(0, count);
}

function oneTimeRandomKey_() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  return Array.from(oneTimeRandomBytes_(20), (byte) => alphabet[byte & 63]).join('');
}

function oneTimeHkdf_(material, info) {
  const pseudoRandomKey = oneTimeHmac_(oneTimeUtf8_('onetimelink:v2'), material);
  return oneTimeHmac_(pseudoRandomKey, Uint8Array.from([...oneTimeUtf8_(info), 1]));
}

function oneTimeKeys_(passphrase, randomKey) {
  const material = oneTimeUtf8_(passphrase + randomKey);
  const readToken = oneTimeHex_(oneTimeHkdf_(material, 'auth'));
  const hashBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, readToken);
  return {
    aesKey: oneTimeHkdf_(material, 'encrypt'),
    readToken,
    readTokenHash: oneTimeHex_(oneTimeUnsigned_(hashBytes)),
  };
}

function oneTimeEncrypt_(text, aesKey) {
  const iv = oneTimeRandomBytes_(12);
  const sealed = oneTimeAes_.gcm(aesKey, iv).encrypt(oneTimeUtf8_(text));
  return oneTimeBase64Url_(iv) + '.' + oneTimeBase64Url_(sealed);
}

function oneTimeDecrypt_(wire, aesKey) {
  const [ivText, bodyText] = wire.split('.');
  const plain = oneTimeAes_.gcm(aesKey, oneTimeFromBase64Url_(ivText)).decrypt(oneTimeFromBase64Url_(bodyText));
  return Utilities.newBlob(oneTimeSigned_(plain)).getDataAsString();
}

function oneTimeOrigin_(host) {
  const match = /^(https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?)\/?$/.exec(host);
  if (!match) throw new Error('Host must be an https URL without a path.');
  return match[1];
}

function oneTimeParseLink_(link) {
  const match = /^(https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?)\/v\/#([A-Za-z0-9_-]{42})$/.exec(String(link).trim());
  if (!match) throw new Error('Not a 1time text link: expected https://host/v/# followed by 42 characters.');
  return {origin: match[1], randomKey: match[2].slice(0, 20), id: match[2].slice(20)};
}

function oneTimeApi_(origin, endpoint, body) {
  const request = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  };
  for (let attempt = 1; ; attempt++) {
    const response = UrlFetchApp.fetch(`${origin}/api/${endpoint}?src=gas`, request);
    const code = response.getResponseCode();
    let json = null;
    try { json = JSON.parse(response.getContentText()); } catch (error) {}
    if (code === 503 && json && json.status === 'retry' && attempt < 4) {
      Utilities.sleep(250 * attempt);
      continue;
    }
    if (code !== 200) throw new Error(`1time API answered HTTP ${code}.`);
    return json || {};
  }
}

function createOneTimeLink(secret, options) {
  const {expiresInSeconds = 86400, views = 1, passphrase = '', host = 'https://1time.io'} = options || {};
  if (typeof secret !== 'string' || !secret) throw new Error('Secret must be a non-empty string.');
  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 2592000) {
    throw new Error('expiresInSeconds must be an integer from 1 to 2592000.');
  }
  if (!Number.isInteger(views) || views < 1 || views > 10) throw new Error('views must be an integer from 1 to 10.');
  const origin = oneTimeOrigin_(host);
  const randomKey = oneTimeRandomKey_();
  const keys = oneTimeKeys_(passphrase, randomKey);
  const response = oneTimeApi_(origin, 'saveSecret', {
    secretMessage: oneTimeEncrypt_(secret, keys.aesKey),
    readTokenHash: keys.readTokenHash,
    v: 3,
    duration: expiresInSeconds,
    views,
  });
  if (response.status !== 'ok' || !/^[A-Za-z0-9_-]{22}$/.test(response.newId)) {
    throw new Error('The server did not accept the secret.');
  }
  return `${origin}/v/#${randomKey}${response.newId}`;
}

function readOneTimeLink(link, passphrase = '') {
  const parts = oneTimeParseLink_(link);
  const keys = oneTimeKeys_(passphrase, parts.randomKey);
  const response = oneTimeApi_(parts.origin, 'get', {id: parts.id, hashedKey: keys.readToken});
  if (response.status === 'ok') {
    return {
      text: oneTimeDecrypt_(response.cryptedMessage, keys.aesKey),
      viewsLeft: Number(response.viewsLeft),
      expiresIn: Number(response.expiresIn),
    };
  }
  if (response.status === 'wrong key') throw new Error('Wrong key: the passphrase is missing or incorrect.');
  if (response.status === 'no message') throw new Error('No message: already read, expired or never existed.');
  throw new Error('The server could not process the request.');
}

// AES-256-GCM below is @noble/ciphers 2.4.0 (aes.js gcm), unmodified, bundled with esbuild.
// MIT License, (c) 2022 Paul Miller (paulmillr.com), (c) 2016 Thomas Pornin. https://github.com/paulmillr/noble-ciphers
var oneTimeAes_=(()=>{var z=Object.defineProperty;var at=Object.getOwnPropertyDescriptor;var gt=Object.getOwnPropertyNames;var pt=Object.prototype.hasOwnProperty;var yt=(t,e,n)=>e in t?z(t,e,{enumerable:!0,configurable:!0,writable:!0,value:n}):t[e]=n;var wt=(t,e)=>{for(var n in e)z(t,n,{get:e[n],enumerable:!0})},dt=(t,e,n,o)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of gt(e))!pt.call(t,r)&&r!==n&&z(t,r,{get:()=>e[r],enumerable:!(o=at(e,r))||o.enumerable});return t};var bt=t=>dt(z({},"__esModule",{value:!0}),t);var b=(t,e,n)=>yt(t,typeof e!="symbol"?e+"":e,n);var Kt={};wt(Kt,{gcm:()=>ft});function W(t){return t instanceof Uint8Array||ArrayBuffer.isView(t)&&t.constructor.name==="Uint8Array"&&"BYTES_PER_ELEMENT"in t&&t.BYTES_PER_ELEMENT===1}var M=t=>t?`"${t}" `:"";function xt(t,e=""){if(typeof t!="boolean")throw new TypeError(M(e)+"expected boolean, got type="+typeof t);return t}function N(t,e=""){if(typeof t!="number")throw new TypeError(M(e)+"expected number, got "+typeof t);if(!Number.isSafeInteger(t)||t<0)throw new RangeError(M(e)+"expected integer >= 0, got "+t);return t}function w(t,e,n=""){if(W(t)&&(e===void 0||t.length===e))return t;e!==void 0&&N(e,"length");let o=W(t),r=e!==void 0?` of length ${e}`:"",i=o?`length=${t.length}`:`type=${typeof t}`,f=M(n)+"expected Uint8Array"+r+", got "+i;throw o?new RangeError(f):new TypeError(f)}function R(t,e=!0){if(t.destroyed)throw new Error("hash was destroyed");if(e&&t.finished)throw new Error("digest() was already called")}function Et(t,e){w(t,void 0,"output");let n=e.outputLen;if(!(t.length>=n))throw new RangeError('"output" expected length >= '+n)}function H(t,e){if(Et(t,e),!I(t))throw new Error("invalid output, must be aligned")}function X(t){return new Uint8Array(t.buffer,t.byteOffset,t.byteLength)}function U(t){return new Uint32Array(t.buffer,t.byteOffset,Math.floor(t.byteLength/4))}function L(...t){for(let e=0;e<t.length;e++)t[e].fill(0)}function v(t){return new DataView(t.buffer,t.byteOffset,t.byteLength)}var C=new Uint8Array(new Uint32Array([287454020]).buffer)[0]===68;function q(t){return t<<24&4278190080|t<<8&16711680|t>>>8&65280|t>>>24&255}var p=C?t=>t:t=>q(t)>>>0;function At(t){for(let e=0;e<t.length;e++)t[e]=q(t[e]);return t}var O=C?t=>t:At;function tt(t,e){if(t=w(t),e=w(e),t.length!==e.length)return!1;let n=0;for(let o=0;o<t.length;o++)n|=t[o]^e[o];return n===0}function Y(t,e,n){let o=e,r=n||(()=>[]),i=(c,s)=>o(s,...r(c)).update(c).digest(),f=o(new Uint8Array(t),...r(new Uint8Array(0)));return i.outputLen=f.outputLen,i.blockLen=f.blockLen,i.create=(c,...s)=>o(c,...s),i}var et=(t,e)=>{function n(o,...r){if(w(o,void 0,"key"),t.nonceLength!==void 0){let h=r[0];w(h,t.varSizeNonce?void 0:t.nonceLength,"nonce")}let i=t.tagLength,f=t.nonceLength!==void 0?1:0;if(!t.withAAD){for(let h=f;h<r.length;h++)if(W(r[h]))throw new Error("AAD not supported")}t.withAAD&&r[f]!==void 0&&w(r[f],void 0,"AAD");let c=e(o,...r),s=(h,l)=>{if(l!==void 0){if(h!==2)throw new Error("cipher output not supported");w(l,void 0,"output")}},u=!1;return{encrypt(h,l){if(u)throw new Error("cannot encrypt() twice with same key + nonce");return u=!0,w(h,void 0,"data"),s(c.encrypt.length,l),c.encrypt(h,l)},decrypt(h,l){if(w(h,void 0,"data"),i&&h.length<i)throw new Error('"ciphertext" expected length >= tagLength='+i);return s(c.decrypt.length,l),c.decrypt(h,l)}}}return Object.assign(n,t),n};function nt(t,e,n=!0){if(e===void 0)return new Uint8Array(t);if(w(e,t,"output"),n&&!I(e))throw new Error("invalid output, must be aligned");return e}function ot(t,e,n){N(t),N(e),xt(n);let o=new Uint8Array(16),r=v(o);return r.setBigUint64(0,BigInt(e),n),r.setBigUint64(8,BigInt(t),n),o}function I(t){return t.byteOffset%4===0}function B(t){return Uint8Array.from(w(t))}var T=16,rt=new Uint8Array(16),k=U(rt),mt=225,Lt=(t,e,n,o)=>{let r=o&1;return{s3:n<<31|o>>>1,s2:e<<31|n>>>1,s1:t<<31|e>>>1,s0:t>>>1^mt<<24&-(r&1)}},P=t=>(t>>>0&255)<<24|(t>>>8&255)<<16|(t>>>16&255)<<8|t>>>24&255|0;var Ut=t=>t>64*1024?8:t>1024?4:2,Z=class{constructor(e,n){b(this,"blockLen",T);b(this,"outputLen",T);b(this,"s0",0);b(this,"s1",0);b(this,"s2",0);b(this,"s3",0);b(this,"finished",!1);b(this,"destroyed",!1);b(this,"t");b(this,"W");b(this,"windowSize");w(e,16,"key"),e=B(e);let o=v(e),r=o.getUint32(0,!1),i=o.getUint32(4,!1),f=o.getUint32(8,!1),c=o.getUint32(12,!1),s=[];for(let g=0;g<128;g++)s.push({s0:P(r),s1:P(i),s2:P(f),s3:P(c)}),{s0:r,s1:i,s2:f,s3:c}=Lt(r,i,f,c);let u=Ut(n||1024);if(![1,2,4,8].includes(u))throw new Error("ghash: invalid window size, expected 2, 4 or 8");this.W=u;let h=128/u,l=this.windowSize=2**u,y=[];for(let g=0;g<h;g++)for(let d=0;d<l;d++){let x=0,E=0,A=0,S=0;for(let m=0;m<u;m++){if(!(d>>>u-m-1&1))continue;let{s0:$,s1:ut,s2:ht,s3:lt}=s[u*g+m];x^=$,E^=ut,A^=ht,S^=lt}y.push({s0:x,s1:E,s2:A,s3:S})}this.t=y}_updateBlock(e,n,o,r){e^=this.s0,n^=this.s1,o^=this.s2,r^=this.s3;let{W:i,t:f,windowSize:c}=this,s=0,u=0,a=0,h=0,l=(1<<i)-1,y=0;for(let g of[e,n,o,r])for(let d=0;d<4;d++){let x=g>>>8*d&255;for(let E=8/i-1;E>=0;E--){let A=x>>>i*E&l,{s0:S,s1:m,s2:_,s3:$}=f[y*c+A];s^=S,u^=m,a^=_,h^=$,y+=1}}this.s0=s,this.s1=u,this.s2=a,this.s3=h}update(e){R(this),w(e),e=B(e);let n=U(e),o=Math.floor(e.length/T),r=e.length%T;for(let i=0;i<o;i++)this._updateBlock(p(n[i*4+0]),p(n[i*4+1]),p(n[i*4+2]),p(n[i*4+3]));return r&&(rt.set(e.subarray(o*T)),this._updateBlock(p(k[0]),p(k[1]),p(k[2]),p(k[3])),L(k)),this}destroy(){this.destroyed=!0;let{t:e}=this;for(let n of e)n.s0=0,n.s1=0,n.s2=0,n.s3=0}digestInto(e){R(this),H(e,this),this.finished=!0;let{s0:n,s1:o,s2:r,s3:i}=this,f=U(e);f[0]=n,f[1]=o,f[2]=r,f[3]=i,C||O(f.subarray(0,T/4))}digest(){let e=new Uint8Array(T);return this.digestInto(e),this.destroy(),e}};var G=Y(16,(t,e)=>new Z(t,e),t=>[t.length]);var J=16,Bt=4,j=new Uint8Array(J);var Tt=283;function St(t){if(![16,24,32].includes(t.length))throw new Error('"aes key" expected Uint8Array of length 16/24/32, got length='+t.length)}function Q(t){return t<<1^Tt&-(t>>7)}function st(t,e){let n=0;for(;e>0;e>>=1)n^=t&-(e&1),t=Q(t);return n}var vt=(()=>{let t=new Uint8Array(256);for(let n=0,o=1;n<256;n++,o^=Q(o))t[n]=o;let e=new Uint8Array(256);e[0]=99;for(let n=0;n<255;n++){let o=t[255-n];o|=o<<8,e[t[n]]=(o^o>>4^o>>5^o>>6^o>>7^99)&255}return L(t),e})();var Ct=t=>t<<24|t>>>8,F=t=>t<<8|t>>>24;function It(t,e){if(t.length!==256)throw new Error("wrong sbox length");let n=new Uint32Array(256).map((u,a)=>e(t[a])),o=n.map(F),r=o.map(F),i=r.map(F),f=new Uint32Array(256*256),c=new Uint32Array(256*256),s=new Uint16Array(256*256);for(let u=0;u<256;u++)for(let a=0;a<256;a++){let h=u*256+a;f[h]=n[u]^o[a],c[h]=r[u]^i[a],s[h]=t[u]<<8|t[a]}return{sbox:t,sbox2:s,T0:n,T1:o,T2:r,T3:i,T01:f,T23:c}}var it=It(vt,t=>st(t,3)<<24|t<<16|t<<8|st(t,2));var _t=(()=>{let t=new Uint8Array(16);for(let e=0,n=1;e<16;e++,n=Q(n))t[e]=n;return t})();function Ot(t){w(t);let e=t.length;St(t);let{sbox2:n}=it,o=[];(!C||!I(t))&&o.push(t=B(t));let r=O(U(t)),i=r.length,f=s=>K(n,s,s,s,s),c=new Uint32Array(e+28);c.set(r);for(let s=i;s<c.length;s++){let u=c[s-1];s%i===0?u=f(Ct(u))^_t[s/i-1]:i>6&&s%i===4&&(u=f(u)),c[s]=c[s-i]^u}return L(...o),c}function D(t,e,n,o,r,i){return t[n<<8&65280|o>>>8&255]^e[r>>>8&65280|i>>>24&255]}function K(t,e,n,o,r){return t[e&255|n&65280]|t[o>>>16&255|r>>>16&65280]<<16}function ct(t,e,n,o,r){let{sbox2:i,T01:f,T23:c}=it,s=0;e^=t[s++],n^=t[s++],o^=t[s++],r^=t[s++];let u=t.length/4-2;for(let g=0;g<u;g++){let d=t[s++]^D(f,c,e,n,o,r),x=t[s++]^D(f,c,n,o,r,e),E=t[s++]^D(f,c,o,r,e,n),A=t[s++]^D(f,c,r,e,n,o);e=d,n=x,o=E,r=A}let a=t[s++]^K(i,e,n,o,r),h=t[s++]^K(i,n,o,r,e),l=t[s++]^K(i,o,r,e,n),y=t[s++]^K(i,r,e,n,o);return{s0:a,s1:h,s2:l,s3:y}}function V(t,e,n,o,r){w(n,J,"nonce"),w(o),r=nt(o.length,r);let i=n,f=U(i),c=v(i),s=U(o),u=U(r),a=e?0:12,h=o.length,l=c.getUint32(a,e);for(let g=0;g+4<=s.length;g+=4){let{s0:d,s1:x,s2:E,s3:A}=ct(t,p(f[0]),p(f[1]),p(f[2]),p(f[3]));u[g+0]=s[g+0]^p(d),u[g+1]=s[g+1]^p(x),u[g+2]=s[g+2]^p(E),u[g+3]=s[g+3]^p(A),l=l+1>>>0,c.setUint32(a,l,e)}let y=J*Math.floor(s.length/Bt);if(y<h){let{s0:g,s1:d,s2:x,s3:E}=ct(t,p(f[0]),p(f[1]),p(f[2]),p(f[3])),A=new Uint32Array([g,d,x,E]);O(A);let S=X(A);for(let m=y,_=0;m<h;m++,_++)r[m]=o[m]^S[_];L(A)}return r}function kt(t,e,n,o,r){let i=r?r.length:0,f=t.create(n,o.length+i);r&&f.update(r);let c=ot(8*o.length,8*i,e);f.update(o),f.update(c);let s=f.digest();return L(c),s}var ft=et({blockSize:16,nonceLength:12,tagLength:16,withAAD:!0,varSizeNonce:!0},function(e,n,o){if(n.length<8)throw new Error("aes/gcm: invalid nonce length");let r=16;function i(c,s,u){let a=kt(G,!1,c,u,o);for(let h=0;h<s.length;h++)a[h]^=s[h];return a}function f(){let c=Ot(e),s=j.slice(),u=j.slice();if(V(c,!1,u,u,s),n.length===12)u.set(n);else{let h=j.slice();v(h).setBigUint64(8,BigInt(n.length*8),!1);let y=G.create(s).update(n).update(h);y.digestInto(u),y.destroy()}let a=V(c,!1,u,j);return{xk:c,authKey:s,counter:u,tagMask:a}}return{encrypt(c){let{xk:s,authKey:u,counter:a,tagMask:h}=f(),l=new Uint8Array(c.length+r),y=[s,u,a,h];I(c)||y.push(c=B(c)),V(s,!1,a,c,l.subarray(0,c.length));let g=i(u,h,l.subarray(0,l.length-r));return y.push(g),l.set(g,c.length),L(...y),l},decrypt(c){let{xk:s,authKey:u,counter:a,tagMask:h}=f(),l=[s,u,h,a];I(c)||l.push(c=B(c));let y=c.subarray(0,-r),g=c.subarray(-r),d=i(u,h,y);if(l.push(d),!tt(d,g))throw L(...l),new Error("aes-gcm: invalid tag");let x=V(s,!1,a,y);return L(...l),x}}});return bt(Kt);})();
/*! Bundled license information:

@noble/ciphers/utils.js:
  (*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) *)
*/
