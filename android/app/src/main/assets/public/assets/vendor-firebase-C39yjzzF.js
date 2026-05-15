import{ac as Cy,_ as tu}from"./vendor-C0xU1d2O.js";const ky=()=>{};var Ch={};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xf=function(r){const e=[];let t=0;for(let n=0;n<r.length;n++){let s=r.charCodeAt(n);s<128?e[t++]=s:s<2048?(e[t++]=s>>6|192,e[t++]=s&63|128):(s&64512)===55296&&n+1<r.length&&(r.charCodeAt(n+1)&64512)===56320?(s=65536+((s&1023)<<10)+(r.charCodeAt(++n)&1023),e[t++]=s>>18|240,e[t++]=s>>12&63|128,e[t++]=s>>6&63|128,e[t++]=s&63|128):(e[t++]=s>>12|224,e[t++]=s>>6&63|128,e[t++]=s&63|128)}return e},Vy=function(r){const e=[];let t=0,n=0;for(;t<r.length;){const s=r[t++];if(s<128)e[n++]=String.fromCharCode(s);else if(s>191&&s<224){const i=r[t++];e[n++]=String.fromCharCode((s&31)<<6|i&63)}else if(s>239&&s<365){const i=r[t++],o=r[t++],c=r[t++],u=((s&7)<<18|(i&63)<<12|(o&63)<<6|c&63)-65536;e[n++]=String.fromCharCode(55296+(u>>10)),e[n++]=String.fromCharCode(56320+(u&1023))}else{const i=r[t++],o=r[t++];e[n++]=String.fromCharCode((s&15)<<12|(i&63)<<6|o&63)}}return e.join("")},Of={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(r,e){if(!Array.isArray(r))throw Error("encodeByteArray takes an array as a parameter");this.init_();const t=e?this.byteToCharMapWebSafe_:this.byteToCharMap_,n=[];for(let s=0;s<r.length;s+=3){const i=r[s],o=s+1<r.length,c=o?r[s+1]:0,u=s+2<r.length,h=u?r[s+2]:0,f=i>>2,p=(i&3)<<4|c>>4;let m=(c&15)<<2|h>>6,T=h&63;u||(T=64,o||(m=64)),n.push(t[f],t[p],t[m],t[T])}return n.join("")},encodeString(r,e){return this.HAS_NATIVE_SUPPORT&&!e?btoa(r):this.encodeByteArray(xf(r),e)},decodeString(r,e){return this.HAS_NATIVE_SUPPORT&&!e?atob(r):Vy(this.decodeStringToByteArray(r,e))},decodeStringToByteArray(r,e){this.init_();const t=e?this.charToByteMapWebSafe_:this.charToByteMap_,n=[];for(let s=0;s<r.length;){const i=t[r.charAt(s++)],c=s<r.length?t[r.charAt(s)]:0;++s;const h=s<r.length?t[r.charAt(s)]:64;++s;const p=s<r.length?t[r.charAt(s)]:64;if(++s,i==null||c==null||h==null||p==null)throw new Dy;const m=i<<2|c>>4;if(n.push(m),h!==64){const T=c<<4&240|h>>2;if(n.push(T),p!==64){const P=h<<6&192|p;n.push(P)}}}return n},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let r=0;r<this.ENCODED_VALS.length;r++)this.byteToCharMap_[r]=this.ENCODED_VALS.charAt(r),this.charToByteMap_[this.byteToCharMap_[r]]=r,this.byteToCharMapWebSafe_[r]=this.ENCODED_VALS_WEBSAFE.charAt(r),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[r]]=r,r>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(r)]=r,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(r)]=r)}}};class Dy extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const Ny=function(r){const e=xf(r);return Of.encodeByteArray(e,!0)},Co=function(r){return Ny(r).replace(/\./g,"")},Mf=function(r){try{return Of.decodeString(r,!0)}catch(e){console.error("base64Decode failed: ",e)}return null};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Lf(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xy=()=>Lf().__FIREBASE_DEFAULTS__,Oy=()=>{if(typeof process>"u"||typeof Ch>"u")return;const r=Ch.__FIREBASE_DEFAULTS__;if(r)return JSON.parse(r)},My=()=>{if(typeof document>"u")return;let r;try{r=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const e=r&&Mf(r[1]);return e&&JSON.parse(e)},na=()=>{try{return ky()||xy()||Oy()||My()}catch(r){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${r}`);return}},Ff=r=>{var e,t;return(t=(e=na())===null||e===void 0?void 0:e.emulatorHosts)===null||t===void 0?void 0:t[r]},Uf=r=>{const e=Ff(r);if(!e)return;const t=e.lastIndexOf(":");if(t<=0||t+1===e.length)throw new Error(`Invalid host ${e} with no separate hostname and port!`);const n=parseInt(e.substring(t+1),10);return e[0]==="["?[e.substring(1,t-1),n]:[e.substring(0,t),n]},Bf=()=>{var r;return(r=na())===null||r===void 0?void 0:r.config},qf=r=>{var e;return(e=na())===null||e===void 0?void 0:e[`_${r}`]};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ly{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((e,t)=>{this.resolve=e,this.reject=t})}wrapCallback(e){return(t,n)=>{t?this.reject(t):this.resolve(n),typeof e=="function"&&(this.promise.catch(()=>{}),e.length===1?e(t):e(t,n))}}}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ft(r){try{return(r.startsWith("http://")||r.startsWith("https://")?new URL(r).hostname:r).endsWith(".cloudworkstations.dev")}catch{return!1}}async function ra(r){return(await fetch(r,{credentials:"include"})).ok}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function jf(r,e){if(r.uid)throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');const t={alg:"none",type:"JWT"},n=e||"demo-project",s=r.iat||0,i=r.sub||r.user_id;if(!i)throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");const o=Object.assign({iss:`https://securetoken.google.com/${n}`,aud:n,iat:s,exp:s+3600,auth_time:s,sub:i,user_id:i,firebase:{sign_in_provider:"custom",identities:{}}},r);return[Co(JSON.stringify(t)),Co(JSON.stringify(o)),""].join(".")}const js={};function Fy(){const r={prod:[],emulator:[]};for(const e of Object.keys(js))js[e]?r.emulator.push(e):r.prod.push(e);return r}function Uy(r){let e=document.getElementById(r),t=!1;return e||(e=document.createElement("div"),e.setAttribute("id",r),t=!0),{created:t,element:e}}let kh=!1;function nu(r,e){if(typeof window>"u"||typeof document>"u"||!Ft(window.location.host)||js[r]===e||js[r]||kh)return;js[r]=e;function t(m){return`__firebase__banner__${m}`}const n="__firebase__banner",i=Fy().prod.length>0;function o(){const m=document.getElementById(n);m&&m.remove()}function c(m){m.style.display="flex",m.style.background="#7faaf0",m.style.position="fixed",m.style.bottom="5px",m.style.left="5px",m.style.padding=".5em",m.style.borderRadius="5px",m.style.alignItems="center"}function u(m,T){m.setAttribute("width","24"),m.setAttribute("id",T),m.setAttribute("height","24"),m.setAttribute("viewBox","0 0 24 24"),m.setAttribute("fill","none"),m.style.marginLeft="-6px"}function h(){const m=document.createElement("span");return m.style.cursor="pointer",m.style.marginLeft="16px",m.style.fontSize="24px",m.innerHTML=" &times;",m.onclick=()=>{kh=!0,o()},m}function f(m,T){m.setAttribute("id",T),m.innerText="Learn more",m.href="https://firebase.google.com/docs/studio/preview-apps#preview-backend",m.setAttribute("target","__blank"),m.style.paddingLeft="5px",m.style.textDecoration="underline"}function p(){const m=Uy(n),T=t("text"),P=document.getElementById(T)||document.createElement("span"),V=t("learnmore"),C=document.getElementById(V)||document.createElement("a"),L=t("preprendIcon"),U=document.getElementById(L)||document.createElementNS("http://www.w3.org/2000/svg","svg");if(m.created){const x=m.element;c(x),f(C,V);const j=h();u(U,L),x.append(U,P,C,j),document.body.appendChild(x)}i?(P.innerText="Preview backend disconnected.",U.innerHTML=`<g clip-path="url(#clip0_6013_33858)">
<path d="M4.8 17.6L12 5.6L19.2 17.6H4.8ZM6.91667 16.4H17.0833L12 7.93333L6.91667 16.4ZM12 15.6C12.1667 15.6 12.3056 15.5444 12.4167 15.4333C12.5389 15.3111 12.6 15.1667 12.6 15C12.6 14.8333 12.5389 14.6944 12.4167 14.5833C12.3056 14.4611 12.1667 14.4 12 14.4C11.8333 14.4 11.6889 14.4611 11.5667 14.5833C11.4556 14.6944 11.4 14.8333 11.4 15C11.4 15.1667 11.4556 15.3111 11.5667 15.4333C11.6889 15.5444 11.8333 15.6 12 15.6ZM11.4 13.6H12.6V10.4H11.4V13.6Z" fill="#212121"/>
</g>
<defs>
<clipPath id="clip0_6013_33858">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>`):(U.innerHTML=`<g clip-path="url(#clip0_6083_34804)">
<path d="M11.4 15.2H12.6V11.2H11.4V15.2ZM12 10C12.1667 10 12.3056 9.94444 12.4167 9.83333C12.5389 9.71111 12.6 9.56667 12.6 9.4C12.6 9.23333 12.5389 9.09444 12.4167 8.98333C12.3056 8.86111 12.1667 8.8 12 8.8C11.8333 8.8 11.6889 8.86111 11.5667 8.98333C11.4556 9.09444 11.4 9.23333 11.4 9.4C11.4 9.56667 11.4556 9.71111 11.5667 9.83333C11.6889 9.94444 11.8333 10 12 10ZM12 18.4C11.1222 18.4 10.2944 18.2333 9.51667 17.9C8.73889 17.5667 8.05556 17.1111 7.46667 16.5333C6.88889 15.9444 6.43333 15.2611 6.1 14.4833C5.76667 13.7056 5.6 12.8778 5.6 12C5.6 11.1111 5.76667 10.2833 6.1 9.51667C6.43333 8.73889 6.88889 8.06111 7.46667 7.48333C8.05556 6.89444 8.73889 6.43333 9.51667 6.1C10.2944 5.76667 11.1222 5.6 12 5.6C12.8889 5.6 13.7167 5.76667 14.4833 6.1C15.2611 6.43333 15.9389 6.89444 16.5167 7.48333C17.1056 8.06111 17.5667 8.73889 17.9 9.51667C18.2333 10.2833 18.4 11.1111 18.4 12C18.4 12.8778 18.2333 13.7056 17.9 14.4833C17.5667 15.2611 17.1056 15.9444 16.5167 16.5333C15.9389 17.1111 15.2611 17.5667 14.4833 17.9C13.7167 18.2333 12.8889 18.4 12 18.4ZM12 17.2C13.4444 17.2 14.6722 16.6944 15.6833 15.6833C16.6944 14.6722 17.2 13.4444 17.2 12C17.2 10.5556 16.6944 9.32778 15.6833 8.31667C14.6722 7.30555 13.4444 6.8 12 6.8C10.5556 6.8 9.32778 7.30555 8.31667 8.31667C7.30556 9.32778 6.8 10.5556 6.8 12C6.8 13.4444 7.30556 14.6722 8.31667 15.6833C9.32778 16.6944 10.5556 17.2 12 17.2Z" fill="#212121"/>
</g>
<defs>
<clipPath id="clip0_6083_34804">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>`,P.innerText="Preview backend running in this workspace."),P.setAttribute("id",T)}document.readyState==="loading"?window.addEventListener("DOMContentLoaded",p):p()}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function we(){return typeof navigator<"u"&&typeof navigator.userAgent=="string"?navigator.userAgent:""}function By(){return typeof window<"u"&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(we())}function zf(){var r;const e=(r=na())===null||r===void 0?void 0:r.forceEnvironment;if(e==="node")return!0;if(e==="browser")return!1;try{return Object.prototype.toString.call(global.process)==="[object process]"}catch{return!1}}function qy(){return typeof navigator<"u"&&navigator.userAgent==="Cloudflare-Workers"}function jy(){const r=typeof chrome=="object"?chrome.runtime:typeof browser=="object"?browser.runtime:void 0;return typeof r=="object"&&r.id!==void 0}function zy(){return typeof navigator=="object"&&navigator.product==="ReactNative"}function $y(){const r=we();return r.indexOf("MSIE ")>=0||r.indexOf("Trident/")>=0}function $f(){return!zf()&&!!navigator.userAgent&&navigator.userAgent.includes("Safari")&&!navigator.userAgent.includes("Chrome")}function Gf(){return!zf()&&!!navigator.userAgent&&(navigator.userAgent.includes("Safari")||navigator.userAgent.includes("WebKit"))&&!navigator.userAgent.includes("Chrome")}function Kf(){try{return typeof indexedDB=="object"}catch{return!1}}function Gy(){return new Promise((r,e)=>{try{let t=!0;const n="validate-browser-context-for-indexeddb-analytics-module",s=self.indexedDB.open(n);s.onsuccess=()=>{s.result.close(),t||self.indexedDB.deleteDatabase(n),r(!0)},s.onupgradeneeded=()=>{t=!1},s.onerror=()=>{var i;e(((i=s.error)===null||i===void 0?void 0:i.message)||"")}}catch(t){e(t)}})}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ky="FirebaseError";class vt extends Error{constructor(e,t,n){super(t),this.code=e,this.customData=n,this.name=Ky,Object.setPrototypeOf(this,vt.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,gi.prototype.create)}}class gi{constructor(e,t,n){this.service=e,this.serviceName=t,this.errors=n}create(e,...t){const n=t[0]||{},s=`${this.service}/${e}`,i=this.errors[e],o=i?Wy(i,n):"Error",c=`${this.serviceName}: ${o} (${s}).`;return new vt(s,c,n)}}function Wy(r,e){return r.replace(Hy,(t,n)=>{const s=e[n];return s!=null?String(s):`<${n}?>`})}const Hy=/\{\$([^}]+)}/g;function Qy(r){for(const e in r)if(Object.prototype.hasOwnProperty.call(r,e))return!1;return!0}function ht(r,e){if(r===e)return!0;const t=Object.keys(r),n=Object.keys(e);for(const s of t){if(!n.includes(s))return!1;const i=r[s],o=e[s];if(Vh(i)&&Vh(o)){if(!ht(i,o))return!1}else if(i!==o)return!1}for(const s of n)if(!t.includes(s))return!1;return!0}function Vh(r){return r!==null&&typeof r=="object"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function _i(r){const e=[];for(const[t,n]of Object.entries(r))Array.isArray(n)?n.forEach(s=>{e.push(encodeURIComponent(t)+"="+encodeURIComponent(s))}):e.push(encodeURIComponent(t)+"="+encodeURIComponent(n));return e.length?"&"+e.join("&"):""}function Ms(r){const e={};return r.replace(/^\?/,"").split("&").forEach(n=>{if(n){const[s,i]=n.split("=");e[decodeURIComponent(s)]=decodeURIComponent(i)}}),e}function Ls(r){const e=r.indexOf("?");if(!e)return"";const t=r.indexOf("#",e);return r.substring(e,t>0?t:void 0)}function Xy(r,e){const t=new Jy(r,e);return t.subscribe.bind(t)}class Jy{constructor(e,t){this.observers=[],this.unsubscribes=[],this.observerCount=0,this.task=Promise.resolve(),this.finalized=!1,this.onNoObservers=t,this.task.then(()=>{e(this)}).catch(n=>{this.error(n)})}next(e){this.forEachObserver(t=>{t.next(e)})}error(e){this.forEachObserver(t=>{t.error(e)}),this.close(e)}complete(){this.forEachObserver(e=>{e.complete()}),this.close()}subscribe(e,t,n){let s;if(e===void 0&&t===void 0&&n===void 0)throw new Error("Missing Observer.");Yy(e,["next","error","complete"])?s=e:s={next:e,error:t,complete:n},s.next===void 0&&(s.next=ic),s.error===void 0&&(s.error=ic),s.complete===void 0&&(s.complete=ic);const i=this.unsubscribeOne.bind(this,this.observers.length);return this.finalized&&this.task.then(()=>{try{this.finalError?s.error(this.finalError):s.complete()}catch{}}),this.observers.push(s),i}unsubscribeOne(e){this.observers===void 0||this.observers[e]===void 0||(delete this.observers[e],this.observerCount-=1,this.observerCount===0&&this.onNoObservers!==void 0&&this.onNoObservers(this))}forEachObserver(e){if(!this.finalized)for(let t=0;t<this.observers.length;t++)this.sendOne(t,e)}sendOne(e,t){this.task.then(()=>{if(this.observers!==void 0&&this.observers[e]!==void 0)try{t(this.observers[e])}catch(n){typeof console<"u"&&console.error&&console.error(n)}})}close(e){this.finalized||(this.finalized=!0,e!==void 0&&(this.finalError=e),this.task.then(()=>{this.observers=void 0,this.onNoObservers=void 0}))}}function Yy(r,e){if(typeof r!="object"||r===null)return!1;for(const t of e)if(t in r&&typeof r[t]=="function")return!0;return!1}function ic(){}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Z(r){return r&&r._delegate?r._delegate:r}class hn{constructor(e,t,n){this.name=e,this.instanceFactory=t,this.type=n,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(e){return this.instantiationMode=e,this}setMultipleInstances(e){return this.multipleInstances=e,this}setServiceProps(e){return this.serviceProps=e,this}setInstanceCreatedCallback(e){return this.onInstanceCreated=e,this}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Nn="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zy{constructor(e,t){this.name=e,this.container=t,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(e){const t=this.normalizeInstanceIdentifier(e);if(!this.instancesDeferred.has(t)){const n=new Ly;if(this.instancesDeferred.set(t,n),this.isInitialized(t)||this.shouldAutoInitialize())try{const s=this.getOrInitializeService({instanceIdentifier:t});s&&n.resolve(s)}catch{}}return this.instancesDeferred.get(t).promise}getImmediate(e){var t;const n=this.normalizeInstanceIdentifier(e==null?void 0:e.identifier),s=(t=e==null?void 0:e.optional)!==null&&t!==void 0?t:!1;if(this.isInitialized(n)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:n})}catch(i){if(s)return null;throw i}else{if(s)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(e){if(e.name!==this.name)throw Error(`Mismatching Component ${e.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=e,!!this.shouldAutoInitialize()){if(tI(e))try{this.getOrInitializeService({instanceIdentifier:Nn})}catch{}for(const[t,n]of this.instancesDeferred.entries()){const s=this.normalizeInstanceIdentifier(t);try{const i=this.getOrInitializeService({instanceIdentifier:s});n.resolve(i)}catch{}}}}clearInstance(e=Nn){this.instancesDeferred.delete(e),this.instancesOptions.delete(e),this.instances.delete(e)}async delete(){const e=Array.from(this.instances.values());await Promise.all([...e.filter(t=>"INTERNAL"in t).map(t=>t.INTERNAL.delete()),...e.filter(t=>"_delete"in t).map(t=>t._delete())])}isComponentSet(){return this.component!=null}isInitialized(e=Nn){return this.instances.has(e)}getOptions(e=Nn){return this.instancesOptions.get(e)||{}}initialize(e={}){const{options:t={}}=e,n=this.normalizeInstanceIdentifier(e.instanceIdentifier);if(this.isInitialized(n))throw Error(`${this.name}(${n}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const s=this.getOrInitializeService({instanceIdentifier:n,options:t});for(const[i,o]of this.instancesDeferred.entries()){const c=this.normalizeInstanceIdentifier(i);n===c&&o.resolve(s)}return s}onInit(e,t){var n;const s=this.normalizeInstanceIdentifier(t),i=(n=this.onInitCallbacks.get(s))!==null&&n!==void 0?n:new Set;i.add(e),this.onInitCallbacks.set(s,i);const o=this.instances.get(s);return o&&e(o,s),()=>{i.delete(e)}}invokeOnInitCallbacks(e,t){const n=this.onInitCallbacks.get(t);if(n)for(const s of n)try{s(e,t)}catch{}}getOrInitializeService({instanceIdentifier:e,options:t={}}){let n=this.instances.get(e);if(!n&&this.component&&(n=this.component.instanceFactory(this.container,{instanceIdentifier:eI(e),options:t}),this.instances.set(e,n),this.instancesOptions.set(e,t),this.invokeOnInitCallbacks(n,e),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,e,n)}catch{}return n||null}normalizeInstanceIdentifier(e=Nn){return this.component?this.component.multipleInstances?e:Nn:e}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function eI(r){return r===Nn?void 0:r}function tI(r){return r.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class nI{constructor(e){this.name=e,this.providers=new Map}addComponent(e){const t=this.getProvider(e.name);if(t.isComponentSet())throw new Error(`Component ${e.name} has already been registered with ${this.name}`);t.setComponent(e)}addOrOverwriteComponent(e){this.getProvider(e.name).isComponentSet()&&this.providers.delete(e.name),this.addComponent(e)}getProvider(e){if(this.providers.has(e))return this.providers.get(e);const t=new Zy(e,this);return this.providers.set(e,t),t}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var J;(function(r){r[r.DEBUG=0]="DEBUG",r[r.VERBOSE=1]="VERBOSE",r[r.INFO=2]="INFO",r[r.WARN=3]="WARN",r[r.ERROR=4]="ERROR",r[r.SILENT=5]="SILENT"})(J||(J={}));const rI={debug:J.DEBUG,verbose:J.VERBOSE,info:J.INFO,warn:J.WARN,error:J.ERROR,silent:J.SILENT},sI=J.INFO,iI={[J.DEBUG]:"log",[J.VERBOSE]:"log",[J.INFO]:"info",[J.WARN]:"warn",[J.ERROR]:"error"},oI=(r,e,...t)=>{if(e<r.logLevel)return;const n=new Date().toISOString(),s=iI[e];if(s)console[s](`[${n}]  ${r.name}:`,...t);else throw new Error(`Attempted to log a message with an invalid logType (value: ${e})`)};class ru{constructor(e){this.name=e,this._logLevel=sI,this._logHandler=oI,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(e){if(!(e in J))throw new TypeError(`Invalid value "${e}" assigned to \`logLevel\``);this._logLevel=e}setLogLevel(e){this._logLevel=typeof e=="string"?rI[e]:e}get logHandler(){return this._logHandler}set logHandler(e){if(typeof e!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=e}get userLogHandler(){return this._userLogHandler}set userLogHandler(e){this._userLogHandler=e}debug(...e){this._userLogHandler&&this._userLogHandler(this,J.DEBUG,...e),this._logHandler(this,J.DEBUG,...e)}log(...e){this._userLogHandler&&this._userLogHandler(this,J.VERBOSE,...e),this._logHandler(this,J.VERBOSE,...e)}info(...e){this._userLogHandler&&this._userLogHandler(this,J.INFO,...e),this._logHandler(this,J.INFO,...e)}warn(...e){this._userLogHandler&&this._userLogHandler(this,J.WARN,...e),this._logHandler(this,J.WARN,...e)}error(...e){this._userLogHandler&&this._userLogHandler(this,J.ERROR,...e),this._logHandler(this,J.ERROR,...e)}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class aI{constructor(e){this.container=e}getPlatformInfoString(){return this.container.getProviders().map(t=>{if(cI(t)){const n=t.getImmediate();return`${n.library}/${n.version}`}else return null}).filter(t=>t).join(" ")}}function cI(r){const e=r.getComponent();return(e==null?void 0:e.type)==="VERSION"}const Tc="@firebase/app",Dh="0.13.2";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Nt=new ru("@firebase/app"),uI="@firebase/app-compat",lI="@firebase/analytics-compat",hI="@firebase/analytics",dI="@firebase/app-check-compat",fI="@firebase/app-check",pI="@firebase/auth",mI="@firebase/auth-compat",gI="@firebase/database",_I="@firebase/data-connect",yI="@firebase/database-compat",II="@firebase/functions",TI="@firebase/functions-compat",EI="@firebase/installations",vI="@firebase/installations-compat",wI="@firebase/messaging",AI="@firebase/messaging-compat",bI="@firebase/performance",RI="@firebase/performance-compat",SI="@firebase/remote-config",PI="@firebase/remote-config-compat",CI="@firebase/storage",kI="@firebase/storage-compat",VI="@firebase/firestore",DI="@firebase/ai",NI="@firebase/firestore-compat",xI="firebase",OI="11.10.0";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ko="[DEFAULT]",MI={[Tc]:"fire-core",[uI]:"fire-core-compat",[hI]:"fire-analytics",[lI]:"fire-analytics-compat",[fI]:"fire-app-check",[dI]:"fire-app-check-compat",[pI]:"fire-auth",[mI]:"fire-auth-compat",[gI]:"fire-rtdb",[_I]:"fire-data-connect",[yI]:"fire-rtdb-compat",[II]:"fire-fn",[TI]:"fire-fn-compat",[EI]:"fire-iid",[vI]:"fire-iid-compat",[wI]:"fire-fcm",[AI]:"fire-fcm-compat",[bI]:"fire-perf",[RI]:"fire-perf-compat",[SI]:"fire-rc",[PI]:"fire-rc-compat",[CI]:"fire-gcs",[kI]:"fire-gcs-compat",[VI]:"fire-fst",[NI]:"fire-fst-compat",[DI]:"fire-vertex","fire-js":"fire-js",[xI]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Vo=new Map,LI=new Map,Ec=new Map;function Nh(r,e){try{r.container.addComponent(e)}catch(t){Nt.debug(`Component ${e.name} failed to register with FirebaseApp ${r.name}`,t)}}function Wn(r){const e=r.name;if(Ec.has(e))return Nt.debug(`There were multiple attempts to register component ${e}.`),!1;Ec.set(e,r);for(const t of Vo.values())Nh(t,r);for(const t of LI.values())Nh(t,r);return!0}function Yr(r,e){const t=r.container.getProvider("heartbeat").getImmediate({optional:!0});return t&&t.triggerHeartbeat(),r.container.getProvider(e)}function FI(r,e,t=ko){Yr(r,e).clearInstance(t)}function $e(r){return r==null?!1:r.settings!==void 0}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const UI={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},cn=new gi("app","Firebase",UI);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class BI{constructor(e,t,n){this._isDeleted=!1,this._options=Object.assign({},e),this._config=Object.assign({},t),this._name=t.name,this._automaticDataCollectionEnabled=t.automaticDataCollectionEnabled,this._container=n,this.container.addComponent(new hn("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this.checkDestroyed(),this._automaticDataCollectionEnabled=e}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(e){this._isDeleted=e}checkDestroyed(){if(this.isDeleted)throw cn.create("app-deleted",{appName:this._name})}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ir=OI;function qI(r,e={}){let t=r;typeof e!="object"&&(e={name:e});const n=Object.assign({name:ko,automaticDataCollectionEnabled:!0},e),s=n.name;if(typeof s!="string"||!s)throw cn.create("bad-app-name",{appName:String(s)});if(t||(t=Bf()),!t)throw cn.create("no-options");const i=Vo.get(s);if(i){if(ht(t,i.options)&&ht(n,i.config))return i;throw cn.create("duplicate-app",{appName:s})}const o=new nI(s);for(const u of Ec.values())o.addComponent(u);const c=new BI(t,n,o);return Vo.set(s,c),c}function su(r=ko){const e=Vo.get(r);if(!e&&r===ko&&Bf())return qI();if(!e)throw cn.create("no-app",{appName:r});return e}function gt(r,e,t){var n;let s=(n=MI[r])!==null&&n!==void 0?n:r;t&&(s+=`-${t}`);const i=s.match(/\s|\//),o=e.match(/\s|\//);if(i||o){const c=[`Unable to register library "${s}" with version "${e}":`];i&&c.push(`library name "${s}" contains illegal characters (whitespace or "/")`),i&&o&&c.push("and"),o&&c.push(`version name "${e}" contains illegal characters (whitespace or "/")`),Nt.warn(c.join(" "));return}Wn(new hn(`${s}-version`,()=>({library:s,version:e}),"VERSION"))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const jI="firebase-heartbeat-database",zI=1,ei="firebase-heartbeat-store";let oc=null;function Wf(){return oc||(oc=Cy(jI,zI,{upgrade:(r,e)=>{switch(e){case 0:try{r.createObjectStore(ei)}catch(t){console.warn(t)}}}}).catch(r=>{throw cn.create("idb-open",{originalErrorMessage:r.message})})),oc}async function $I(r){try{const t=(await Wf()).transaction(ei),n=await t.objectStore(ei).get(Hf(r));return await t.done,n}catch(e){if(e instanceof vt)Nt.warn(e.message);else{const t=cn.create("idb-get",{originalErrorMessage:e==null?void 0:e.message});Nt.warn(t.message)}}}async function xh(r,e){try{const n=(await Wf()).transaction(ei,"readwrite");await n.objectStore(ei).put(e,Hf(r)),await n.done}catch(t){if(t instanceof vt)Nt.warn(t.message);else{const n=cn.create("idb-set",{originalErrorMessage:t==null?void 0:t.message});Nt.warn(n.message)}}}function Hf(r){return`${r.name}!${r.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const GI=1024,KI=30;class WI{constructor(e){this.container=e,this._heartbeatsCache=null;const t=this.container.getProvider("app").getImmediate();this._storage=new QI(t),this._heartbeatsCachePromise=this._storage.read().then(n=>(this._heartbeatsCache=n,n))}async triggerHeartbeat(){var e,t;try{const s=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),i=Oh();if(((e=this._heartbeatsCache)===null||e===void 0?void 0:e.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((t=this._heartbeatsCache)===null||t===void 0?void 0:t.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===i||this._heartbeatsCache.heartbeats.some(o=>o.date===i))return;if(this._heartbeatsCache.heartbeats.push({date:i,agent:s}),this._heartbeatsCache.heartbeats.length>KI){const o=XI(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(o,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(n){Nt.warn(n)}}async getHeartbeatsHeader(){var e;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((e=this._heartbeatsCache)===null||e===void 0?void 0:e.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const t=Oh(),{heartbeatsToSend:n,unsentEntries:s}=HI(this._heartbeatsCache.heartbeats),i=Co(JSON.stringify({version:2,heartbeats:n}));return this._heartbeatsCache.lastSentHeartbeatDate=t,s.length>0?(this._heartbeatsCache.heartbeats=s,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),i}catch(t){return Nt.warn(t),""}}}function Oh(){return new Date().toISOString().substring(0,10)}function HI(r,e=GI){const t=[];let n=r.slice();for(const s of r){const i=t.find(o=>o.agent===s.agent);if(i){if(i.dates.push(s.date),Mh(t)>e){i.dates.pop();break}}else if(t.push({agent:s.agent,dates:[s.date]}),Mh(t)>e){t.pop();break}n=n.slice(1)}return{heartbeatsToSend:t,unsentEntries:n}}class QI{constructor(e){this.app=e,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return Kf()?Gy().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const t=await $I(this.app);return t!=null&&t.heartbeats?t:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(e){var t;if(await this._canUseIndexedDBPromise){const s=await this.read();return xh(this.app,{lastSentHeartbeatDate:(t=e.lastSentHeartbeatDate)!==null&&t!==void 0?t:s.lastSentHeartbeatDate,heartbeats:e.heartbeats})}else return}async add(e){var t;if(await this._canUseIndexedDBPromise){const s=await this.read();return xh(this.app,{lastSentHeartbeatDate:(t=e.lastSentHeartbeatDate)!==null&&t!==void 0?t:s.lastSentHeartbeatDate,heartbeats:[...s.heartbeats,...e.heartbeats]})}else return}}function Mh(r){return Co(JSON.stringify({version:2,heartbeats:r})).length}function XI(r){if(r.length===0)return-1;let e=0,t=r[0].date;for(let n=1;n<r.length;n++)r[n].date<t&&(t=r[n].date,e=n);return e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function JI(r){Wn(new hn("platform-logger",e=>new aI(e),"PRIVATE")),Wn(new hn("heartbeat",e=>new WI(e),"PRIVATE")),gt(Tc,Dh,r),gt(Tc,Dh,"esm2017"),gt("fire-js","")}JI("");var YI="firebase",ZI="11.10.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */gt(YI,ZI,"app");function Qf(){return{"dependent-sdk-initialized-before-auth":"Another Firebase SDK was initialized and is trying to use Auth before Auth is initialized. Please be sure to call `initializeAuth` or `getAuth` before starting any other Firebase SDK."}}const eT=Qf,Xf=new gi("auth","Firebase",Qf());/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Do=new ru("@firebase/auth");function tT(r,...e){Do.logLevel<=J.WARN&&Do.warn(`Auth (${ir}): ${r}`,...e)}function mo(r,...e){Do.logLevel<=J.ERROR&&Do.error(`Auth (${ir}): ${r}`,...e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function rt(r,...e){throw ou(r,...e)}function ct(r,...e){return ou(r,...e)}function iu(r,e,t){const n=Object.assign(Object.assign({},eT()),{[e]:t});return new gi("auth","Firebase",n).create(e,{appName:r.name})}function _t(r){return iu(r,"operation-not-supported-in-this-environment","Operations that alter the current user are not supported in conjunction with FirebaseServerApp")}function nT(r,e,t){const n=t;if(!(e instanceof n))throw n.name!==e.constructor.name&&rt(r,"argument-error"),iu(r,"argument-error",`Type of ${e.constructor.name} does not match expected instance.Did you pass a reference from a different Auth SDK?`)}function ou(r,...e){if(typeof r!="string"){const t=e[0],n=[...e.slice(1)];return n[0]&&(n[0].appName=r.name),r._errorFactory.create(t,...n)}return Xf.create(r,...e)}function K(r,e,...t){if(!r)throw ou(e,...t)}function Pt(r){const e="INTERNAL ASSERTION FAILED: "+r;throw mo(e),new Error(e)}function xt(r,e){r||Pt(e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function vc(){var r;return typeof self<"u"&&((r=self.location)===null||r===void 0?void 0:r.href)||""}function rT(){return Lh()==="http:"||Lh()==="https:"}function Lh(){var r;return typeof self<"u"&&((r=self.location)===null||r===void 0?void 0:r.protocol)||null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function sT(){return typeof navigator<"u"&&navigator&&"onLine"in navigator&&typeof navigator.onLine=="boolean"&&(rT()||jy()||"connection"in navigator)?navigator.onLine:!0}function iT(){if(typeof navigator>"u")return null;const r=navigator;return r.languages&&r.languages[0]||r.language||null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class yi{constructor(e,t){this.shortDelay=e,this.longDelay=t,xt(t>e,"Short delay should be less than long delay!"),this.isMobile=By()||zy()}get(){return sT()?this.isMobile?this.longDelay:this.shortDelay:Math.min(5e3,this.shortDelay)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function au(r,e){xt(r.emulator,"Emulator should always be set here");const{url:t}=r.emulator;return e?`${t}${e.startsWith("/")?e.slice(1):e}`:t}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Jf{static initialize(e,t,n){this.fetchImpl=e,t&&(this.headersImpl=t),n&&(this.responseImpl=n)}static fetch(){if(this.fetchImpl)return this.fetchImpl;if(typeof self<"u"&&"fetch"in self)return self.fetch;if(typeof globalThis<"u"&&globalThis.fetch)return globalThis.fetch;if(typeof fetch<"u")return fetch;Pt("Could not find fetch implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}static headers(){if(this.headersImpl)return this.headersImpl;if(typeof self<"u"&&"Headers"in self)return self.Headers;if(typeof globalThis<"u"&&globalThis.Headers)return globalThis.Headers;if(typeof Headers<"u")return Headers;Pt("Could not find Headers implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}static response(){if(this.responseImpl)return this.responseImpl;if(typeof self<"u"&&"Response"in self)return self.Response;if(typeof globalThis<"u"&&globalThis.Response)return globalThis.Response;if(typeof Response<"u")return Response;Pt("Could not find Response implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const oT={CREDENTIAL_MISMATCH:"custom-token-mismatch",MISSING_CUSTOM_TOKEN:"internal-error",INVALID_IDENTIFIER:"invalid-email",MISSING_CONTINUE_URI:"internal-error",INVALID_PASSWORD:"wrong-password",MISSING_PASSWORD:"missing-password",INVALID_LOGIN_CREDENTIALS:"invalid-credential",EMAIL_EXISTS:"email-already-in-use",PASSWORD_LOGIN_DISABLED:"operation-not-allowed",INVALID_IDP_RESPONSE:"invalid-credential",INVALID_PENDING_TOKEN:"invalid-credential",FEDERATED_USER_ID_ALREADY_LINKED:"credential-already-in-use",MISSING_REQ_TYPE:"internal-error",EMAIL_NOT_FOUND:"user-not-found",RESET_PASSWORD_EXCEED_LIMIT:"too-many-requests",EXPIRED_OOB_CODE:"expired-action-code",INVALID_OOB_CODE:"invalid-action-code",MISSING_OOB_CODE:"internal-error",CREDENTIAL_TOO_OLD_LOGIN_AGAIN:"requires-recent-login",INVALID_ID_TOKEN:"invalid-user-token",TOKEN_EXPIRED:"user-token-expired",USER_NOT_FOUND:"user-token-expired",TOO_MANY_ATTEMPTS_TRY_LATER:"too-many-requests",PASSWORD_DOES_NOT_MEET_REQUIREMENTS:"password-does-not-meet-requirements",INVALID_CODE:"invalid-verification-code",INVALID_SESSION_INFO:"invalid-verification-id",INVALID_TEMPORARY_PROOF:"invalid-credential",MISSING_SESSION_INFO:"missing-verification-id",SESSION_EXPIRED:"code-expired",MISSING_ANDROID_PACKAGE_NAME:"missing-android-pkg-name",UNAUTHORIZED_DOMAIN:"unauthorized-continue-uri",INVALID_OAUTH_CLIENT_ID:"invalid-oauth-client-id",ADMIN_ONLY_OPERATION:"admin-restricted-operation",INVALID_MFA_PENDING_CREDENTIAL:"invalid-multi-factor-session",MFA_ENROLLMENT_NOT_FOUND:"multi-factor-info-not-found",MISSING_MFA_ENROLLMENT_ID:"missing-multi-factor-info",MISSING_MFA_PENDING_CREDENTIAL:"missing-multi-factor-session",SECOND_FACTOR_EXISTS:"second-factor-already-in-use",SECOND_FACTOR_LIMIT_EXCEEDED:"maximum-second-factor-count-exceeded",BLOCKING_FUNCTION_ERROR_RESPONSE:"internal-error",RECAPTCHA_NOT_ENABLED:"recaptcha-not-enabled",MISSING_RECAPTCHA_TOKEN:"missing-recaptcha-token",INVALID_RECAPTCHA_TOKEN:"invalid-recaptcha-token",INVALID_RECAPTCHA_ACTION:"invalid-recaptcha-action",MISSING_CLIENT_TYPE:"missing-client-type",MISSING_RECAPTCHA_VERSION:"missing-recaptcha-version",INVALID_RECAPTCHA_VERSION:"invalid-recaptcha-version",INVALID_REQ_TYPE:"invalid-req-type"};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const aT=["/v1/accounts:signInWithCustomToken","/v1/accounts:signInWithEmailLink","/v1/accounts:signInWithIdp","/v1/accounts:signInWithPassword","/v1/accounts:signInWithPhoneNumber","/v1/token"],cT=new yi(3e4,6e4);function Ut(r,e){return r.tenantId&&!e.tenantId?Object.assign(Object.assign({},e),{tenantId:r.tenantId}):e}async function Bt(r,e,t,n,s={}){return Yf(r,s,async()=>{let i={},o={};n&&(e==="GET"?o=n:i={body:JSON.stringify(n)});const c=_i(Object.assign({key:r.config.apiKey},o)).slice(1),u=await r._getAdditionalHeaders();u["Content-Type"]="application/json",r.languageCode&&(u["X-Firebase-Locale"]=r.languageCode);const h=Object.assign({method:e,headers:u},i);return qy()||(h.referrerPolicy="no-referrer"),r.emulatorConfig&&Ft(r.emulatorConfig.host)&&(h.credentials="include"),Jf.fetch()(await Zf(r,r.config.apiHost,t,c),h)})}async function Yf(r,e,t){r._canInitEmulator=!1;const n=Object.assign(Object.assign({},oT),e);try{const s=new lT(r),i=await Promise.race([t(),s.promise]);s.clearNetworkTimeout();const o=await i.json();if("needConfirmation"in o)throw ro(r,"account-exists-with-different-credential",o);if(i.ok&&!("errorMessage"in o))return o;{const c=i.ok?o.errorMessage:o.error.message,[u,h]=c.split(" : ");if(u==="FEDERATED_USER_ID_ALREADY_LINKED")throw ro(r,"credential-already-in-use",o);if(u==="EMAIL_EXISTS")throw ro(r,"email-already-in-use",o);if(u==="USER_DISABLED")throw ro(r,"user-disabled",o);const f=n[u]||u.toLowerCase().replace(/[_\s]+/g,"-");if(h)throw iu(r,f,h);rt(r,f)}}catch(s){if(s instanceof vt)throw s;rt(r,"network-request-failed",{message:String(s)})}}async function Ii(r,e,t,n,s={}){const i=await Bt(r,e,t,n,s);return"mfaPendingCredential"in i&&rt(r,"multi-factor-auth-required",{_serverResponse:i}),i}async function Zf(r,e,t,n){const s=`${e}${t}?${n}`,i=r,o=i.config.emulator?au(r.config,s):`${r.config.apiScheme}://${s}`;return aT.includes(t)&&(await i._persistenceManagerAvailable,i._getPersistenceType()==="COOKIE")?i._getPersistence()._getFinalTarget(o).toString():o}function uT(r){switch(r){case"ENFORCE":return"ENFORCE";case"AUDIT":return"AUDIT";case"OFF":return"OFF";default:return"ENFORCEMENT_STATE_UNSPECIFIED"}}class lT{clearNetworkTimeout(){clearTimeout(this.timer)}constructor(e){this.auth=e,this.timer=null,this.promise=new Promise((t,n)=>{this.timer=setTimeout(()=>n(ct(this.auth,"network-request-failed")),cT.get())})}}function ro(r,e,t){const n={appName:r.name};t.email&&(n.email=t.email),t.phoneNumber&&(n.phoneNumber=t.phoneNumber);const s=ct(r,e,n);return s.customData._tokenResponse=t,s}function Fh(r){return r!==void 0&&r.enterprise!==void 0}class hT{constructor(e){if(this.siteKey="",this.recaptchaEnforcementState=[],e.recaptchaKey===void 0)throw new Error("recaptchaKey undefined");this.siteKey=e.recaptchaKey.split("/")[3],this.recaptchaEnforcementState=e.recaptchaEnforcementState}getProviderEnforcementState(e){if(!this.recaptchaEnforcementState||this.recaptchaEnforcementState.length===0)return null;for(const t of this.recaptchaEnforcementState)if(t.provider&&t.provider===e)return uT(t.enforcementState);return null}isProviderEnabled(e){return this.getProviderEnforcementState(e)==="ENFORCE"||this.getProviderEnforcementState(e)==="AUDIT"}isAnyProviderEnabled(){return this.isProviderEnabled("EMAIL_PASSWORD_PROVIDER")||this.isProviderEnabled("PHONE_PROVIDER")}}async function dT(r,e){return Bt(r,"GET","/v2/recaptchaConfig",Ut(r,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function fT(r,e){return Bt(r,"POST","/v1/accounts:delete",e)}async function No(r,e){return Bt(r,"POST","/v1/accounts:lookup",e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function zs(r){if(r)try{const e=new Date(Number(r));if(!isNaN(e.getTime()))return e.toUTCString()}catch{}}async function pT(r,e=!1){const t=Z(r),n=await t.getIdToken(e),s=cu(n);K(s&&s.exp&&s.auth_time&&s.iat,t.auth,"internal-error");const i=typeof s.firebase=="object"?s.firebase:void 0,o=i==null?void 0:i.sign_in_provider;return{claims:s,token:n,authTime:zs(ac(s.auth_time)),issuedAtTime:zs(ac(s.iat)),expirationTime:zs(ac(s.exp)),signInProvider:o||null,signInSecondFactor:(i==null?void 0:i.sign_in_second_factor)||null}}function ac(r){return Number(r)*1e3}function cu(r){const[e,t,n]=r.split(".");if(e===void 0||t===void 0||n===void 0)return mo("JWT malformed, contained fewer than 3 sections"),null;try{const s=Mf(t);return s?JSON.parse(s):(mo("Failed to decode base64 JWT payload"),null)}catch(s){return mo("Caught error parsing JWT payload as JSON",s==null?void 0:s.toString()),null}}function Uh(r){const e=cu(r);return K(e,"internal-error"),K(typeof e.exp<"u","internal-error"),K(typeof e.iat<"u","internal-error"),Number(e.exp)-Number(e.iat)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ti(r,e,t=!1){if(t)return e;try{return await e}catch(n){throw n instanceof vt&&mT(n)&&r.auth.currentUser===r&&await r.auth.signOut(),n}}function mT({code:r}){return r==="auth/user-disabled"||r==="auth/user-token-expired"}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class gT{constructor(e){this.user=e,this.isRunning=!1,this.timerId=null,this.errorBackoff=3e4}_start(){this.isRunning||(this.isRunning=!0,this.schedule())}_stop(){this.isRunning&&(this.isRunning=!1,this.timerId!==null&&clearTimeout(this.timerId))}getInterval(e){var t;if(e){const n=this.errorBackoff;return this.errorBackoff=Math.min(this.errorBackoff*2,96e4),n}else{this.errorBackoff=3e4;const s=((t=this.user.stsTokenManager.expirationTime)!==null&&t!==void 0?t:0)-Date.now()-3e5;return Math.max(0,s)}}schedule(e=!1){if(!this.isRunning)return;const t=this.getInterval(e);this.timerId=setTimeout(async()=>{await this.iteration()},t)}async iteration(){try{await this.user.getIdToken(!0)}catch(e){(e==null?void 0:e.code)==="auth/network-request-failed"&&this.schedule(!0);return}this.schedule()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wc{constructor(e,t){this.createdAt=e,this.lastLoginAt=t,this._initializeTime()}_initializeTime(){this.lastSignInTime=zs(this.lastLoginAt),this.creationTime=zs(this.createdAt)}_copy(e){this.createdAt=e.createdAt,this.lastLoginAt=e.lastLoginAt,this._initializeTime()}toJSON(){return{createdAt:this.createdAt,lastLoginAt:this.lastLoginAt}}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function xo(r){var e;const t=r.auth,n=await r.getIdToken(),s=await ti(r,No(t,{idToken:n}));K(s==null?void 0:s.users.length,t,"internal-error");const i=s.users[0];r._notifyReloadListener(i);const o=!((e=i.providerUserInfo)===null||e===void 0)&&e.length?ep(i.providerUserInfo):[],c=yT(r.providerData,o),u=r.isAnonymous,h=!(r.email&&i.passwordHash)&&!(c!=null&&c.length),f=u?h:!1,p={uid:i.localId,displayName:i.displayName||null,photoURL:i.photoUrl||null,email:i.email||null,emailVerified:i.emailVerified||!1,phoneNumber:i.phoneNumber||null,tenantId:i.tenantId||null,providerData:c,metadata:new wc(i.createdAt,i.lastLoginAt),isAnonymous:f};Object.assign(r,p)}async function _T(r){const e=Z(r);await xo(e),await e.auth._persistUserIfCurrent(e),e.auth._notifyListenersIfCurrent(e)}function yT(r,e){return[...r.filter(n=>!e.some(s=>s.providerId===n.providerId)),...e]}function ep(r){return r.map(e=>{var{providerId:t}=e,n=tu(e,["providerId"]);return{providerId:t,uid:n.rawId||"",displayName:n.displayName||null,email:n.email||null,phoneNumber:n.phoneNumber||null,photoURL:n.photoUrl||null}})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function IT(r,e){const t=await Yf(r,{},async()=>{const n=_i({grant_type:"refresh_token",refresh_token:e}).slice(1),{tokenApiHost:s,apiKey:i}=r.config,o=await Zf(r,s,"/v1/token",`key=${i}`),c=await r._getAdditionalHeaders();c["Content-Type"]="application/x-www-form-urlencoded";const u={method:"POST",headers:c,body:n};return r.emulatorConfig&&Ft(r.emulatorConfig.host)&&(u.credentials="include"),Jf.fetch()(o,u)});return{accessToken:t.access_token,expiresIn:t.expires_in,refreshToken:t.refresh_token}}async function TT(r,e){return Bt(r,"POST","/v2/accounts:revokeToken",Ut(r,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Rr{constructor(){this.refreshToken=null,this.accessToken=null,this.expirationTime=null}get isExpired(){return!this.expirationTime||Date.now()>this.expirationTime-3e4}updateFromServerResponse(e){K(e.idToken,"internal-error"),K(typeof e.idToken<"u","internal-error"),K(typeof e.refreshToken<"u","internal-error");const t="expiresIn"in e&&typeof e.expiresIn<"u"?Number(e.expiresIn):Uh(e.idToken);this.updateTokensAndExpiration(e.idToken,e.refreshToken,t)}updateFromIdToken(e){K(e.length!==0,"internal-error");const t=Uh(e);this.updateTokensAndExpiration(e,null,t)}async getToken(e,t=!1){return!t&&this.accessToken&&!this.isExpired?this.accessToken:(K(this.refreshToken,e,"user-token-expired"),this.refreshToken?(await this.refresh(e,this.refreshToken),this.accessToken):null)}clearRefreshToken(){this.refreshToken=null}async refresh(e,t){const{accessToken:n,refreshToken:s,expiresIn:i}=await IT(e,t);this.updateTokensAndExpiration(n,s,Number(i))}updateTokensAndExpiration(e,t,n){this.refreshToken=t||null,this.accessToken=e||null,this.expirationTime=Date.now()+n*1e3}static fromJSON(e,t){const{refreshToken:n,accessToken:s,expirationTime:i}=t,o=new Rr;return n&&(K(typeof n=="string","internal-error",{appName:e}),o.refreshToken=n),s&&(K(typeof s=="string","internal-error",{appName:e}),o.accessToken=s),i&&(K(typeof i=="number","internal-error",{appName:e}),o.expirationTime=i),o}toJSON(){return{refreshToken:this.refreshToken,accessToken:this.accessToken,expirationTime:this.expirationTime}}_assign(e){this.accessToken=e.accessToken,this.refreshToken=e.refreshToken,this.expirationTime=e.expirationTime}_clone(){return Object.assign(new Rr,this.toJSON())}_performRefresh(){return Pt("not implemented")}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Qt(r,e){K(typeof r=="string"||typeof r>"u","internal-error",{appName:e})}class ot{constructor(e){var{uid:t,auth:n,stsTokenManager:s}=e,i=tu(e,["uid","auth","stsTokenManager"]);this.providerId="firebase",this.proactiveRefresh=new gT(this),this.reloadUserInfo=null,this.reloadListener=null,this.uid=t,this.auth=n,this.stsTokenManager=s,this.accessToken=s.accessToken,this.displayName=i.displayName||null,this.email=i.email||null,this.emailVerified=i.emailVerified||!1,this.phoneNumber=i.phoneNumber||null,this.photoURL=i.photoURL||null,this.isAnonymous=i.isAnonymous||!1,this.tenantId=i.tenantId||null,this.providerData=i.providerData?[...i.providerData]:[],this.metadata=new wc(i.createdAt||void 0,i.lastLoginAt||void 0)}async getIdToken(e){const t=await ti(this,this.stsTokenManager.getToken(this.auth,e));return K(t,this.auth,"internal-error"),this.accessToken!==t&&(this.accessToken=t,await this.auth._persistUserIfCurrent(this),this.auth._notifyListenersIfCurrent(this)),t}getIdTokenResult(e){return pT(this,e)}reload(){return _T(this)}_assign(e){this!==e&&(K(this.uid===e.uid,this.auth,"internal-error"),this.displayName=e.displayName,this.photoURL=e.photoURL,this.email=e.email,this.emailVerified=e.emailVerified,this.phoneNumber=e.phoneNumber,this.isAnonymous=e.isAnonymous,this.tenantId=e.tenantId,this.providerData=e.providerData.map(t=>Object.assign({},t)),this.metadata._copy(e.metadata),this.stsTokenManager._assign(e.stsTokenManager))}_clone(e){const t=new ot(Object.assign(Object.assign({},this),{auth:e,stsTokenManager:this.stsTokenManager._clone()}));return t.metadata._copy(this.metadata),t}_onReload(e){K(!this.reloadListener,this.auth,"internal-error"),this.reloadListener=e,this.reloadUserInfo&&(this._notifyReloadListener(this.reloadUserInfo),this.reloadUserInfo=null)}_notifyReloadListener(e){this.reloadListener?this.reloadListener(e):this.reloadUserInfo=e}_startProactiveRefresh(){this.proactiveRefresh._start()}_stopProactiveRefresh(){this.proactiveRefresh._stop()}async _updateTokensIfNecessary(e,t=!1){let n=!1;e.idToken&&e.idToken!==this.stsTokenManager.accessToken&&(this.stsTokenManager.updateFromServerResponse(e),n=!0),t&&await xo(this),await this.auth._persistUserIfCurrent(this),n&&this.auth._notifyListenersIfCurrent(this)}async delete(){if($e(this.auth.app))return Promise.reject(_t(this.auth));const e=await this.getIdToken();return await ti(this,fT(this.auth,{idToken:e})),this.stsTokenManager.clearRefreshToken(),this.auth.signOut()}toJSON(){return Object.assign(Object.assign({uid:this.uid,email:this.email||void 0,emailVerified:this.emailVerified,displayName:this.displayName||void 0,isAnonymous:this.isAnonymous,photoURL:this.photoURL||void 0,phoneNumber:this.phoneNumber||void 0,tenantId:this.tenantId||void 0,providerData:this.providerData.map(e=>Object.assign({},e)),stsTokenManager:this.stsTokenManager.toJSON(),_redirectEventId:this._redirectEventId},this.metadata.toJSON()),{apiKey:this.auth.config.apiKey,appName:this.auth.name})}get refreshToken(){return this.stsTokenManager.refreshToken||""}static _fromJSON(e,t){var n,s,i,o,c,u,h,f;const p=(n=t.displayName)!==null&&n!==void 0?n:void 0,m=(s=t.email)!==null&&s!==void 0?s:void 0,T=(i=t.phoneNumber)!==null&&i!==void 0?i:void 0,P=(o=t.photoURL)!==null&&o!==void 0?o:void 0,V=(c=t.tenantId)!==null&&c!==void 0?c:void 0,C=(u=t._redirectEventId)!==null&&u!==void 0?u:void 0,L=(h=t.createdAt)!==null&&h!==void 0?h:void 0,U=(f=t.lastLoginAt)!==null&&f!==void 0?f:void 0,{uid:x,emailVerified:j,isAnonymous:H,providerData:$,stsTokenManager:E}=t;K(x&&E,e,"internal-error");const _=Rr.fromJSON(this.name,E);K(typeof x=="string",e,"internal-error"),Qt(p,e.name),Qt(m,e.name),K(typeof j=="boolean",e,"internal-error"),K(typeof H=="boolean",e,"internal-error"),Qt(T,e.name),Qt(P,e.name),Qt(V,e.name),Qt(C,e.name),Qt(L,e.name),Qt(U,e.name);const y=new ot({uid:x,auth:e,email:m,emailVerified:j,displayName:p,isAnonymous:H,photoURL:P,phoneNumber:T,tenantId:V,stsTokenManager:_,createdAt:L,lastLoginAt:U});return $&&Array.isArray($)&&(y.providerData=$.map(v=>Object.assign({},v))),C&&(y._redirectEventId=C),y}static async _fromIdTokenResponse(e,t,n=!1){const s=new Rr;s.updateFromServerResponse(t);const i=new ot({uid:t.localId,auth:e,stsTokenManager:s,isAnonymous:n});return await xo(i),i}static async _fromGetAccountInfoResponse(e,t,n){const s=t.users[0];K(s.localId!==void 0,"internal-error");const i=s.providerUserInfo!==void 0?ep(s.providerUserInfo):[],o=!(s.email&&s.passwordHash)&&!(i!=null&&i.length),c=new Rr;c.updateFromIdToken(n);const u=new ot({uid:s.localId,auth:e,stsTokenManager:c,isAnonymous:o}),h={uid:s.localId,displayName:s.displayName||null,photoURL:s.photoUrl||null,email:s.email||null,emailVerified:s.emailVerified||!1,phoneNumber:s.phoneNumber||null,tenantId:s.tenantId||null,providerData:i,metadata:new wc(s.createdAt,s.lastLoginAt),isAnonymous:!(s.email&&s.passwordHash)&&!(i!=null&&i.length)};return Object.assign(u,h),u}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Bh=new Map;function Ct(r){xt(r instanceof Function,"Expected a class definition");let e=Bh.get(r);return e?(xt(e instanceof r,"Instance stored in cache mismatched with class"),e):(e=new r,Bh.set(r,e),e)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class tp{constructor(){this.type="NONE",this.storage={}}async _isAvailable(){return!0}async _set(e,t){this.storage[e]=t}async _get(e){const t=this.storage[e];return t===void 0?null:t}async _remove(e){delete this.storage[e]}_addListener(e,t){}_removeListener(e,t){}}tp.type="NONE";const qh=tp;/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function go(r,e,t){return`firebase:${r}:${e}:${t}`}class Sr{constructor(e,t,n){this.persistence=e,this.auth=t,this.userKey=n;const{config:s,name:i}=this.auth;this.fullUserKey=go(this.userKey,s.apiKey,i),this.fullPersistenceKey=go("persistence",s.apiKey,i),this.boundEventHandler=t._onStorageEvent.bind(t),this.persistence._addListener(this.fullUserKey,this.boundEventHandler)}setCurrentUser(e){return this.persistence._set(this.fullUserKey,e.toJSON())}async getCurrentUser(){const e=await this.persistence._get(this.fullUserKey);if(!e)return null;if(typeof e=="string"){const t=await No(this.auth,{idToken:e}).catch(()=>{});return t?ot._fromGetAccountInfoResponse(this.auth,t,e):null}return ot._fromJSON(this.auth,e)}removeCurrentUser(){return this.persistence._remove(this.fullUserKey)}savePersistenceForRedirect(){return this.persistence._set(this.fullPersistenceKey,this.persistence.type)}async setPersistence(e){if(this.persistence===e)return;const t=await this.getCurrentUser();if(await this.removeCurrentUser(),this.persistence=e,t)return this.setCurrentUser(t)}delete(){this.persistence._removeListener(this.fullUserKey,this.boundEventHandler)}static async create(e,t,n="authUser"){if(!t.length)return new Sr(Ct(qh),e,n);const s=(await Promise.all(t.map(async h=>{if(await h._isAvailable())return h}))).filter(h=>h);let i=s[0]||Ct(qh);const o=go(n,e.config.apiKey,e.name);let c=null;for(const h of t)try{const f=await h._get(o);if(f){let p;if(typeof f=="string"){const m=await No(e,{idToken:f}).catch(()=>{});if(!m)break;p=await ot._fromGetAccountInfoResponse(e,m,f)}else p=ot._fromJSON(e,f);h!==i&&(c=p),i=h;break}}catch{}const u=s.filter(h=>h._shouldAllowMigration);return!i._shouldAllowMigration||!u.length?new Sr(i,e,n):(i=u[0],c&&await i._set(o,c.toJSON()),await Promise.all(t.map(async h=>{if(h!==i)try{await h._remove(o)}catch{}})),new Sr(i,e,n))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function jh(r){const e=r.toLowerCase();if(e.includes("opera/")||e.includes("opr/")||e.includes("opios/"))return"Opera";if(ip(e))return"IEMobile";if(e.includes("msie")||e.includes("trident/"))return"IE";if(e.includes("edge/"))return"Edge";if(np(e))return"Firefox";if(e.includes("silk/"))return"Silk";if(ap(e))return"Blackberry";if(cp(e))return"Webos";if(rp(e))return"Safari";if((e.includes("chrome/")||sp(e))&&!e.includes("edge/"))return"Chrome";if(op(e))return"Android";{const t=/([a-zA-Z\d\.]+)\/[a-zA-Z\d\.]*$/,n=r.match(t);if((n==null?void 0:n.length)===2)return n[1]}return"Other"}function np(r=we()){return/firefox\//i.test(r)}function rp(r=we()){const e=r.toLowerCase();return e.includes("safari/")&&!e.includes("chrome/")&&!e.includes("crios/")&&!e.includes("android")}function sp(r=we()){return/crios\//i.test(r)}function ip(r=we()){return/iemobile/i.test(r)}function op(r=we()){return/android/i.test(r)}function ap(r=we()){return/blackberry/i.test(r)}function cp(r=we()){return/webos/i.test(r)}function uu(r=we()){return/iphone|ipad|ipod/i.test(r)||/macintosh/i.test(r)&&/mobile/i.test(r)}function ET(r=we()){var e;return uu(r)&&!!(!((e=window.navigator)===null||e===void 0)&&e.standalone)}function vT(){return $y()&&document.documentMode===10}function up(r=we()){return uu(r)||op(r)||cp(r)||ap(r)||/windows phone/i.test(r)||ip(r)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function lp(r,e=[]){let t;switch(r){case"Browser":t=jh(we());break;case"Worker":t=`${jh(we())}-${r}`;break;default:t=r}const n=e.length?e.join(","):"FirebaseCore-web";return`${t}/JsCore/${ir}/${n}`}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wT{constructor(e){this.auth=e,this.queue=[]}pushCallback(e,t){const n=i=>new Promise((o,c)=>{try{const u=e(i);o(u)}catch(u){c(u)}});n.onAbort=t,this.queue.push(n);const s=this.queue.length-1;return()=>{this.queue[s]=()=>Promise.resolve()}}async runMiddleware(e){if(this.auth.currentUser===e)return;const t=[];try{for(const n of this.queue)await n(e),n.onAbort&&t.push(n.onAbort)}catch(n){t.reverse();for(const s of t)try{s()}catch{}throw this.auth._errorFactory.create("login-blocked",{originalMessage:n==null?void 0:n.message})}}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function AT(r,e={}){return Bt(r,"GET","/v2/passwordPolicy",Ut(r,e))}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const bT=6;class RT{constructor(e){var t,n,s,i;const o=e.customStrengthOptions;this.customStrengthOptions={},this.customStrengthOptions.minPasswordLength=(t=o.minPasswordLength)!==null&&t!==void 0?t:bT,o.maxPasswordLength&&(this.customStrengthOptions.maxPasswordLength=o.maxPasswordLength),o.containsLowercaseCharacter!==void 0&&(this.customStrengthOptions.containsLowercaseLetter=o.containsLowercaseCharacter),o.containsUppercaseCharacter!==void 0&&(this.customStrengthOptions.containsUppercaseLetter=o.containsUppercaseCharacter),o.containsNumericCharacter!==void 0&&(this.customStrengthOptions.containsNumericCharacter=o.containsNumericCharacter),o.containsNonAlphanumericCharacter!==void 0&&(this.customStrengthOptions.containsNonAlphanumericCharacter=o.containsNonAlphanumericCharacter),this.enforcementState=e.enforcementState,this.enforcementState==="ENFORCEMENT_STATE_UNSPECIFIED"&&(this.enforcementState="OFF"),this.allowedNonAlphanumericCharacters=(s=(n=e.allowedNonAlphanumericCharacters)===null||n===void 0?void 0:n.join(""))!==null&&s!==void 0?s:"",this.forceUpgradeOnSignin=(i=e.forceUpgradeOnSignin)!==null&&i!==void 0?i:!1,this.schemaVersion=e.schemaVersion}validatePassword(e){var t,n,s,i,o,c;const u={isValid:!0,passwordPolicy:this};return this.validatePasswordLengthOptions(e,u),this.validatePasswordCharacterOptions(e,u),u.isValid&&(u.isValid=(t=u.meetsMinPasswordLength)!==null&&t!==void 0?t:!0),u.isValid&&(u.isValid=(n=u.meetsMaxPasswordLength)!==null&&n!==void 0?n:!0),u.isValid&&(u.isValid=(s=u.containsLowercaseLetter)!==null&&s!==void 0?s:!0),u.isValid&&(u.isValid=(i=u.containsUppercaseLetter)!==null&&i!==void 0?i:!0),u.isValid&&(u.isValid=(o=u.containsNumericCharacter)!==null&&o!==void 0?o:!0),u.isValid&&(u.isValid=(c=u.containsNonAlphanumericCharacter)!==null&&c!==void 0?c:!0),u}validatePasswordLengthOptions(e,t){const n=this.customStrengthOptions.minPasswordLength,s=this.customStrengthOptions.maxPasswordLength;n&&(t.meetsMinPasswordLength=e.length>=n),s&&(t.meetsMaxPasswordLength=e.length<=s)}validatePasswordCharacterOptions(e,t){this.updatePasswordCharacterOptionsStatuses(t,!1,!1,!1,!1);let n;for(let s=0;s<e.length;s++)n=e.charAt(s),this.updatePasswordCharacterOptionsStatuses(t,n>="a"&&n<="z",n>="A"&&n<="Z",n>="0"&&n<="9",this.allowedNonAlphanumericCharacters.includes(n))}updatePasswordCharacterOptionsStatuses(e,t,n,s,i){this.customStrengthOptions.containsLowercaseLetter&&(e.containsLowercaseLetter||(e.containsLowercaseLetter=t)),this.customStrengthOptions.containsUppercaseLetter&&(e.containsUppercaseLetter||(e.containsUppercaseLetter=n)),this.customStrengthOptions.containsNumericCharacter&&(e.containsNumericCharacter||(e.containsNumericCharacter=s)),this.customStrengthOptions.containsNonAlphanumericCharacter&&(e.containsNonAlphanumericCharacter||(e.containsNonAlphanumericCharacter=i))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ST{constructor(e,t,n,s){this.app=e,this.heartbeatServiceProvider=t,this.appCheckServiceProvider=n,this.config=s,this.currentUser=null,this.emulatorConfig=null,this.operations=Promise.resolve(),this.authStateSubscription=new zh(this),this.idTokenSubscription=new zh(this),this.beforeStateQueue=new wT(this),this.redirectUser=null,this.isProactiveRefreshEnabled=!1,this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION=1,this._canInitEmulator=!0,this._isInitialized=!1,this._deleted=!1,this._initializationPromise=null,this._popupRedirectResolver=null,this._errorFactory=Xf,this._agentRecaptchaConfig=null,this._tenantRecaptchaConfigs={},this._projectPasswordPolicy=null,this._tenantPasswordPolicies={},this._resolvePersistenceManagerAvailable=void 0,this.lastNotifiedUid=void 0,this.languageCode=null,this.tenantId=null,this.settings={appVerificationDisabledForTesting:!1},this.frameworks=[],this.name=e.name,this.clientVersion=s.sdkClientVersion,this._persistenceManagerAvailable=new Promise(i=>this._resolvePersistenceManagerAvailable=i)}_initializeWithPersistence(e,t){return t&&(this._popupRedirectResolver=Ct(t)),this._initializationPromise=this.queue(async()=>{var n,s,i;if(!this._deleted&&(this.persistenceManager=await Sr.create(this,e),(n=this._resolvePersistenceManagerAvailable)===null||n===void 0||n.call(this),!this._deleted)){if(!((s=this._popupRedirectResolver)===null||s===void 0)&&s._shouldInitProactively)try{await this._popupRedirectResolver._initialize(this)}catch{}await this.initializeCurrentUser(t),this.lastNotifiedUid=((i=this.currentUser)===null||i===void 0?void 0:i.uid)||null,!this._deleted&&(this._isInitialized=!0)}}),this._initializationPromise}async _onStorageEvent(){if(this._deleted)return;const e=await this.assertedPersistence.getCurrentUser();if(!(!this.currentUser&&!e)){if(this.currentUser&&e&&this.currentUser.uid===e.uid){this._currentUser._assign(e),await this.currentUser.getIdToken();return}await this._updateCurrentUser(e,!0)}}async initializeCurrentUserFromIdToken(e){try{const t=await No(this,{idToken:e}),n=await ot._fromGetAccountInfoResponse(this,t,e);await this.directlySetCurrentUser(n)}catch(t){console.warn("FirebaseServerApp could not login user with provided authIdToken: ",t),await this.directlySetCurrentUser(null)}}async initializeCurrentUser(e){var t;if($e(this.app)){const o=this.app.settings.authIdToken;return o?new Promise(c=>{setTimeout(()=>this.initializeCurrentUserFromIdToken(o).then(c,c))}):this.directlySetCurrentUser(null)}const n=await this.assertedPersistence.getCurrentUser();let s=n,i=!1;if(e&&this.config.authDomain){await this.getOrInitRedirectPersistenceManager();const o=(t=this.redirectUser)===null||t===void 0?void 0:t._redirectEventId,c=s==null?void 0:s._redirectEventId,u=await this.tryRedirectSignIn(e);(!o||o===c)&&(u!=null&&u.user)&&(s=u.user,i=!0)}if(!s)return this.directlySetCurrentUser(null);if(!s._redirectEventId){if(i)try{await this.beforeStateQueue.runMiddleware(s)}catch(o){s=n,this._popupRedirectResolver._overrideRedirectResult(this,()=>Promise.reject(o))}return s?this.reloadAndSetCurrentUserOrClear(s):this.directlySetCurrentUser(null)}return K(this._popupRedirectResolver,this,"argument-error"),await this.getOrInitRedirectPersistenceManager(),this.redirectUser&&this.redirectUser._redirectEventId===s._redirectEventId?this.directlySetCurrentUser(s):this.reloadAndSetCurrentUserOrClear(s)}async tryRedirectSignIn(e){let t=null;try{t=await this._popupRedirectResolver._completeRedirectFn(this,e,!0)}catch{await this._setRedirectUser(null)}return t}async reloadAndSetCurrentUserOrClear(e){try{await xo(e)}catch(t){if((t==null?void 0:t.code)!=="auth/network-request-failed")return this.directlySetCurrentUser(null)}return this.directlySetCurrentUser(e)}useDeviceLanguage(){this.languageCode=iT()}async _delete(){this._deleted=!0}async updateCurrentUser(e){if($e(this.app))return Promise.reject(_t(this));const t=e?Z(e):null;return t&&K(t.auth.config.apiKey===this.config.apiKey,this,"invalid-user-token"),this._updateCurrentUser(t&&t._clone(this))}async _updateCurrentUser(e,t=!1){if(!this._deleted)return e&&K(this.tenantId===e.tenantId,this,"tenant-id-mismatch"),t||await this.beforeStateQueue.runMiddleware(e),this.queue(async()=>{await this.directlySetCurrentUser(e),this.notifyAuthListeners()})}async signOut(){return $e(this.app)?Promise.reject(_t(this)):(await this.beforeStateQueue.runMiddleware(null),(this.redirectPersistenceManager||this._popupRedirectResolver)&&await this._setRedirectUser(null),this._updateCurrentUser(null,!0))}setPersistence(e){return $e(this.app)?Promise.reject(_t(this)):this.queue(async()=>{await this.assertedPersistence.setPersistence(Ct(e))})}_getRecaptchaConfig(){return this.tenantId==null?this._agentRecaptchaConfig:this._tenantRecaptchaConfigs[this.tenantId]}async validatePassword(e){this._getPasswordPolicyInternal()||await this._updatePasswordPolicy();const t=this._getPasswordPolicyInternal();return t.schemaVersion!==this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION?Promise.reject(this._errorFactory.create("unsupported-password-policy-schema-version",{})):t.validatePassword(e)}_getPasswordPolicyInternal(){return this.tenantId===null?this._projectPasswordPolicy:this._tenantPasswordPolicies[this.tenantId]}async _updatePasswordPolicy(){const e=await AT(this),t=new RT(e);this.tenantId===null?this._projectPasswordPolicy=t:this._tenantPasswordPolicies[this.tenantId]=t}_getPersistenceType(){return this.assertedPersistence.persistence.type}_getPersistence(){return this.assertedPersistence.persistence}_updateErrorMap(e){this._errorFactory=new gi("auth","Firebase",e())}onAuthStateChanged(e,t,n){return this.registerStateListener(this.authStateSubscription,e,t,n)}beforeAuthStateChanged(e,t){return this.beforeStateQueue.pushCallback(e,t)}onIdTokenChanged(e,t,n){return this.registerStateListener(this.idTokenSubscription,e,t,n)}authStateReady(){return new Promise((e,t)=>{if(this.currentUser)e();else{const n=this.onAuthStateChanged(()=>{n(),e()},t)}})}async revokeAccessToken(e){if(this.currentUser){const t=await this.currentUser.getIdToken(),n={providerId:"apple.com",tokenType:"ACCESS_TOKEN",token:e,idToken:t};this.tenantId!=null&&(n.tenantId=this.tenantId),await TT(this,n)}}toJSON(){var e;return{apiKey:this.config.apiKey,authDomain:this.config.authDomain,appName:this.name,currentUser:(e=this._currentUser)===null||e===void 0?void 0:e.toJSON()}}async _setRedirectUser(e,t){const n=await this.getOrInitRedirectPersistenceManager(t);return e===null?n.removeCurrentUser():n.setCurrentUser(e)}async getOrInitRedirectPersistenceManager(e){if(!this.redirectPersistenceManager){const t=e&&Ct(e)||this._popupRedirectResolver;K(t,this,"argument-error"),this.redirectPersistenceManager=await Sr.create(this,[Ct(t._redirectPersistence)],"redirectUser"),this.redirectUser=await this.redirectPersistenceManager.getCurrentUser()}return this.redirectPersistenceManager}async _redirectUserForId(e){var t,n;return this._isInitialized&&await this.queue(async()=>{}),((t=this._currentUser)===null||t===void 0?void 0:t._redirectEventId)===e?this._currentUser:((n=this.redirectUser)===null||n===void 0?void 0:n._redirectEventId)===e?this.redirectUser:null}async _persistUserIfCurrent(e){if(e===this.currentUser)return this.queue(async()=>this.directlySetCurrentUser(e))}_notifyListenersIfCurrent(e){e===this.currentUser&&this.notifyAuthListeners()}_key(){return`${this.config.authDomain}:${this.config.apiKey}:${this.name}`}_startProactiveRefresh(){this.isProactiveRefreshEnabled=!0,this.currentUser&&this._currentUser._startProactiveRefresh()}_stopProactiveRefresh(){this.isProactiveRefreshEnabled=!1,this.currentUser&&this._currentUser._stopProactiveRefresh()}get _currentUser(){return this.currentUser}notifyAuthListeners(){var e,t;if(!this._isInitialized)return;this.idTokenSubscription.next(this.currentUser);const n=(t=(e=this.currentUser)===null||e===void 0?void 0:e.uid)!==null&&t!==void 0?t:null;this.lastNotifiedUid!==n&&(this.lastNotifiedUid=n,this.authStateSubscription.next(this.currentUser))}registerStateListener(e,t,n,s){if(this._deleted)return()=>{};const i=typeof t=="function"?t:t.next.bind(t);let o=!1;const c=this._isInitialized?Promise.resolve():this._initializationPromise;if(K(c,this,"internal-error"),c.then(()=>{o||i(this.currentUser)}),typeof t=="function"){const u=e.addObserver(t,n,s);return()=>{o=!0,u()}}else{const u=e.addObserver(t);return()=>{o=!0,u()}}}async directlySetCurrentUser(e){this.currentUser&&this.currentUser!==e&&this._currentUser._stopProactiveRefresh(),e&&this.isProactiveRefreshEnabled&&e._startProactiveRefresh(),this.currentUser=e,e?await this.assertedPersistence.setCurrentUser(e):await this.assertedPersistence.removeCurrentUser()}queue(e){return this.operations=this.operations.then(e,e),this.operations}get assertedPersistence(){return K(this.persistenceManager,this,"internal-error"),this.persistenceManager}_logFramework(e){!e||this.frameworks.includes(e)||(this.frameworks.push(e),this.frameworks.sort(),this.clientVersion=lp(this.config.clientPlatform,this._getFrameworks()))}_getFrameworks(){return this.frameworks}async _getAdditionalHeaders(){var e;const t={"X-Client-Version":this.clientVersion};this.app.options.appId&&(t["X-Firebase-gmpid"]=this.app.options.appId);const n=await((e=this.heartbeatServiceProvider.getImmediate({optional:!0}))===null||e===void 0?void 0:e.getHeartbeatsHeader());n&&(t["X-Firebase-Client"]=n);const s=await this._getAppCheckToken();return s&&(t["X-Firebase-AppCheck"]=s),t}async _getAppCheckToken(){var e;if($e(this.app)&&this.app.settings.appCheckToken)return this.app.settings.appCheckToken;const t=await((e=this.appCheckServiceProvider.getImmediate({optional:!0}))===null||e===void 0?void 0:e.getToken());return t!=null&&t.error&&tT(`Error while retrieving App Check token: ${t.error}`),t==null?void 0:t.token}}function wt(r){return Z(r)}class zh{constructor(e){this.auth=e,this.observer=null,this.addObserver=Xy(t=>this.observer=t)}get next(){return K(this.observer,this.auth,"internal-error"),this.observer.next.bind(this.observer)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let sa={async loadJS(){throw new Error("Unable to load external scripts")},recaptchaV2Script:"",recaptchaEnterpriseScript:"",gapiScript:""};function PT(r){sa=r}function hp(r){return sa.loadJS(r)}function CT(){return sa.recaptchaEnterpriseScript}function kT(){return sa.gapiScript}function VT(r){return`__${r}${Math.floor(Math.random()*1e6)}`}class DT{constructor(){this.enterprise=new NT}ready(e){e()}execute(e,t){return Promise.resolve("token")}render(e,t){return""}}class NT{ready(e){e()}execute(e,t){return Promise.resolve("token")}render(e,t){return""}}const xT="recaptcha-enterprise",dp="NO_RECAPTCHA";class OT{constructor(e){this.type=xT,this.auth=wt(e)}async verify(e="verify",t=!1){async function n(i){if(!t){if(i.tenantId==null&&i._agentRecaptchaConfig!=null)return i._agentRecaptchaConfig.siteKey;if(i.tenantId!=null&&i._tenantRecaptchaConfigs[i.tenantId]!==void 0)return i._tenantRecaptchaConfigs[i.tenantId].siteKey}return new Promise(async(o,c)=>{dT(i,{clientType:"CLIENT_TYPE_WEB",version:"RECAPTCHA_ENTERPRISE"}).then(u=>{if(u.recaptchaKey===void 0)c(new Error("recaptcha Enterprise site key undefined"));else{const h=new hT(u);return i.tenantId==null?i._agentRecaptchaConfig=h:i._tenantRecaptchaConfigs[i.tenantId]=h,o(h.siteKey)}}).catch(u=>{c(u)})})}function s(i,o,c){const u=window.grecaptcha;Fh(u)?u.enterprise.ready(()=>{u.enterprise.execute(i,{action:e}).then(h=>{o(h)}).catch(()=>{o(dp)})}):c(Error("No reCAPTCHA enterprise script loaded."))}return this.auth.settings.appVerificationDisabledForTesting?new DT().execute("siteKey",{action:"verify"}):new Promise((i,o)=>{n(this.auth).then(c=>{if(!t&&Fh(window.grecaptcha))s(c,i,o);else{if(typeof window>"u"){o(new Error("RecaptchaVerifier is only supported in browser"));return}let u=CT();u.length!==0&&(u+=c),hp(u).then(()=>{s(c,i,o)}).catch(h=>{o(h)})}}).catch(c=>{o(c)})})}}async function $h(r,e,t,n=!1,s=!1){const i=new OT(r);let o;if(s)o=dp;else try{o=await i.verify(t)}catch{o=await i.verify(t,!0)}const c=Object.assign({},e);if(t==="mfaSmsEnrollment"||t==="mfaSmsSignIn"){if("phoneEnrollmentInfo"in c){const u=c.phoneEnrollmentInfo.phoneNumber,h=c.phoneEnrollmentInfo.recaptchaToken;Object.assign(c,{phoneEnrollmentInfo:{phoneNumber:u,recaptchaToken:h,captchaResponse:o,clientType:"CLIENT_TYPE_WEB",recaptchaVersion:"RECAPTCHA_ENTERPRISE"}})}else if("phoneSignInInfo"in c){const u=c.phoneSignInInfo.recaptchaToken;Object.assign(c,{phoneSignInInfo:{recaptchaToken:u,captchaResponse:o,clientType:"CLIENT_TYPE_WEB",recaptchaVersion:"RECAPTCHA_ENTERPRISE"}})}return c}return n?Object.assign(c,{captchaResp:o}):Object.assign(c,{captchaResponse:o}),Object.assign(c,{clientType:"CLIENT_TYPE_WEB"}),Object.assign(c,{recaptchaVersion:"RECAPTCHA_ENTERPRISE"}),c}async function Oo(r,e,t,n,s){var i;if(!((i=r._getRecaptchaConfig())===null||i===void 0)&&i.isProviderEnabled("EMAIL_PASSWORD_PROVIDER")){const o=await $h(r,e,t,t==="getOobCode");return n(r,o)}else return n(r,e).catch(async o=>{if(o.code==="auth/missing-recaptcha-token"){console.log(`${t} is protected by reCAPTCHA Enterprise for this project. Automatically triggering the reCAPTCHA flow and restarting the flow.`);const c=await $h(r,e,t,t==="getOobCode");return n(r,c)}else return Promise.reject(o)})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function MT(r,e){const t=Yr(r,"auth");if(t.isInitialized()){const s=t.getImmediate(),i=t.getOptions();if(ht(i,e??{}))return s;rt(s,"already-initialized")}return t.initialize({options:e})}function LT(r,e){const t=(e==null?void 0:e.persistence)||[],n=(Array.isArray(t)?t:[t]).map(Ct);e!=null&&e.errorMap&&r._updateErrorMap(e.errorMap),r._initializeWithPersistence(n,e==null?void 0:e.popupRedirectResolver)}function FT(r,e,t){const n=wt(r);K(/^https?:\/\//.test(e),n,"invalid-emulator-scheme");const s=!1,i=fp(e),{host:o,port:c}=UT(e),u=c===null?"":`:${c}`,h={url:`${i}//${o}${u}/`},f=Object.freeze({host:o,port:c,protocol:i.replace(":",""),options:Object.freeze({disableWarnings:s})});if(!n._canInitEmulator){K(n.config.emulator&&n.emulatorConfig,n,"emulator-config-failed"),K(ht(h,n.config.emulator)&&ht(f,n.emulatorConfig),n,"emulator-config-failed");return}n.config.emulator=h,n.emulatorConfig=f,n.settings.appVerificationDisabledForTesting=!0,Ft(o)?(ra(`${i}//${o}${u}`),nu("Auth",!0)):BT()}function fp(r){const e=r.indexOf(":");return e<0?"":r.substr(0,e+1)}function UT(r){const e=fp(r),t=/(\/\/)?([^?#/]+)/.exec(r.substr(e.length));if(!t)return{host:"",port:null};const n=t[2].split("@").pop()||"",s=/^(\[[^\]]+\])(:|$)/.exec(n);if(s){const i=s[1];return{host:i,port:Gh(n.substr(i.length+1))}}else{const[i,o]=n.split(":");return{host:i,port:Gh(o)}}}function Gh(r){if(!r)return null;const e=Number(r);return isNaN(e)?null:e}function BT(){function r(){const e=document.createElement("p"),t=e.style;e.innerText="Running in emulator mode. Do not use with production credentials.",t.position="fixed",t.width="100%",t.backgroundColor="#ffffff",t.border=".1em solid #000000",t.color="#b50000",t.bottom="0px",t.left="0px",t.margin="0px",t.zIndex="10000",t.textAlign="center",e.classList.add("firebase-emulator-warning"),document.body.appendChild(e)}typeof console<"u"&&typeof console.info=="function"&&console.info("WARNING: You are using the Auth Emulator, which is intended for local testing only.  Do not use with production credentials."),typeof window<"u"&&typeof document<"u"&&(document.readyState==="loading"?window.addEventListener("DOMContentLoaded",r):r())}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class lu{constructor(e,t){this.providerId=e,this.signInMethod=t}toJSON(){return Pt("not implemented")}_getIdTokenResponse(e){return Pt("not implemented")}_linkToIdToken(e,t){return Pt("not implemented")}_getReauthenticationResolver(e){return Pt("not implemented")}}async function qT(r,e){return Bt(r,"POST","/v1/accounts:signUp",e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function jT(r,e){return Ii(r,"POST","/v1/accounts:signInWithPassword",Ut(r,e))}async function pp(r,e){return Bt(r,"POST","/v1/accounts:sendOobCode",Ut(r,e))}async function zT(r,e){return pp(r,e)}async function $T(r,e){return pp(r,e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function GT(r,e){return Ii(r,"POST","/v1/accounts:signInWithEmailLink",Ut(r,e))}async function KT(r,e){return Ii(r,"POST","/v1/accounts:signInWithEmailLink",Ut(r,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ni extends lu{constructor(e,t,n,s=null){super("password",n),this._email=e,this._password=t,this._tenantId=s}static _fromEmailAndPassword(e,t){return new ni(e,t,"password")}static _fromEmailAndCode(e,t,n=null){return new ni(e,t,"emailLink",n)}toJSON(){return{email:this._email,password:this._password,signInMethod:this.signInMethod,tenantId:this._tenantId}}static fromJSON(e){const t=typeof e=="string"?JSON.parse(e):e;if(t!=null&&t.email&&(t!=null&&t.password)){if(t.signInMethod==="password")return this._fromEmailAndPassword(t.email,t.password);if(t.signInMethod==="emailLink")return this._fromEmailAndCode(t.email,t.password,t.tenantId)}return null}async _getIdTokenResponse(e){switch(this.signInMethod){case"password":const t={returnSecureToken:!0,email:this._email,password:this._password,clientType:"CLIENT_TYPE_WEB"};return Oo(e,t,"signInWithPassword",jT);case"emailLink":return GT(e,{email:this._email,oobCode:this._password});default:rt(e,"internal-error")}}async _linkToIdToken(e,t){switch(this.signInMethod){case"password":const n={idToken:t,returnSecureToken:!0,email:this._email,password:this._password,clientType:"CLIENT_TYPE_WEB"};return Oo(e,n,"signUpPassword",qT);case"emailLink":return KT(e,{idToken:t,email:this._email,oobCode:this._password});default:rt(e,"internal-error")}}_getReauthenticationResolver(e){return this._getIdTokenResponse(e)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Pr(r,e){return Ii(r,"POST","/v1/accounts:signInWithIdp",Ut(r,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const WT="http://localhost";class Hn extends lu{constructor(){super(...arguments),this.pendingToken=null}static _fromParams(e){const t=new Hn(e.providerId,e.signInMethod);return e.idToken||e.accessToken?(e.idToken&&(t.idToken=e.idToken),e.accessToken&&(t.accessToken=e.accessToken),e.nonce&&!e.pendingToken&&(t.nonce=e.nonce),e.pendingToken&&(t.pendingToken=e.pendingToken)):e.oauthToken&&e.oauthTokenSecret?(t.accessToken=e.oauthToken,t.secret=e.oauthTokenSecret):rt("argument-error"),t}toJSON(){return{idToken:this.idToken,accessToken:this.accessToken,secret:this.secret,nonce:this.nonce,pendingToken:this.pendingToken,providerId:this.providerId,signInMethod:this.signInMethod}}static fromJSON(e){const t=typeof e=="string"?JSON.parse(e):e,{providerId:n,signInMethod:s}=t,i=tu(t,["providerId","signInMethod"]);if(!n||!s)return null;const o=new Hn(n,s);return o.idToken=i.idToken||void 0,o.accessToken=i.accessToken||void 0,o.secret=i.secret,o.nonce=i.nonce,o.pendingToken=i.pendingToken||null,o}_getIdTokenResponse(e){const t=this.buildRequest();return Pr(e,t)}_linkToIdToken(e,t){const n=this.buildRequest();return n.idToken=t,Pr(e,n)}_getReauthenticationResolver(e){const t=this.buildRequest();return t.autoCreate=!1,Pr(e,t)}buildRequest(){const e={requestUri:WT,returnSecureToken:!0};if(this.pendingToken)e.pendingToken=this.pendingToken;else{const t={};this.idToken&&(t.id_token=this.idToken),this.accessToken&&(t.access_token=this.accessToken),this.secret&&(t.oauth_token_secret=this.secret),t.providerId=this.providerId,this.nonce&&!this.pendingToken&&(t.nonce=this.nonce),e.postBody=_i(t)}return e}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function HT(r){switch(r){case"recoverEmail":return"RECOVER_EMAIL";case"resetPassword":return"PASSWORD_RESET";case"signIn":return"EMAIL_SIGNIN";case"verifyEmail":return"VERIFY_EMAIL";case"verifyAndChangeEmail":return"VERIFY_AND_CHANGE_EMAIL";case"revertSecondFactorAddition":return"REVERT_SECOND_FACTOR_ADDITION";default:return null}}function QT(r){const e=Ms(Ls(r)).link,t=e?Ms(Ls(e)).deep_link_id:null,n=Ms(Ls(r)).deep_link_id;return(n?Ms(Ls(n)).link:null)||n||t||e||r}class hu{constructor(e){var t,n,s,i,o,c;const u=Ms(Ls(e)),h=(t=u.apiKey)!==null&&t!==void 0?t:null,f=(n=u.oobCode)!==null&&n!==void 0?n:null,p=HT((s=u.mode)!==null&&s!==void 0?s:null);K(h&&f&&p,"argument-error"),this.apiKey=h,this.operation=p,this.code=f,this.continueUrl=(i=u.continueUrl)!==null&&i!==void 0?i:null,this.languageCode=(o=u.lang)!==null&&o!==void 0?o:null,this.tenantId=(c=u.tenantId)!==null&&c!==void 0?c:null}static parseLink(e){const t=QT(e);try{return new hu(t)}catch{return null}}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zr{constructor(){this.providerId=Zr.PROVIDER_ID}static credential(e,t){return ni._fromEmailAndPassword(e,t)}static credentialWithLink(e,t){const n=hu.parseLink(t);return K(n,"argument-error"),ni._fromEmailAndCode(e,n.code,n.tenantId)}}Zr.PROVIDER_ID="password";Zr.EMAIL_PASSWORD_SIGN_IN_METHOD="password";Zr.EMAIL_LINK_SIGN_IN_METHOD="emailLink";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class du{constructor(e){this.providerId=e,this.defaultLanguageCode=null,this.customParameters={}}setDefaultLanguage(e){this.defaultLanguageCode=e}setCustomParameters(e){return this.customParameters=e,this}getCustomParameters(){return this.customParameters}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ti extends du{constructor(){super(...arguments),this.scopes=[]}addScope(e){return this.scopes.includes(e)||this.scopes.push(e),this}getScopes(){return[...this.scopes]}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zt extends Ti{constructor(){super("facebook.com")}static credential(e){return Hn._fromParams({providerId:Zt.PROVIDER_ID,signInMethod:Zt.FACEBOOK_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return Zt.credentialFromTaggedObject(e)}static credentialFromError(e){return Zt.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!("oauthAccessToken"in e)||!e.oauthAccessToken)return null;try{return Zt.credential(e.oauthAccessToken)}catch{return null}}}Zt.FACEBOOK_SIGN_IN_METHOD="facebook.com";Zt.PROVIDER_ID="facebook.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class en extends Ti{constructor(){super("google.com"),this.addScope("profile")}static credential(e,t){return Hn._fromParams({providerId:en.PROVIDER_ID,signInMethod:en.GOOGLE_SIGN_IN_METHOD,idToken:e,accessToken:t})}static credentialFromResult(e){return en.credentialFromTaggedObject(e)}static credentialFromError(e){return en.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthIdToken:t,oauthAccessToken:n}=e;if(!t&&!n)return null;try{return en.credential(t,n)}catch{return null}}}en.GOOGLE_SIGN_IN_METHOD="google.com";en.PROVIDER_ID="google.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class tn extends Ti{constructor(){super("github.com")}static credential(e){return Hn._fromParams({providerId:tn.PROVIDER_ID,signInMethod:tn.GITHUB_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return tn.credentialFromTaggedObject(e)}static credentialFromError(e){return tn.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!("oauthAccessToken"in e)||!e.oauthAccessToken)return null;try{return tn.credential(e.oauthAccessToken)}catch{return null}}}tn.GITHUB_SIGN_IN_METHOD="github.com";tn.PROVIDER_ID="github.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class nn extends Ti{constructor(){super("twitter.com")}static credential(e,t){return Hn._fromParams({providerId:nn.PROVIDER_ID,signInMethod:nn.TWITTER_SIGN_IN_METHOD,oauthToken:e,oauthTokenSecret:t})}static credentialFromResult(e){return nn.credentialFromTaggedObject(e)}static credentialFromError(e){return nn.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthAccessToken:t,oauthTokenSecret:n}=e;if(!t||!n)return null;try{return nn.credential(t,n)}catch{return null}}}nn.TWITTER_SIGN_IN_METHOD="twitter.com";nn.PROVIDER_ID="twitter.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function mp(r,e){return Ii(r,"POST","/v1/accounts:signUp",Ut(r,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ot{constructor(e){this.user=e.user,this.providerId=e.providerId,this._tokenResponse=e._tokenResponse,this.operationType=e.operationType}static async _fromIdTokenResponse(e,t,n,s=!1){const i=await ot._fromIdTokenResponse(e,n,s),o=Kh(n);return new Ot({user:i,providerId:o,_tokenResponse:n,operationType:t})}static async _forOperation(e,t,n){await e._updateTokensIfNecessary(n,!0);const s=Kh(n);return new Ot({user:e,providerId:s,_tokenResponse:n,operationType:t})}}function Kh(r){return r.providerId?r.providerId:"phoneNumber"in r?"phone":null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function fP(r){var e;if($e(r.app))return Promise.reject(_t(r));const t=wt(r);if(await t._initializationPromise,!((e=t.currentUser)===null||e===void 0)&&e.isAnonymous)return new Ot({user:t.currentUser,providerId:null,operationType:"signIn"});const n=await mp(t,{returnSecureToken:!0}),s=await Ot._fromIdTokenResponse(t,"signIn",n,!0);return await t._updateCurrentUser(s.user),s}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Mo extends vt{constructor(e,t,n,s){var i;super(t.code,t.message),this.operationType=n,this.user=s,Object.setPrototypeOf(this,Mo.prototype),this.customData={appName:e.name,tenantId:(i=e.tenantId)!==null&&i!==void 0?i:void 0,_serverResponse:t.customData._serverResponse,operationType:n}}static _fromErrorAndOperation(e,t,n,s){return new Mo(e,t,n,s)}}function gp(r,e,t,n){return(e==="reauthenticate"?t._getReauthenticationResolver(r):t._getIdTokenResponse(r)).catch(i=>{throw i.code==="auth/multi-factor-auth-required"?Mo._fromErrorAndOperation(r,i,e,n):i})}async function XT(r,e,t=!1){const n=await ti(r,e._linkToIdToken(r.auth,await r.getIdToken()),t);return Ot._forOperation(r,"link",n)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function JT(r,e,t=!1){const{auth:n}=r;if($e(n.app))return Promise.reject(_t(n));const s="reauthenticate";try{const i=await ti(r,gp(n,s,e,r),t);K(i.idToken,n,"internal-error");const o=cu(i.idToken);K(o,n,"internal-error");const{sub:c}=o;return K(r.uid===c,n,"user-mismatch"),Ot._forOperation(r,s,i)}catch(i){throw(i==null?void 0:i.code)==="auth/user-not-found"&&rt(n,"user-mismatch"),i}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function _p(r,e,t=!1){if($e(r.app))return Promise.reject(_t(r));const n="signIn",s=await gp(r,n,e),i=await Ot._fromIdTokenResponse(r,n,s);return t||await r._updateCurrentUser(i.user),i}async function YT(r,e){return _p(wt(r),e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function yp(r){const e=wt(r);e._getPasswordPolicyInternal()&&await e._updatePasswordPolicy()}async function pP(r,e,t){const n=wt(r);await Oo(n,{requestType:"PASSWORD_RESET",email:e,clientType:"CLIENT_TYPE_WEB"},"getOobCode",$T)}async function mP(r,e,t){if($e(r.app))return Promise.reject(_t(r));const n=wt(r),o=await Oo(n,{returnSecureToken:!0,email:e,password:t,clientType:"CLIENT_TYPE_WEB"},"signUpPassword",mp).catch(u=>{throw u.code==="auth/password-does-not-meet-requirements"&&yp(r),u}),c=await Ot._fromIdTokenResponse(n,"signIn",o);return await n._updateCurrentUser(c.user),c}function gP(r,e,t){return $e(r.app)?Promise.reject(_t(r)):YT(Z(r),Zr.credential(e,t)).catch(async n=>{throw n.code==="auth/password-does-not-meet-requirements"&&yp(r),n})}async function _P(r,e){const t=Z(r),s={requestType:"VERIFY_EMAIL",idToken:await r.getIdToken()},{email:i}=await zT(t.auth,s);i!==r.email&&await r.reload()}function ZT(r,e,t,n){return Z(r).onIdTokenChanged(e,t,n)}function eE(r,e,t){return Z(r).beforeAuthStateChanged(e,t)}function yP(r,e,t,n){return Z(r).onAuthStateChanged(e,t,n)}function IP(r){return Z(r).signOut()}const Lo="__sak";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ip{constructor(e,t){this.storageRetriever=e,this.type=t}_isAvailable(){try{return this.storage?(this.storage.setItem(Lo,"1"),this.storage.removeItem(Lo),Promise.resolve(!0)):Promise.resolve(!1)}catch{return Promise.resolve(!1)}}_set(e,t){return this.storage.setItem(e,JSON.stringify(t)),Promise.resolve()}_get(e){const t=this.storage.getItem(e);return Promise.resolve(t?JSON.parse(t):null)}_remove(e){return this.storage.removeItem(e),Promise.resolve()}get storage(){return this.storageRetriever()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const tE=1e3,nE=10;class Tp extends Ip{constructor(){super(()=>window.localStorage,"LOCAL"),this.boundEventHandler=(e,t)=>this.onStorageEvent(e,t),this.listeners={},this.localCache={},this.pollTimer=null,this.fallbackToPolling=up(),this._shouldAllowMigration=!0}forAllChangedKeys(e){for(const t of Object.keys(this.listeners)){const n=this.storage.getItem(t),s=this.localCache[t];n!==s&&e(t,s,n)}}onStorageEvent(e,t=!1){if(!e.key){this.forAllChangedKeys((o,c,u)=>{this.notifyListeners(o,u)});return}const n=e.key;t?this.detachListener():this.stopPolling();const s=()=>{const o=this.storage.getItem(n);!t&&this.localCache[n]===o||this.notifyListeners(n,o)},i=this.storage.getItem(n);vT()&&i!==e.newValue&&e.newValue!==e.oldValue?setTimeout(s,nE):s()}notifyListeners(e,t){this.localCache[e]=t;const n=this.listeners[e];if(n)for(const s of Array.from(n))s(t&&JSON.parse(t))}startPolling(){this.stopPolling(),this.pollTimer=setInterval(()=>{this.forAllChangedKeys((e,t,n)=>{this.onStorageEvent(new StorageEvent("storage",{key:e,oldValue:t,newValue:n}),!0)})},tE)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}attachListener(){window.addEventListener("storage",this.boundEventHandler)}detachListener(){window.removeEventListener("storage",this.boundEventHandler)}_addListener(e,t){Object.keys(this.listeners).length===0&&(this.fallbackToPolling?this.startPolling():this.attachListener()),this.listeners[e]||(this.listeners[e]=new Set,this.localCache[e]=this.storage.getItem(e)),this.listeners[e].add(t)}_removeListener(e,t){this.listeners[e]&&(this.listeners[e].delete(t),this.listeners[e].size===0&&delete this.listeners[e]),Object.keys(this.listeners).length===0&&(this.detachListener(),this.stopPolling())}async _set(e,t){await super._set(e,t),this.localCache[e]=JSON.stringify(t)}async _get(e){const t=await super._get(e);return this.localCache[e]=JSON.stringify(t),t}async _remove(e){await super._remove(e),delete this.localCache[e]}}Tp.type="LOCAL";const rE=Tp;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ep extends Ip{constructor(){super(()=>window.sessionStorage,"SESSION")}_addListener(e,t){}_removeListener(e,t){}}Ep.type="SESSION";const vp=Ep;/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function sE(r){return Promise.all(r.map(async e=>{try{return{fulfilled:!0,value:await e}}catch(t){return{fulfilled:!1,reason:t}}}))}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ia{constructor(e){this.eventTarget=e,this.handlersMap={},this.boundEventHandler=this.handleEvent.bind(this)}static _getInstance(e){const t=this.receivers.find(s=>s.isListeningto(e));if(t)return t;const n=new ia(e);return this.receivers.push(n),n}isListeningto(e){return this.eventTarget===e}async handleEvent(e){const t=e,{eventId:n,eventType:s,data:i}=t.data,o=this.handlersMap[s];if(!(o!=null&&o.size))return;t.ports[0].postMessage({status:"ack",eventId:n,eventType:s});const c=Array.from(o).map(async h=>h(t.origin,i)),u=await sE(c);t.ports[0].postMessage({status:"done",eventId:n,eventType:s,response:u})}_subscribe(e,t){Object.keys(this.handlersMap).length===0&&this.eventTarget.addEventListener("message",this.boundEventHandler),this.handlersMap[e]||(this.handlersMap[e]=new Set),this.handlersMap[e].add(t)}_unsubscribe(e,t){this.handlersMap[e]&&t&&this.handlersMap[e].delete(t),(!t||this.handlersMap[e].size===0)&&delete this.handlersMap[e],Object.keys(this.handlersMap).length===0&&this.eventTarget.removeEventListener("message",this.boundEventHandler)}}ia.receivers=[];/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function fu(r="",e=10){let t="";for(let n=0;n<e;n++)t+=Math.floor(Math.random()*10);return r+t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class iE{constructor(e){this.target=e,this.handlers=new Set}removeMessageHandler(e){e.messageChannel&&(e.messageChannel.port1.removeEventListener("message",e.onMessage),e.messageChannel.port1.close()),this.handlers.delete(e)}async _send(e,t,n=50){const s=typeof MessageChannel<"u"?new MessageChannel:null;if(!s)throw new Error("connection_unavailable");let i,o;return new Promise((c,u)=>{const h=fu("",20);s.port1.start();const f=setTimeout(()=>{u(new Error("unsupported_event"))},n);o={messageChannel:s,onMessage(p){const m=p;if(m.data.eventId===h)switch(m.data.status){case"ack":clearTimeout(f),i=setTimeout(()=>{u(new Error("timeout"))},3e3);break;case"done":clearTimeout(i),c(m.data.response);break;default:clearTimeout(f),clearTimeout(i),u(new Error("invalid_response"));break}}},this.handlers.add(o),s.port1.addEventListener("message",o.onMessage),this.target.postMessage({eventType:e,eventId:h,data:t},[s.port2])}).finally(()=>{o&&this.removeMessageHandler(o)})}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function yt(){return window}function oE(r){yt().location.href=r}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function wp(){return typeof yt().WorkerGlobalScope<"u"&&typeof yt().importScripts=="function"}async function aE(){if(!(navigator!=null&&navigator.serviceWorker))return null;try{return(await navigator.serviceWorker.ready).active}catch{return null}}function cE(){var r;return((r=navigator==null?void 0:navigator.serviceWorker)===null||r===void 0?void 0:r.controller)||null}function uE(){return wp()?self:null}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ap="firebaseLocalStorageDb",lE=1,Fo="firebaseLocalStorage",bp="fbase_key";class Ei{constructor(e){this.request=e}toPromise(){return new Promise((e,t)=>{this.request.addEventListener("success",()=>{e(this.request.result)}),this.request.addEventListener("error",()=>{t(this.request.error)})})}}function oa(r,e){return r.transaction([Fo],e?"readwrite":"readonly").objectStore(Fo)}function hE(){const r=indexedDB.deleteDatabase(Ap);return new Ei(r).toPromise()}function Ac(){const r=indexedDB.open(Ap,lE);return new Promise((e,t)=>{r.addEventListener("error",()=>{t(r.error)}),r.addEventListener("upgradeneeded",()=>{const n=r.result;try{n.createObjectStore(Fo,{keyPath:bp})}catch(s){t(s)}}),r.addEventListener("success",async()=>{const n=r.result;n.objectStoreNames.contains(Fo)?e(n):(n.close(),await hE(),e(await Ac()))})})}async function Wh(r,e,t){const n=oa(r,!0).put({[bp]:e,value:t});return new Ei(n).toPromise()}async function dE(r,e){const t=oa(r,!1).get(e),n=await new Ei(t).toPromise();return n===void 0?null:n.value}function Hh(r,e){const t=oa(r,!0).delete(e);return new Ei(t).toPromise()}const fE=800,pE=3;class Rp{constructor(){this.type="LOCAL",this._shouldAllowMigration=!0,this.listeners={},this.localCache={},this.pollTimer=null,this.pendingWrites=0,this.receiver=null,this.sender=null,this.serviceWorkerReceiverAvailable=!1,this.activeServiceWorker=null,this._workerInitializationPromise=this.initializeServiceWorkerMessaging().then(()=>{},()=>{})}async _openDb(){return this.db?this.db:(this.db=await Ac(),this.db)}async _withRetries(e){let t=0;for(;;)try{const n=await this._openDb();return await e(n)}catch(n){if(t++>pE)throw n;this.db&&(this.db.close(),this.db=void 0)}}async initializeServiceWorkerMessaging(){return wp()?this.initializeReceiver():this.initializeSender()}async initializeReceiver(){this.receiver=ia._getInstance(uE()),this.receiver._subscribe("keyChanged",async(e,t)=>({keyProcessed:(await this._poll()).includes(t.key)})),this.receiver._subscribe("ping",async(e,t)=>["keyChanged"])}async initializeSender(){var e,t;if(this.activeServiceWorker=await aE(),!this.activeServiceWorker)return;this.sender=new iE(this.activeServiceWorker);const n=await this.sender._send("ping",{},800);n&&!((e=n[0])===null||e===void 0)&&e.fulfilled&&!((t=n[0])===null||t===void 0)&&t.value.includes("keyChanged")&&(this.serviceWorkerReceiverAvailable=!0)}async notifyServiceWorker(e){if(!(!this.sender||!this.activeServiceWorker||cE()!==this.activeServiceWorker))try{await this.sender._send("keyChanged",{key:e},this.serviceWorkerReceiverAvailable?800:50)}catch{}}async _isAvailable(){try{if(!indexedDB)return!1;const e=await Ac();return await Wh(e,Lo,"1"),await Hh(e,Lo),!0}catch{}return!1}async _withPendingWrite(e){this.pendingWrites++;try{await e()}finally{this.pendingWrites--}}async _set(e,t){return this._withPendingWrite(async()=>(await this._withRetries(n=>Wh(n,e,t)),this.localCache[e]=t,this.notifyServiceWorker(e)))}async _get(e){const t=await this._withRetries(n=>dE(n,e));return this.localCache[e]=t,t}async _remove(e){return this._withPendingWrite(async()=>(await this._withRetries(t=>Hh(t,e)),delete this.localCache[e],this.notifyServiceWorker(e)))}async _poll(){const e=await this._withRetries(s=>{const i=oa(s,!1).getAll();return new Ei(i).toPromise()});if(!e)return[];if(this.pendingWrites!==0)return[];const t=[],n=new Set;if(e.length!==0)for(const{fbase_key:s,value:i}of e)n.add(s),JSON.stringify(this.localCache[s])!==JSON.stringify(i)&&(this.notifyListeners(s,i),t.push(s));for(const s of Object.keys(this.localCache))this.localCache[s]&&!n.has(s)&&(this.notifyListeners(s,null),t.push(s));return t}notifyListeners(e,t){this.localCache[e]=t;const n=this.listeners[e];if(n)for(const s of Array.from(n))s(t)}startPolling(){this.stopPolling(),this.pollTimer=setInterval(async()=>this._poll(),fE)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}_addListener(e,t){Object.keys(this.listeners).length===0&&this.startPolling(),this.listeners[e]||(this.listeners[e]=new Set,this._get(e)),this.listeners[e].add(t)}_removeListener(e,t){this.listeners[e]&&(this.listeners[e].delete(t),this.listeners[e].size===0&&delete this.listeners[e]),Object.keys(this.listeners).length===0&&this.stopPolling()}}Rp.type="LOCAL";const mE=Rp;new yi(3e4,6e4);/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Sp(r,e){return e?Ct(e):(K(r._popupRedirectResolver,r,"argument-error"),r._popupRedirectResolver)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pu extends lu{constructor(e){super("custom","custom"),this.params=e}_getIdTokenResponse(e){return Pr(e,this._buildIdpRequest())}_linkToIdToken(e,t){return Pr(e,this._buildIdpRequest(t))}_getReauthenticationResolver(e){return Pr(e,this._buildIdpRequest())}_buildIdpRequest(e){const t={requestUri:this.params.requestUri,sessionId:this.params.sessionId,postBody:this.params.postBody,tenantId:this.params.tenantId,pendingToken:this.params.pendingToken,returnSecureToken:!0,returnIdpCredential:!0};return e&&(t.idToken=e),t}}function gE(r){return _p(r.auth,new pu(r),r.bypassAuthState)}function _E(r){const{auth:e,user:t}=r;return K(t,e,"internal-error"),JT(t,new pu(r),r.bypassAuthState)}async function yE(r){const{auth:e,user:t}=r;return K(t,e,"internal-error"),XT(t,new pu(r),r.bypassAuthState)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Pp{constructor(e,t,n,s,i=!1){this.auth=e,this.resolver=n,this.user=s,this.bypassAuthState=i,this.pendingPromise=null,this.eventManager=null,this.filter=Array.isArray(t)?t:[t]}execute(){return new Promise(async(e,t)=>{this.pendingPromise={resolve:e,reject:t};try{this.eventManager=await this.resolver._initialize(this.auth),await this.onExecution(),this.eventManager.registerConsumer(this)}catch(n){this.reject(n)}})}async onAuthEvent(e){const{urlResponse:t,sessionId:n,postBody:s,tenantId:i,error:o,type:c}=e;if(o){this.reject(o);return}const u={auth:this.auth,requestUri:t,sessionId:n,tenantId:i||void 0,postBody:s||void 0,user:this.user,bypassAuthState:this.bypassAuthState};try{this.resolve(await this.getIdpTask(c)(u))}catch(h){this.reject(h)}}onError(e){this.reject(e)}getIdpTask(e){switch(e){case"signInViaPopup":case"signInViaRedirect":return gE;case"linkViaPopup":case"linkViaRedirect":return yE;case"reauthViaPopup":case"reauthViaRedirect":return _E;default:rt(this.auth,"internal-error")}}resolve(e){xt(this.pendingPromise,"Pending promise was never set"),this.pendingPromise.resolve(e),this.unregisterAndCleanUp()}reject(e){xt(this.pendingPromise,"Pending promise was never set"),this.pendingPromise.reject(e),this.unregisterAndCleanUp()}unregisterAndCleanUp(){this.eventManager&&this.eventManager.unregisterConsumer(this),this.pendingPromise=null,this.cleanUp()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const IE=new yi(2e3,1e4);async function TP(r,e,t){if($e(r.app))return Promise.reject(ct(r,"operation-not-supported-in-this-environment"));const n=wt(r);nT(r,e,du);const s=Sp(n,t);return new qn(n,"signInViaPopup",e,s).executeNotNull()}class qn extends Pp{constructor(e,t,n,s,i){super(e,t,s,i),this.provider=n,this.authWindow=null,this.pollId=null,qn.currentPopupAction&&qn.currentPopupAction.cancel(),qn.currentPopupAction=this}async executeNotNull(){const e=await this.execute();return K(e,this.auth,"internal-error"),e}async onExecution(){xt(this.filter.length===1,"Popup operations only handle one event");const e=fu();this.authWindow=await this.resolver._openPopup(this.auth,this.provider,this.filter[0],e),this.authWindow.associatedEvent=e,this.resolver._originValidation(this.auth).catch(t=>{this.reject(t)}),this.resolver._isIframeWebStorageSupported(this.auth,t=>{t||this.reject(ct(this.auth,"web-storage-unsupported"))}),this.pollUserCancellation()}get eventId(){var e;return((e=this.authWindow)===null||e===void 0?void 0:e.associatedEvent)||null}cancel(){this.reject(ct(this.auth,"cancelled-popup-request"))}cleanUp(){this.authWindow&&this.authWindow.close(),this.pollId&&window.clearTimeout(this.pollId),this.authWindow=null,this.pollId=null,qn.currentPopupAction=null}pollUserCancellation(){const e=()=>{var t,n;if(!((n=(t=this.authWindow)===null||t===void 0?void 0:t.window)===null||n===void 0)&&n.closed){this.pollId=window.setTimeout(()=>{this.pollId=null,this.reject(ct(this.auth,"popup-closed-by-user"))},8e3);return}this.pollId=window.setTimeout(e,IE.get())};e()}}qn.currentPopupAction=null;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const TE="pendingRedirect",_o=new Map;class EE extends Pp{constructor(e,t,n=!1){super(e,["signInViaRedirect","linkViaRedirect","reauthViaRedirect","unknown"],t,void 0,n),this.eventId=null}async execute(){let e=_o.get(this.auth._key());if(!e){try{const n=await vE(this.resolver,this.auth)?await super.execute():null;e=()=>Promise.resolve(n)}catch(t){e=()=>Promise.reject(t)}_o.set(this.auth._key(),e)}return this.bypassAuthState||_o.set(this.auth._key(),()=>Promise.resolve(null)),e()}async onAuthEvent(e){if(e.type==="signInViaRedirect")return super.onAuthEvent(e);if(e.type==="unknown"){this.resolve(null);return}if(e.eventId){const t=await this.auth._redirectUserForId(e.eventId);if(t)return this.user=t,super.onAuthEvent(e);this.resolve(null)}}async onExecution(){}cleanUp(){}}async function vE(r,e){const t=bE(e),n=AE(r);if(!await n._isAvailable())return!1;const s=await n._get(t)==="true";return await n._remove(t),s}function wE(r,e){_o.set(r._key(),e)}function AE(r){return Ct(r._redirectPersistence)}function bE(r){return go(TE,r.config.apiKey,r.name)}async function RE(r,e,t=!1){if($e(r.app))return Promise.reject(_t(r));const n=wt(r),s=Sp(n,e),o=await new EE(n,s,t).execute();return o&&!t&&(delete o.user._redirectEventId,await n._persistUserIfCurrent(o.user),await n._setRedirectUser(null,e)),o}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const SE=600*1e3;class PE{constructor(e){this.auth=e,this.cachedEventUids=new Set,this.consumers=new Set,this.queuedRedirectEvent=null,this.hasHandledPotentialRedirect=!1,this.lastProcessedEventTime=Date.now()}registerConsumer(e){this.consumers.add(e),this.queuedRedirectEvent&&this.isEventForConsumer(this.queuedRedirectEvent,e)&&(this.sendToConsumer(this.queuedRedirectEvent,e),this.saveEventToCache(this.queuedRedirectEvent),this.queuedRedirectEvent=null)}unregisterConsumer(e){this.consumers.delete(e)}onEvent(e){if(this.hasEventBeenHandled(e))return!1;let t=!1;return this.consumers.forEach(n=>{this.isEventForConsumer(e,n)&&(t=!0,this.sendToConsumer(e,n),this.saveEventToCache(e))}),this.hasHandledPotentialRedirect||!CE(e)||(this.hasHandledPotentialRedirect=!0,t||(this.queuedRedirectEvent=e,t=!0)),t}sendToConsumer(e,t){var n;if(e.error&&!Cp(e)){const s=((n=e.error.code)===null||n===void 0?void 0:n.split("auth/")[1])||"internal-error";t.onError(ct(this.auth,s))}else t.onAuthEvent(e)}isEventForConsumer(e,t){const n=t.eventId===null||!!e.eventId&&e.eventId===t.eventId;return t.filter.includes(e.type)&&n}hasEventBeenHandled(e){return Date.now()-this.lastProcessedEventTime>=SE&&this.cachedEventUids.clear(),this.cachedEventUids.has(Qh(e))}saveEventToCache(e){this.cachedEventUids.add(Qh(e)),this.lastProcessedEventTime=Date.now()}}function Qh(r){return[r.type,r.eventId,r.sessionId,r.tenantId].filter(e=>e).join("-")}function Cp({type:r,error:e}){return r==="unknown"&&(e==null?void 0:e.code)==="auth/no-auth-event"}function CE(r){switch(r.type){case"signInViaRedirect":case"linkViaRedirect":case"reauthViaRedirect":return!0;case"unknown":return Cp(r);default:return!1}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function kE(r,e={}){return Bt(r,"GET","/v1/projects",e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const VE=/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,DE=/^https?/;async function NE(r){if(r.config.emulator)return;const{authorizedDomains:e}=await kE(r);for(const t of e)try{if(xE(t))return}catch{}rt(r,"unauthorized-domain")}function xE(r){const e=vc(),{protocol:t,hostname:n}=new URL(e);if(r.startsWith("chrome-extension://")){const o=new URL(r);return o.hostname===""&&n===""?t==="chrome-extension:"&&r.replace("chrome-extension://","")===e.replace("chrome-extension://",""):t==="chrome-extension:"&&o.hostname===n}if(!DE.test(t))return!1;if(VE.test(r))return n===r;const s=r.replace(/\./g,"\\.");return new RegExp("^(.+\\."+s+"|"+s+")$","i").test(n)}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const OE=new yi(3e4,6e4);function Xh(){const r=yt().___jsl;if(r!=null&&r.H){for(const e of Object.keys(r.H))if(r.H[e].r=r.H[e].r||[],r.H[e].L=r.H[e].L||[],r.H[e].r=[...r.H[e].L],r.CP)for(let t=0;t<r.CP.length;t++)r.CP[t]=null}}function ME(r){return new Promise((e,t)=>{var n,s,i;function o(){Xh(),gapi.load("gapi.iframes",{callback:()=>{e(gapi.iframes.getContext())},ontimeout:()=>{Xh(),t(ct(r,"network-request-failed"))},timeout:OE.get()})}if(!((s=(n=yt().gapi)===null||n===void 0?void 0:n.iframes)===null||s===void 0)&&s.Iframe)e(gapi.iframes.getContext());else if(!((i=yt().gapi)===null||i===void 0)&&i.load)o();else{const c=VT("iframefcb");return yt()[c]=()=>{gapi.load?o():t(ct(r,"network-request-failed"))},hp(`${kT()}?onload=${c}`).catch(u=>t(u))}}).catch(e=>{throw yo=null,e})}let yo=null;function LE(r){return yo=yo||ME(r),yo}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const FE=new yi(5e3,15e3),UE="__/auth/iframe",BE="emulator/auth/iframe",qE={style:{position:"absolute",top:"-100px",width:"1px",height:"1px"},"aria-hidden":"true",tabindex:"-1"},jE=new Map([["identitytoolkit.googleapis.com","p"],["staging-identitytoolkit.sandbox.googleapis.com","s"],["test-identitytoolkit.sandbox.googleapis.com","t"]]);function zE(r){const e=r.config;K(e.authDomain,r,"auth-domain-config-required");const t=e.emulator?au(e,BE):`https://${r.config.authDomain}/${UE}`,n={apiKey:e.apiKey,appName:r.name,v:ir},s=jE.get(r.config.apiHost);s&&(n.eid=s);const i=r._getFrameworks();return i.length&&(n.fw=i.join(",")),`${t}?${_i(n).slice(1)}`}async function $E(r){const e=await LE(r),t=yt().gapi;return K(t,r,"internal-error"),e.open({where:document.body,url:zE(r),messageHandlersFilter:t.iframes.CROSS_ORIGIN_IFRAMES_FILTER,attributes:qE,dontclear:!0},n=>new Promise(async(s,i)=>{await n.restyle({setHideOnLeave:!1});const o=ct(r,"network-request-failed"),c=yt().setTimeout(()=>{i(o)},FE.get());function u(){yt().clearTimeout(c),s(n)}n.ping(u).then(u,()=>{i(o)})}))}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const GE={location:"yes",resizable:"yes",statusbar:"yes",toolbar:"no"},KE=500,WE=600,HE="_blank",QE="http://localhost";class Jh{constructor(e){this.window=e,this.associatedEvent=null}close(){if(this.window)try{this.window.close()}catch{}}}function XE(r,e,t,n=KE,s=WE){const i=Math.max((window.screen.availHeight-s)/2,0).toString(),o=Math.max((window.screen.availWidth-n)/2,0).toString();let c="";const u=Object.assign(Object.assign({},GE),{width:n.toString(),height:s.toString(),top:i,left:o}),h=we().toLowerCase();t&&(c=sp(h)?HE:t),np(h)&&(e=e||QE,u.scrollbars="yes");const f=Object.entries(u).reduce((m,[T,P])=>`${m}${T}=${P},`,"");if(ET(h)&&c!=="_self")return JE(e||"",c),new Jh(null);const p=window.open(e||"",c,f);K(p,r,"popup-blocked");try{p.focus()}catch{}return new Jh(p)}function JE(r,e){const t=document.createElement("a");t.href=r,t.target=e;const n=document.createEvent("MouseEvent");n.initMouseEvent("click",!0,!0,window,1,0,0,0,0,!1,!1,!1,!1,1,null),t.dispatchEvent(n)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const YE="__/auth/handler",ZE="emulator/auth/handler",ev=encodeURIComponent("fac");async function Yh(r,e,t,n,s,i){K(r.config.authDomain,r,"auth-domain-config-required"),K(r.config.apiKey,r,"invalid-api-key");const o={apiKey:r.config.apiKey,appName:r.name,authType:t,redirectUrl:n,v:ir,eventId:s};if(e instanceof du){e.setDefaultLanguage(r.languageCode),o.providerId=e.providerId||"",Qy(e.getCustomParameters())||(o.customParameters=JSON.stringify(e.getCustomParameters()));for(const[f,p]of Object.entries({}))o[f]=p}if(e instanceof Ti){const f=e.getScopes().filter(p=>p!=="");f.length>0&&(o.scopes=f.join(","))}r.tenantId&&(o.tid=r.tenantId);const c=o;for(const f of Object.keys(c))c[f]===void 0&&delete c[f];const u=await r._getAppCheckToken(),h=u?`#${ev}=${encodeURIComponent(u)}`:"";return`${tv(r)}?${_i(c).slice(1)}${h}`}function tv({config:r}){return r.emulator?au(r,ZE):`https://${r.authDomain}/${YE}`}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const cc="webStorageSupport";class nv{constructor(){this.eventManagers={},this.iframes={},this.originValidationPromises={},this._redirectPersistence=vp,this._completeRedirectFn=RE,this._overrideRedirectResult=wE}async _openPopup(e,t,n,s){var i;xt((i=this.eventManagers[e._key()])===null||i===void 0?void 0:i.manager,"_initialize() not called before _openPopup()");const o=await Yh(e,t,n,vc(),s);return XE(e,o,fu())}async _openRedirect(e,t,n,s){await this._originValidation(e);const i=await Yh(e,t,n,vc(),s);return oE(i),new Promise(()=>{})}_initialize(e){const t=e._key();if(this.eventManagers[t]){const{manager:s,promise:i}=this.eventManagers[t];return s?Promise.resolve(s):(xt(i,"If manager is not set, promise should be"),i)}const n=this.initAndGetManager(e);return this.eventManagers[t]={promise:n},n.catch(()=>{delete this.eventManagers[t]}),n}async initAndGetManager(e){const t=await $E(e),n=new PE(e);return t.register("authEvent",s=>(K(s==null?void 0:s.authEvent,e,"invalid-auth-event"),{status:n.onEvent(s.authEvent)?"ACK":"ERROR"}),gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER),this.eventManagers[e._key()]={manager:n},this.iframes[e._key()]=t,n}_isIframeWebStorageSupported(e,t){this.iframes[e._key()].send(cc,{type:cc},s=>{var i;const o=(i=s==null?void 0:s[0])===null||i===void 0?void 0:i[cc];o!==void 0&&t(!!o),rt(e,"internal-error")},gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER)}_originValidation(e){const t=e._key();return this.originValidationPromises[t]||(this.originValidationPromises[t]=NE(e)),this.originValidationPromises[t]}get _shouldInitProactively(){return up()||rp()||uu()}}const rv=nv;var Zh="@firebase/auth",ed="1.10.8";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class sv{constructor(e){this.auth=e,this.internalListeners=new Map}getUid(){var e;return this.assertAuthConfigured(),((e=this.auth.currentUser)===null||e===void 0?void 0:e.uid)||null}async getToken(e){return this.assertAuthConfigured(),await this.auth._initializationPromise,this.auth.currentUser?{accessToken:await this.auth.currentUser.getIdToken(e)}:null}addAuthTokenListener(e){if(this.assertAuthConfigured(),this.internalListeners.has(e))return;const t=this.auth.onIdTokenChanged(n=>{e((n==null?void 0:n.stsTokenManager.accessToken)||null)});this.internalListeners.set(e,t),this.updateProactiveRefresh()}removeAuthTokenListener(e){this.assertAuthConfigured();const t=this.internalListeners.get(e);t&&(this.internalListeners.delete(e),t(),this.updateProactiveRefresh())}assertAuthConfigured(){K(this.auth._initializationPromise,"dependent-sdk-initialized-before-auth")}updateProactiveRefresh(){this.internalListeners.size>0?this.auth._startProactiveRefresh():this.auth._stopProactiveRefresh()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function iv(r){switch(r){case"Node":return"node";case"ReactNative":return"rn";case"Worker":return"webworker";case"Cordova":return"cordova";case"WebExtension":return"web-extension";default:return}}function ov(r){Wn(new hn("auth",(e,{options:t})=>{const n=e.getProvider("app").getImmediate(),s=e.getProvider("heartbeat"),i=e.getProvider("app-check-internal"),{apiKey:o,authDomain:c}=n.options;K(o&&!o.includes(":"),"invalid-api-key",{appName:n.name});const u={apiKey:o,authDomain:c,clientPlatform:r,apiHost:"identitytoolkit.googleapis.com",tokenApiHost:"securetoken.googleapis.com",apiScheme:"https",sdkClientVersion:lp(r)},h=new ST(n,s,i,u);return LT(h,t),h},"PUBLIC").setInstantiationMode("EXPLICIT").setInstanceCreatedCallback((e,t,n)=>{e.getProvider("auth-internal").initialize()})),Wn(new hn("auth-internal",e=>{const t=wt(e.getProvider("auth").getImmediate());return(n=>new sv(n))(t)},"PRIVATE").setInstantiationMode("EXPLICIT")),gt(Zh,ed,iv(r)),gt(Zh,ed,"esm2017")}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const av=300,cv=qf("authIdTokenMaxAge")||av;let td=null;const uv=r=>async e=>{const t=e&&await e.getIdTokenResult(),n=t&&(new Date().getTime()-Date.parse(t.issuedAtTime))/1e3;if(n&&n>cv)return;const s=t==null?void 0:t.token;td!==s&&(td=s,await fetch(r,{method:s?"POST":"DELETE",headers:s?{Authorization:`Bearer ${s}`}:{}}))};function EP(r=su()){const e=Yr(r,"auth");if(e.isInitialized())return e.getImmediate();const t=MT(r,{popupRedirectResolver:rv,persistence:[mE,rE,vp]}),n=qf("authTokenSyncURL");if(n&&typeof isSecureContext=="boolean"&&isSecureContext){const i=new URL(n,location.origin);if(location.origin===i.origin){const o=uv(i.toString());eE(t,o,()=>o(t.currentUser)),ZT(t,c=>o(c))}}const s=Ff("auth");return s&&FT(t,`http://${s}`),t}function lv(){var r,e;return(e=(r=document.getElementsByTagName("head"))===null||r===void 0?void 0:r[0])!==null&&e!==void 0?e:document}PT({loadJS(r){return new Promise((e,t)=>{const n=document.createElement("script");n.setAttribute("src",r),n.onload=e,n.onerror=s=>{const i=ct("internal-error");i.customData=s,t(i)},n.type="text/javascript",n.charset="UTF-8",lv().appendChild(n)})},gapiScript:"https://apis.google.com/js/api.js",recaptchaV2Script:"https://www.google.com/recaptcha/api.js",recaptchaEnterpriseScript:"https://www.google.com/recaptcha/enterprise.js?render="});ov("Browser");var nd=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var un,kp;(function(){var r;/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/function e(E,_){function y(){}y.prototype=_.prototype,E.D=_.prototype,E.prototype=new y,E.prototype.constructor=E,E.C=function(v,w,S){for(var I=Array(arguments.length-2),At=2;At<arguments.length;At++)I[At-2]=arguments[At];return _.prototype[w].apply(v,I)}}function t(){this.blockSize=-1}function n(){this.blockSize=-1,this.blockSize=64,this.g=Array(4),this.B=Array(this.blockSize),this.o=this.h=0,this.s()}e(n,t),n.prototype.s=function(){this.g[0]=1732584193,this.g[1]=4023233417,this.g[2]=2562383102,this.g[3]=271733878,this.o=this.h=0};function s(E,_,y){y||(y=0);var v=Array(16);if(typeof _=="string")for(var w=0;16>w;++w)v[w]=_.charCodeAt(y++)|_.charCodeAt(y++)<<8|_.charCodeAt(y++)<<16|_.charCodeAt(y++)<<24;else for(w=0;16>w;++w)v[w]=_[y++]|_[y++]<<8|_[y++]<<16|_[y++]<<24;_=E.g[0],y=E.g[1],w=E.g[2];var S=E.g[3],I=_+(S^y&(w^S))+v[0]+3614090360&4294967295;_=y+(I<<7&4294967295|I>>>25),I=S+(w^_&(y^w))+v[1]+3905402710&4294967295,S=_+(I<<12&4294967295|I>>>20),I=w+(y^S&(_^y))+v[2]+606105819&4294967295,w=S+(I<<17&4294967295|I>>>15),I=y+(_^w&(S^_))+v[3]+3250441966&4294967295,y=w+(I<<22&4294967295|I>>>10),I=_+(S^y&(w^S))+v[4]+4118548399&4294967295,_=y+(I<<7&4294967295|I>>>25),I=S+(w^_&(y^w))+v[5]+1200080426&4294967295,S=_+(I<<12&4294967295|I>>>20),I=w+(y^S&(_^y))+v[6]+2821735955&4294967295,w=S+(I<<17&4294967295|I>>>15),I=y+(_^w&(S^_))+v[7]+4249261313&4294967295,y=w+(I<<22&4294967295|I>>>10),I=_+(S^y&(w^S))+v[8]+1770035416&4294967295,_=y+(I<<7&4294967295|I>>>25),I=S+(w^_&(y^w))+v[9]+2336552879&4294967295,S=_+(I<<12&4294967295|I>>>20),I=w+(y^S&(_^y))+v[10]+4294925233&4294967295,w=S+(I<<17&4294967295|I>>>15),I=y+(_^w&(S^_))+v[11]+2304563134&4294967295,y=w+(I<<22&4294967295|I>>>10),I=_+(S^y&(w^S))+v[12]+1804603682&4294967295,_=y+(I<<7&4294967295|I>>>25),I=S+(w^_&(y^w))+v[13]+4254626195&4294967295,S=_+(I<<12&4294967295|I>>>20),I=w+(y^S&(_^y))+v[14]+2792965006&4294967295,w=S+(I<<17&4294967295|I>>>15),I=y+(_^w&(S^_))+v[15]+1236535329&4294967295,y=w+(I<<22&4294967295|I>>>10),I=_+(w^S&(y^w))+v[1]+4129170786&4294967295,_=y+(I<<5&4294967295|I>>>27),I=S+(y^w&(_^y))+v[6]+3225465664&4294967295,S=_+(I<<9&4294967295|I>>>23),I=w+(_^y&(S^_))+v[11]+643717713&4294967295,w=S+(I<<14&4294967295|I>>>18),I=y+(S^_&(w^S))+v[0]+3921069994&4294967295,y=w+(I<<20&4294967295|I>>>12),I=_+(w^S&(y^w))+v[5]+3593408605&4294967295,_=y+(I<<5&4294967295|I>>>27),I=S+(y^w&(_^y))+v[10]+38016083&4294967295,S=_+(I<<9&4294967295|I>>>23),I=w+(_^y&(S^_))+v[15]+3634488961&4294967295,w=S+(I<<14&4294967295|I>>>18),I=y+(S^_&(w^S))+v[4]+3889429448&4294967295,y=w+(I<<20&4294967295|I>>>12),I=_+(w^S&(y^w))+v[9]+568446438&4294967295,_=y+(I<<5&4294967295|I>>>27),I=S+(y^w&(_^y))+v[14]+3275163606&4294967295,S=_+(I<<9&4294967295|I>>>23),I=w+(_^y&(S^_))+v[3]+4107603335&4294967295,w=S+(I<<14&4294967295|I>>>18),I=y+(S^_&(w^S))+v[8]+1163531501&4294967295,y=w+(I<<20&4294967295|I>>>12),I=_+(w^S&(y^w))+v[13]+2850285829&4294967295,_=y+(I<<5&4294967295|I>>>27),I=S+(y^w&(_^y))+v[2]+4243563512&4294967295,S=_+(I<<9&4294967295|I>>>23),I=w+(_^y&(S^_))+v[7]+1735328473&4294967295,w=S+(I<<14&4294967295|I>>>18),I=y+(S^_&(w^S))+v[12]+2368359562&4294967295,y=w+(I<<20&4294967295|I>>>12),I=_+(y^w^S)+v[5]+4294588738&4294967295,_=y+(I<<4&4294967295|I>>>28),I=S+(_^y^w)+v[8]+2272392833&4294967295,S=_+(I<<11&4294967295|I>>>21),I=w+(S^_^y)+v[11]+1839030562&4294967295,w=S+(I<<16&4294967295|I>>>16),I=y+(w^S^_)+v[14]+4259657740&4294967295,y=w+(I<<23&4294967295|I>>>9),I=_+(y^w^S)+v[1]+2763975236&4294967295,_=y+(I<<4&4294967295|I>>>28),I=S+(_^y^w)+v[4]+1272893353&4294967295,S=_+(I<<11&4294967295|I>>>21),I=w+(S^_^y)+v[7]+4139469664&4294967295,w=S+(I<<16&4294967295|I>>>16),I=y+(w^S^_)+v[10]+3200236656&4294967295,y=w+(I<<23&4294967295|I>>>9),I=_+(y^w^S)+v[13]+681279174&4294967295,_=y+(I<<4&4294967295|I>>>28),I=S+(_^y^w)+v[0]+3936430074&4294967295,S=_+(I<<11&4294967295|I>>>21),I=w+(S^_^y)+v[3]+3572445317&4294967295,w=S+(I<<16&4294967295|I>>>16),I=y+(w^S^_)+v[6]+76029189&4294967295,y=w+(I<<23&4294967295|I>>>9),I=_+(y^w^S)+v[9]+3654602809&4294967295,_=y+(I<<4&4294967295|I>>>28),I=S+(_^y^w)+v[12]+3873151461&4294967295,S=_+(I<<11&4294967295|I>>>21),I=w+(S^_^y)+v[15]+530742520&4294967295,w=S+(I<<16&4294967295|I>>>16),I=y+(w^S^_)+v[2]+3299628645&4294967295,y=w+(I<<23&4294967295|I>>>9),I=_+(w^(y|~S))+v[0]+4096336452&4294967295,_=y+(I<<6&4294967295|I>>>26),I=S+(y^(_|~w))+v[7]+1126891415&4294967295,S=_+(I<<10&4294967295|I>>>22),I=w+(_^(S|~y))+v[14]+2878612391&4294967295,w=S+(I<<15&4294967295|I>>>17),I=y+(S^(w|~_))+v[5]+4237533241&4294967295,y=w+(I<<21&4294967295|I>>>11),I=_+(w^(y|~S))+v[12]+1700485571&4294967295,_=y+(I<<6&4294967295|I>>>26),I=S+(y^(_|~w))+v[3]+2399980690&4294967295,S=_+(I<<10&4294967295|I>>>22),I=w+(_^(S|~y))+v[10]+4293915773&4294967295,w=S+(I<<15&4294967295|I>>>17),I=y+(S^(w|~_))+v[1]+2240044497&4294967295,y=w+(I<<21&4294967295|I>>>11),I=_+(w^(y|~S))+v[8]+1873313359&4294967295,_=y+(I<<6&4294967295|I>>>26),I=S+(y^(_|~w))+v[15]+4264355552&4294967295,S=_+(I<<10&4294967295|I>>>22),I=w+(_^(S|~y))+v[6]+2734768916&4294967295,w=S+(I<<15&4294967295|I>>>17),I=y+(S^(w|~_))+v[13]+1309151649&4294967295,y=w+(I<<21&4294967295|I>>>11),I=_+(w^(y|~S))+v[4]+4149444226&4294967295,_=y+(I<<6&4294967295|I>>>26),I=S+(y^(_|~w))+v[11]+3174756917&4294967295,S=_+(I<<10&4294967295|I>>>22),I=w+(_^(S|~y))+v[2]+718787259&4294967295,w=S+(I<<15&4294967295|I>>>17),I=y+(S^(w|~_))+v[9]+3951481745&4294967295,E.g[0]=E.g[0]+_&4294967295,E.g[1]=E.g[1]+(w+(I<<21&4294967295|I>>>11))&4294967295,E.g[2]=E.g[2]+w&4294967295,E.g[3]=E.g[3]+S&4294967295}n.prototype.u=function(E,_){_===void 0&&(_=E.length);for(var y=_-this.blockSize,v=this.B,w=this.h,S=0;S<_;){if(w==0)for(;S<=y;)s(this,E,S),S+=this.blockSize;if(typeof E=="string"){for(;S<_;)if(v[w++]=E.charCodeAt(S++),w==this.blockSize){s(this,v),w=0;break}}else for(;S<_;)if(v[w++]=E[S++],w==this.blockSize){s(this,v),w=0;break}}this.h=w,this.o+=_},n.prototype.v=function(){var E=Array((56>this.h?this.blockSize:2*this.blockSize)-this.h);E[0]=128;for(var _=1;_<E.length-8;++_)E[_]=0;var y=8*this.o;for(_=E.length-8;_<E.length;++_)E[_]=y&255,y/=256;for(this.u(E),E=Array(16),_=y=0;4>_;++_)for(var v=0;32>v;v+=8)E[y++]=this.g[_]>>>v&255;return E};function i(E,_){var y=c;return Object.prototype.hasOwnProperty.call(y,E)?y[E]:y[E]=_(E)}function o(E,_){this.h=_;for(var y=[],v=!0,w=E.length-1;0<=w;w--){var S=E[w]|0;v&&S==_||(y[w]=S,v=!1)}this.g=y}var c={};function u(E){return-128<=E&&128>E?i(E,function(_){return new o([_|0],0>_?-1:0)}):new o([E|0],0>E?-1:0)}function h(E){if(isNaN(E)||!isFinite(E))return p;if(0>E)return C(h(-E));for(var _=[],y=1,v=0;E>=y;v++)_[v]=E/y|0,y*=4294967296;return new o(_,0)}function f(E,_){if(E.length==0)throw Error("number format error: empty string");if(_=_||10,2>_||36<_)throw Error("radix out of range: "+_);if(E.charAt(0)=="-")return C(f(E.substring(1),_));if(0<=E.indexOf("-"))throw Error('number format error: interior "-" character');for(var y=h(Math.pow(_,8)),v=p,w=0;w<E.length;w+=8){var S=Math.min(8,E.length-w),I=parseInt(E.substring(w,w+S),_);8>S?(S=h(Math.pow(_,S)),v=v.j(S).add(h(I))):(v=v.j(y),v=v.add(h(I)))}return v}var p=u(0),m=u(1),T=u(16777216);r=o.prototype,r.m=function(){if(V(this))return-C(this).m();for(var E=0,_=1,y=0;y<this.g.length;y++){var v=this.i(y);E+=(0<=v?v:4294967296+v)*_,_*=4294967296}return E},r.toString=function(E){if(E=E||10,2>E||36<E)throw Error("radix out of range: "+E);if(P(this))return"0";if(V(this))return"-"+C(this).toString(E);for(var _=h(Math.pow(E,6)),y=this,v="";;){var w=j(y,_).g;y=L(y,w.j(_));var S=((0<y.g.length?y.g[0]:y.h)>>>0).toString(E);if(y=w,P(y))return S+v;for(;6>S.length;)S="0"+S;v=S+v}},r.i=function(E){return 0>E?0:E<this.g.length?this.g[E]:this.h};function P(E){if(E.h!=0)return!1;for(var _=0;_<E.g.length;_++)if(E.g[_]!=0)return!1;return!0}function V(E){return E.h==-1}r.l=function(E){return E=L(this,E),V(E)?-1:P(E)?0:1};function C(E){for(var _=E.g.length,y=[],v=0;v<_;v++)y[v]=~E.g[v];return new o(y,~E.h).add(m)}r.abs=function(){return V(this)?C(this):this},r.add=function(E){for(var _=Math.max(this.g.length,E.g.length),y=[],v=0,w=0;w<=_;w++){var S=v+(this.i(w)&65535)+(E.i(w)&65535),I=(S>>>16)+(this.i(w)>>>16)+(E.i(w)>>>16);v=I>>>16,S&=65535,I&=65535,y[w]=I<<16|S}return new o(y,y[y.length-1]&-2147483648?-1:0)};function L(E,_){return E.add(C(_))}r.j=function(E){if(P(this)||P(E))return p;if(V(this))return V(E)?C(this).j(C(E)):C(C(this).j(E));if(V(E))return C(this.j(C(E)));if(0>this.l(T)&&0>E.l(T))return h(this.m()*E.m());for(var _=this.g.length+E.g.length,y=[],v=0;v<2*_;v++)y[v]=0;for(v=0;v<this.g.length;v++)for(var w=0;w<E.g.length;w++){var S=this.i(v)>>>16,I=this.i(v)&65535,At=E.i(w)>>>16,fs=E.i(w)&65535;y[2*v+2*w]+=I*fs,U(y,2*v+2*w),y[2*v+2*w+1]+=S*fs,U(y,2*v+2*w+1),y[2*v+2*w+1]+=I*At,U(y,2*v+2*w+1),y[2*v+2*w+2]+=S*At,U(y,2*v+2*w+2)}for(v=0;v<_;v++)y[v]=y[2*v+1]<<16|y[2*v];for(v=_;v<2*_;v++)y[v]=0;return new o(y,0)};function U(E,_){for(;(E[_]&65535)!=E[_];)E[_+1]+=E[_]>>>16,E[_]&=65535,_++}function x(E,_){this.g=E,this.h=_}function j(E,_){if(P(_))throw Error("division by zero");if(P(E))return new x(p,p);if(V(E))return _=j(C(E),_),new x(C(_.g),C(_.h));if(V(_))return _=j(E,C(_)),new x(C(_.g),_.h);if(30<E.g.length){if(V(E)||V(_))throw Error("slowDivide_ only works with positive integers.");for(var y=m,v=_;0>=v.l(E);)y=H(y),v=H(v);var w=$(y,1),S=$(v,1);for(v=$(v,2),y=$(y,2);!P(v);){var I=S.add(v);0>=I.l(E)&&(w=w.add(y),S=I),v=$(v,1),y=$(y,1)}return _=L(E,w.j(_)),new x(w,_)}for(w=p;0<=E.l(_);){for(y=Math.max(1,Math.floor(E.m()/_.m())),v=Math.ceil(Math.log(y)/Math.LN2),v=48>=v?1:Math.pow(2,v-48),S=h(y),I=S.j(_);V(I)||0<I.l(E);)y-=v,S=h(y),I=S.j(_);P(S)&&(S=m),w=w.add(S),E=L(E,I)}return new x(w,E)}r.A=function(E){return j(this,E).h},r.and=function(E){for(var _=Math.max(this.g.length,E.g.length),y=[],v=0;v<_;v++)y[v]=this.i(v)&E.i(v);return new o(y,this.h&E.h)},r.or=function(E){for(var _=Math.max(this.g.length,E.g.length),y=[],v=0;v<_;v++)y[v]=this.i(v)|E.i(v);return new o(y,this.h|E.h)},r.xor=function(E){for(var _=Math.max(this.g.length,E.g.length),y=[],v=0;v<_;v++)y[v]=this.i(v)^E.i(v);return new o(y,this.h^E.h)};function H(E){for(var _=E.g.length+1,y=[],v=0;v<_;v++)y[v]=E.i(v)<<1|E.i(v-1)>>>31;return new o(y,E.h)}function $(E,_){var y=_>>5;_%=32;for(var v=E.g.length-y,w=[],S=0;S<v;S++)w[S]=0<_?E.i(S+y)>>>_|E.i(S+y+1)<<32-_:E.i(S+y);return new o(w,E.h)}n.prototype.digest=n.prototype.v,n.prototype.reset=n.prototype.s,n.prototype.update=n.prototype.u,kp=n,o.prototype.add=o.prototype.add,o.prototype.multiply=o.prototype.j,o.prototype.modulo=o.prototype.A,o.prototype.compare=o.prototype.l,o.prototype.toNumber=o.prototype.m,o.prototype.toString=o.prototype.toString,o.prototype.getBits=o.prototype.i,o.fromNumber=h,o.fromString=f,un=o}).apply(typeof nd<"u"?nd:typeof self<"u"?self:typeof window<"u"?window:{});var so=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var Vp,Fs,Dp,Io,bc,Np,xp,Op;(function(){var r,e=typeof Object.defineProperties=="function"?Object.defineProperty:function(a,l,d){return a==Array.prototype||a==Object.prototype||(a[l]=d.value),a};function t(a){a=[typeof globalThis=="object"&&globalThis,a,typeof window=="object"&&window,typeof self=="object"&&self,typeof so=="object"&&so];for(var l=0;l<a.length;++l){var d=a[l];if(d&&d.Math==Math)return d}throw Error("Cannot find global object")}var n=t(this);function s(a,l){if(l)e:{var d=n;a=a.split(".");for(var g=0;g<a.length-1;g++){var b=a[g];if(!(b in d))break e;d=d[b]}a=a[a.length-1],g=d[a],l=l(g),l!=g&&l!=null&&e(d,a,{configurable:!0,writable:!0,value:l})}}function i(a,l){a instanceof String&&(a+="");var d=0,g=!1,b={next:function(){if(!g&&d<a.length){var k=d++;return{value:l(k,a[k]),done:!1}}return g=!0,{done:!0,value:void 0}}};return b[Symbol.iterator]=function(){return b},b}s("Array.prototype.values",function(a){return a||function(){return i(this,function(l,d){return d})}});/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/var o=o||{},c=this||self;function u(a){var l=typeof a;return l=l!="object"?l:a?Array.isArray(a)?"array":l:"null",l=="array"||l=="object"&&typeof a.length=="number"}function h(a){var l=typeof a;return l=="object"&&a!=null||l=="function"}function f(a,l,d){return a.call.apply(a.bind,arguments)}function p(a,l,d){if(!a)throw Error();if(2<arguments.length){var g=Array.prototype.slice.call(arguments,2);return function(){var b=Array.prototype.slice.call(arguments);return Array.prototype.unshift.apply(b,g),a.apply(l,b)}}return function(){return a.apply(l,arguments)}}function m(a,l,d){return m=Function.prototype.bind&&Function.prototype.bind.toString().indexOf("native code")!=-1?f:p,m.apply(null,arguments)}function T(a,l){var d=Array.prototype.slice.call(arguments,1);return function(){var g=d.slice();return g.push.apply(g,arguments),a.apply(this,g)}}function P(a,l){function d(){}d.prototype=l.prototype,a.aa=l.prototype,a.prototype=new d,a.prototype.constructor=a,a.Qb=function(g,b,k){for(var F=Array(arguments.length-2),ae=2;ae<arguments.length;ae++)F[ae-2]=arguments[ae];return l.prototype[b].apply(g,F)}}function V(a){const l=a.length;if(0<l){const d=Array(l);for(let g=0;g<l;g++)d[g]=a[g];return d}return[]}function C(a,l){for(let d=1;d<arguments.length;d++){const g=arguments[d];if(u(g)){const b=a.length||0,k=g.length||0;a.length=b+k;for(let F=0;F<k;F++)a[b+F]=g[F]}else a.push(g)}}class L{constructor(l,d){this.i=l,this.j=d,this.h=0,this.g=null}get(){let l;return 0<this.h?(this.h--,l=this.g,this.g=l.next,l.next=null):l=this.i(),l}}function U(a){return/^[\s\xa0]*$/.test(a)}function x(){var a=c.navigator;return a&&(a=a.userAgent)?a:""}function j(a){return j[" "](a),a}j[" "]=function(){};var H=x().indexOf("Gecko")!=-1&&!(x().toLowerCase().indexOf("webkit")!=-1&&x().indexOf("Edge")==-1)&&!(x().indexOf("Trident")!=-1||x().indexOf("MSIE")!=-1)&&x().indexOf("Edge")==-1;function $(a,l,d){for(const g in a)l.call(d,a[g],g,a)}function E(a,l){for(const d in a)l.call(void 0,a[d],d,a)}function _(a){const l={};for(const d in a)l[d]=a[d];return l}const y="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function v(a,l){let d,g;for(let b=1;b<arguments.length;b++){g=arguments[b];for(d in g)a[d]=g[d];for(let k=0;k<y.length;k++)d=y[k],Object.prototype.hasOwnProperty.call(g,d)&&(a[d]=g[d])}}function w(a){var l=1;a=a.split(":");const d=[];for(;0<l&&a.length;)d.push(a.shift()),l--;return a.length&&d.push(a.join(":")),d}function S(a){c.setTimeout(()=>{throw a},0)}function I(){var a=Oa;let l=null;return a.g&&(l=a.g,a.g=a.g.next,a.g||(a.h=null),l.next=null),l}class At{constructor(){this.h=this.g=null}add(l,d){const g=fs.get();g.set(l,d),this.h?this.h.next=g:this.g=g,this.h=g}}var fs=new L(()=>new H_,a=>a.reset());class H_{constructor(){this.next=this.g=this.h=null}set(l,d){this.h=l,this.g=d,this.next=null}reset(){this.next=this.g=this.h=null}}let ps,ms=!1,Oa=new At,Cl=()=>{const a=c.Promise.resolve(void 0);ps=()=>{a.then(Q_)}};var Q_=()=>{for(var a;a=I();){try{a.h.call(a.g)}catch(d){S(d)}var l=fs;l.j(a),100>l.h&&(l.h++,a.next=l.g,l.g=a)}ms=!1};function Gt(){this.s=this.s,this.C=this.C}Gt.prototype.s=!1,Gt.prototype.ma=function(){this.s||(this.s=!0,this.N())},Gt.prototype.N=function(){if(this.C)for(;this.C.length;)this.C.shift()()};function De(a,l){this.type=a,this.g=this.target=l,this.defaultPrevented=!1}De.prototype.h=function(){this.defaultPrevented=!0};var X_=(function(){if(!c.addEventListener||!Object.defineProperty)return!1;var a=!1,l=Object.defineProperty({},"passive",{get:function(){a=!0}});try{const d=()=>{};c.addEventListener("test",d,l),c.removeEventListener("test",d,l)}catch{}return a})();function gs(a,l){if(De.call(this,a?a.type:""),this.relatedTarget=this.g=this.target=null,this.button=this.screenY=this.screenX=this.clientY=this.clientX=0,this.key="",this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1,this.state=null,this.pointerId=0,this.pointerType="",this.i=null,a){var d=this.type=a.type,g=a.changedTouches&&a.changedTouches.length?a.changedTouches[0]:null;if(this.target=a.target||a.srcElement,this.g=l,l=a.relatedTarget){if(H){e:{try{j(l.nodeName);var b=!0;break e}catch{}b=!1}b||(l=null)}}else d=="mouseover"?l=a.fromElement:d=="mouseout"&&(l=a.toElement);this.relatedTarget=l,g?(this.clientX=g.clientX!==void 0?g.clientX:g.pageX,this.clientY=g.clientY!==void 0?g.clientY:g.pageY,this.screenX=g.screenX||0,this.screenY=g.screenY||0):(this.clientX=a.clientX!==void 0?a.clientX:a.pageX,this.clientY=a.clientY!==void 0?a.clientY:a.pageY,this.screenX=a.screenX||0,this.screenY=a.screenY||0),this.button=a.button,this.key=a.key||"",this.ctrlKey=a.ctrlKey,this.altKey=a.altKey,this.shiftKey=a.shiftKey,this.metaKey=a.metaKey,this.pointerId=a.pointerId||0,this.pointerType=typeof a.pointerType=="string"?a.pointerType:J_[a.pointerType]||"",this.state=a.state,this.i=a,a.defaultPrevented&&gs.aa.h.call(this)}}P(gs,De);var J_={2:"touch",3:"pen",4:"mouse"};gs.prototype.h=function(){gs.aa.h.call(this);var a=this.i;a.preventDefault?a.preventDefault():a.returnValue=!1};var Fi="closure_listenable_"+(1e6*Math.random()|0),Y_=0;function Z_(a,l,d,g,b){this.listener=a,this.proxy=null,this.src=l,this.type=d,this.capture=!!g,this.ha=b,this.key=++Y_,this.da=this.fa=!1}function Ui(a){a.da=!0,a.listener=null,a.proxy=null,a.src=null,a.ha=null}function Bi(a){this.src=a,this.g={},this.h=0}Bi.prototype.add=function(a,l,d,g,b){var k=a.toString();a=this.g[k],a||(a=this.g[k]=[],this.h++);var F=La(a,l,g,b);return-1<F?(l=a[F],d||(l.fa=!1)):(l=new Z_(l,this.src,k,!!g,b),l.fa=d,a.push(l)),l};function Ma(a,l){var d=l.type;if(d in a.g){var g=a.g[d],b=Array.prototype.indexOf.call(g,l,void 0),k;(k=0<=b)&&Array.prototype.splice.call(g,b,1),k&&(Ui(l),a.g[d].length==0&&(delete a.g[d],a.h--))}}function La(a,l,d,g){for(var b=0;b<a.length;++b){var k=a[b];if(!k.da&&k.listener==l&&k.capture==!!d&&k.ha==g)return b}return-1}var Fa="closure_lm_"+(1e6*Math.random()|0),Ua={};function kl(a,l,d,g,b){if(Array.isArray(l)){for(var k=0;k<l.length;k++)kl(a,l[k],d,g,b);return null}return d=Nl(d),a&&a[Fi]?a.K(l,d,h(g)?!!g.capture:!1,b):ey(a,l,d,!1,g,b)}function ey(a,l,d,g,b,k){if(!l)throw Error("Invalid event type");var F=h(b)?!!b.capture:!!b,ae=qa(a);if(ae||(a[Fa]=ae=new Bi(a)),d=ae.add(l,d,g,F,k),d.proxy)return d;if(g=ty(),d.proxy=g,g.src=a,g.listener=d,a.addEventListener)X_||(b=F),b===void 0&&(b=!1),a.addEventListener(l.toString(),g,b);else if(a.attachEvent)a.attachEvent(Dl(l.toString()),g);else if(a.addListener&&a.removeListener)a.addListener(g);else throw Error("addEventListener and attachEvent are unavailable.");return d}function ty(){function a(d){return l.call(a.src,a.listener,d)}const l=ny;return a}function Vl(a,l,d,g,b){if(Array.isArray(l))for(var k=0;k<l.length;k++)Vl(a,l[k],d,g,b);else g=h(g)?!!g.capture:!!g,d=Nl(d),a&&a[Fi]?(a=a.i,l=String(l).toString(),l in a.g&&(k=a.g[l],d=La(k,d,g,b),-1<d&&(Ui(k[d]),Array.prototype.splice.call(k,d,1),k.length==0&&(delete a.g[l],a.h--)))):a&&(a=qa(a))&&(l=a.g[l.toString()],a=-1,l&&(a=La(l,d,g,b)),(d=-1<a?l[a]:null)&&Ba(d))}function Ba(a){if(typeof a!="number"&&a&&!a.da){var l=a.src;if(l&&l[Fi])Ma(l.i,a);else{var d=a.type,g=a.proxy;l.removeEventListener?l.removeEventListener(d,g,a.capture):l.detachEvent?l.detachEvent(Dl(d),g):l.addListener&&l.removeListener&&l.removeListener(g),(d=qa(l))?(Ma(d,a),d.h==0&&(d.src=null,l[Fa]=null)):Ui(a)}}}function Dl(a){return a in Ua?Ua[a]:Ua[a]="on"+a}function ny(a,l){if(a.da)a=!0;else{l=new gs(l,this);var d=a.listener,g=a.ha||a.src;a.fa&&Ba(a),a=d.call(g,l)}return a}function qa(a){return a=a[Fa],a instanceof Bi?a:null}var ja="__closure_events_fn_"+(1e9*Math.random()>>>0);function Nl(a){return typeof a=="function"?a:(a[ja]||(a[ja]=function(l){return a.handleEvent(l)}),a[ja])}function Ne(){Gt.call(this),this.i=new Bi(this),this.M=this,this.F=null}P(Ne,Gt),Ne.prototype[Fi]=!0,Ne.prototype.removeEventListener=function(a,l,d,g){Vl(this,a,l,d,g)};function qe(a,l){var d,g=a.F;if(g)for(d=[];g;g=g.F)d.push(g);if(a=a.M,g=l.type||l,typeof l=="string")l=new De(l,a);else if(l instanceof De)l.target=l.target||a;else{var b=l;l=new De(g,a),v(l,b)}if(b=!0,d)for(var k=d.length-1;0<=k;k--){var F=l.g=d[k];b=qi(F,g,!0,l)&&b}if(F=l.g=a,b=qi(F,g,!0,l)&&b,b=qi(F,g,!1,l)&&b,d)for(k=0;k<d.length;k++)F=l.g=d[k],b=qi(F,g,!1,l)&&b}Ne.prototype.N=function(){if(Ne.aa.N.call(this),this.i){var a=this.i,l;for(l in a.g){for(var d=a.g[l],g=0;g<d.length;g++)Ui(d[g]);delete a.g[l],a.h--}}this.F=null},Ne.prototype.K=function(a,l,d,g){return this.i.add(String(a),l,!1,d,g)},Ne.prototype.L=function(a,l,d,g){return this.i.add(String(a),l,!0,d,g)};function qi(a,l,d,g){if(l=a.i.g[String(l)],!l)return!0;l=l.concat();for(var b=!0,k=0;k<l.length;++k){var F=l[k];if(F&&!F.da&&F.capture==d){var ae=F.listener,Ce=F.ha||F.src;F.fa&&Ma(a.i,F),b=ae.call(Ce,g)!==!1&&b}}return b&&!g.defaultPrevented}function xl(a,l,d){if(typeof a=="function")d&&(a=m(a,d));else if(a&&typeof a.handleEvent=="function")a=m(a.handleEvent,a);else throw Error("Invalid listener argument");return 2147483647<Number(l)?-1:c.setTimeout(a,l||0)}function Ol(a){a.g=xl(()=>{a.g=null,a.i&&(a.i=!1,Ol(a))},a.l);const l=a.h;a.h=null,a.m.apply(null,l)}class ry extends Gt{constructor(l,d){super(),this.m=l,this.l=d,this.h=null,this.i=!1,this.g=null}j(l){this.h=arguments,this.g?this.i=!0:Ol(this)}N(){super.N(),this.g&&(c.clearTimeout(this.g),this.g=null,this.i=!1,this.h=null)}}function _s(a){Gt.call(this),this.h=a,this.g={}}P(_s,Gt);var Ml=[];function Ll(a){$(a.g,function(l,d){this.g.hasOwnProperty(d)&&Ba(l)},a),a.g={}}_s.prototype.N=function(){_s.aa.N.call(this),Ll(this)},_s.prototype.handleEvent=function(){throw Error("EventHandler.handleEvent not implemented")};var za=c.JSON.stringify,sy=c.JSON.parse,iy=class{stringify(a){return c.JSON.stringify(a,void 0)}parse(a){return c.JSON.parse(a,void 0)}};function $a(){}$a.prototype.h=null;function Fl(a){return a.h||(a.h=a.i())}function Ul(){}var ys={OPEN:"a",kb:"b",Ja:"c",wb:"d"};function Ga(){De.call(this,"d")}P(Ga,De);function Ka(){De.call(this,"c")}P(Ka,De);var Pn={},Bl=null;function ji(){return Bl=Bl||new Ne}Pn.La="serverreachability";function ql(a){De.call(this,Pn.La,a)}P(ql,De);function Is(a){const l=ji();qe(l,new ql(l))}Pn.STAT_EVENT="statevent";function jl(a,l){De.call(this,Pn.STAT_EVENT,a),this.stat=l}P(jl,De);function je(a){const l=ji();qe(l,new jl(l,a))}Pn.Ma="timingevent";function zl(a,l){De.call(this,Pn.Ma,a),this.size=l}P(zl,De);function Ts(a,l){if(typeof a!="function")throw Error("Fn must not be null and must be a function");return c.setTimeout(function(){a()},l)}function Es(){this.g=!0}Es.prototype.xa=function(){this.g=!1};function oy(a,l,d,g,b,k){a.info(function(){if(a.g)if(k)for(var F="",ae=k.split("&"),Ce=0;Ce<ae.length;Ce++){var te=ae[Ce].split("=");if(1<te.length){var xe=te[0];te=te[1];var Oe=xe.split("_");F=2<=Oe.length&&Oe[1]=="type"?F+(xe+"="+te+"&"):F+(xe+"=redacted&")}}else F=null;else F=k;return"XMLHTTP REQ ("+g+") [attempt "+b+"]: "+l+`
`+d+`
`+F})}function ay(a,l,d,g,b,k,F){a.info(function(){return"XMLHTTP RESP ("+g+") [ attempt "+b+"]: "+l+`
`+d+`
`+k+" "+F})}function hr(a,l,d,g){a.info(function(){return"XMLHTTP TEXT ("+l+"): "+uy(a,d)+(g?" "+g:"")})}function cy(a,l){a.info(function(){return"TIMEOUT: "+l})}Es.prototype.info=function(){};function uy(a,l){if(!a.g)return l;if(!l)return null;try{var d=JSON.parse(l);if(d){for(a=0;a<d.length;a++)if(Array.isArray(d[a])){var g=d[a];if(!(2>g.length)){var b=g[1];if(Array.isArray(b)&&!(1>b.length)){var k=b[0];if(k!="noop"&&k!="stop"&&k!="close")for(var F=1;F<b.length;F++)b[F]=""}}}}return za(d)}catch{return l}}var zi={NO_ERROR:0,gb:1,tb:2,sb:3,nb:4,rb:5,ub:6,Ia:7,TIMEOUT:8,xb:9},$l={lb:"complete",Hb:"success",Ja:"error",Ia:"abort",zb:"ready",Ab:"readystatechange",TIMEOUT:"timeout",vb:"incrementaldata",yb:"progress",ob:"downloadprogress",Pb:"uploadprogress"},Wa;function $i(){}P($i,$a),$i.prototype.g=function(){return new XMLHttpRequest},$i.prototype.i=function(){return{}},Wa=new $i;function Kt(a,l,d,g){this.j=a,this.i=l,this.l=d,this.R=g||1,this.U=new _s(this),this.I=45e3,this.H=null,this.o=!1,this.m=this.A=this.v=this.L=this.F=this.S=this.B=null,this.D=[],this.g=null,this.C=0,this.s=this.u=null,this.X=-1,this.J=!1,this.O=0,this.M=null,this.W=this.K=this.T=this.P=!1,this.h=new Gl}function Gl(){this.i=null,this.g="",this.h=!1}var Kl={},Ha={};function Qa(a,l,d){a.L=1,a.v=Hi(bt(l)),a.m=d,a.P=!0,Wl(a,null)}function Wl(a,l){a.F=Date.now(),Gi(a),a.A=bt(a.v);var d=a.A,g=a.R;Array.isArray(g)||(g=[String(g)]),ah(d.i,"t",g),a.C=0,d=a.j.J,a.h=new Gl,a.g=bh(a.j,d?l:null,!a.m),0<a.O&&(a.M=new ry(m(a.Y,a,a.g),a.O)),l=a.U,d=a.g,g=a.ca;var b="readystatechange";Array.isArray(b)||(b&&(Ml[0]=b.toString()),b=Ml);for(var k=0;k<b.length;k++){var F=kl(d,b[k],g||l.handleEvent,!1,l.h||l);if(!F)break;l.g[F.key]=F}l=a.H?_(a.H):{},a.m?(a.u||(a.u="POST"),l["Content-Type"]="application/x-www-form-urlencoded",a.g.ea(a.A,a.u,a.m,l)):(a.u="GET",a.g.ea(a.A,a.u,null,l)),Is(),oy(a.i,a.u,a.A,a.l,a.R,a.m)}Kt.prototype.ca=function(a){a=a.target;const l=this.M;l&&Rt(a)==3?l.j():this.Y(a)},Kt.prototype.Y=function(a){try{if(a==this.g)e:{const Oe=Rt(this.g);var l=this.g.Ba();const pr=this.g.Z();if(!(3>Oe)&&(Oe!=3||this.g&&(this.h.h||this.g.oa()||ph(this.g)))){this.J||Oe!=4||l==7||(l==8||0>=pr?Is(3):Is(2)),Xa(this);var d=this.g.Z();this.X=d;t:if(Hl(this)){var g=ph(this.g);a="";var b=g.length,k=Rt(this.g)==4;if(!this.h.i){if(typeof TextDecoder>"u"){Cn(this),vs(this);var F="";break t}this.h.i=new c.TextDecoder}for(l=0;l<b;l++)this.h.h=!0,a+=this.h.i.decode(g[l],{stream:!(k&&l==b-1)});g.length=0,this.h.g+=a,this.C=0,F=this.h.g}else F=this.g.oa();if(this.o=d==200,ay(this.i,this.u,this.A,this.l,this.R,Oe,d),this.o){if(this.T&&!this.K){t:{if(this.g){var ae,Ce=this.g;if((ae=Ce.g?Ce.g.getResponseHeader("X-HTTP-Initial-Response"):null)&&!U(ae)){var te=ae;break t}}te=null}if(d=te)hr(this.i,this.l,d,"Initial handshake response via X-HTTP-Initial-Response"),this.K=!0,Ja(this,d);else{this.o=!1,this.s=3,je(12),Cn(this),vs(this);break e}}if(this.P){d=!0;let st;for(;!this.J&&this.C<F.length;)if(st=ly(this,F),st==Ha){Oe==4&&(this.s=4,je(14),d=!1),hr(this.i,this.l,null,"[Incomplete Response]");break}else if(st==Kl){this.s=4,je(15),hr(this.i,this.l,F,"[Invalid Chunk]"),d=!1;break}else hr(this.i,this.l,st,null),Ja(this,st);if(Hl(this)&&this.C!=0&&(this.h.g=this.h.g.slice(this.C),this.C=0),Oe!=4||F.length!=0||this.h.h||(this.s=1,je(16),d=!1),this.o=this.o&&d,!d)hr(this.i,this.l,F,"[Invalid Chunked Response]"),Cn(this),vs(this);else if(0<F.length&&!this.W){this.W=!0;var xe=this.j;xe.g==this&&xe.ba&&!xe.M&&(xe.j.info("Great, no buffering proxy detected. Bytes received: "+F.length),rc(xe),xe.M=!0,je(11))}}else hr(this.i,this.l,F,null),Ja(this,F);Oe==4&&Cn(this),this.o&&!this.J&&(Oe==4?Eh(this.j,this):(this.o=!1,Gi(this)))}else Sy(this.g),d==400&&0<F.indexOf("Unknown SID")?(this.s=3,je(12)):(this.s=0,je(13)),Cn(this),vs(this)}}}catch{}finally{}};function Hl(a){return a.g?a.u=="GET"&&a.L!=2&&a.j.Ca:!1}function ly(a,l){var d=a.C,g=l.indexOf(`
`,d);return g==-1?Ha:(d=Number(l.substring(d,g)),isNaN(d)?Kl:(g+=1,g+d>l.length?Ha:(l=l.slice(g,g+d),a.C=g+d,l)))}Kt.prototype.cancel=function(){this.J=!0,Cn(this)};function Gi(a){a.S=Date.now()+a.I,Ql(a,a.I)}function Ql(a,l){if(a.B!=null)throw Error("WatchDog timer not null");a.B=Ts(m(a.ba,a),l)}function Xa(a){a.B&&(c.clearTimeout(a.B),a.B=null)}Kt.prototype.ba=function(){this.B=null;const a=Date.now();0<=a-this.S?(cy(this.i,this.A),this.L!=2&&(Is(),je(17)),Cn(this),this.s=2,vs(this)):Ql(this,this.S-a)};function vs(a){a.j.G==0||a.J||Eh(a.j,a)}function Cn(a){Xa(a);var l=a.M;l&&typeof l.ma=="function"&&l.ma(),a.M=null,Ll(a.U),a.g&&(l=a.g,a.g=null,l.abort(),l.ma())}function Ja(a,l){try{var d=a.j;if(d.G!=0&&(d.g==a||Ya(d.h,a))){if(!a.K&&Ya(d.h,a)&&d.G==3){try{var g=d.Da.g.parse(l)}catch{g=null}if(Array.isArray(g)&&g.length==3){var b=g;if(b[0]==0){e:if(!d.u){if(d.g)if(d.g.F+3e3<a.F)eo(d),Yi(d);else break e;nc(d),je(18)}}else d.za=b[1],0<d.za-d.T&&37500>b[2]&&d.F&&d.v==0&&!d.C&&(d.C=Ts(m(d.Za,d),6e3));if(1>=Yl(d.h)&&d.ca){try{d.ca()}catch{}d.ca=void 0}}else Vn(d,11)}else if((a.K||d.g==a)&&eo(d),!U(l))for(b=d.Da.g.parse(l),l=0;l<b.length;l++){let te=b[l];if(d.T=te[0],te=te[1],d.G==2)if(te[0]=="c"){d.K=te[1],d.ia=te[2];const xe=te[3];xe!=null&&(d.la=xe,d.j.info("VER="+d.la));const Oe=te[4];Oe!=null&&(d.Aa=Oe,d.j.info("SVER="+d.Aa));const pr=te[5];pr!=null&&typeof pr=="number"&&0<pr&&(g=1.5*pr,d.L=g,d.j.info("backChannelRequestTimeoutMs_="+g)),g=d;const st=a.g;if(st){const no=st.g?st.g.getResponseHeader("X-Client-Wire-Protocol"):null;if(no){var k=g.h;k.g||no.indexOf("spdy")==-1&&no.indexOf("quic")==-1&&no.indexOf("h2")==-1||(k.j=k.l,k.g=new Set,k.h&&(Za(k,k.h),k.h=null))}if(g.D){const sc=st.g?st.g.getResponseHeader("X-HTTP-Session-Id"):null;sc&&(g.ya=sc,ue(g.I,g.D,sc))}}d.G=3,d.l&&d.l.ua(),d.ba&&(d.R=Date.now()-a.F,d.j.info("Handshake RTT: "+d.R+"ms")),g=d;var F=a;if(g.qa=Ah(g,g.J?g.ia:null,g.W),F.K){Zl(g.h,F);var ae=F,Ce=g.L;Ce&&(ae.I=Ce),ae.B&&(Xa(ae),Gi(ae)),g.g=F}else Ih(g);0<d.i.length&&Zi(d)}else te[0]!="stop"&&te[0]!="close"||Vn(d,7);else d.G==3&&(te[0]=="stop"||te[0]=="close"?te[0]=="stop"?Vn(d,7):tc(d):te[0]!="noop"&&d.l&&d.l.ta(te),d.v=0)}}Is(4)}catch{}}var hy=class{constructor(a,l){this.g=a,this.map=l}};function Xl(a){this.l=a||10,c.PerformanceNavigationTiming?(a=c.performance.getEntriesByType("navigation"),a=0<a.length&&(a[0].nextHopProtocol=="hq"||a[0].nextHopProtocol=="h2")):a=!!(c.chrome&&c.chrome.loadTimes&&c.chrome.loadTimes()&&c.chrome.loadTimes().wasFetchedViaSpdy),this.j=a?this.l:1,this.g=null,1<this.j&&(this.g=new Set),this.h=null,this.i=[]}function Jl(a){return a.h?!0:a.g?a.g.size>=a.j:!1}function Yl(a){return a.h?1:a.g?a.g.size:0}function Ya(a,l){return a.h?a.h==l:a.g?a.g.has(l):!1}function Za(a,l){a.g?a.g.add(l):a.h=l}function Zl(a,l){a.h&&a.h==l?a.h=null:a.g&&a.g.has(l)&&a.g.delete(l)}Xl.prototype.cancel=function(){if(this.i=eh(this),this.h)this.h.cancel(),this.h=null;else if(this.g&&this.g.size!==0){for(const a of this.g.values())a.cancel();this.g.clear()}};function eh(a){if(a.h!=null)return a.i.concat(a.h.D);if(a.g!=null&&a.g.size!==0){let l=a.i;for(const d of a.g.values())l=l.concat(d.D);return l}return V(a.i)}function dy(a){if(a.V&&typeof a.V=="function")return a.V();if(typeof Map<"u"&&a instanceof Map||typeof Set<"u"&&a instanceof Set)return Array.from(a.values());if(typeof a=="string")return a.split("");if(u(a)){for(var l=[],d=a.length,g=0;g<d;g++)l.push(a[g]);return l}l=[],d=0;for(g in a)l[d++]=a[g];return l}function fy(a){if(a.na&&typeof a.na=="function")return a.na();if(!a.V||typeof a.V!="function"){if(typeof Map<"u"&&a instanceof Map)return Array.from(a.keys());if(!(typeof Set<"u"&&a instanceof Set)){if(u(a)||typeof a=="string"){var l=[];a=a.length;for(var d=0;d<a;d++)l.push(d);return l}l=[],d=0;for(const g in a)l[d++]=g;return l}}}function th(a,l){if(a.forEach&&typeof a.forEach=="function")a.forEach(l,void 0);else if(u(a)||typeof a=="string")Array.prototype.forEach.call(a,l,void 0);else for(var d=fy(a),g=dy(a),b=g.length,k=0;k<b;k++)l.call(void 0,g[k],d&&d[k],a)}var nh=RegExp("^(?:([^:/?#.]+):)?(?://(?:([^\\\\/?#]*)@)?([^\\\\/?#]*?)(?::([0-9]+))?(?=[\\\\/?#]|$))?([^?#]+)?(?:\\?([^#]*))?(?:#([\\s\\S]*))?$");function py(a,l){if(a){a=a.split("&");for(var d=0;d<a.length;d++){var g=a[d].indexOf("="),b=null;if(0<=g){var k=a[d].substring(0,g);b=a[d].substring(g+1)}else k=a[d];l(k,b?decodeURIComponent(b.replace(/\+/g," ")):"")}}}function kn(a){if(this.g=this.o=this.j="",this.s=null,this.m=this.l="",this.h=!1,a instanceof kn){this.h=a.h,Ki(this,a.j),this.o=a.o,this.g=a.g,Wi(this,a.s),this.l=a.l;var l=a.i,d=new bs;d.i=l.i,l.g&&(d.g=new Map(l.g),d.h=l.h),rh(this,d),this.m=a.m}else a&&(l=String(a).match(nh))?(this.h=!1,Ki(this,l[1]||"",!0),this.o=ws(l[2]||""),this.g=ws(l[3]||"",!0),Wi(this,l[4]),this.l=ws(l[5]||"",!0),rh(this,l[6]||"",!0),this.m=ws(l[7]||"")):(this.h=!1,this.i=new bs(null,this.h))}kn.prototype.toString=function(){var a=[],l=this.j;l&&a.push(As(l,sh,!0),":");var d=this.g;return(d||l=="file")&&(a.push("//"),(l=this.o)&&a.push(As(l,sh,!0),"@"),a.push(encodeURIComponent(String(d)).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),d=this.s,d!=null&&a.push(":",String(d))),(d=this.l)&&(this.g&&d.charAt(0)!="/"&&a.push("/"),a.push(As(d,d.charAt(0)=="/"?_y:gy,!0))),(d=this.i.toString())&&a.push("?",d),(d=this.m)&&a.push("#",As(d,Iy)),a.join("")};function bt(a){return new kn(a)}function Ki(a,l,d){a.j=d?ws(l,!0):l,a.j&&(a.j=a.j.replace(/:$/,""))}function Wi(a,l){if(l){if(l=Number(l),isNaN(l)||0>l)throw Error("Bad port number "+l);a.s=l}else a.s=null}function rh(a,l,d){l instanceof bs?(a.i=l,Ty(a.i,a.h)):(d||(l=As(l,yy)),a.i=new bs(l,a.h))}function ue(a,l,d){a.i.set(l,d)}function Hi(a){return ue(a,"zx",Math.floor(2147483648*Math.random()).toString(36)+Math.abs(Math.floor(2147483648*Math.random())^Date.now()).toString(36)),a}function ws(a,l){return a?l?decodeURI(a.replace(/%25/g,"%2525")):decodeURIComponent(a):""}function As(a,l,d){return typeof a=="string"?(a=encodeURI(a).replace(l,my),d&&(a=a.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),a):null}function my(a){return a=a.charCodeAt(0),"%"+(a>>4&15).toString(16)+(a&15).toString(16)}var sh=/[#\/\?@]/g,gy=/[#\?:]/g,_y=/[#\?]/g,yy=/[#\?@]/g,Iy=/#/g;function bs(a,l){this.h=this.g=null,this.i=a||null,this.j=!!l}function Wt(a){a.g||(a.g=new Map,a.h=0,a.i&&py(a.i,function(l,d){a.add(decodeURIComponent(l.replace(/\+/g," ")),d)}))}r=bs.prototype,r.add=function(a,l){Wt(this),this.i=null,a=dr(this,a);var d=this.g.get(a);return d||this.g.set(a,d=[]),d.push(l),this.h+=1,this};function ih(a,l){Wt(a),l=dr(a,l),a.g.has(l)&&(a.i=null,a.h-=a.g.get(l).length,a.g.delete(l))}function oh(a,l){return Wt(a),l=dr(a,l),a.g.has(l)}r.forEach=function(a,l){Wt(this),this.g.forEach(function(d,g){d.forEach(function(b){a.call(l,b,g,this)},this)},this)},r.na=function(){Wt(this);const a=Array.from(this.g.values()),l=Array.from(this.g.keys()),d=[];for(let g=0;g<l.length;g++){const b=a[g];for(let k=0;k<b.length;k++)d.push(l[g])}return d},r.V=function(a){Wt(this);let l=[];if(typeof a=="string")oh(this,a)&&(l=l.concat(this.g.get(dr(this,a))));else{a=Array.from(this.g.values());for(let d=0;d<a.length;d++)l=l.concat(a[d])}return l},r.set=function(a,l){return Wt(this),this.i=null,a=dr(this,a),oh(this,a)&&(this.h-=this.g.get(a).length),this.g.set(a,[l]),this.h+=1,this},r.get=function(a,l){return a?(a=this.V(a),0<a.length?String(a[0]):l):l};function ah(a,l,d){ih(a,l),0<d.length&&(a.i=null,a.g.set(dr(a,l),V(d)),a.h+=d.length)}r.toString=function(){if(this.i)return this.i;if(!this.g)return"";const a=[],l=Array.from(this.g.keys());for(var d=0;d<l.length;d++){var g=l[d];const k=encodeURIComponent(String(g)),F=this.V(g);for(g=0;g<F.length;g++){var b=k;F[g]!==""&&(b+="="+encodeURIComponent(String(F[g]))),a.push(b)}}return this.i=a.join("&")};function dr(a,l){return l=String(l),a.j&&(l=l.toLowerCase()),l}function Ty(a,l){l&&!a.j&&(Wt(a),a.i=null,a.g.forEach(function(d,g){var b=g.toLowerCase();g!=b&&(ih(this,g),ah(this,b,d))},a)),a.j=l}function Ey(a,l){const d=new Es;if(c.Image){const g=new Image;g.onload=T(Ht,d,"TestLoadImage: loaded",!0,l,g),g.onerror=T(Ht,d,"TestLoadImage: error",!1,l,g),g.onabort=T(Ht,d,"TestLoadImage: abort",!1,l,g),g.ontimeout=T(Ht,d,"TestLoadImage: timeout",!1,l,g),c.setTimeout(function(){g.ontimeout&&g.ontimeout()},1e4),g.src=a}else l(!1)}function vy(a,l){const d=new Es,g=new AbortController,b=setTimeout(()=>{g.abort(),Ht(d,"TestPingServer: timeout",!1,l)},1e4);fetch(a,{signal:g.signal}).then(k=>{clearTimeout(b),k.ok?Ht(d,"TestPingServer: ok",!0,l):Ht(d,"TestPingServer: server error",!1,l)}).catch(()=>{clearTimeout(b),Ht(d,"TestPingServer: error",!1,l)})}function Ht(a,l,d,g,b){try{b&&(b.onload=null,b.onerror=null,b.onabort=null,b.ontimeout=null),g(d)}catch{}}function wy(){this.g=new iy}function Ay(a,l,d){const g=d||"";try{th(a,function(b,k){let F=b;h(b)&&(F=za(b)),l.push(g+k+"="+encodeURIComponent(F))})}catch(b){throw l.push(g+"type="+encodeURIComponent("_badmap")),b}}function Qi(a){this.l=a.Ub||null,this.j=a.eb||!1}P(Qi,$a),Qi.prototype.g=function(){return new Xi(this.l,this.j)},Qi.prototype.i=(function(a){return function(){return a}})({});function Xi(a,l){Ne.call(this),this.D=a,this.o=l,this.m=void 0,this.status=this.readyState=0,this.responseType=this.responseText=this.response=this.statusText="",this.onreadystatechange=null,this.u=new Headers,this.h=null,this.B="GET",this.A="",this.g=!1,this.v=this.j=this.l=null}P(Xi,Ne),r=Xi.prototype,r.open=function(a,l){if(this.readyState!=0)throw this.abort(),Error("Error reopening a connection");this.B=a,this.A=l,this.readyState=1,Ss(this)},r.send=function(a){if(this.readyState!=1)throw this.abort(),Error("need to call open() first. ");this.g=!0;const l={headers:this.u,method:this.B,credentials:this.m,cache:void 0};a&&(l.body=a),(this.D||c).fetch(new Request(this.A,l)).then(this.Sa.bind(this),this.ga.bind(this))},r.abort=function(){this.response=this.responseText="",this.u=new Headers,this.status=0,this.j&&this.j.cancel("Request was aborted.").catch(()=>{}),1<=this.readyState&&this.g&&this.readyState!=4&&(this.g=!1,Rs(this)),this.readyState=0},r.Sa=function(a){if(this.g&&(this.l=a,this.h||(this.status=this.l.status,this.statusText=this.l.statusText,this.h=a.headers,this.readyState=2,Ss(this)),this.g&&(this.readyState=3,Ss(this),this.g)))if(this.responseType==="arraybuffer")a.arrayBuffer().then(this.Qa.bind(this),this.ga.bind(this));else if(typeof c.ReadableStream<"u"&&"body"in a){if(this.j=a.body.getReader(),this.o){if(this.responseType)throw Error('responseType must be empty for "streamBinaryChunks" mode responses.');this.response=[]}else this.response=this.responseText="",this.v=new TextDecoder;ch(this)}else a.text().then(this.Ra.bind(this),this.ga.bind(this))};function ch(a){a.j.read().then(a.Pa.bind(a)).catch(a.ga.bind(a))}r.Pa=function(a){if(this.g){if(this.o&&a.value)this.response.push(a.value);else if(!this.o){var l=a.value?a.value:new Uint8Array(0);(l=this.v.decode(l,{stream:!a.done}))&&(this.response=this.responseText+=l)}a.done?Rs(this):Ss(this),this.readyState==3&&ch(this)}},r.Ra=function(a){this.g&&(this.response=this.responseText=a,Rs(this))},r.Qa=function(a){this.g&&(this.response=a,Rs(this))},r.ga=function(){this.g&&Rs(this)};function Rs(a){a.readyState=4,a.l=null,a.j=null,a.v=null,Ss(a)}r.setRequestHeader=function(a,l){this.u.append(a,l)},r.getResponseHeader=function(a){return this.h&&this.h.get(a.toLowerCase())||""},r.getAllResponseHeaders=function(){if(!this.h)return"";const a=[],l=this.h.entries();for(var d=l.next();!d.done;)d=d.value,a.push(d[0]+": "+d[1]),d=l.next();return a.join(`\r
`)};function Ss(a){a.onreadystatechange&&a.onreadystatechange.call(a)}Object.defineProperty(Xi.prototype,"withCredentials",{get:function(){return this.m==="include"},set:function(a){this.m=a?"include":"same-origin"}});function uh(a){let l="";return $(a,function(d,g){l+=g,l+=":",l+=d,l+=`\r
`}),l}function ec(a,l,d){e:{for(g in d){var g=!1;break e}g=!0}g||(d=uh(d),typeof a=="string"?d!=null&&encodeURIComponent(String(d)):ue(a,l,d))}function ye(a){Ne.call(this),this.headers=new Map,this.o=a||null,this.h=!1,this.v=this.g=null,this.D="",this.m=0,this.l="",this.j=this.B=this.u=this.A=!1,this.I=null,this.H="",this.J=!1}P(ye,Ne);var by=/^https?$/i,Ry=["POST","PUT"];r=ye.prototype,r.Ha=function(a){this.J=a},r.ea=function(a,l,d,g){if(this.g)throw Error("[goog.net.XhrIo] Object is active with another request="+this.D+"; newUri="+a);l=l?l.toUpperCase():"GET",this.D=a,this.l="",this.m=0,this.A=!1,this.h=!0,this.g=this.o?this.o.g():Wa.g(),this.v=this.o?Fl(this.o):Fl(Wa),this.g.onreadystatechange=m(this.Ea,this);try{this.B=!0,this.g.open(l,String(a),!0),this.B=!1}catch(k){lh(this,k);return}if(a=d||"",d=new Map(this.headers),g)if(Object.getPrototypeOf(g)===Object.prototype)for(var b in g)d.set(b,g[b]);else if(typeof g.keys=="function"&&typeof g.get=="function")for(const k of g.keys())d.set(k,g.get(k));else throw Error("Unknown input type for opt_headers: "+String(g));g=Array.from(d.keys()).find(k=>k.toLowerCase()=="content-type"),b=c.FormData&&a instanceof c.FormData,!(0<=Array.prototype.indexOf.call(Ry,l,void 0))||g||b||d.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");for(const[k,F]of d)this.g.setRequestHeader(k,F);this.H&&(this.g.responseType=this.H),"withCredentials"in this.g&&this.g.withCredentials!==this.J&&(this.g.withCredentials=this.J);try{fh(this),this.u=!0,this.g.send(a),this.u=!1}catch(k){lh(this,k)}};function lh(a,l){a.h=!1,a.g&&(a.j=!0,a.g.abort(),a.j=!1),a.l=l,a.m=5,hh(a),Ji(a)}function hh(a){a.A||(a.A=!0,qe(a,"complete"),qe(a,"error"))}r.abort=function(a){this.g&&this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1,this.m=a||7,qe(this,"complete"),qe(this,"abort"),Ji(this))},r.N=function(){this.g&&(this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1),Ji(this,!0)),ye.aa.N.call(this)},r.Ea=function(){this.s||(this.B||this.u||this.j?dh(this):this.bb())},r.bb=function(){dh(this)};function dh(a){if(a.h&&typeof o<"u"&&(!a.v[1]||Rt(a)!=4||a.Z()!=2)){if(a.u&&Rt(a)==4)xl(a.Ea,0,a);else if(qe(a,"readystatechange"),Rt(a)==4){a.h=!1;try{const F=a.Z();e:switch(F){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var l=!0;break e;default:l=!1}var d;if(!(d=l)){var g;if(g=F===0){var b=String(a.D).match(nh)[1]||null;!b&&c.self&&c.self.location&&(b=c.self.location.protocol.slice(0,-1)),g=!by.test(b?b.toLowerCase():"")}d=g}if(d)qe(a,"complete"),qe(a,"success");else{a.m=6;try{var k=2<Rt(a)?a.g.statusText:""}catch{k=""}a.l=k+" ["+a.Z()+"]",hh(a)}}finally{Ji(a)}}}}function Ji(a,l){if(a.g){fh(a);const d=a.g,g=a.v[0]?()=>{}:null;a.g=null,a.v=null,l||qe(a,"ready");try{d.onreadystatechange=g}catch{}}}function fh(a){a.I&&(c.clearTimeout(a.I),a.I=null)}r.isActive=function(){return!!this.g};function Rt(a){return a.g?a.g.readyState:0}r.Z=function(){try{return 2<Rt(this)?this.g.status:-1}catch{return-1}},r.oa=function(){try{return this.g?this.g.responseText:""}catch{return""}},r.Oa=function(a){if(this.g){var l=this.g.responseText;return a&&l.indexOf(a)==0&&(l=l.substring(a.length)),sy(l)}};function ph(a){try{if(!a.g)return null;if("response"in a.g)return a.g.response;switch(a.H){case"":case"text":return a.g.responseText;case"arraybuffer":if("mozResponseArrayBuffer"in a.g)return a.g.mozResponseArrayBuffer}return null}catch{return null}}function Sy(a){const l={};a=(a.g&&2<=Rt(a)&&a.g.getAllResponseHeaders()||"").split(`\r
`);for(let g=0;g<a.length;g++){if(U(a[g]))continue;var d=w(a[g]);const b=d[0];if(d=d[1],typeof d!="string")continue;d=d.trim();const k=l[b]||[];l[b]=k,k.push(d)}E(l,function(g){return g.join(", ")})}r.Ba=function(){return this.m},r.Ka=function(){return typeof this.l=="string"?this.l:String(this.l)};function Ps(a,l,d){return d&&d.internalChannelParams&&d.internalChannelParams[a]||l}function mh(a){this.Aa=0,this.i=[],this.j=new Es,this.ia=this.qa=this.I=this.W=this.g=this.ya=this.D=this.H=this.m=this.S=this.o=null,this.Ya=this.U=0,this.Va=Ps("failFast",!1,a),this.F=this.C=this.u=this.s=this.l=null,this.X=!0,this.za=this.T=-1,this.Y=this.v=this.B=0,this.Ta=Ps("baseRetryDelayMs",5e3,a),this.cb=Ps("retryDelaySeedMs",1e4,a),this.Wa=Ps("forwardChannelMaxRetries",2,a),this.wa=Ps("forwardChannelRequestTimeoutMs",2e4,a),this.pa=a&&a.xmlHttpFactory||void 0,this.Xa=a&&a.Tb||void 0,this.Ca=a&&a.useFetchStreams||!1,this.L=void 0,this.J=a&&a.supportsCrossDomainXhr||!1,this.K="",this.h=new Xl(a&&a.concurrentRequestLimit),this.Da=new wy,this.P=a&&a.fastHandshake||!1,this.O=a&&a.encodeInitMessageHeaders||!1,this.P&&this.O&&(this.O=!1),this.Ua=a&&a.Rb||!1,a&&a.xa&&this.j.xa(),a&&a.forceLongPolling&&(this.X=!1),this.ba=!this.P&&this.X&&a&&a.detectBufferingProxy||!1,this.ja=void 0,a&&a.longPollingTimeout&&0<a.longPollingTimeout&&(this.ja=a.longPollingTimeout),this.ca=void 0,this.R=0,this.M=!1,this.ka=this.A=null}r=mh.prototype,r.la=8,r.G=1,r.connect=function(a,l,d,g){je(0),this.W=a,this.H=l||{},d&&g!==void 0&&(this.H.OSID=d,this.H.OAID=g),this.F=this.X,this.I=Ah(this,null,this.W),Zi(this)};function tc(a){if(gh(a),a.G==3){var l=a.U++,d=bt(a.I);if(ue(d,"SID",a.K),ue(d,"RID",l),ue(d,"TYPE","terminate"),Cs(a,d),l=new Kt(a,a.j,l),l.L=2,l.v=Hi(bt(d)),d=!1,c.navigator&&c.navigator.sendBeacon)try{d=c.navigator.sendBeacon(l.v.toString(),"")}catch{}!d&&c.Image&&(new Image().src=l.v,d=!0),d||(l.g=bh(l.j,null),l.g.ea(l.v)),l.F=Date.now(),Gi(l)}wh(a)}function Yi(a){a.g&&(rc(a),a.g.cancel(),a.g=null)}function gh(a){Yi(a),a.u&&(c.clearTimeout(a.u),a.u=null),eo(a),a.h.cancel(),a.s&&(typeof a.s=="number"&&c.clearTimeout(a.s),a.s=null)}function Zi(a){if(!Jl(a.h)&&!a.s){a.s=!0;var l=a.Ga;ps||Cl(),ms||(ps(),ms=!0),Oa.add(l,a),a.B=0}}function Py(a,l){return Yl(a.h)>=a.h.j-(a.s?1:0)?!1:a.s?(a.i=l.D.concat(a.i),!0):a.G==1||a.G==2||a.B>=(a.Va?0:a.Wa)?!1:(a.s=Ts(m(a.Ga,a,l),vh(a,a.B)),a.B++,!0)}r.Ga=function(a){if(this.s)if(this.s=null,this.G==1){if(!a){this.U=Math.floor(1e5*Math.random()),a=this.U++;const b=new Kt(this,this.j,a);let k=this.o;if(this.S&&(k?(k=_(k),v(k,this.S)):k=this.S),this.m!==null||this.O||(b.H=k,k=null),this.P)e:{for(var l=0,d=0;d<this.i.length;d++){t:{var g=this.i[d];if("__data__"in g.map&&(g=g.map.__data__,typeof g=="string")){g=g.length;break t}g=void 0}if(g===void 0)break;if(l+=g,4096<l){l=d;break e}if(l===4096||d===this.i.length-1){l=d+1;break e}}l=1e3}else l=1e3;l=yh(this,b,l),d=bt(this.I),ue(d,"RID",a),ue(d,"CVER",22),this.D&&ue(d,"X-HTTP-Session-Id",this.D),Cs(this,d),k&&(this.O?l="headers="+encodeURIComponent(String(uh(k)))+"&"+l:this.m&&ec(d,this.m,k)),Za(this.h,b),this.Ua&&ue(d,"TYPE","init"),this.P?(ue(d,"$req",l),ue(d,"SID","null"),b.T=!0,Qa(b,d,null)):Qa(b,d,l),this.G=2}}else this.G==3&&(a?_h(this,a):this.i.length==0||Jl(this.h)||_h(this))};function _h(a,l){var d;l?d=l.l:d=a.U++;const g=bt(a.I);ue(g,"SID",a.K),ue(g,"RID",d),ue(g,"AID",a.T),Cs(a,g),a.m&&a.o&&ec(g,a.m,a.o),d=new Kt(a,a.j,d,a.B+1),a.m===null&&(d.H=a.o),l&&(a.i=l.D.concat(a.i)),l=yh(a,d,1e3),d.I=Math.round(.5*a.wa)+Math.round(.5*a.wa*Math.random()),Za(a.h,d),Qa(d,g,l)}function Cs(a,l){a.H&&$(a.H,function(d,g){ue(l,g,d)}),a.l&&th({},function(d,g){ue(l,g,d)})}function yh(a,l,d){d=Math.min(a.i.length,d);var g=a.l?m(a.l.Na,a.l,a):null;e:{var b=a.i;let k=-1;for(;;){const F=["count="+d];k==-1?0<d?(k=b[0].g,F.push("ofs="+k)):k=0:F.push("ofs="+k);let ae=!0;for(let Ce=0;Ce<d;Ce++){let te=b[Ce].g;const xe=b[Ce].map;if(te-=k,0>te)k=Math.max(0,b[Ce].g-100),ae=!1;else try{Ay(xe,F,"req"+te+"_")}catch{g&&g(xe)}}if(ae){g=F.join("&");break e}}}return a=a.i.splice(0,d),l.D=a,g}function Ih(a){if(!a.g&&!a.u){a.Y=1;var l=a.Fa;ps||Cl(),ms||(ps(),ms=!0),Oa.add(l,a),a.v=0}}function nc(a){return a.g||a.u||3<=a.v?!1:(a.Y++,a.u=Ts(m(a.Fa,a),vh(a,a.v)),a.v++,!0)}r.Fa=function(){if(this.u=null,Th(this),this.ba&&!(this.M||this.g==null||0>=this.R)){var a=2*this.R;this.j.info("BP detection timer enabled: "+a),this.A=Ts(m(this.ab,this),a)}},r.ab=function(){this.A&&(this.A=null,this.j.info("BP detection timeout reached."),this.j.info("Buffering proxy detected and switch to long-polling!"),this.F=!1,this.M=!0,je(10),Yi(this),Th(this))};function rc(a){a.A!=null&&(c.clearTimeout(a.A),a.A=null)}function Th(a){a.g=new Kt(a,a.j,"rpc",a.Y),a.m===null&&(a.g.H=a.o),a.g.O=0;var l=bt(a.qa);ue(l,"RID","rpc"),ue(l,"SID",a.K),ue(l,"AID",a.T),ue(l,"CI",a.F?"0":"1"),!a.F&&a.ja&&ue(l,"TO",a.ja),ue(l,"TYPE","xmlhttp"),Cs(a,l),a.m&&a.o&&ec(l,a.m,a.o),a.L&&(a.g.I=a.L);var d=a.g;a=a.ia,d.L=1,d.v=Hi(bt(l)),d.m=null,d.P=!0,Wl(d,a)}r.Za=function(){this.C!=null&&(this.C=null,Yi(this),nc(this),je(19))};function eo(a){a.C!=null&&(c.clearTimeout(a.C),a.C=null)}function Eh(a,l){var d=null;if(a.g==l){eo(a),rc(a),a.g=null;var g=2}else if(Ya(a.h,l))d=l.D,Zl(a.h,l),g=1;else return;if(a.G!=0){if(l.o)if(g==1){d=l.m?l.m.length:0,l=Date.now()-l.F;var b=a.B;g=ji(),qe(g,new zl(g,d)),Zi(a)}else Ih(a);else if(b=l.s,b==3||b==0&&0<l.X||!(g==1&&Py(a,l)||g==2&&nc(a)))switch(d&&0<d.length&&(l=a.h,l.i=l.i.concat(d)),b){case 1:Vn(a,5);break;case 4:Vn(a,10);break;case 3:Vn(a,6);break;default:Vn(a,2)}}}function vh(a,l){let d=a.Ta+Math.floor(Math.random()*a.cb);return a.isActive()||(d*=2),d*l}function Vn(a,l){if(a.j.info("Error code "+l),l==2){var d=m(a.fb,a),g=a.Xa;const b=!g;g=new kn(g||"//www.google.com/images/cleardot.gif"),c.location&&c.location.protocol=="http"||Ki(g,"https"),Hi(g),b?Ey(g.toString(),d):vy(g.toString(),d)}else je(2);a.G=0,a.l&&a.l.sa(l),wh(a),gh(a)}r.fb=function(a){a?(this.j.info("Successfully pinged google.com"),je(2)):(this.j.info("Failed to ping google.com"),je(1))};function wh(a){if(a.G=0,a.ka=[],a.l){const l=eh(a.h);(l.length!=0||a.i.length!=0)&&(C(a.ka,l),C(a.ka,a.i),a.h.i.length=0,V(a.i),a.i.length=0),a.l.ra()}}function Ah(a,l,d){var g=d instanceof kn?bt(d):new kn(d);if(g.g!="")l&&(g.g=l+"."+g.g),Wi(g,g.s);else{var b=c.location;g=b.protocol,l=l?l+"."+b.hostname:b.hostname,b=+b.port;var k=new kn(null);g&&Ki(k,g),l&&(k.g=l),b&&Wi(k,b),d&&(k.l=d),g=k}return d=a.D,l=a.ya,d&&l&&ue(g,d,l),ue(g,"VER",a.la),Cs(a,g),g}function bh(a,l,d){if(l&&!a.J)throw Error("Can't create secondary domain capable XhrIo object.");return l=a.Ca&&!a.pa?new ye(new Qi({eb:d})):new ye(a.pa),l.Ha(a.J),l}r.isActive=function(){return!!this.l&&this.l.isActive(this)};function Rh(){}r=Rh.prototype,r.ua=function(){},r.ta=function(){},r.sa=function(){},r.ra=function(){},r.isActive=function(){return!0},r.Na=function(){};function to(){}to.prototype.g=function(a,l){return new Ye(a,l)};function Ye(a,l){Ne.call(this),this.g=new mh(l),this.l=a,this.h=l&&l.messageUrlParams||null,a=l&&l.messageHeaders||null,l&&l.clientProtocolHeaderRequired&&(a?a["X-Client-Protocol"]="webchannel":a={"X-Client-Protocol":"webchannel"}),this.g.o=a,a=l&&l.initMessageHeaders||null,l&&l.messageContentType&&(a?a["X-WebChannel-Content-Type"]=l.messageContentType:a={"X-WebChannel-Content-Type":l.messageContentType}),l&&l.va&&(a?a["X-WebChannel-Client-Profile"]=l.va:a={"X-WebChannel-Client-Profile":l.va}),this.g.S=a,(a=l&&l.Sb)&&!U(a)&&(this.g.m=a),this.v=l&&l.supportsCrossDomainXhr||!1,this.u=l&&l.sendRawJson||!1,(l=l&&l.httpSessionIdParam)&&!U(l)&&(this.g.D=l,a=this.h,a!==null&&l in a&&(a=this.h,l in a&&delete a[l])),this.j=new fr(this)}P(Ye,Ne),Ye.prototype.m=function(){this.g.l=this.j,this.v&&(this.g.J=!0),this.g.connect(this.l,this.h||void 0)},Ye.prototype.close=function(){tc(this.g)},Ye.prototype.o=function(a){var l=this.g;if(typeof a=="string"){var d={};d.__data__=a,a=d}else this.u&&(d={},d.__data__=za(a),a=d);l.i.push(new hy(l.Ya++,a)),l.G==3&&Zi(l)},Ye.prototype.N=function(){this.g.l=null,delete this.j,tc(this.g),delete this.g,Ye.aa.N.call(this)};function Sh(a){Ga.call(this),a.__headers__&&(this.headers=a.__headers__,this.statusCode=a.__status__,delete a.__headers__,delete a.__status__);var l=a.__sm__;if(l){e:{for(const d in l){a=d;break e}a=void 0}(this.i=a)&&(a=this.i,l=l!==null&&a in l?l[a]:void 0),this.data=l}else this.data=a}P(Sh,Ga);function Ph(){Ka.call(this),this.status=1}P(Ph,Ka);function fr(a){this.g=a}P(fr,Rh),fr.prototype.ua=function(){qe(this.g,"a")},fr.prototype.ta=function(a){qe(this.g,new Sh(a))},fr.prototype.sa=function(a){qe(this.g,new Ph)},fr.prototype.ra=function(){qe(this.g,"b")},to.prototype.createWebChannel=to.prototype.g,Ye.prototype.send=Ye.prototype.o,Ye.prototype.open=Ye.prototype.m,Ye.prototype.close=Ye.prototype.close,Op=function(){return new to},xp=function(){return ji()},Np=Pn,bc={mb:0,pb:1,qb:2,Jb:3,Ob:4,Lb:5,Mb:6,Kb:7,Ib:8,Nb:9,PROXY:10,NOPROXY:11,Gb:12,Cb:13,Db:14,Bb:15,Eb:16,Fb:17,ib:18,hb:19,jb:20},zi.NO_ERROR=0,zi.TIMEOUT=8,zi.HTTP_ERROR=6,Io=zi,$l.COMPLETE="complete",Dp=$l,Ul.EventType=ys,ys.OPEN="a",ys.CLOSE="b",ys.ERROR="c",ys.MESSAGE="d",Ne.prototype.listen=Ne.prototype.K,Fs=Ul,ye.prototype.listenOnce=ye.prototype.L,ye.prototype.getLastError=ye.prototype.Ka,ye.prototype.getLastErrorCode=ye.prototype.Ba,ye.prototype.getStatus=ye.prototype.Z,ye.prototype.getResponseJson=ye.prototype.Oa,ye.prototype.getResponseText=ye.prototype.oa,ye.prototype.send=ye.prototype.ea,ye.prototype.setWithCredentials=ye.prototype.Ha,Vp=ye}).apply(typeof so<"u"?so:typeof self<"u"?self:typeof window<"u"?window:{});const rd="@firebase/firestore",sd="4.8.0";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Se{constructor(e){this.uid=e}isAuthenticated(){return this.uid!=null}toKey(){return this.isAuthenticated()?"uid:"+this.uid:"anonymous-user"}isEqual(e){return e.uid===this.uid}}Se.UNAUTHENTICATED=new Se(null),Se.GOOGLE_CREDENTIALS=new Se("google-credentials-uid"),Se.FIRST_PARTY=new Se("first-party-uid"),Se.MOCK_USER=new Se("mock-user");/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let es="11.10.0";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const dn=new ru("@firebase/firestore");function vr(){return dn.logLevel}function hv(r){dn.setLogLevel(r)}function N(r,...e){if(dn.logLevel<=J.DEBUG){const t=e.map(mu);dn.debug(`Firestore (${es}): ${r}`,...t)}}function Ie(r,...e){if(dn.logLevel<=J.ERROR){const t=e.map(mu);dn.error(`Firestore (${es}): ${r}`,...t)}}function Be(r,...e){if(dn.logLevel<=J.WARN){const t=e.map(mu);dn.warn(`Firestore (${es}): ${r}`,...t)}}function mu(r){if(typeof r=="string")return r;try{/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/return(function(t){return JSON.stringify(t)})(r)}catch{return r}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function B(r,e,t){let n="Unexpected state";typeof e=="string"?n=e:t=e,Mp(r,n,t)}function Mp(r,e,t){let n=`FIRESTORE (${es}) INTERNAL ASSERTION FAILED: ${e} (ID: ${r.toString(16)})`;if(t!==void 0)try{n+=" CONTEXT: "+JSON.stringify(t)}catch{n+=" CONTEXT: "+t}throw Ie(n),new Error(n)}function q(r,e,t,n){let s="Unexpected state";typeof t=="string"?s=t:n=t,r||Mp(e,s,n)}function dv(r,e){r||B(57014,e)}function M(r,e){return r}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const R={OK:"ok",CANCELLED:"cancelled",UNKNOWN:"unknown",INVALID_ARGUMENT:"invalid-argument",DEADLINE_EXCEEDED:"deadline-exceeded",NOT_FOUND:"not-found",ALREADY_EXISTS:"already-exists",PERMISSION_DENIED:"permission-denied",UNAUTHENTICATED:"unauthenticated",RESOURCE_EXHAUSTED:"resource-exhausted",FAILED_PRECONDITION:"failed-precondition",ABORTED:"aborted",OUT_OF_RANGE:"out-of-range",UNIMPLEMENTED:"unimplemented",INTERNAL:"internal",UNAVAILABLE:"unavailable",DATA_LOSS:"data-loss"};class D extends vt{constructor(e,t){super(e,t),this.code=e,this.message=t,this.toString=()=>`${this.name}: [code=${this.code}]: ${this.message}`}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Pe{constructor(){this.promise=new Promise(((e,t)=>{this.resolve=e,this.reject=t}))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Lp{constructor(e,t){this.user=t,this.type="OAuth",this.headers=new Map,this.headers.set("Authorization",`Bearer ${e}`)}}class Fp{getToken(){return Promise.resolve(null)}invalidateToken(){}start(e,t){e.enqueueRetryable((()=>t(Se.UNAUTHENTICATED)))}shutdown(){}}class fv{constructor(e){this.token=e,this.changeListener=null}getToken(){return Promise.resolve(this.token)}invalidateToken(){}start(e,t){this.changeListener=t,e.enqueueRetryable((()=>t(this.token.user)))}shutdown(){this.changeListener=null}}class pv{constructor(e){this.t=e,this.currentUser=Se.UNAUTHENTICATED,this.i=0,this.forceRefresh=!1,this.auth=null}start(e,t){q(this.o===void 0,42304);let n=this.i;const s=u=>this.i!==n?(n=this.i,t(u)):Promise.resolve();let i=new Pe;this.o=()=>{this.i++,this.currentUser=this.u(),i.resolve(),i=new Pe,e.enqueueRetryable((()=>s(this.currentUser)))};const o=()=>{const u=i;e.enqueueRetryable((async()=>{await u.promise,await s(this.currentUser)}))},c=u=>{N("FirebaseAuthCredentialsProvider","Auth detected"),this.auth=u,this.o&&(this.auth.addAuthTokenListener(this.o),o())};this.t.onInit((u=>c(u))),setTimeout((()=>{if(!this.auth){const u=this.t.getImmediate({optional:!0});u?c(u):(N("FirebaseAuthCredentialsProvider","Auth not yet detected"),i.resolve(),i=new Pe)}}),0),o()}getToken(){const e=this.i,t=this.forceRefresh;return this.forceRefresh=!1,this.auth?this.auth.getToken(t).then((n=>this.i!==e?(N("FirebaseAuthCredentialsProvider","getToken aborted due to token change."),this.getToken()):n?(q(typeof n.accessToken=="string",31837,{l:n}),new Lp(n.accessToken,this.currentUser)):null)):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.auth&&this.o&&this.auth.removeAuthTokenListener(this.o),this.o=void 0}u(){const e=this.auth&&this.auth.getUid();return q(e===null||typeof e=="string",2055,{h:e}),new Se(e)}}class mv{constructor(e,t,n){this.P=e,this.T=t,this.I=n,this.type="FirstParty",this.user=Se.FIRST_PARTY,this.A=new Map}R(){return this.I?this.I():null}get headers(){this.A.set("X-Goog-AuthUser",this.P);const e=this.R();return e&&this.A.set("Authorization",e),this.T&&this.A.set("X-Goog-Iam-Authorization-Token",this.T),this.A}}class gv{constructor(e,t,n){this.P=e,this.T=t,this.I=n}getToken(){return Promise.resolve(new mv(this.P,this.T,this.I))}start(e,t){e.enqueueRetryable((()=>t(Se.FIRST_PARTY)))}shutdown(){}invalidateToken(){}}class Rc{constructor(e){this.value=e,this.type="AppCheck",this.headers=new Map,e&&e.length>0&&this.headers.set("x-firebase-appcheck",this.value)}}class _v{constructor(e,t){this.V=t,this.forceRefresh=!1,this.appCheck=null,this.m=null,this.p=null,$e(e)&&e.settings.appCheckToken&&(this.p=e.settings.appCheckToken)}start(e,t){q(this.o===void 0,3512);const n=i=>{i.error!=null&&N("FirebaseAppCheckTokenProvider",`Error getting App Check token; using placeholder token instead. Error: ${i.error.message}`);const o=i.token!==this.m;return this.m=i.token,N("FirebaseAppCheckTokenProvider",`Received ${o?"new":"existing"} token.`),o?t(i.token):Promise.resolve()};this.o=i=>{e.enqueueRetryable((()=>n(i)))};const s=i=>{N("FirebaseAppCheckTokenProvider","AppCheck detected"),this.appCheck=i,this.o&&this.appCheck.addTokenListener(this.o)};this.V.onInit((i=>s(i))),setTimeout((()=>{if(!this.appCheck){const i=this.V.getImmediate({optional:!0});i?s(i):N("FirebaseAppCheckTokenProvider","AppCheck not yet detected")}}),0)}getToken(){if(this.p)return Promise.resolve(new Rc(this.p));const e=this.forceRefresh;return this.forceRefresh=!1,this.appCheck?this.appCheck.getToken(e).then((t=>t?(q(typeof t.token=="string",44558,{tokenResult:t}),this.m=t.token,new Rc(t.token)):null)):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.appCheck&&this.o&&this.appCheck.removeTokenListener(this.o),this.o=void 0}}class yv{getToken(){return Promise.resolve(new Rc(""))}invalidateToken(){}start(e,t){}shutdown(){}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Iv(r){const e=typeof self<"u"&&(self.crypto||self.msCrypto),t=new Uint8Array(r);if(e&&typeof e.getRandomValues=="function")e.getRandomValues(t);else for(let n=0;n<r;n++)t[n]=Math.floor(256*Math.random());return t}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function gu(){return new TextEncoder}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class aa{static newId(){const e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",t=62*Math.floor(4.129032258064516);let n="";for(;n.length<20;){const s=Iv(40);for(let i=0;i<s.length;++i)n.length<20&&s[i]<t&&(n+=e.charAt(s[i]%62))}return n}}function G(r,e){return r<e?-1:r>e?1:0}function Sc(r,e){let t=0;for(;t<r.length&&t<e.length;){const n=r.codePointAt(t),s=e.codePointAt(t);if(n!==s){if(n<128&&s<128)return G(n,s);{const i=gu(),o=Tv(i.encode(id(r,t)),i.encode(id(e,t)));return o!==0?o:G(n,s)}}t+=n>65535?2:1}return G(r.length,e.length)}function id(r,e){return r.codePointAt(e)>65535?r.substring(e,e+2):r.substring(e,e+1)}function Tv(r,e){for(let t=0;t<r.length&&t<e.length;++t)if(r[t]!==e[t])return G(r[t],e[t]);return G(r.length,e.length)}function Vr(r,e,t){return r.length===e.length&&r.every(((n,s)=>t(n,e[s])))}function Up(r){return r+"\0"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Pc="__name__";class dt{constructor(e,t,n){t===void 0?t=0:t>e.length&&B(637,{offset:t,range:e.length}),n===void 0?n=e.length-t:n>e.length-t&&B(1746,{length:n,range:e.length-t}),this.segments=e,this.offset=t,this.len=n}get length(){return this.len}isEqual(e){return dt.comparator(this,e)===0}child(e){const t=this.segments.slice(this.offset,this.limit());return e instanceof dt?e.forEach((n=>{t.push(n)})):t.push(e),this.construct(t)}limit(){return this.offset+this.length}popFirst(e){return e=e===void 0?1:e,this.construct(this.segments,this.offset+e,this.length-e)}popLast(){return this.construct(this.segments,this.offset,this.length-1)}firstSegment(){return this.segments[this.offset]}lastSegment(){return this.get(this.length-1)}get(e){return this.segments[this.offset+e]}isEmpty(){return this.length===0}isPrefixOf(e){if(e.length<this.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}isImmediateParentOf(e){if(this.length+1!==e.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}forEach(e){for(let t=this.offset,n=this.limit();t<n;t++)e(this.segments[t])}toArray(){return this.segments.slice(this.offset,this.limit())}static comparator(e,t){const n=Math.min(e.length,t.length);for(let s=0;s<n;s++){const i=dt.compareSegments(e.get(s),t.get(s));if(i!==0)return i}return G(e.length,t.length)}static compareSegments(e,t){const n=dt.isNumericId(e),s=dt.isNumericId(t);return n&&!s?-1:!n&&s?1:n&&s?dt.extractNumericId(e).compare(dt.extractNumericId(t)):Sc(e,t)}static isNumericId(e){return e.startsWith("__id")&&e.endsWith("__")}static extractNumericId(e){return un.fromString(e.substring(4,e.length-2))}}class Q extends dt{construct(e,t,n){return new Q(e,t,n)}canonicalString(){return this.toArray().join("/")}toString(){return this.canonicalString()}toUriEncodedString(){return this.toArray().map(encodeURIComponent).join("/")}static fromString(...e){const t=[];for(const n of e){if(n.indexOf("//")>=0)throw new D(R.INVALID_ARGUMENT,`Invalid segment (${n}). Paths must not contain // in them.`);t.push(...n.split("/").filter((s=>s.length>0)))}return new Q(t)}static emptyPath(){return new Q([])}}const Ev=/^[_a-zA-Z][_a-zA-Z0-9]*$/;class he extends dt{construct(e,t,n){return new he(e,t,n)}static isValidIdentifier(e){return Ev.test(e)}canonicalString(){return this.toArray().map((e=>(e=e.replace(/\\/g,"\\\\").replace(/`/g,"\\`"),he.isValidIdentifier(e)||(e="`"+e+"`"),e))).join(".")}toString(){return this.canonicalString()}isKeyField(){return this.length===1&&this.get(0)===Pc}static keyField(){return new he([Pc])}static fromServerFormat(e){const t=[];let n="",s=0;const i=()=>{if(n.length===0)throw new D(R.INVALID_ARGUMENT,`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`);t.push(n),n=""};let o=!1;for(;s<e.length;){const c=e[s];if(c==="\\"){if(s+1===e.length)throw new D(R.INVALID_ARGUMENT,"Path has trailing escape character: "+e);const u=e[s+1];if(u!=="\\"&&u!=="."&&u!=="`")throw new D(R.INVALID_ARGUMENT,"Path has invalid escape sequence: "+e);n+=u,s+=2}else c==="`"?(o=!o,s++):c!=="."||o?(n+=c,s++):(i(),s++)}if(i(),o)throw new D(R.INVALID_ARGUMENT,"Unterminated ` in path: "+e);return new he(t)}static emptyPath(){return new he([])}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class O{constructor(e){this.path=e}static fromPath(e){return new O(Q.fromString(e))}static fromName(e){return new O(Q.fromString(e).popFirst(5))}static empty(){return new O(Q.emptyPath())}get collectionGroup(){return this.path.popLast().lastSegment()}hasCollectionId(e){return this.path.length>=2&&this.path.get(this.path.length-2)===e}getCollectionGroup(){return this.path.get(this.path.length-2)}getCollectionPath(){return this.path.popLast()}isEqual(e){return e!==null&&Q.comparator(this.path,e.path)===0}toString(){return this.path.toString()}static comparator(e,t){return Q.comparator(e.path,t.path)}static isDocumentKey(e){return e.length%2==0}static fromSegments(e){return new O(new Q(e.slice()))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function _u(r,e,t){if(!t)throw new D(R.INVALID_ARGUMENT,`Function ${r}() cannot be called with an empty ${e}.`)}function Bp(r,e,t,n){if(e===!0&&n===!0)throw new D(R.INVALID_ARGUMENT,`${r} and ${t} cannot be used together.`)}function od(r){if(!O.isDocumentKey(r))throw new D(R.INVALID_ARGUMENT,`Invalid document reference. Document references must have an even number of segments, but ${r} has ${r.length}.`)}function ad(r){if(O.isDocumentKey(r))throw new D(R.INVALID_ARGUMENT,`Invalid collection reference. Collection references must have an odd number of segments, but ${r} has ${r.length}.`)}function qp(r){return typeof r=="object"&&r!==null&&(Object.getPrototypeOf(r)===Object.prototype||Object.getPrototypeOf(r)===null)}function ca(r){if(r===void 0)return"undefined";if(r===null)return"null";if(typeof r=="string")return r.length>20&&(r=`${r.substring(0,20)}...`),JSON.stringify(r);if(typeof r=="number"||typeof r=="boolean")return""+r;if(typeof r=="object"){if(r instanceof Array)return"an array";{const e=(function(n){return n.constructor?n.constructor.name:null})(r);return e?`a custom ${e} object`:"an object"}}return typeof r=="function"?"a function":B(12329,{type:typeof r})}function X(r,e){if("_delegate"in r&&(r=r._delegate),!(r instanceof e)){if(e.name===r.constructor.name)throw new D(R.INVALID_ARGUMENT,"Type does not match the expected instance. Did you pass a reference from a different Firestore SDK?");{const t=ca(r);throw new D(R.INVALID_ARGUMENT,`Expected type '${e.name}', but it was: ${t}`)}}return r}function jp(r,e){if(e<=0)throw new D(R.INVALID_ARGUMENT,`Function ${r}() requires a positive number, but it was: ${e}.`)}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ve(r,e){const t={typeString:r};return e&&(t.value=e),t}function or(r,e){if(!qp(r))throw new D(R.INVALID_ARGUMENT,"JSON must be an object");let t;for(const n in e)if(e[n]){const s=e[n].typeString,i="value"in e[n]?{value:e[n].value}:void 0;if(!(n in r)){t=`JSON missing required field: '${n}'`;break}const o=r[n];if(s&&typeof o!==s){t=`JSON field '${n}' must be a ${s}.`;break}if(i!==void 0&&o!==i.value){t=`Expected '${n}' field to equal '${i.value}'`;break}}if(t)throw new D(R.INVALID_ARGUMENT,t);return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const cd=-62135596800,ud=1e6;class ne{static now(){return ne.fromMillis(Date.now())}static fromDate(e){return ne.fromMillis(e.getTime())}static fromMillis(e){const t=Math.floor(e/1e3),n=Math.floor((e-1e3*t)*ud);return new ne(t,n)}constructor(e,t){if(this.seconds=e,this.nanoseconds=t,t<0)throw new D(R.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+t);if(t>=1e9)throw new D(R.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+t);if(e<cd)throw new D(R.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e);if(e>=253402300800)throw new D(R.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e)}toDate(){return new Date(this.toMillis())}toMillis(){return 1e3*this.seconds+this.nanoseconds/ud}_compareTo(e){return this.seconds===e.seconds?G(this.nanoseconds,e.nanoseconds):G(this.seconds,e.seconds)}isEqual(e){return e.seconds===this.seconds&&e.nanoseconds===this.nanoseconds}toString(){return"Timestamp(seconds="+this.seconds+", nanoseconds="+this.nanoseconds+")"}toJSON(){return{type:ne._jsonSchemaVersion,seconds:this.seconds,nanoseconds:this.nanoseconds}}static fromJSON(e){if(or(e,ne._jsonSchema))return new ne(e.seconds,e.nanoseconds)}valueOf(){const e=this.seconds-cd;return String(e).padStart(12,"0")+"."+String(this.nanoseconds).padStart(9,"0")}}ne._jsonSchemaVersion="firestore/timestamp/1.0",ne._jsonSchema={type:ve("string",ne._jsonSchemaVersion),seconds:ve("number"),nanoseconds:ve("number")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class z{static fromTimestamp(e){return new z(e)}static min(){return new z(new ne(0,0))}static max(){return new z(new ne(253402300799,999999999))}constructor(e){this.timestamp=e}compareTo(e){return this.timestamp._compareTo(e.timestamp)}isEqual(e){return this.timestamp.isEqual(e.timestamp)}toMicroseconds(){return 1e6*this.timestamp.seconds+this.timestamp.nanoseconds/1e3}toString(){return"SnapshotVersion("+this.timestamp.toString()+")"}toTimestamp(){return this.timestamp}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Dr=-1;class Nr{constructor(e,t,n,s){this.indexId=e,this.collectionGroup=t,this.fields=n,this.indexState=s}}function Cc(r){return r.fields.find((e=>e.kind===2))}function xn(r){return r.fields.filter((e=>e.kind!==2))}function vv(r,e){let t=G(r.collectionGroup,e.collectionGroup);if(t!==0)return t;for(let n=0;n<Math.min(r.fields.length,e.fields.length);++n)if(t=wv(r.fields[n],e.fields[n]),t!==0)return t;return G(r.fields.length,e.fields.length)}Nr.UNKNOWN_ID=-1;class zn{constructor(e,t){this.fieldPath=e,this.kind=t}}function wv(r,e){const t=he.comparator(r.fieldPath,e.fieldPath);return t!==0?t:G(r.kind,e.kind)}class xr{constructor(e,t){this.sequenceNumber=e,this.offset=t}static empty(){return new xr(0,tt.min())}}function zp(r,e){const t=r.toTimestamp().seconds,n=r.toTimestamp().nanoseconds+1,s=z.fromTimestamp(n===1e9?new ne(t+1,0):new ne(t,n));return new tt(s,O.empty(),e)}function $p(r){return new tt(r.readTime,r.key,Dr)}class tt{constructor(e,t,n){this.readTime=e,this.documentKey=t,this.largestBatchId=n}static min(){return new tt(z.min(),O.empty(),Dr)}static max(){return new tt(z.max(),O.empty(),Dr)}}function yu(r,e){let t=r.readTime.compareTo(e.readTime);return t!==0?t:(t=O.comparator(r.documentKey,e.documentKey),t!==0?t:G(r.largestBatchId,e.largestBatchId))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Gp="The current tab is not in the required state to perform this operation. It might be necessary to refresh the browser tab.";class Kp{constructor(){this.onCommittedListeners=[]}addOnCommittedListener(e){this.onCommittedListeners.push(e)}raiseOnCommittedEvent(){this.onCommittedListeners.forEach((e=>e()))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Tn(r){if(r.code!==R.FAILED_PRECONDITION||r.message!==Gp)throw r;N("LocalStore","Unexpectedly lost primary lease")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class A{constructor(e){this.nextCallback=null,this.catchCallback=null,this.result=void 0,this.error=void 0,this.isDone=!1,this.callbackAttached=!1,e((t=>{this.isDone=!0,this.result=t,this.nextCallback&&this.nextCallback(t)}),(t=>{this.isDone=!0,this.error=t,this.catchCallback&&this.catchCallback(t)}))}catch(e){return this.next(void 0,e)}next(e,t){return this.callbackAttached&&B(59440),this.callbackAttached=!0,this.isDone?this.error?this.wrapFailure(t,this.error):this.wrapSuccess(e,this.result):new A(((n,s)=>{this.nextCallback=i=>{this.wrapSuccess(e,i).next(n,s)},this.catchCallback=i=>{this.wrapFailure(t,i).next(n,s)}}))}toPromise(){return new Promise(((e,t)=>{this.next(e,t)}))}wrapUserFunction(e){try{const t=e();return t instanceof A?t:A.resolve(t)}catch(t){return A.reject(t)}}wrapSuccess(e,t){return e?this.wrapUserFunction((()=>e(t))):A.resolve(t)}wrapFailure(e,t){return e?this.wrapUserFunction((()=>e(t))):A.reject(t)}static resolve(e){return new A(((t,n)=>{t(e)}))}static reject(e){return new A(((t,n)=>{n(e)}))}static waitFor(e){return new A(((t,n)=>{let s=0,i=0,o=!1;e.forEach((c=>{++s,c.next((()=>{++i,o&&i===s&&t()}),(u=>n(u)))})),o=!0,i===s&&t()}))}static or(e){let t=A.resolve(!1);for(const n of e)t=t.next((s=>s?A.resolve(s):n()));return t}static forEach(e,t){const n=[];return e.forEach(((s,i)=>{n.push(t.call(this,s,i))})),this.waitFor(n)}static mapArray(e,t){return new A(((n,s)=>{const i=e.length,o=new Array(i);let c=0;for(let u=0;u<i;u++){const h=u;t(e[h]).next((f=>{o[h]=f,++c,c===i&&n(o)}),(f=>s(f)))}}))}static doWhile(e,t){return new A(((n,s)=>{const i=()=>{e()===!0?t().next((()=>{i()}),s):n()};i()}))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ze="SimpleDb";class ua{static open(e,t,n,s){try{return new ua(t,e.transaction(s,n))}catch(i){throw new $s(t,i)}}constructor(e,t){this.action=e,this.transaction=t,this.aborted=!1,this.S=new Pe,this.transaction.oncomplete=()=>{this.S.resolve()},this.transaction.onabort=()=>{t.error?this.S.reject(new $s(e,t.error)):this.S.resolve()},this.transaction.onerror=n=>{const s=Iu(n.target.error);this.S.reject(new $s(e,s))}}get D(){return this.S.promise}abort(e){e&&this.S.reject(e),this.aborted||(N(Ze,"Aborting transaction:",e?e.message:"Client-initiated abort"),this.aborted=!0,this.transaction.abort())}v(){const e=this.transaction;this.aborted||typeof e.commit!="function"||e.commit()}store(e){const t=this.transaction.objectStore(e);return new bv(t)}}class It{static delete(e){return N(Ze,"Removing database:",e),Mn(Lf().indexedDB.deleteDatabase(e)).toPromise()}static C(){if(!Kf())return!1;if(It.F())return!0;const e=we(),t=It.M(e),n=0<t&&t<10,s=Wp(e),i=0<s&&s<4.5;return!(e.indexOf("MSIE ")>0||e.indexOf("Trident/")>0||e.indexOf("Edge/")>0||n||i)}static F(){var e;return typeof process<"u"&&((e=process.__PRIVATE_env)===null||e===void 0?void 0:e.O)==="YES"}static N(e,t){return e.store(t)}static M(e){const t=e.match(/i(?:phone|pad|pod) os ([\d_]+)/i),n=t?t[1].split("_").slice(0,2).join("."):"-1";return Number(n)}constructor(e,t,n){this.name=e,this.version=t,this.B=n,this.L=null,It.M(we())===12.2&&Ie("Firestore persistence suffers from a bug in iOS 12.2 Safari that may cause your app to stop working. See https://stackoverflow.com/q/56496296/110915 for details and a potential workaround.")}async k(e){return this.db||(N(Ze,"Opening database:",this.name),this.db=await new Promise(((t,n)=>{const s=indexedDB.open(this.name,this.version);s.onsuccess=i=>{const o=i.target.result;t(o)},s.onblocked=()=>{n(new $s(e,"Cannot upgrade IndexedDB schema while another tab is open. Close all tabs that access Firestore and reload this page to proceed."))},s.onerror=i=>{const o=i.target.error;o.name==="VersionError"?n(new D(R.FAILED_PRECONDITION,"A newer version of the Firestore SDK was previously used and so the persisted data is not compatible with the version of the SDK you are now using. The SDK will operate with persistence disabled. If you need persistence, please re-upgrade to a newer version of the SDK or else clear the persisted IndexedDB data for your app to start fresh.")):o.name==="InvalidStateError"?n(new D(R.FAILED_PRECONDITION,"Unable to open an IndexedDB connection. This could be due to running in a private browsing session on a browser whose private browsing sessions do not support IndexedDB: "+o)):n(new $s(e,o))},s.onupgradeneeded=i=>{N(Ze,'Database "'+this.name+'" requires upgrade from version:',i.oldVersion);const o=i.target.result;if(this.L!==null&&this.L!==i.oldVersion)throw new Error(`refusing to open IndexedDB database due to potential corruption of the IndexedDB database data; this corruption could be caused by clicking the "clear site data" button in a web browser; try reloading the web page to re-initialize the IndexedDB database: lastClosedDbVersion=${this.L}, event.oldVersion=${i.oldVersion}, event.newVersion=${i.newVersion}, db.version=${o.version}`);this.B.q(o,s.transaction,i.oldVersion,this.version).next((()=>{N(Ze,"Database upgrade to version "+this.version+" complete")}))}})),this.db.addEventListener("close",(t=>{const n=t.target;this.L=n.version}),{passive:!0})),this.db.addEventListener("versionchange",(t=>{var n;t.newVersion===null&&(Be('Received "versionchange" event with newVersion===null; notifying the registered DatabaseDeletedListener, if any'),(n=this.databaseDeletedListener)===null||n===void 0||n.call(this))}),{passive:!0}),this.db}setDatabaseDeletedListener(e){if(this.databaseDeletedListener)throw new Error("setDatabaseDeletedListener() may only be called once, and it has already been called");this.databaseDeletedListener=e}async runTransaction(e,t,n,s){const i=t==="readonly";let o=0;for(;;){++o;try{this.db=await this.k(e);const c=ua.open(this.db,e,i?"readonly":"readwrite",n),u=s(c).next((h=>(c.v(),h))).catch((h=>(c.abort(h),A.reject(h)))).toPromise();return u.catch((()=>{})),await c.D,u}catch(c){const u=c,h=u.name!=="FirebaseError"&&o<3;if(N(Ze,"Transaction failed with error:",u.message,"Retrying:",h),this.close(),!h)return Promise.reject(u)}}}close(){this.db&&this.db.close(),this.db=void 0}}function Wp(r){const e=r.match(/Android ([\d.]+)/i),t=e?e[1].split(".").slice(0,2).join("."):"-1";return Number(t)}class Av{constructor(e){this.$=e,this.U=!1,this.K=null}get isDone(){return this.U}get W(){return this.K}set cursor(e){this.$=e}done(){this.U=!0}G(e){this.K=e}delete(){return Mn(this.$.delete())}}class $s extends D{constructor(e,t){super(R.UNAVAILABLE,`IndexedDB transaction '${e}' failed: ${t}`),this.name="IndexedDbTransactionError"}}function En(r){return r.name==="IndexedDbTransactionError"}class bv{constructor(e){this.store=e}put(e,t){let n;return t!==void 0?(N(Ze,"PUT",this.store.name,e,t),n=this.store.put(t,e)):(N(Ze,"PUT",this.store.name,"<auto-key>",e),n=this.store.put(e)),Mn(n)}add(e){return N(Ze,"ADD",this.store.name,e,e),Mn(this.store.add(e))}get(e){return Mn(this.store.get(e)).next((t=>(t===void 0&&(t=null),N(Ze,"GET",this.store.name,e,t),t)))}delete(e){return N(Ze,"DELETE",this.store.name,e),Mn(this.store.delete(e))}count(){return N(Ze,"COUNT",this.store.name),Mn(this.store.count())}j(e,t){const n=this.options(e,t),s=n.index?this.store.index(n.index):this.store;if(typeof s.getAll=="function"){const i=s.getAll(n.range);return new A(((o,c)=>{i.onerror=u=>{c(u.target.error)},i.onsuccess=u=>{o(u.target.result)}}))}{const i=this.cursor(n),o=[];return this.J(i,((c,u)=>{o.push(u)})).next((()=>o))}}H(e,t){const n=this.store.getAll(e,t===null?void 0:t);return new A(((s,i)=>{n.onerror=o=>{i(o.target.error)},n.onsuccess=o=>{s(o.target.result)}}))}Y(e,t){N(Ze,"DELETE ALL",this.store.name);const n=this.options(e,t);n.Z=!1;const s=this.cursor(n);return this.J(s,((i,o,c)=>c.delete()))}X(e,t){let n;t?n=e:(n={},t=e);const s=this.cursor(n);return this.J(s,t)}ee(e){const t=this.cursor({});return new A(((n,s)=>{t.onerror=i=>{const o=Iu(i.target.error);s(o)},t.onsuccess=i=>{const o=i.target.result;o?e(o.primaryKey,o.value).next((c=>{c?o.continue():n()})):n()}}))}J(e,t){const n=[];return new A(((s,i)=>{e.onerror=o=>{i(o.target.error)},e.onsuccess=o=>{const c=o.target.result;if(!c)return void s();const u=new Av(c),h=t(c.primaryKey,c.value,u);if(h instanceof A){const f=h.catch((p=>(u.done(),A.reject(p))));n.push(f)}u.isDone?s():u.W===null?c.continue():c.continue(u.W)}})).next((()=>A.waitFor(n)))}options(e,t){let n;return e!==void 0&&(typeof e=="string"?n=e:t=e),{index:n,range:t}}cursor(e){let t="next";if(e.reverse&&(t="prev"),e.index){const n=this.store.index(e.index);return e.Z?n.openKeyCursor(e.range,t):n.openCursor(e.range,t)}return this.store.openCursor(e.range,t)}}function Mn(r){return new A(((e,t)=>{r.onsuccess=n=>{const s=n.target.result;e(s)},r.onerror=n=>{const s=Iu(n.target.error);t(s)}}))}let ld=!1;function Iu(r){const e=It.M(we());if(e>=12.2&&e<13){const t="An internal error was encountered in the Indexed Database server";if(r.message.indexOf(t)>=0){const n=new D("internal",`IOS_INDEXEDDB_BUG1: IndexedDb has thrown '${t}'. This is likely due to an unavoidable bug in iOS. See https://stackoverflow.com/q/56496296/110915 for details and a potential workaround.`);return ld||(ld=!0,setTimeout((()=>{throw n}),0)),n}}return r}const Gs="IndexBackfiller";class Rv{constructor(e,t){this.asyncQueue=e,this.te=t,this.task=null}start(){this.ne(15e3)}stop(){this.task&&(this.task.cancel(),this.task=null)}get started(){return this.task!==null}ne(e){N(Gs,`Scheduled in ${e}ms`),this.task=this.asyncQueue.enqueueAfterDelay("index_backfill",e,(async()=>{this.task=null;try{const t=await this.te.re();N(Gs,`Documents written: ${t}`)}catch(t){En(t)?N(Gs,"Ignoring IndexedDB error during index backfill: ",t):await Tn(t)}await this.ne(6e4)}))}}class Sv{constructor(e,t){this.localStore=e,this.persistence=t}async re(e=50){return this.persistence.runTransaction("Backfill Indexes","readwrite-primary",(t=>this.ie(t,e)))}ie(e,t){const n=new Set;let s=t,i=!0;return A.doWhile((()=>i===!0&&s>0),(()=>this.localStore.indexManager.getNextCollectionGroupToUpdate(e).next((o=>{if(o!==null&&!n.has(o))return N(Gs,`Processing collection: ${o}`),this.se(e,o,s).next((c=>{s-=c,n.add(o)}));i=!1})))).next((()=>t-s))}se(e,t,n){return this.localStore.indexManager.getMinOffsetFromCollectionGroup(e,t).next((s=>this.localStore.localDocuments.getNextDocuments(e,t,s,n).next((i=>{const o=i.changes;return this.localStore.indexManager.updateIndexEntries(e,o).next((()=>this.oe(s,i))).next((c=>(N(Gs,`Updating offset: ${c}`),this.localStore.indexManager.updateCollectionGroup(e,t,c)))).next((()=>o.size))}))))}oe(e,t){let n=e;return t.changes.forEach(((s,i)=>{const o=$p(i);yu(o,n)>0&&(n=o)})),new tt(n.readTime,n.documentKey,Math.max(t.batchId,e.largestBatchId))}}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class We{constructor(e,t){this.previousValue=e,t&&(t.sequenceNumberHandler=n=>this._e(n),this.ae=n=>t.writeSequenceNumber(n))}_e(e){return this.previousValue=Math.max(e,this.previousValue),this.previousValue}next(){const e=++this.previousValue;return this.ae&&this.ae(e),e}}We.ue=-1;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ln=-1;function vi(r){return r==null}function ri(r){return r===0&&1/r==-1/0}function Hp(r){return typeof r=="number"&&Number.isInteger(r)&&!ri(r)&&r<=Number.MAX_SAFE_INTEGER&&r>=Number.MIN_SAFE_INTEGER}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Uo="";function Fe(r){let e="";for(let t=0;t<r.length;t++)e.length>0&&(e=hd(e)),e=Pv(r.get(t),e);return hd(e)}function Pv(r,e){let t=e;const n=r.length;for(let s=0;s<n;s++){const i=r.charAt(s);switch(i){case"\0":t+="";break;case Uo:t+="";break;default:t+=i}}return t}function hd(r){return r+Uo+""}function pt(r){const e=r.length;if(q(e>=2,64408,{path:r}),e===2)return q(r.charAt(0)===Uo&&r.charAt(1)==="",56145,{path:r}),Q.emptyPath();const t=e-2,n=[];let s="";for(let i=0;i<e;){const o=r.indexOf(Uo,i);switch((o<0||o>t)&&B(50515,{path:r}),r.charAt(o+1)){case"":const c=r.substring(i,o);let u;s.length===0?u=c:(s+=c,u=s,s=""),n.push(u);break;case"":s+=r.substring(i,o),s+="\0";break;case"":s+=r.substring(i,o+1);break;default:B(61167,{path:r})}i=o+2}return new Q(n)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const On="remoteDocuments",wi="owner",mr="owner",si="mutationQueues",Cv="userId",it="mutations",dd="batchId",jn="userMutationsIndex",fd=["userId","batchId"];/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function To(r,e){return[r,Fe(e)]}function Qp(r,e,t){return[r,Fe(e),t]}const kv={},Or="documentMutations",Bo="remoteDocumentsV14",Vv=["prefixPath","collectionGroup","readTime","documentId"],Eo="documentKeyIndex",Dv=["prefixPath","collectionGroup","documentId"],Xp="collectionGroupIndex",Nv=["collectionGroup","readTime","prefixPath","documentId"],ii="remoteDocumentGlobal",kc="remoteDocumentGlobalKey",Mr="targets",Jp="queryTargetsIndex",xv=["canonicalId","targetId"],Lr="targetDocuments",Ov=["targetId","path"],Tu="documentTargetsIndex",Mv=["path","targetId"],qo="targetGlobalKey",$n="targetGlobal",oi="collectionParents",Lv=["collectionId","parent"],Fr="clientMetadata",Fv="clientId",la="bundles",Uv="bundleId",ha="namedQueries",Bv="name",Eu="indexConfiguration",qv="indexId",Vc="collectionGroupIndex",jv="collectionGroup",Ks="indexState",zv=["indexId","uid"],Yp="sequenceNumberIndex",$v=["uid","sequenceNumber"],Ws="indexEntries",Gv=["indexId","uid","arrayValue","directionalValue","orderedDocumentKey","documentKey"],Zp="documentKeyIndex",Kv=["indexId","uid","orderedDocumentKey"],da="documentOverlays",Wv=["userId","collectionPath","documentId"],Dc="collectionPathOverlayIndex",Hv=["userId","collectionPath","largestBatchId"],em="collectionGroupOverlayIndex",Qv=["userId","collectionGroup","largestBatchId"],vu="globals",Xv="name",tm=[si,it,Or,On,Mr,wi,$n,Lr,Fr,ii,oi,la,ha],Jv=[...tm,da],nm=[si,it,Or,Bo,Mr,wi,$n,Lr,Fr,ii,oi,la,ha,da],rm=nm,wu=[...rm,Eu,Ks,Ws],Yv=wu,sm=[...wu,vu],Zv=sm;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Nc extends Kp{constructor(e,t){super(),this.ce=e,this.currentSequenceNumber=t}}function be(r,e){const t=M(r);return It.N(t.ce,e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function pd(r){let e=0;for(const t in r)Object.prototype.hasOwnProperty.call(r,t)&&e++;return e}function vn(r,e){for(const t in r)Object.prototype.hasOwnProperty.call(r,t)&&e(t,r[t])}function im(r,e){const t=[];for(const n in r)Object.prototype.hasOwnProperty.call(r,n)&&t.push(e(r[n],n,r));return t}function om(r){for(const e in r)if(Object.prototype.hasOwnProperty.call(r,e))return!1;return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ce{constructor(e,t){this.comparator=e,this.root=t||ke.EMPTY}insert(e,t){return new ce(this.comparator,this.root.insert(e,t,this.comparator).copy(null,null,ke.BLACK,null,null))}remove(e){return new ce(this.comparator,this.root.remove(e,this.comparator).copy(null,null,ke.BLACK,null,null))}get(e){let t=this.root;for(;!t.isEmpty();){const n=this.comparator(e,t.key);if(n===0)return t.value;n<0?t=t.left:n>0&&(t=t.right)}return null}indexOf(e){let t=0,n=this.root;for(;!n.isEmpty();){const s=this.comparator(e,n.key);if(s===0)return t+n.left.size;s<0?n=n.left:(t+=n.left.size+1,n=n.right)}return-1}isEmpty(){return this.root.isEmpty()}get size(){return this.root.size}minKey(){return this.root.minKey()}maxKey(){return this.root.maxKey()}inorderTraversal(e){return this.root.inorderTraversal(e)}forEach(e){this.inorderTraversal(((t,n)=>(e(t,n),!1)))}toString(){const e=[];return this.inorderTraversal(((t,n)=>(e.push(`${t}:${n}`),!1))),`{${e.join(", ")}}`}reverseTraversal(e){return this.root.reverseTraversal(e)}getIterator(){return new io(this.root,null,this.comparator,!1)}getIteratorFrom(e){return new io(this.root,e,this.comparator,!1)}getReverseIterator(){return new io(this.root,null,this.comparator,!0)}getReverseIteratorFrom(e){return new io(this.root,e,this.comparator,!0)}}class io{constructor(e,t,n,s){this.isReverse=s,this.nodeStack=[];let i=1;for(;!e.isEmpty();)if(i=t?n(e.key,t):1,t&&s&&(i*=-1),i<0)e=this.isReverse?e.left:e.right;else{if(i===0){this.nodeStack.push(e);break}this.nodeStack.push(e),e=this.isReverse?e.right:e.left}}getNext(){let e=this.nodeStack.pop();const t={key:e.key,value:e.value};if(this.isReverse)for(e=e.left;!e.isEmpty();)this.nodeStack.push(e),e=e.right;else for(e=e.right;!e.isEmpty();)this.nodeStack.push(e),e=e.left;return t}hasNext(){return this.nodeStack.length>0}peek(){if(this.nodeStack.length===0)return null;const e=this.nodeStack[this.nodeStack.length-1];return{key:e.key,value:e.value}}}class ke{constructor(e,t,n,s,i){this.key=e,this.value=t,this.color=n??ke.RED,this.left=s??ke.EMPTY,this.right=i??ke.EMPTY,this.size=this.left.size+1+this.right.size}copy(e,t,n,s,i){return new ke(e??this.key,t??this.value,n??this.color,s??this.left,i??this.right)}isEmpty(){return!1}inorderTraversal(e){return this.left.inorderTraversal(e)||e(this.key,this.value)||this.right.inorderTraversal(e)}reverseTraversal(e){return this.right.reverseTraversal(e)||e(this.key,this.value)||this.left.reverseTraversal(e)}min(){return this.left.isEmpty()?this:this.left.min()}minKey(){return this.min().key}maxKey(){return this.right.isEmpty()?this.key:this.right.maxKey()}insert(e,t,n){let s=this;const i=n(e,s.key);return s=i<0?s.copy(null,null,null,s.left.insert(e,t,n),null):i===0?s.copy(null,t,null,null,null):s.copy(null,null,null,null,s.right.insert(e,t,n)),s.fixUp()}removeMin(){if(this.left.isEmpty())return ke.EMPTY;let e=this;return e.left.isRed()||e.left.left.isRed()||(e=e.moveRedLeft()),e=e.copy(null,null,null,e.left.removeMin(),null),e.fixUp()}remove(e,t){let n,s=this;if(t(e,s.key)<0)s.left.isEmpty()||s.left.isRed()||s.left.left.isRed()||(s=s.moveRedLeft()),s=s.copy(null,null,null,s.left.remove(e,t),null);else{if(s.left.isRed()&&(s=s.rotateRight()),s.right.isEmpty()||s.right.isRed()||s.right.left.isRed()||(s=s.moveRedRight()),t(e,s.key)===0){if(s.right.isEmpty())return ke.EMPTY;n=s.right.min(),s=s.copy(n.key,n.value,null,null,s.right.removeMin())}s=s.copy(null,null,null,null,s.right.remove(e,t))}return s.fixUp()}isRed(){return this.color}fixUp(){let e=this;return e.right.isRed()&&!e.left.isRed()&&(e=e.rotateLeft()),e.left.isRed()&&e.left.left.isRed()&&(e=e.rotateRight()),e.left.isRed()&&e.right.isRed()&&(e=e.colorFlip()),e}moveRedLeft(){let e=this.colorFlip();return e.right.left.isRed()&&(e=e.copy(null,null,null,null,e.right.rotateRight()),e=e.rotateLeft(),e=e.colorFlip()),e}moveRedRight(){let e=this.colorFlip();return e.left.left.isRed()&&(e=e.rotateRight(),e=e.colorFlip()),e}rotateLeft(){const e=this.copy(null,null,ke.RED,null,this.right.left);return this.right.copy(null,null,this.color,e,null)}rotateRight(){const e=this.copy(null,null,ke.RED,this.left.right,null);return this.left.copy(null,null,this.color,null,e)}colorFlip(){const e=this.left.copy(null,null,!this.left.color,null,null),t=this.right.copy(null,null,!this.right.color,null,null);return this.copy(null,null,!this.color,e,t)}checkMaxDepth(){const e=this.check();return Math.pow(2,e)<=this.size+1}check(){if(this.isRed()&&this.left.isRed())throw B(43730,{key:this.key,value:this.value});if(this.right.isRed())throw B(14113,{key:this.key,value:this.value});const e=this.left.check();if(e!==this.right.check())throw B(27949);return e+(this.isRed()?0:1)}}ke.EMPTY=null,ke.RED=!0,ke.BLACK=!1;ke.EMPTY=new class{constructor(){this.size=0}get key(){throw B(57766)}get value(){throw B(16141)}get color(){throw B(16727)}get left(){throw B(29726)}get right(){throw B(36894)}copy(e,t,n,s,i){return this}insert(e,t,n){return new ke(e,t)}remove(e,t){return this}isEmpty(){return!0}inorderTraversal(e){return!1}reverseTraversal(e){return!1}minKey(){return null}maxKey(){return null}isRed(){return!1}checkMaxDepth(){return!0}check(){return 0}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ie{constructor(e){this.comparator=e,this.data=new ce(this.comparator)}has(e){return this.data.get(e)!==null}first(){return this.data.minKey()}last(){return this.data.maxKey()}get size(){return this.data.size}indexOf(e){return this.data.indexOf(e)}forEach(e){this.data.inorderTraversal(((t,n)=>(e(t),!1)))}forEachInRange(e,t){const n=this.data.getIteratorFrom(e[0]);for(;n.hasNext();){const s=n.getNext();if(this.comparator(s.key,e[1])>=0)return;t(s.key)}}forEachWhile(e,t){let n;for(n=t!==void 0?this.data.getIteratorFrom(t):this.data.getIterator();n.hasNext();)if(!e(n.getNext().key))return}firstAfterOrEqual(e){const t=this.data.getIteratorFrom(e);return t.hasNext()?t.getNext().key:null}getIterator(){return new md(this.data.getIterator())}getIteratorFrom(e){return new md(this.data.getIteratorFrom(e))}add(e){return this.copy(this.data.remove(e).insert(e,!0))}delete(e){return this.has(e)?this.copy(this.data.remove(e)):this}isEmpty(){return this.data.isEmpty()}unionWith(e){let t=this;return t.size<e.size&&(t=e,e=this),e.forEach((n=>{t=t.add(n)})),t}isEqual(e){if(!(e instanceof ie)||this.size!==e.size)return!1;const t=this.data.getIterator(),n=e.data.getIterator();for(;t.hasNext();){const s=t.getNext().key,i=n.getNext().key;if(this.comparator(s,i)!==0)return!1}return!0}toArray(){const e=[];return this.forEach((t=>{e.push(t)})),e}toString(){const e=[];return this.forEach((t=>e.push(t))),"SortedSet("+e.toString()+")"}copy(e){const t=new ie(this.comparator);return t.data=e,t}}class md{constructor(e){this.iter=e}getNext(){return this.iter.getNext().key}hasNext(){return this.iter.hasNext()}}function gr(r){return r.hasNext()?r.getNext():void 0}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class He{constructor(e){this.fields=e,e.sort(he.comparator)}static empty(){return new He([])}unionWith(e){let t=new ie(he.comparator);for(const n of this.fields)t=t.add(n);for(const n of e)t=t.add(n);return new He(t.toArray())}covers(e){for(const t of this.fields)if(t.isPrefixOf(e))return!0;return!1}isEqual(e){return Vr(this.fields,e.fields,((t,n)=>t.isEqual(n)))}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class am extends Error{constructor(){super(...arguments),this.name="Base64DecodeError"}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ew(){return typeof atob<"u"}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ge{constructor(e){this.binaryString=e}static fromBase64String(e){const t=(function(s){try{return atob(s)}catch(i){throw typeof DOMException<"u"&&i instanceof DOMException?new am("Invalid base64 string: "+i):i}})(e);return new ge(t)}static fromUint8Array(e){const t=(function(s){let i="";for(let o=0;o<s.length;++o)i+=String.fromCharCode(s[o]);return i})(e);return new ge(t)}[Symbol.iterator](){let e=0;return{next:()=>e<this.binaryString.length?{value:this.binaryString.charCodeAt(e++),done:!1}:{value:void 0,done:!0}}}toBase64(){return(function(t){return btoa(t)})(this.binaryString)}toUint8Array(){return(function(t){const n=new Uint8Array(t.length);for(let s=0;s<t.length;s++)n[s]=t.charCodeAt(s);return n})(this.binaryString)}approximateByteSize(){return 2*this.binaryString.length}compareTo(e){return G(this.binaryString,e.binaryString)}isEqual(e){return this.binaryString===e.binaryString}}ge.EMPTY_BYTE_STRING=new ge("");const tw=new RegExp(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d+))?Z$/);function Mt(r){if(q(!!r,39018),typeof r=="string"){let e=0;const t=tw.exec(r);if(q(!!t,46558,{timestamp:r}),t[1]){let s=t[1];s=(s+"000000000").substr(0,9),e=Number(s)}const n=new Date(r);return{seconds:Math.floor(n.getTime()/1e3),nanos:e}}return{seconds:fe(r.seconds),nanos:fe(r.nanos)}}function fe(r){return typeof r=="number"?r:typeof r=="string"?Number(r):0}function Lt(r){return typeof r=="string"?ge.fromBase64String(r):ge.fromUint8Array(r)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const cm="server_timestamp",um="__type__",lm="__previous_value__",hm="__local_write_time__";function fa(r){var e,t;return((t=(((e=r==null?void 0:r.mapValue)===null||e===void 0?void 0:e.fields)||{})[um])===null||t===void 0?void 0:t.stringValue)===cm}function pa(r){const e=r.mapValue.fields[lm];return fa(e)?pa(e):e}function ai(r){const e=Mt(r.mapValue.fields[hm].timestampValue);return new ne(e.seconds,e.nanos)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class nw{constructor(e,t,n,s,i,o,c,u,h,f){this.databaseId=e,this.appId=t,this.persistenceKey=n,this.host=s,this.ssl=i,this.forceLongPolling=o,this.autoDetectLongPolling=c,this.longPollingOptions=u,this.useFetchStreams=h,this.isUsingEmulator=f}}const ci="(default)";class fn{constructor(e,t){this.projectId=e,this.database=t||ci}static empty(){return new fn("","")}get isDefaultDatabase(){return this.database===ci}isEqual(e){return e instanceof fn&&e.projectId===this.projectId&&e.database===this.database}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Au="__type__",dm="__max__",on={mapValue:{fields:{__type__:{stringValue:dm}}}},bu="__vector__",Ur="value",vo={nullValue:"NULL_VALUE"};function pn(r){return"nullValue"in r?0:"booleanValue"in r?1:"integerValue"in r||"doubleValue"in r?2:"timestampValue"in r?3:"stringValue"in r?5:"bytesValue"in r?6:"referenceValue"in r?7:"geoPointValue"in r?8:"arrayValue"in r?9:"mapValue"in r?fa(r)?4:fm(r)?9007199254740991:ma(r)?10:11:B(28295,{value:r})}function Et(r,e){if(r===e)return!0;const t=pn(r);if(t!==pn(e))return!1;switch(t){case 0:case 9007199254740991:return!0;case 1:return r.booleanValue===e.booleanValue;case 4:return ai(r).isEqual(ai(e));case 3:return(function(s,i){if(typeof s.timestampValue=="string"&&typeof i.timestampValue=="string"&&s.timestampValue.length===i.timestampValue.length)return s.timestampValue===i.timestampValue;const o=Mt(s.timestampValue),c=Mt(i.timestampValue);return o.seconds===c.seconds&&o.nanos===c.nanos})(r,e);case 5:return r.stringValue===e.stringValue;case 6:return(function(s,i){return Lt(s.bytesValue).isEqual(Lt(i.bytesValue))})(r,e);case 7:return r.referenceValue===e.referenceValue;case 8:return(function(s,i){return fe(s.geoPointValue.latitude)===fe(i.geoPointValue.latitude)&&fe(s.geoPointValue.longitude)===fe(i.geoPointValue.longitude)})(r,e);case 2:return(function(s,i){if("integerValue"in s&&"integerValue"in i)return fe(s.integerValue)===fe(i.integerValue);if("doubleValue"in s&&"doubleValue"in i){const o=fe(s.doubleValue),c=fe(i.doubleValue);return o===c?ri(o)===ri(c):isNaN(o)&&isNaN(c)}return!1})(r,e);case 9:return Vr(r.arrayValue.values||[],e.arrayValue.values||[],Et);case 10:case 11:return(function(s,i){const o=s.mapValue.fields||{},c=i.mapValue.fields||{};if(pd(o)!==pd(c))return!1;for(const u in o)if(o.hasOwnProperty(u)&&(c[u]===void 0||!Et(o[u],c[u])))return!1;return!0})(r,e);default:return B(52216,{left:r})}}function ui(r,e){return(r.values||[]).find((t=>Et(t,e)))!==void 0}function mn(r,e){if(r===e)return 0;const t=pn(r),n=pn(e);if(t!==n)return G(t,n);switch(t){case 0:case 9007199254740991:return 0;case 1:return G(r.booleanValue,e.booleanValue);case 2:return(function(i,o){const c=fe(i.integerValue||i.doubleValue),u=fe(o.integerValue||o.doubleValue);return c<u?-1:c>u?1:c===u?0:isNaN(c)?isNaN(u)?0:-1:1})(r,e);case 3:return gd(r.timestampValue,e.timestampValue);case 4:return gd(ai(r),ai(e));case 5:return Sc(r.stringValue,e.stringValue);case 6:return(function(i,o){const c=Lt(i),u=Lt(o);return c.compareTo(u)})(r.bytesValue,e.bytesValue);case 7:return(function(i,o){const c=i.split("/"),u=o.split("/");for(let h=0;h<c.length&&h<u.length;h++){const f=G(c[h],u[h]);if(f!==0)return f}return G(c.length,u.length)})(r.referenceValue,e.referenceValue);case 8:return(function(i,o){const c=G(fe(i.latitude),fe(o.latitude));return c!==0?c:G(fe(i.longitude),fe(o.longitude))})(r.geoPointValue,e.geoPointValue);case 9:return _d(r.arrayValue,e.arrayValue);case 10:return(function(i,o){var c,u,h,f;const p=i.fields||{},m=o.fields||{},T=(c=p[Ur])===null||c===void 0?void 0:c.arrayValue,P=(u=m[Ur])===null||u===void 0?void 0:u.arrayValue,V=G(((h=T==null?void 0:T.values)===null||h===void 0?void 0:h.length)||0,((f=P==null?void 0:P.values)===null||f===void 0?void 0:f.length)||0);return V!==0?V:_d(T,P)})(r.mapValue,e.mapValue);case 11:return(function(i,o){if(i===on.mapValue&&o===on.mapValue)return 0;if(i===on.mapValue)return 1;if(o===on.mapValue)return-1;const c=i.fields||{},u=Object.keys(c),h=o.fields||{},f=Object.keys(h);u.sort(),f.sort();for(let p=0;p<u.length&&p<f.length;++p){const m=Sc(u[p],f[p]);if(m!==0)return m;const T=mn(c[u[p]],h[f[p]]);if(T!==0)return T}return G(u.length,f.length)})(r.mapValue,e.mapValue);default:throw B(23264,{le:t})}}function gd(r,e){if(typeof r=="string"&&typeof e=="string"&&r.length===e.length)return G(r,e);const t=Mt(r),n=Mt(e),s=G(t.seconds,n.seconds);return s!==0?s:G(t.nanos,n.nanos)}function _d(r,e){const t=r.values||[],n=e.values||[];for(let s=0;s<t.length&&s<n.length;++s){const i=mn(t[s],n[s]);if(i)return i}return G(t.length,n.length)}function Br(r){return xc(r)}function xc(r){return"nullValue"in r?"null":"booleanValue"in r?""+r.booleanValue:"integerValue"in r?""+r.integerValue:"doubleValue"in r?""+r.doubleValue:"timestampValue"in r?(function(t){const n=Mt(t);return`time(${n.seconds},${n.nanos})`})(r.timestampValue):"stringValue"in r?r.stringValue:"bytesValue"in r?(function(t){return Lt(t).toBase64()})(r.bytesValue):"referenceValue"in r?(function(t){return O.fromName(t).toString()})(r.referenceValue):"geoPointValue"in r?(function(t){return`geo(${t.latitude},${t.longitude})`})(r.geoPointValue):"arrayValue"in r?(function(t){let n="[",s=!0;for(const i of t.values||[])s?s=!1:n+=",",n+=xc(i);return n+"]"})(r.arrayValue):"mapValue"in r?(function(t){const n=Object.keys(t.fields||{}).sort();let s="{",i=!0;for(const o of n)i?i=!1:s+=",",s+=`${o}:${xc(t.fields[o])}`;return s+"}"})(r.mapValue):B(61005,{value:r})}function wo(r){switch(pn(r)){case 0:case 1:return 4;case 2:return 8;case 3:case 8:return 16;case 4:const e=pa(r);return e?16+wo(e):16;case 5:return 2*r.stringValue.length;case 6:return Lt(r.bytesValue).approximateByteSize();case 7:return r.referenceValue.length;case 9:return(function(n){return(n.values||[]).reduce(((s,i)=>s+wo(i)),0)})(r.arrayValue);case 10:case 11:return(function(n){let s=0;return vn(n.fields,((i,o)=>{s+=i.length+wo(o)})),s})(r.mapValue);default:throw B(13486,{value:r})}}function Qn(r,e){return{referenceValue:`projects/${r.projectId}/databases/${r.database}/documents/${e.path.canonicalString()}`}}function Oc(r){return!!r&&"integerValue"in r}function li(r){return!!r&&"arrayValue"in r}function yd(r){return!!r&&"nullValue"in r}function Id(r){return!!r&&"doubleValue"in r&&isNaN(Number(r.doubleValue))}function Ao(r){return!!r&&"mapValue"in r}function ma(r){var e,t;return((t=(((e=r==null?void 0:r.mapValue)===null||e===void 0?void 0:e.fields)||{})[Au])===null||t===void 0?void 0:t.stringValue)===bu}function Hs(r){if(r.geoPointValue)return{geoPointValue:Object.assign({},r.geoPointValue)};if(r.timestampValue&&typeof r.timestampValue=="object")return{timestampValue:Object.assign({},r.timestampValue)};if(r.mapValue){const e={mapValue:{fields:{}}};return vn(r.mapValue.fields,((t,n)=>e.mapValue.fields[t]=Hs(n))),e}if(r.arrayValue){const e={arrayValue:{values:[]}};for(let t=0;t<(r.arrayValue.values||[]).length;++t)e.arrayValue.values[t]=Hs(r.arrayValue.values[t]);return e}return Object.assign({},r)}function fm(r){return(((r.mapValue||{}).fields||{}).__type__||{}).stringValue===dm}const pm={mapValue:{fields:{[Au]:{stringValue:bu},[Ur]:{arrayValue:{}}}}};function rw(r){return"nullValue"in r?vo:"booleanValue"in r?{booleanValue:!1}:"integerValue"in r||"doubleValue"in r?{doubleValue:NaN}:"timestampValue"in r?{timestampValue:{seconds:Number.MIN_SAFE_INTEGER}}:"stringValue"in r?{stringValue:""}:"bytesValue"in r?{bytesValue:""}:"referenceValue"in r?Qn(fn.empty(),O.empty()):"geoPointValue"in r?{geoPointValue:{latitude:-90,longitude:-180}}:"arrayValue"in r?{arrayValue:{}}:"mapValue"in r?ma(r)?pm:{mapValue:{}}:B(35942,{value:r})}function sw(r){return"nullValue"in r?{booleanValue:!1}:"booleanValue"in r?{doubleValue:NaN}:"integerValue"in r||"doubleValue"in r?{timestampValue:{seconds:Number.MIN_SAFE_INTEGER}}:"timestampValue"in r?{stringValue:""}:"stringValue"in r?{bytesValue:""}:"bytesValue"in r?Qn(fn.empty(),O.empty()):"referenceValue"in r?{geoPointValue:{latitude:-90,longitude:-180}}:"geoPointValue"in r?{arrayValue:{}}:"arrayValue"in r?pm:"mapValue"in r?ma(r)?{mapValue:{}}:on:B(61959,{value:r})}function Td(r,e){const t=mn(r.value,e.value);return t!==0?t:r.inclusive&&!e.inclusive?-1:!r.inclusive&&e.inclusive?1:0}function Ed(r,e){const t=mn(r.value,e.value);return t!==0?t:r.inclusive&&!e.inclusive?1:!r.inclusive&&e.inclusive?-1:0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ve{constructor(e){this.value=e}static empty(){return new Ve({mapValue:{}})}field(e){if(e.isEmpty())return this.value;{let t=this.value;for(let n=0;n<e.length-1;++n)if(t=(t.mapValue.fields||{})[e.get(n)],!Ao(t))return null;return t=(t.mapValue.fields||{})[e.lastSegment()],t||null}}set(e,t){this.getFieldsMap(e.popLast())[e.lastSegment()]=Hs(t)}setAll(e){let t=he.emptyPath(),n={},s=[];e.forEach(((o,c)=>{if(!t.isImmediateParentOf(c)){const u=this.getFieldsMap(t);this.applyChanges(u,n,s),n={},s=[],t=c.popLast()}o?n[c.lastSegment()]=Hs(o):s.push(c.lastSegment())}));const i=this.getFieldsMap(t);this.applyChanges(i,n,s)}delete(e){const t=this.field(e.popLast());Ao(t)&&t.mapValue.fields&&delete t.mapValue.fields[e.lastSegment()]}isEqual(e){return Et(this.value,e.value)}getFieldsMap(e){let t=this.value;t.mapValue.fields||(t.mapValue={fields:{}});for(let n=0;n<e.length;++n){let s=t.mapValue.fields[e.get(n)];Ao(s)&&s.mapValue.fields||(s={mapValue:{fields:{}}},t.mapValue.fields[e.get(n)]=s),t=s}return t.mapValue.fields}applyChanges(e,t,n){vn(t,((s,i)=>e[s]=i));for(const s of n)delete e[s]}clone(){return new Ve(Hs(this.value))}}function mm(r){const e=[];return vn(r.fields,((t,n)=>{const s=new he([t]);if(Ao(n)){const i=mm(n.mapValue).fields;if(i.length===0)e.push(s);else for(const o of i)e.push(s.child(o))}else e.push(s)})),new He(e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class le{constructor(e,t,n,s,i,o,c){this.key=e,this.documentType=t,this.version=n,this.readTime=s,this.createTime=i,this.data=o,this.documentState=c}static newInvalidDocument(e){return new le(e,0,z.min(),z.min(),z.min(),Ve.empty(),0)}static newFoundDocument(e,t,n,s){return new le(e,1,t,z.min(),n,s,0)}static newNoDocument(e,t){return new le(e,2,t,z.min(),z.min(),Ve.empty(),0)}static newUnknownDocument(e,t){return new le(e,3,t,z.min(),z.min(),Ve.empty(),2)}convertToFoundDocument(e,t){return!this.createTime.isEqual(z.min())||this.documentType!==2&&this.documentType!==0||(this.createTime=e),this.version=e,this.documentType=1,this.data=t,this.documentState=0,this}convertToNoDocument(e){return this.version=e,this.documentType=2,this.data=Ve.empty(),this.documentState=0,this}convertToUnknownDocument(e){return this.version=e,this.documentType=3,this.data=Ve.empty(),this.documentState=2,this}setHasCommittedMutations(){return this.documentState=2,this}setHasLocalMutations(){return this.documentState=1,this.version=z.min(),this}setReadTime(e){return this.readTime=e,this}get hasLocalMutations(){return this.documentState===1}get hasCommittedMutations(){return this.documentState===2}get hasPendingWrites(){return this.hasLocalMutations||this.hasCommittedMutations}isValidDocument(){return this.documentType!==0}isFoundDocument(){return this.documentType===1}isNoDocument(){return this.documentType===2}isUnknownDocument(){return this.documentType===3}isEqual(e){return e instanceof le&&this.key.isEqual(e.key)&&this.version.isEqual(e.version)&&this.documentType===e.documentType&&this.documentState===e.documentState&&this.data.isEqual(e.data)}mutableCopy(){return new le(this.key,this.documentType,this.version,this.readTime,this.createTime,this.data.clone(),this.documentState)}toString(){return`Document(${this.key}, ${this.version}, ${JSON.stringify(this.data.value)}, {createTime: ${this.createTime}}), {documentType: ${this.documentType}}), {documentState: ${this.documentState}})`}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class gn{constructor(e,t){this.position=e,this.inclusive=t}}function vd(r,e,t){let n=0;for(let s=0;s<r.position.length;s++){const i=e[s],o=r.position[s];if(i.field.isKeyField()?n=O.comparator(O.fromName(o.referenceValue),t.key):n=mn(o,t.data.field(i.field)),i.dir==="desc"&&(n*=-1),n!==0)break}return n}function wd(r,e){if(r===null)return e===null;if(e===null||r.inclusive!==e.inclusive||r.position.length!==e.position.length)return!1;for(let t=0;t<r.position.length;t++)if(!Et(r.position[t],e.position[t]))return!1;return!0}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hi{constructor(e,t="asc"){this.field=e,this.dir=t}}function iw(r,e){return r.dir===e.dir&&r.field.isEqual(e.field)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class gm{}class Y extends gm{constructor(e,t,n){super(),this.field=e,this.op=t,this.value=n}static create(e,t,n){return e.isKeyField()?t==="in"||t==="not-in"?this.createKeyFieldInFilter(e,t,n):new ow(e,t,n):t==="array-contains"?new uw(e,n):t==="in"?new vm(e,n):t==="not-in"?new lw(e,n):t==="array-contains-any"?new hw(e,n):new Y(e,t,n)}static createKeyFieldInFilter(e,t,n){return t==="in"?new aw(e,n):new cw(e,n)}matches(e){const t=e.data.field(this.field);return this.op==="!="?t!==null&&t.nullValue===void 0&&this.matchesComparison(mn(t,this.value)):t!==null&&pn(this.value)===pn(t)&&this.matchesComparison(mn(t,this.value))}matchesComparison(e){switch(this.op){case"<":return e<0;case"<=":return e<=0;case"==":return e===0;case"!=":return e!==0;case">":return e>0;case">=":return e>=0;default:return B(47266,{operator:this.op})}}isInequality(){return["<","<=",">",">=","!=","not-in"].indexOf(this.op)>=0}getFlattenedFilters(){return[this]}getFilters(){return[this]}}class re extends gm{constructor(e,t){super(),this.filters=e,this.op=t,this.he=null}static create(e,t){return new re(e,t)}matches(e){return qr(this)?this.filters.find((t=>!t.matches(e)))===void 0:this.filters.find((t=>t.matches(e)))!==void 0}getFlattenedFilters(){return this.he!==null||(this.he=this.filters.reduce(((e,t)=>e.concat(t.getFlattenedFilters())),[])),this.he}getFilters(){return Object.assign([],this.filters)}}function qr(r){return r.op==="and"}function Mc(r){return r.op==="or"}function Ru(r){return _m(r)&&qr(r)}function _m(r){for(const e of r.filters)if(e instanceof re)return!1;return!0}function Lc(r){if(r instanceof Y)return r.field.canonicalString()+r.op.toString()+Br(r.value);if(Ru(r))return r.filters.map((e=>Lc(e))).join(",");{const e=r.filters.map((t=>Lc(t))).join(",");return`${r.op}(${e})`}}function ym(r,e){return r instanceof Y?(function(n,s){return s instanceof Y&&n.op===s.op&&n.field.isEqual(s.field)&&Et(n.value,s.value)})(r,e):r instanceof re?(function(n,s){return s instanceof re&&n.op===s.op&&n.filters.length===s.filters.length?n.filters.reduce(((i,o,c)=>i&&ym(o,s.filters[c])),!0):!1})(r,e):void B(19439)}function Im(r,e){const t=r.filters.concat(e);return re.create(t,r.op)}function Tm(r){return r instanceof Y?(function(t){return`${t.field.canonicalString()} ${t.op} ${Br(t.value)}`})(r):r instanceof re?(function(t){return t.op.toString()+" {"+t.getFilters().map(Tm).join(" ,")+"}"})(r):"Filter"}class ow extends Y{constructor(e,t,n){super(e,t,n),this.key=O.fromName(n.referenceValue)}matches(e){const t=O.comparator(e.key,this.key);return this.matchesComparison(t)}}class aw extends Y{constructor(e,t){super(e,"in",t),this.keys=Em("in",t)}matches(e){return this.keys.some((t=>t.isEqual(e.key)))}}class cw extends Y{constructor(e,t){super(e,"not-in",t),this.keys=Em("not-in",t)}matches(e){return!this.keys.some((t=>t.isEqual(e.key)))}}function Em(r,e){var t;return(((t=e.arrayValue)===null||t===void 0?void 0:t.values)||[]).map((n=>O.fromName(n.referenceValue)))}class uw extends Y{constructor(e,t){super(e,"array-contains",t)}matches(e){const t=e.data.field(this.field);return li(t)&&ui(t.arrayValue,this.value)}}class vm extends Y{constructor(e,t){super(e,"in",t)}matches(e){const t=e.data.field(this.field);return t!==null&&ui(this.value.arrayValue,t)}}class lw extends Y{constructor(e,t){super(e,"not-in",t)}matches(e){if(ui(this.value.arrayValue,{nullValue:"NULL_VALUE"}))return!1;const t=e.data.field(this.field);return t!==null&&t.nullValue===void 0&&!ui(this.value.arrayValue,t)}}class hw extends Y{constructor(e,t){super(e,"array-contains-any",t)}matches(e){const t=e.data.field(this.field);return!(!li(t)||!t.arrayValue.values)&&t.arrayValue.values.some((n=>ui(this.value.arrayValue,n)))}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class dw{constructor(e,t=null,n=[],s=[],i=null,o=null,c=null){this.path=e,this.collectionGroup=t,this.orderBy=n,this.filters=s,this.limit=i,this.startAt=o,this.endAt=c,this.Pe=null}}function Fc(r,e=null,t=[],n=[],s=null,i=null,o=null){return new dw(r,e,t,n,s,i,o)}function Xn(r){const e=M(r);if(e.Pe===null){let t=e.path.canonicalString();e.collectionGroup!==null&&(t+="|cg:"+e.collectionGroup),t+="|f:",t+=e.filters.map((n=>Lc(n))).join(","),t+="|ob:",t+=e.orderBy.map((n=>(function(i){return i.field.canonicalString()+i.dir})(n))).join(","),vi(e.limit)||(t+="|l:",t+=e.limit),e.startAt&&(t+="|lb:",t+=e.startAt.inclusive?"b:":"a:",t+=e.startAt.position.map((n=>Br(n))).join(",")),e.endAt&&(t+="|ub:",t+=e.endAt.inclusive?"a:":"b:",t+=e.endAt.position.map((n=>Br(n))).join(",")),e.Pe=t}return e.Pe}function Ai(r,e){if(r.limit!==e.limit||r.orderBy.length!==e.orderBy.length)return!1;for(let t=0;t<r.orderBy.length;t++)if(!iw(r.orderBy[t],e.orderBy[t]))return!1;if(r.filters.length!==e.filters.length)return!1;for(let t=0;t<r.filters.length;t++)if(!ym(r.filters[t],e.filters[t]))return!1;return r.collectionGroup===e.collectionGroup&&!!r.path.isEqual(e.path)&&!!wd(r.startAt,e.startAt)&&wd(r.endAt,e.endAt)}function jo(r){return O.isDocumentKey(r.path)&&r.collectionGroup===null&&r.filters.length===0}function zo(r,e){return r.filters.filter((t=>t instanceof Y&&t.field.isEqual(e)))}function Ad(r,e,t){let n=vo,s=!0;for(const i of zo(r,e)){let o=vo,c=!0;switch(i.op){case"<":case"<=":o=rw(i.value);break;case"==":case"in":case">=":o=i.value;break;case">":o=i.value,c=!1;break;case"!=":case"not-in":o=vo}Td({value:n,inclusive:s},{value:o,inclusive:c})<0&&(n=o,s=c)}if(t!==null){for(let i=0;i<r.orderBy.length;++i)if(r.orderBy[i].field.isEqual(e)){const o=t.position[i];Td({value:n,inclusive:s},{value:o,inclusive:t.inclusive})<0&&(n=o,s=t.inclusive);break}}return{value:n,inclusive:s}}function bd(r,e,t){let n=on,s=!0;for(const i of zo(r,e)){let o=on,c=!0;switch(i.op){case">=":case">":o=sw(i.value),c=!1;break;case"==":case"in":case"<=":o=i.value;break;case"<":o=i.value,c=!1;break;case"!=":case"not-in":o=on}Ed({value:n,inclusive:s},{value:o,inclusive:c})>0&&(n=o,s=c)}if(t!==null){for(let i=0;i<r.orderBy.length;++i)if(r.orderBy[i].field.isEqual(e)){const o=t.position[i];Ed({value:n,inclusive:s},{value:o,inclusive:t.inclusive})>0&&(n=o,s=t.inclusive);break}}return{value:n,inclusive:s}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class qt{constructor(e,t=null,n=[],s=[],i=null,o="F",c=null,u=null){this.path=e,this.collectionGroup=t,this.explicitOrderBy=n,this.filters=s,this.limit=i,this.limitType=o,this.startAt=c,this.endAt=u,this.Te=null,this.Ie=null,this.de=null,this.startAt,this.endAt}}function wm(r,e,t,n,s,i,o,c){return new qt(r,e,t,n,s,i,o,c)}function ts(r){return new qt(r)}function Rd(r){return r.filters.length===0&&r.limit===null&&r.startAt==null&&r.endAt==null&&(r.explicitOrderBy.length===0||r.explicitOrderBy.length===1&&r.explicitOrderBy[0].field.isKeyField())}function Su(r){return r.collectionGroup!==null}function Cr(r){const e=M(r);if(e.Te===null){e.Te=[];const t=new Set;for(const i of e.explicitOrderBy)e.Te.push(i),t.add(i.field.canonicalString());const n=e.explicitOrderBy.length>0?e.explicitOrderBy[e.explicitOrderBy.length-1].dir:"asc";(function(o){let c=new ie(he.comparator);return o.filters.forEach((u=>{u.getFlattenedFilters().forEach((h=>{h.isInequality()&&(c=c.add(h.field))}))})),c})(e).forEach((i=>{t.has(i.canonicalString())||i.isKeyField()||e.Te.push(new hi(i,n))})),t.has(he.keyField().canonicalString())||e.Te.push(new hi(he.keyField(),n))}return e.Te}function Ue(r){const e=M(r);return e.Ie||(e.Ie=bm(e,Cr(r))),e.Ie}function Am(r){const e=M(r);return e.de||(e.de=bm(e,r.explicitOrderBy)),e.de}function bm(r,e){if(r.limitType==="F")return Fc(r.path,r.collectionGroup,e,r.filters,r.limit,r.startAt,r.endAt);{e=e.map((s=>{const i=s.dir==="desc"?"asc":"desc";return new hi(s.field,i)}));const t=r.endAt?new gn(r.endAt.position,r.endAt.inclusive):null,n=r.startAt?new gn(r.startAt.position,r.startAt.inclusive):null;return Fc(r.path,r.collectionGroup,e,r.filters,r.limit,t,n)}}function Uc(r,e){const t=r.filters.concat([e]);return new qt(r.path,r.collectionGroup,r.explicitOrderBy.slice(),t,r.limit,r.limitType,r.startAt,r.endAt)}function $o(r,e,t){return new qt(r.path,r.collectionGroup,r.explicitOrderBy.slice(),r.filters.slice(),e,t,r.startAt,r.endAt)}function bi(r,e){return Ai(Ue(r),Ue(e))&&r.limitType===e.limitType}function Rm(r){return`${Xn(Ue(r))}|lt:${r.limitType}`}function wr(r){return`Query(target=${(function(t){let n=t.path.canonicalString();return t.collectionGroup!==null&&(n+=" collectionGroup="+t.collectionGroup),t.filters.length>0&&(n+=`, filters: [${t.filters.map((s=>Tm(s))).join(", ")}]`),vi(t.limit)||(n+=", limit: "+t.limit),t.orderBy.length>0&&(n+=`, orderBy: [${t.orderBy.map((s=>(function(o){return`${o.field.canonicalString()} (${o.dir})`})(s))).join(", ")}]`),t.startAt&&(n+=", startAt: ",n+=t.startAt.inclusive?"b:":"a:",n+=t.startAt.position.map((s=>Br(s))).join(",")),t.endAt&&(n+=", endAt: ",n+=t.endAt.inclusive?"a:":"b:",n+=t.endAt.position.map((s=>Br(s))).join(",")),`Target(${n})`})(Ue(r))}; limitType=${r.limitType})`}function Ri(r,e){return e.isFoundDocument()&&(function(n,s){const i=s.key.path;return n.collectionGroup!==null?s.key.hasCollectionId(n.collectionGroup)&&n.path.isPrefixOf(i):O.isDocumentKey(n.path)?n.path.isEqual(i):n.path.isImmediateParentOf(i)})(r,e)&&(function(n,s){for(const i of Cr(n))if(!i.field.isKeyField()&&s.data.field(i.field)===null)return!1;return!0})(r,e)&&(function(n,s){for(const i of n.filters)if(!i.matches(s))return!1;return!0})(r,e)&&(function(n,s){return!(n.startAt&&!(function(o,c,u){const h=vd(o,c,u);return o.inclusive?h<=0:h<0})(n.startAt,Cr(n),s)||n.endAt&&!(function(o,c,u){const h=vd(o,c,u);return o.inclusive?h>=0:h>0})(n.endAt,Cr(n),s))})(r,e)}function Sm(r){return r.collectionGroup||(r.path.length%2==1?r.path.lastSegment():r.path.get(r.path.length-2))}function Pm(r){return(e,t)=>{let n=!1;for(const s of Cr(r)){const i=fw(s,e,t);if(i!==0)return i;n=n||s.field.isKeyField()}return 0}}function fw(r,e,t){const n=r.field.isKeyField()?O.comparator(e.key,t.key):(function(i,o,c){const u=o.data.field(i),h=c.data.field(i);return u!==null&&h!==null?mn(u,h):B(42886)})(r.field,e,t);switch(r.dir){case"asc":return n;case"desc":return-1*n;default:return B(19790,{direction:r.dir})}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class jt{constructor(e,t){this.mapKeyFn=e,this.equalsFn=t,this.inner={},this.innerSize=0}get(e){const t=this.mapKeyFn(e),n=this.inner[t];if(n!==void 0){for(const[s,i]of n)if(this.equalsFn(s,e))return i}}has(e){return this.get(e)!==void 0}set(e,t){const n=this.mapKeyFn(e),s=this.inner[n];if(s===void 0)return this.inner[n]=[[e,t]],void this.innerSize++;for(let i=0;i<s.length;i++)if(this.equalsFn(s[i][0],e))return void(s[i]=[e,t]);s.push([e,t]),this.innerSize++}delete(e){const t=this.mapKeyFn(e),n=this.inner[t];if(n===void 0)return!1;for(let s=0;s<n.length;s++)if(this.equalsFn(n[s][0],e))return n.length===1?delete this.inner[t]:n.splice(s,1),this.innerSize--,!0;return!1}forEach(e){vn(this.inner,((t,n)=>{for(const[s,i]of n)e(s,i)}))}isEmpty(){return om(this.inner)}size(){return this.innerSize}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const pw=new ce(O.comparator);function Qe(){return pw}const Cm=new ce(O.comparator);function Us(...r){let e=Cm;for(const t of r)e=e.insert(t.key,t);return e}function km(r){let e=Cm;return r.forEach(((t,n)=>e=e.insert(t,n.overlayedDocument))),e}function mt(){return Qs()}function Vm(){return Qs()}function Qs(){return new jt((r=>r.toString()),((r,e)=>r.isEqual(e)))}const mw=new ce(O.comparator),gw=new ie(O.comparator);function W(...r){let e=gw;for(const t of r)e=e.add(t);return e}const _w=new ie(G);function Pu(){return _w}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Cu(r,e){if(r.useProto3Json){if(isNaN(e))return{doubleValue:"NaN"};if(e===1/0)return{doubleValue:"Infinity"};if(e===-1/0)return{doubleValue:"-Infinity"}}return{doubleValue:ri(e)?"-0":e}}function Dm(r){return{integerValue:""+r}}function Nm(r,e){return Hp(e)?Dm(e):Cu(r,e)}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ga{constructor(){this._=void 0}}function yw(r,e,t){return r instanceof jr?(function(s,i){const o={fields:{[um]:{stringValue:cm},[hm]:{timestampValue:{seconds:s.seconds,nanos:s.nanoseconds}}}};return i&&fa(i)&&(i=pa(i)),i&&(o.fields[lm]=i),{mapValue:o}})(t,e):r instanceof Jn?Om(r,e):r instanceof Yn?Mm(r,e):(function(s,i){const o=xm(s,i),c=Sd(o)+Sd(s.Ee);return Oc(o)&&Oc(s.Ee)?Dm(c):Cu(s.serializer,c)})(r,e)}function Iw(r,e,t){return r instanceof Jn?Om(r,e):r instanceof Yn?Mm(r,e):t}function xm(r,e){return r instanceof zr?(function(n){return Oc(n)||(function(i){return!!i&&"doubleValue"in i})(n)})(e)?e:{integerValue:0}:null}class jr extends ga{}class Jn extends ga{constructor(e){super(),this.elements=e}}function Om(r,e){const t=Lm(e);for(const n of r.elements)t.some((s=>Et(s,n)))||t.push(n);return{arrayValue:{values:t}}}class Yn extends ga{constructor(e){super(),this.elements=e}}function Mm(r,e){let t=Lm(e);for(const n of r.elements)t=t.filter((s=>!Et(s,n)));return{arrayValue:{values:t}}}class zr extends ga{constructor(e,t){super(),this.serializer=e,this.Ee=t}}function Sd(r){return fe(r.integerValue||r.doubleValue)}function Lm(r){return li(r)&&r.arrayValue.values?r.arrayValue.values.slice():[]}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Si{constructor(e,t){this.field=e,this.transform=t}}function Tw(r,e){return r.field.isEqual(e.field)&&(function(n,s){return n instanceof Jn&&s instanceof Jn||n instanceof Yn&&s instanceof Yn?Vr(n.elements,s.elements,Et):n instanceof zr&&s instanceof zr?Et(n.Ee,s.Ee):n instanceof jr&&s instanceof jr})(r.transform,e.transform)}class Ew{constructor(e,t){this.version=e,this.transformResults=t}}class pe{constructor(e,t){this.updateTime=e,this.exists=t}static none(){return new pe}static exists(e){return new pe(void 0,e)}static updateTime(e){return new pe(e)}get isNone(){return this.updateTime===void 0&&this.exists===void 0}isEqual(e){return this.exists===e.exists&&(this.updateTime?!!e.updateTime&&this.updateTime.isEqual(e.updateTime):!e.updateTime)}}function bo(r,e){return r.updateTime!==void 0?e.isFoundDocument()&&e.version.isEqual(r.updateTime):r.exists===void 0||r.exists===e.isFoundDocument()}class _a{}function Fm(r,e){if(!r.hasLocalMutations||e&&e.fields.length===0)return null;if(e===null)return r.isNoDocument()?new rs(r.key,pe.none()):new ns(r.key,r.data,pe.none());{const t=r.data,n=Ve.empty();let s=new ie(he.comparator);for(let i of e.fields)if(!s.has(i)){let o=t.field(i);o===null&&i.length>1&&(i=i.popLast(),o=t.field(i)),o===null?n.delete(i):n.set(i,o),s=s.add(i)}return new zt(r.key,n,new He(s.toArray()),pe.none())}}function vw(r,e,t){r instanceof ns?(function(s,i,o){const c=s.value.clone(),u=Cd(s.fieldTransforms,i,o.transformResults);c.setAll(u),i.convertToFoundDocument(o.version,c).setHasCommittedMutations()})(r,e,t):r instanceof zt?(function(s,i,o){if(!bo(s.precondition,i))return void i.convertToUnknownDocument(o.version);const c=Cd(s.fieldTransforms,i,o.transformResults),u=i.data;u.setAll(Um(s)),u.setAll(c),i.convertToFoundDocument(o.version,u).setHasCommittedMutations()})(r,e,t):(function(s,i,o){i.convertToNoDocument(o.version).setHasCommittedMutations()})(0,e,t)}function Xs(r,e,t,n){return r instanceof ns?(function(i,o,c,u){if(!bo(i.precondition,o))return c;const h=i.value.clone(),f=kd(i.fieldTransforms,u,o);return h.setAll(f),o.convertToFoundDocument(o.version,h).setHasLocalMutations(),null})(r,e,t,n):r instanceof zt?(function(i,o,c,u){if(!bo(i.precondition,o))return c;const h=kd(i.fieldTransforms,u,o),f=o.data;return f.setAll(Um(i)),f.setAll(h),o.convertToFoundDocument(o.version,f).setHasLocalMutations(),c===null?null:c.unionWith(i.fieldMask.fields).unionWith(i.fieldTransforms.map((p=>p.field)))})(r,e,t,n):(function(i,o,c){return bo(i.precondition,o)?(o.convertToNoDocument(o.version).setHasLocalMutations(),null):c})(r,e,t)}function ww(r,e){let t=null;for(const n of r.fieldTransforms){const s=e.data.field(n.field),i=xm(n.transform,s||null);i!=null&&(t===null&&(t=Ve.empty()),t.set(n.field,i))}return t||null}function Pd(r,e){return r.type===e.type&&!!r.key.isEqual(e.key)&&!!r.precondition.isEqual(e.precondition)&&!!(function(n,s){return n===void 0&&s===void 0||!(!n||!s)&&Vr(n,s,((i,o)=>Tw(i,o)))})(r.fieldTransforms,e.fieldTransforms)&&(r.type===0?r.value.isEqual(e.value):r.type!==1||r.data.isEqual(e.data)&&r.fieldMask.isEqual(e.fieldMask))}class ns extends _a{constructor(e,t,n,s=[]){super(),this.key=e,this.value=t,this.precondition=n,this.fieldTransforms=s,this.type=0}getFieldMask(){return null}}class zt extends _a{constructor(e,t,n,s,i=[]){super(),this.key=e,this.data=t,this.fieldMask=n,this.precondition=s,this.fieldTransforms=i,this.type=1}getFieldMask(){return this.fieldMask}}function Um(r){const e=new Map;return r.fieldMask.fields.forEach((t=>{if(!t.isEmpty()){const n=r.data.field(t);e.set(t,n)}})),e}function Cd(r,e,t){const n=new Map;q(r.length===t.length,32656,{Ae:t.length,Re:r.length});for(let s=0;s<t.length;s++){const i=r[s],o=i.transform,c=e.data.field(i.field);n.set(i.field,Iw(o,c,t[s]))}return n}function kd(r,e,t){const n=new Map;for(const s of r){const i=s.transform,o=t.data.field(s.field);n.set(s.field,yw(i,o,e))}return n}class rs extends _a{constructor(e,t){super(),this.key=e,this.precondition=t,this.type=2,this.fieldTransforms=[]}getFieldMask(){return null}}class ku extends _a{constructor(e,t){super(),this.key=e,this.precondition=t,this.type=3,this.fieldTransforms=[]}getFieldMask(){return null}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Vu{constructor(e,t,n,s){this.batchId=e,this.localWriteTime=t,this.baseMutations=n,this.mutations=s}applyToRemoteDocument(e,t){const n=t.mutationResults;for(let s=0;s<this.mutations.length;s++){const i=this.mutations[s];i.key.isEqual(e.key)&&vw(i,e,n[s])}}applyToLocalView(e,t){for(const n of this.baseMutations)n.key.isEqual(e.key)&&(t=Xs(n,e,t,this.localWriteTime));for(const n of this.mutations)n.key.isEqual(e.key)&&(t=Xs(n,e,t,this.localWriteTime));return t}applyToLocalDocumentSet(e,t){const n=Vm();return this.mutations.forEach((s=>{const i=e.get(s.key),o=i.overlayedDocument;let c=this.applyToLocalView(o,i.mutatedFields);c=t.has(s.key)?null:c;const u=Fm(o,c);u!==null&&n.set(s.key,u),o.isValidDocument()||o.convertToNoDocument(z.min())})),n}keys(){return this.mutations.reduce(((e,t)=>e.add(t.key)),W())}isEqual(e){return this.batchId===e.batchId&&Vr(this.mutations,e.mutations,((t,n)=>Pd(t,n)))&&Vr(this.baseMutations,e.baseMutations,((t,n)=>Pd(t,n)))}}class Du{constructor(e,t,n,s){this.batch=e,this.commitVersion=t,this.mutationResults=n,this.docVersions=s}static from(e,t,n){q(e.mutations.length===n.length,58842,{Ve:e.mutations.length,me:n.length});let s=(function(){return mw})();const i=e.mutations;for(let o=0;o<i.length;o++)s=s.insert(i[o].key,n[o].version);return new Du(e,t,n,s)}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Nu{constructor(e,t){this.largestBatchId=e,this.mutation=t}getKey(){return this.mutation.key}isEqual(e){return e!==null&&this.mutation===e.mutation}toString(){return`Overlay{
      largestBatchId: ${this.largestBatchId},
      mutation: ${this.mutation.toString()}
    }`}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Bm{constructor(e,t,n){this.alias=e,this.aggregateType=t,this.fieldPath=n}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Aw{constructor(e,t){this.count=e,this.unchangedNames=t}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Ee,ee;function qm(r){switch(r){case R.OK:return B(64938);case R.CANCELLED:case R.UNKNOWN:case R.DEADLINE_EXCEEDED:case R.RESOURCE_EXHAUSTED:case R.INTERNAL:case R.UNAVAILABLE:case R.UNAUTHENTICATED:return!1;case R.INVALID_ARGUMENT:case R.NOT_FOUND:case R.ALREADY_EXISTS:case R.PERMISSION_DENIED:case R.FAILED_PRECONDITION:case R.ABORTED:case R.OUT_OF_RANGE:case R.UNIMPLEMENTED:case R.DATA_LOSS:return!0;default:return B(15467,{code:r})}}function jm(r){if(r===void 0)return Ie("GRPC error has no .code"),R.UNKNOWN;switch(r){case Ee.OK:return R.OK;case Ee.CANCELLED:return R.CANCELLED;case Ee.UNKNOWN:return R.UNKNOWN;case Ee.DEADLINE_EXCEEDED:return R.DEADLINE_EXCEEDED;case Ee.RESOURCE_EXHAUSTED:return R.RESOURCE_EXHAUSTED;case Ee.INTERNAL:return R.INTERNAL;case Ee.UNAVAILABLE:return R.UNAVAILABLE;case Ee.UNAUTHENTICATED:return R.UNAUTHENTICATED;case Ee.INVALID_ARGUMENT:return R.INVALID_ARGUMENT;case Ee.NOT_FOUND:return R.NOT_FOUND;case Ee.ALREADY_EXISTS:return R.ALREADY_EXISTS;case Ee.PERMISSION_DENIED:return R.PERMISSION_DENIED;case Ee.FAILED_PRECONDITION:return R.FAILED_PRECONDITION;case Ee.ABORTED:return R.ABORTED;case Ee.OUT_OF_RANGE:return R.OUT_OF_RANGE;case Ee.UNIMPLEMENTED:return R.UNIMPLEMENTED;case Ee.DATA_LOSS:return R.DATA_LOSS;default:return B(39323,{code:r})}}(ee=Ee||(Ee={}))[ee.OK=0]="OK",ee[ee.CANCELLED=1]="CANCELLED",ee[ee.UNKNOWN=2]="UNKNOWN",ee[ee.INVALID_ARGUMENT=3]="INVALID_ARGUMENT",ee[ee.DEADLINE_EXCEEDED=4]="DEADLINE_EXCEEDED",ee[ee.NOT_FOUND=5]="NOT_FOUND",ee[ee.ALREADY_EXISTS=6]="ALREADY_EXISTS",ee[ee.PERMISSION_DENIED=7]="PERMISSION_DENIED",ee[ee.UNAUTHENTICATED=16]="UNAUTHENTICATED",ee[ee.RESOURCE_EXHAUSTED=8]="RESOURCE_EXHAUSTED",ee[ee.FAILED_PRECONDITION=9]="FAILED_PRECONDITION",ee[ee.ABORTED=10]="ABORTED",ee[ee.OUT_OF_RANGE=11]="OUT_OF_RANGE",ee[ee.UNIMPLEMENTED=12]="UNIMPLEMENTED",ee[ee.INTERNAL=13]="INTERNAL",ee[ee.UNAVAILABLE=14]="UNAVAILABLE",ee[ee.DATA_LOSS=15]="DATA_LOSS";/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Go=null;/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const bw=new un([4294967295,4294967295],0);function Vd(r){const e=gu().encode(r),t=new kp;return t.update(e),new Uint8Array(t.digest())}function Dd(r){const e=new DataView(r.buffer),t=e.getUint32(0,!0),n=e.getUint32(4,!0),s=e.getUint32(8,!0),i=e.getUint32(12,!0);return[new un([t,n],0),new un([s,i],0)]}class xu{constructor(e,t,n){if(this.bitmap=e,this.padding=t,this.hashCount=n,t<0||t>=8)throw new Bs(`Invalid padding: ${t}`);if(n<0)throw new Bs(`Invalid hash count: ${n}`);if(e.length>0&&this.hashCount===0)throw new Bs(`Invalid hash count: ${n}`);if(e.length===0&&t!==0)throw new Bs(`Invalid padding when bitmap length is 0: ${t}`);this.fe=8*e.length-t,this.ge=un.fromNumber(this.fe)}pe(e,t,n){let s=e.add(t.multiply(un.fromNumber(n)));return s.compare(bw)===1&&(s=new un([s.getBits(0),s.getBits(1)],0)),s.modulo(this.ge).toNumber()}ye(e){return!!(this.bitmap[Math.floor(e/8)]&1<<e%8)}mightContain(e){if(this.fe===0)return!1;const t=Vd(e),[n,s]=Dd(t);for(let i=0;i<this.hashCount;i++){const o=this.pe(n,s,i);if(!this.ye(o))return!1}return!0}static create(e,t,n){const s=e%8==0?0:8-e%8,i=new Uint8Array(Math.ceil(e/8)),o=new xu(i,s,t);return n.forEach((c=>o.insert(c))),o}insert(e){if(this.fe===0)return;const t=Vd(e),[n,s]=Dd(t);for(let i=0;i<this.hashCount;i++){const o=this.pe(n,s,i);this.we(o)}}we(e){const t=Math.floor(e/8),n=e%8;this.bitmap[t]|=1<<n}}class Bs extends Error{constructor(){super(...arguments),this.name="BloomFilterError"}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Pi{constructor(e,t,n,s,i){this.snapshotVersion=e,this.targetChanges=t,this.targetMismatches=n,this.documentUpdates=s,this.resolvedLimboDocuments=i}static createSynthesizedRemoteEventForCurrentChange(e,t,n){const s=new Map;return s.set(e,Ci.createSynthesizedTargetChangeForCurrentChange(e,t,n)),new Pi(z.min(),s,new ce(G),Qe(),W())}}class Ci{constructor(e,t,n,s,i){this.resumeToken=e,this.current=t,this.addedDocuments=n,this.modifiedDocuments=s,this.removedDocuments=i}static createSynthesizedTargetChangeForCurrentChange(e,t,n){return new Ci(n,t,W(),W(),W())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ro{constructor(e,t,n,s){this.Se=e,this.removedTargetIds=t,this.key=n,this.be=s}}class zm{constructor(e,t){this.targetId=e,this.De=t}}class $m{constructor(e,t,n=ge.EMPTY_BYTE_STRING,s=null){this.state=e,this.targetIds=t,this.resumeToken=n,this.cause=s}}class Nd{constructor(){this.ve=0,this.Ce=xd(),this.Fe=ge.EMPTY_BYTE_STRING,this.Me=!1,this.xe=!0}get current(){return this.Me}get resumeToken(){return this.Fe}get Oe(){return this.ve!==0}get Ne(){return this.xe}Be(e){e.approximateByteSize()>0&&(this.xe=!0,this.Fe=e)}Le(){let e=W(),t=W(),n=W();return this.Ce.forEach(((s,i)=>{switch(i){case 0:e=e.add(s);break;case 2:t=t.add(s);break;case 1:n=n.add(s);break;default:B(38017,{changeType:i})}})),new Ci(this.Fe,this.Me,e,t,n)}ke(){this.xe=!1,this.Ce=xd()}qe(e,t){this.xe=!0,this.Ce=this.Ce.insert(e,t)}Qe(e){this.xe=!0,this.Ce=this.Ce.remove(e)}$e(){this.ve+=1}Ue(){this.ve-=1,q(this.ve>=0,3241,{ve:this.ve})}Ke(){this.xe=!0,this.Me=!0}}class Rw{constructor(e){this.We=e,this.Ge=new Map,this.ze=Qe(),this.je=oo(),this.Je=oo(),this.He=new ce(G)}Ye(e){for(const t of e.Se)e.be&&e.be.isFoundDocument()?this.Ze(t,e.be):this.Xe(t,e.key,e.be);for(const t of e.removedTargetIds)this.Xe(t,e.key,e.be)}et(e){this.forEachTarget(e,(t=>{const n=this.tt(t);switch(e.state){case 0:this.nt(t)&&n.Be(e.resumeToken);break;case 1:n.Ue(),n.Oe||n.ke(),n.Be(e.resumeToken);break;case 2:n.Ue(),n.Oe||this.removeTarget(t);break;case 3:this.nt(t)&&(n.Ke(),n.Be(e.resumeToken));break;case 4:this.nt(t)&&(this.rt(t),n.Be(e.resumeToken));break;default:B(56790,{state:e.state})}}))}forEachTarget(e,t){e.targetIds.length>0?e.targetIds.forEach(t):this.Ge.forEach(((n,s)=>{this.nt(s)&&t(s)}))}it(e){const t=e.targetId,n=e.De.count,s=this.st(t);if(s){const i=s.target;if(jo(i))if(n===0){const o=new O(i.path);this.Xe(t,o,le.newNoDocument(o,z.min()))}else q(n===1,20013,{expectedCount:n});else{const o=this.ot(t);if(o!==n){const c=this._t(e),u=c?this.ut(c,e,o):1;if(u!==0){this.rt(t);const h=u===2?"TargetPurposeExistenceFilterMismatchBloom":"TargetPurposeExistenceFilterMismatch";this.He=this.He.insert(t,h)}Go==null||Go.ct((function(f,p,m,T,P){var V,C,L,U,x,j;const H={localCacheCount:f,existenceFilterCount:p.count,databaseId:m.database,projectId:m.projectId},$=p.unchangedNames;return $&&(H.bloomFilter={applied:P===0,hashCount:(V=$==null?void 0:$.hashCount)!==null&&V!==void 0?V:0,bitmapLength:(U=(L=(C=$==null?void 0:$.bits)===null||C===void 0?void 0:C.bitmap)===null||L===void 0?void 0:L.length)!==null&&U!==void 0?U:0,padding:(j=(x=$==null?void 0:$.bits)===null||x===void 0?void 0:x.padding)!==null&&j!==void 0?j:0,mightContain:E=>{var _;return(_=T==null?void 0:T.mightContain(E))!==null&&_!==void 0&&_}}),H})(o,e.De,this.We.lt(),c,u))}}}}_t(e){const t=e.De.unchangedNames;if(!t||!t.bits)return null;const{bits:{bitmap:n="",padding:s=0},hashCount:i=0}=t;let o,c;try{o=Lt(n).toUint8Array()}catch(u){if(u instanceof am)return Be("Decoding the base64 bloom filter in existence filter failed ("+u.message+"); ignoring the bloom filter and falling back to full re-query."),null;throw u}try{c=new xu(o,s,i)}catch(u){return Be(u instanceof Bs?"BloomFilter error: ":"Applying bloom filter failed: ",u),null}return c.fe===0?null:c}ut(e,t,n){return t.De.count===n-this.ht(e,t.targetId)?0:2}ht(e,t){const n=this.We.getRemoteKeysForTarget(t);let s=0;return n.forEach((i=>{const o=this.We.lt(),c=`projects/${o.projectId}/databases/${o.database}/documents/${i.path.canonicalString()}`;e.mightContain(c)||(this.Xe(t,i,null),s++)})),s}Pt(e){const t=new Map;this.Ge.forEach(((i,o)=>{const c=this.st(o);if(c){if(i.current&&jo(c.target)){const u=new O(c.target.path);this.Tt(u).has(o)||this.It(o,u)||this.Xe(o,u,le.newNoDocument(u,e))}i.Ne&&(t.set(o,i.Le()),i.ke())}}));let n=W();this.Je.forEach(((i,o)=>{let c=!0;o.forEachWhile((u=>{const h=this.st(u);return!h||h.purpose==="TargetPurposeLimboResolution"||(c=!1,!1)})),c&&(n=n.add(i))})),this.ze.forEach(((i,o)=>o.setReadTime(e)));const s=new Pi(e,t,this.He,this.ze,n);return this.ze=Qe(),this.je=oo(),this.Je=oo(),this.He=new ce(G),s}Ze(e,t){if(!this.nt(e))return;const n=this.It(e,t.key)?2:0;this.tt(e).qe(t.key,n),this.ze=this.ze.insert(t.key,t),this.je=this.je.insert(t.key,this.Tt(t.key).add(e)),this.Je=this.Je.insert(t.key,this.dt(t.key).add(e))}Xe(e,t,n){if(!this.nt(e))return;const s=this.tt(e);this.It(e,t)?s.qe(t,1):s.Qe(t),this.Je=this.Je.insert(t,this.dt(t).delete(e)),this.Je=this.Je.insert(t,this.dt(t).add(e)),n&&(this.ze=this.ze.insert(t,n))}removeTarget(e){this.Ge.delete(e)}ot(e){const t=this.tt(e).Le();return this.We.getRemoteKeysForTarget(e).size+t.addedDocuments.size-t.removedDocuments.size}$e(e){this.tt(e).$e()}tt(e){let t=this.Ge.get(e);return t||(t=new Nd,this.Ge.set(e,t)),t}dt(e){let t=this.Je.get(e);return t||(t=new ie(G),this.Je=this.Je.insert(e,t)),t}Tt(e){let t=this.je.get(e);return t||(t=new ie(G),this.je=this.je.insert(e,t)),t}nt(e){const t=this.st(e)!==null;return t||N("WatchChangeAggregator","Detected inactive target",e),t}st(e){const t=this.Ge.get(e);return t&&t.Oe?null:this.We.Et(e)}rt(e){this.Ge.set(e,new Nd),this.We.getRemoteKeysForTarget(e).forEach((t=>{this.Xe(e,t,null)}))}It(e,t){return this.We.getRemoteKeysForTarget(e).has(t)}}function oo(){return new ce(O.comparator)}function xd(){return new ce(O.comparator)}const Sw={asc:"ASCENDING",desc:"DESCENDING"},Pw={"<":"LESS_THAN","<=":"LESS_THAN_OR_EQUAL",">":"GREATER_THAN",">=":"GREATER_THAN_OR_EQUAL","==":"EQUAL","!=":"NOT_EQUAL","array-contains":"ARRAY_CONTAINS",in:"IN","not-in":"NOT_IN","array-contains-any":"ARRAY_CONTAINS_ANY"},Cw={and:"AND",or:"OR"};class kw{constructor(e,t){this.databaseId=e,this.useProto3Json=t}}function Bc(r,e){return r.useProto3Json||vi(e)?e:{value:e}}function $r(r,e){return r.useProto3Json?`${new Date(1e3*e.seconds).toISOString().replace(/\.\d*/,"").replace("Z","")}.${("000000000"+e.nanoseconds).slice(-9)}Z`:{seconds:""+e.seconds,nanos:e.nanoseconds}}function Gm(r,e){return r.useProto3Json?e.toBase64():e.toUint8Array()}function Vw(r,e){return $r(r,e.toTimestamp())}function Te(r){return q(!!r,49232),z.fromTimestamp((function(t){const n=Mt(t);return new ne(n.seconds,n.nanos)})(r))}function Ou(r,e){return qc(r,e).canonicalString()}function qc(r,e){const t=(function(s){return new Q(["projects",s.projectId,"databases",s.database])})(r).child("documents");return e===void 0?t:t.child(e)}function Km(r){const e=Q.fromString(r);return q(tg(e),10190,{key:e.toString()}),e}function di(r,e){return Ou(r.databaseId,e.path)}function Tt(r,e){const t=Km(e);if(t.get(1)!==r.databaseId.projectId)throw new D(R.INVALID_ARGUMENT,"Tried to deserialize key from different project: "+t.get(1)+" vs "+r.databaseId.projectId);if(t.get(3)!==r.databaseId.database)throw new D(R.INVALID_ARGUMENT,"Tried to deserialize key from different database: "+t.get(3)+" vs "+r.databaseId.database);return new O(Qm(t))}function Wm(r,e){return Ou(r.databaseId,e)}function Hm(r){const e=Km(r);return e.length===4?Q.emptyPath():Qm(e)}function jc(r){return new Q(["projects",r.databaseId.projectId,"databases",r.databaseId.database]).canonicalString()}function Qm(r){return q(r.length>4&&r.get(4)==="documents",29091,{key:r.toString()}),r.popFirst(5)}function Od(r,e,t){return{name:di(r,e),fields:t.value.mapValue.fields}}function ya(r,e,t){const n=Tt(r,e.name),s=Te(e.updateTime),i=e.createTime?Te(e.createTime):z.min(),o=new Ve({mapValue:{fields:e.fields}}),c=le.newFoundDocument(n,s,i,o);return t&&c.setHasCommittedMutations(),t?c.setHasCommittedMutations():c}function Dw(r,e){return"found"in e?(function(n,s){q(!!s.found,43571),s.found.name,s.found.updateTime;const i=Tt(n,s.found.name),o=Te(s.found.updateTime),c=s.found.createTime?Te(s.found.createTime):z.min(),u=new Ve({mapValue:{fields:s.found.fields}});return le.newFoundDocument(i,o,c,u)})(r,e):"missing"in e?(function(n,s){q(!!s.missing,3894),q(!!s.readTime,22933);const i=Tt(n,s.missing),o=Te(s.readTime);return le.newNoDocument(i,o)})(r,e):B(7234,{result:e})}function Nw(r,e){let t;if("targetChange"in e){e.targetChange;const n=(function(h){return h==="NO_CHANGE"?0:h==="ADD"?1:h==="REMOVE"?2:h==="CURRENT"?3:h==="RESET"?4:B(39313,{state:h})})(e.targetChange.targetChangeType||"NO_CHANGE"),s=e.targetChange.targetIds||[],i=(function(h,f){return h.useProto3Json?(q(f===void 0||typeof f=="string",58123),ge.fromBase64String(f||"")):(q(f===void 0||f instanceof Buffer||f instanceof Uint8Array,16193),ge.fromUint8Array(f||new Uint8Array))})(r,e.targetChange.resumeToken),o=e.targetChange.cause,c=o&&(function(h){const f=h.code===void 0?R.UNKNOWN:jm(h.code);return new D(f,h.message||"")})(o);t=new $m(n,s,i,c||null)}else if("documentChange"in e){e.documentChange;const n=e.documentChange;n.document,n.document.name,n.document.updateTime;const s=Tt(r,n.document.name),i=Te(n.document.updateTime),o=n.document.createTime?Te(n.document.createTime):z.min(),c=new Ve({mapValue:{fields:n.document.fields}}),u=le.newFoundDocument(s,i,o,c),h=n.targetIds||[],f=n.removedTargetIds||[];t=new Ro(h,f,u.key,u)}else if("documentDelete"in e){e.documentDelete;const n=e.documentDelete;n.document;const s=Tt(r,n.document),i=n.readTime?Te(n.readTime):z.min(),o=le.newNoDocument(s,i),c=n.removedTargetIds||[];t=new Ro([],c,o.key,o)}else if("documentRemove"in e){e.documentRemove;const n=e.documentRemove;n.document;const s=Tt(r,n.document),i=n.removedTargetIds||[];t=new Ro([],i,s,null)}else{if(!("filter"in e))return B(11601,{At:e});{e.filter;const n=e.filter;n.targetId;const{count:s=0,unchangedNames:i}=n,o=new Aw(s,i),c=n.targetId;t=new zm(c,o)}}return t}function fi(r,e){let t;if(e instanceof ns)t={update:Od(r,e.key,e.value)};else if(e instanceof rs)t={delete:di(r,e.key)};else if(e instanceof zt)t={update:Od(r,e.key,e.data),updateMask:Uw(e.fieldMask)};else{if(!(e instanceof ku))return B(16599,{Rt:e.type});t={verify:di(r,e.key)}}return e.fieldTransforms.length>0&&(t.updateTransforms=e.fieldTransforms.map((n=>(function(i,o){const c=o.transform;if(c instanceof jr)return{fieldPath:o.field.canonicalString(),setToServerValue:"REQUEST_TIME"};if(c instanceof Jn)return{fieldPath:o.field.canonicalString(),appendMissingElements:{values:c.elements}};if(c instanceof Yn)return{fieldPath:o.field.canonicalString(),removeAllFromArray:{values:c.elements}};if(c instanceof zr)return{fieldPath:o.field.canonicalString(),increment:c.Ee};throw B(20930,{transform:o.transform})})(0,n)))),e.precondition.isNone||(t.currentDocument=(function(s,i){return i.updateTime!==void 0?{updateTime:Vw(s,i.updateTime)}:i.exists!==void 0?{exists:i.exists}:B(27497)})(r,e.precondition)),t}function zc(r,e){const t=e.currentDocument?(function(i){return i.updateTime!==void 0?pe.updateTime(Te(i.updateTime)):i.exists!==void 0?pe.exists(i.exists):pe.none()})(e.currentDocument):pe.none(),n=e.updateTransforms?e.updateTransforms.map((s=>(function(o,c){let u=null;if("setToServerValue"in c)q(c.setToServerValue==="REQUEST_TIME",16630,{proto:c}),u=new jr;else if("appendMissingElements"in c){const f=c.appendMissingElements.values||[];u=new Jn(f)}else if("removeAllFromArray"in c){const f=c.removeAllFromArray.values||[];u=new Yn(f)}else"increment"in c?u=new zr(o,c.increment):B(16584,{proto:c});const h=he.fromServerFormat(c.fieldPath);return new Si(h,u)})(r,s))):[];if(e.update){e.update.name;const s=Tt(r,e.update.name),i=new Ve({mapValue:{fields:e.update.fields}});if(e.updateMask){const o=(function(u){const h=u.fieldPaths||[];return new He(h.map((f=>he.fromServerFormat(f))))})(e.updateMask);return new zt(s,i,o,t,n)}return new ns(s,i,t,n)}if(e.delete){const s=Tt(r,e.delete);return new rs(s,t)}if(e.verify){const s=Tt(r,e.verify);return new ku(s,t)}return B(1463,{proto:e})}function xw(r,e){return r&&r.length>0?(q(e!==void 0,14353),r.map((t=>(function(s,i){let o=s.updateTime?Te(s.updateTime):Te(i);return o.isEqual(z.min())&&(o=Te(i)),new Ew(o,s.transformResults||[])})(t,e)))):[]}function Xm(r,e){return{documents:[Wm(r,e.path)]}}function Ia(r,e){const t={structuredQuery:{}},n=e.path;let s;e.collectionGroup!==null?(s=n,t.structuredQuery.from=[{collectionId:e.collectionGroup,allDescendants:!0}]):(s=n.popLast(),t.structuredQuery.from=[{collectionId:n.lastSegment()}]),t.parent=Wm(r,s);const i=(function(h){if(h.length!==0)return eg(re.create(h,"and"))})(e.filters);i&&(t.structuredQuery.where=i);const o=(function(h){if(h.length!==0)return h.map((f=>(function(m){return{field:rn(m.field),direction:Mw(m.dir)}})(f)))})(e.orderBy);o&&(t.structuredQuery.orderBy=o);const c=Bc(r,e.limit);return c!==null&&(t.structuredQuery.limit=c),e.startAt&&(t.structuredQuery.startAt=(function(h){return{before:h.inclusive,values:h.position}})(e.startAt)),e.endAt&&(t.structuredQuery.endAt=(function(h){return{before:!h.inclusive,values:h.position}})(e.endAt)),{Vt:t,parent:s}}function Jm(r,e,t,n){const{Vt:s,parent:i}=Ia(r,e),o={},c=[];let u=0;return t.forEach((h=>{const f=n?h.alias:"aggregate_"+u++;o[f]=h.alias,h.aggregateType==="count"?c.push({alias:f,count:{}}):h.aggregateType==="avg"?c.push({alias:f,avg:{field:rn(h.fieldPath)}}):h.aggregateType==="sum"&&c.push({alias:f,sum:{field:rn(h.fieldPath)}})})),{request:{structuredAggregationQuery:{aggregations:c,structuredQuery:s.structuredQuery},parent:s.parent},ft:o,parent:i}}function Ym(r){let e=Hm(r.parent);const t=r.structuredQuery,n=t.from?t.from.length:0;let s=null;if(n>0){q(n===1,65062);const f=t.from[0];f.allDescendants?s=f.collectionId:e=e.child(f.collectionId)}let i=[];t.where&&(i=(function(p){const m=Zm(p);return m instanceof re&&Ru(m)?m.getFilters():[m]})(t.where));let o=[];t.orderBy&&(o=(function(p){return p.map((m=>(function(P){return new hi(Ar(P.field),(function(C){switch(C){case"ASCENDING":return"asc";case"DESCENDING":return"desc";default:return}})(P.direction))})(m)))})(t.orderBy));let c=null;t.limit&&(c=(function(p){let m;return m=typeof p=="object"?p.value:p,vi(m)?null:m})(t.limit));let u=null;t.startAt&&(u=(function(p){const m=!!p.before,T=p.values||[];return new gn(T,m)})(t.startAt));let h=null;return t.endAt&&(h=(function(p){const m=!p.before,T=p.values||[];return new gn(T,m)})(t.endAt)),wm(e,s,o,i,c,"F",u,h)}function Ow(r,e){const t=(function(s){switch(s){case"TargetPurposeListen":return null;case"TargetPurposeExistenceFilterMismatch":return"existence-filter-mismatch";case"TargetPurposeExistenceFilterMismatchBloom":return"existence-filter-mismatch-bloom";case"TargetPurposeLimboResolution":return"limbo-document";default:return B(28987,{purpose:s})}})(e.purpose);return t==null?null:{"goog-listen-tags":t}}function Zm(r){return r.unaryFilter!==void 0?(function(t){switch(t.unaryFilter.op){case"IS_NAN":const n=Ar(t.unaryFilter.field);return Y.create(n,"==",{doubleValue:NaN});case"IS_NULL":const s=Ar(t.unaryFilter.field);return Y.create(s,"==",{nullValue:"NULL_VALUE"});case"IS_NOT_NAN":const i=Ar(t.unaryFilter.field);return Y.create(i,"!=",{doubleValue:NaN});case"IS_NOT_NULL":const o=Ar(t.unaryFilter.field);return Y.create(o,"!=",{nullValue:"NULL_VALUE"});case"OPERATOR_UNSPECIFIED":return B(61313);default:return B(60726)}})(r):r.fieldFilter!==void 0?(function(t){return Y.create(Ar(t.fieldFilter.field),(function(s){switch(s){case"EQUAL":return"==";case"NOT_EQUAL":return"!=";case"GREATER_THAN":return">";case"GREATER_THAN_OR_EQUAL":return">=";case"LESS_THAN":return"<";case"LESS_THAN_OR_EQUAL":return"<=";case"ARRAY_CONTAINS":return"array-contains";case"IN":return"in";case"NOT_IN":return"not-in";case"ARRAY_CONTAINS_ANY":return"array-contains-any";case"OPERATOR_UNSPECIFIED":return B(58110);default:return B(50506)}})(t.fieldFilter.op),t.fieldFilter.value)})(r):r.compositeFilter!==void 0?(function(t){return re.create(t.compositeFilter.filters.map((n=>Zm(n))),(function(s){switch(s){case"AND":return"and";case"OR":return"or";default:return B(1026)}})(t.compositeFilter.op))})(r):B(30097,{filter:r})}function Mw(r){return Sw[r]}function Lw(r){return Pw[r]}function Fw(r){return Cw[r]}function rn(r){return{fieldPath:r.canonicalString()}}function Ar(r){return he.fromServerFormat(r.fieldPath)}function eg(r){return r instanceof Y?(function(t){if(t.op==="=="){if(Id(t.value))return{unaryFilter:{field:rn(t.field),op:"IS_NAN"}};if(yd(t.value))return{unaryFilter:{field:rn(t.field),op:"IS_NULL"}}}else if(t.op==="!="){if(Id(t.value))return{unaryFilter:{field:rn(t.field),op:"IS_NOT_NAN"}};if(yd(t.value))return{unaryFilter:{field:rn(t.field),op:"IS_NOT_NULL"}}}return{fieldFilter:{field:rn(t.field),op:Lw(t.op),value:t.value}}})(r):r instanceof re?(function(t){const n=t.getFilters().map((s=>eg(s)));return n.length===1?n[0]:{compositeFilter:{op:Fw(t.op),filters:n}}})(r):B(54877,{filter:r})}function Uw(r){const e=[];return r.fields.forEach((t=>e.push(t.canonicalString()))),{fieldPaths:e}}function tg(r){return r.length>=4&&r.get(0)==="projects"&&r.get(2)==="databases"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class kt{constructor(e,t,n,s,i=z.min(),o=z.min(),c=ge.EMPTY_BYTE_STRING,u=null){this.target=e,this.targetId=t,this.purpose=n,this.sequenceNumber=s,this.snapshotVersion=i,this.lastLimboFreeSnapshotVersion=o,this.resumeToken=c,this.expectedCount=u}withSequenceNumber(e){return new kt(this.target,this.targetId,this.purpose,e,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,this.expectedCount)}withResumeToken(e,t){return new kt(this.target,this.targetId,this.purpose,this.sequenceNumber,t,this.lastLimboFreeSnapshotVersion,e,null)}withExpectedCount(e){return new kt(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,e)}withLastLimboFreeSnapshotVersion(e){return new kt(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,e,this.resumeToken,this.expectedCount)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ng{constructor(e){this.gt=e}}function Bw(r,e){let t;if(e.document)t=ya(r.gt,e.document,!!e.hasCommittedMutations);else if(e.noDocument){const n=O.fromSegments(e.noDocument.path),s=er(e.noDocument.readTime);t=le.newNoDocument(n,s),e.hasCommittedMutations&&t.setHasCommittedMutations()}else{if(!e.unknownDocument)return B(56709);{const n=O.fromSegments(e.unknownDocument.path),s=er(e.unknownDocument.version);t=le.newUnknownDocument(n,s)}}return e.readTime&&t.setReadTime((function(s){const i=new ne(s[0],s[1]);return z.fromTimestamp(i)})(e.readTime)),t}function Md(r,e){const t=e.key,n={prefixPath:t.getCollectionPath().popLast().toArray(),collectionGroup:t.collectionGroup,documentId:t.path.lastSegment(),readTime:Ko(e.readTime),hasCommittedMutations:e.hasCommittedMutations};if(e.isFoundDocument())n.document=(function(i,o){return{name:di(i,o.key),fields:o.data.value.mapValue.fields,updateTime:$r(i,o.version.toTimestamp()),createTime:$r(i,o.createTime.toTimestamp())}})(r.gt,e);else if(e.isNoDocument())n.noDocument={path:t.path.toArray(),readTime:Zn(e.version)};else{if(!e.isUnknownDocument())return B(57904,{document:e});n.unknownDocument={path:t.path.toArray(),version:Zn(e.version)}}return n}function Ko(r){const e=r.toTimestamp();return[e.seconds,e.nanoseconds]}function Zn(r){const e=r.toTimestamp();return{seconds:e.seconds,nanoseconds:e.nanoseconds}}function er(r){const e=new ne(r.seconds,r.nanoseconds);return z.fromTimestamp(e)}function Ln(r,e){const t=(e.baseMutations||[]).map((i=>zc(r.gt,i)));for(let i=0;i<e.mutations.length-1;++i){const o=e.mutations[i];if(i+1<e.mutations.length&&e.mutations[i+1].transform!==void 0){const c=e.mutations[i+1];o.updateTransforms=c.transform.fieldTransforms,e.mutations.splice(i+1,1),++i}}const n=e.mutations.map((i=>zc(r.gt,i))),s=ne.fromMillis(e.localWriteTimeMs);return new Vu(e.batchId,s,t,n)}function qs(r){const e=er(r.readTime),t=r.lastLimboFreeSnapshotVersion!==void 0?er(r.lastLimboFreeSnapshotVersion):z.min();let n;return n=(function(i){return i.documents!==void 0})(r.query)?(function(i){const o=i.documents.length;return q(o===1,1966,{count:o}),Ue(ts(Hm(i.documents[0])))})(r.query):(function(i){return Ue(Ym(i))})(r.query),new kt(n,r.targetId,"TargetPurposeListen",r.lastListenSequenceNumber,e,t,ge.fromBase64String(r.resumeToken))}function rg(r,e){const t=Zn(e.snapshotVersion),n=Zn(e.lastLimboFreeSnapshotVersion);let s;s=jo(e.target)?Xm(r.gt,e.target):Ia(r.gt,e.target).Vt;const i=e.resumeToken.toBase64();return{targetId:e.targetId,canonicalId:Xn(e.target),readTime:t,resumeToken:i,lastListenSequenceNumber:e.sequenceNumber,lastLimboFreeSnapshotVersion:n,query:s}}function Ta(r){const e=Ym({parent:r.parent,structuredQuery:r.structuredQuery});return r.limitType==="LAST"?$o(e,e.limit,"L"):e}function uc(r,e){return new Nu(e.largestBatchId,zc(r.gt,e.overlayMutation))}function Ld(r,e){const t=e.path.lastSegment();return[r,Fe(e.path.popLast()),t]}function Fd(r,e,t,n){return{indexId:r,uid:e,sequenceNumber:t,readTime:Zn(n.readTime),documentKey:Fe(n.documentKey.path),largestBatchId:n.largestBatchId}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class qw{getBundleMetadata(e,t){return Ud(e).get(t).next((n=>{if(n)return(function(i){return{id:i.bundleId,createTime:er(i.createTime),version:i.version}})(n)}))}saveBundleMetadata(e,t){return Ud(e).put((function(s){return{bundleId:s.id,createTime:Zn(Te(s.createTime)),version:s.version}})(t))}getNamedQuery(e,t){return Bd(e).get(t).next((n=>{if(n)return(function(i){return{name:i.name,query:Ta(i.bundledQuery),readTime:er(i.readTime)}})(n)}))}saveNamedQuery(e,t){return Bd(e).put((function(s){return{name:s.name,readTime:Zn(Te(s.readTime)),bundledQuery:s.bundledQuery}})(t))}}function Ud(r){return be(r,la)}function Bd(r){return be(r,ha)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ea{constructor(e,t){this.serializer=e,this.userId=t}static yt(e,t){const n=t.uid||"";return new Ea(e,n)}getOverlay(e,t){return ks(e).get(Ld(this.userId,t)).next((n=>n?uc(this.serializer,n):null))}getOverlays(e,t){const n=mt();return A.forEach(t,(s=>this.getOverlay(e,s).next((i=>{i!==null&&n.set(s,i)})))).next((()=>n))}saveOverlays(e,t,n){const s=[];return n.forEach(((i,o)=>{const c=new Nu(t,o);s.push(this.wt(e,c))})),A.waitFor(s)}removeOverlaysForBatchId(e,t,n){const s=new Set;t.forEach((o=>s.add(Fe(o.getCollectionPath()))));const i=[];return s.forEach((o=>{const c=IDBKeyRange.bound([this.userId,o,n],[this.userId,o,n+1],!1,!0);i.push(ks(e).Y(Dc,c))})),A.waitFor(i)}getOverlaysForCollection(e,t,n){const s=mt(),i=Fe(t),o=IDBKeyRange.bound([this.userId,i,n],[this.userId,i,Number.POSITIVE_INFINITY],!0);return ks(e).j(Dc,o).next((c=>{for(const u of c){const h=uc(this.serializer,u);s.set(h.getKey(),h)}return s}))}getOverlaysForCollectionGroup(e,t,n,s){const i=mt();let o;const c=IDBKeyRange.bound([this.userId,t,n],[this.userId,t,Number.POSITIVE_INFINITY],!0);return ks(e).X({index:em,range:c},((u,h,f)=>{const p=uc(this.serializer,h);i.size()<s||p.largestBatchId===o?(i.set(p.getKey(),p),o=p.largestBatchId):f.done()})).next((()=>i))}wt(e,t){return ks(e).put((function(s,i,o){const[c,u,h]=Ld(i,o.mutation.key);return{userId:i,collectionPath:u,documentId:h,collectionGroup:o.mutation.key.getCollectionGroup(),largestBatchId:o.largestBatchId,overlayMutation:fi(s.gt,o.mutation)}})(this.serializer,this.userId,t))}}function ks(r){return be(r,da)}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class jw{St(e){return be(e,vu)}getSessionToken(e){return this.St(e).get("sessionToken").next((t=>{const n=t==null?void 0:t.value;return n?ge.fromUint8Array(n):ge.EMPTY_BYTE_STRING}))}setSessionToken(e,t){return this.St(e).put({name:"sessionToken",value:t.toUint8Array()})}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Fn{constructor(){}bt(e,t){this.Dt(e,t),t.vt()}Dt(e,t){if("nullValue"in e)this.Ct(t,5);else if("booleanValue"in e)this.Ct(t,10),t.Ft(e.booleanValue?1:0);else if("integerValue"in e)this.Ct(t,15),t.Ft(fe(e.integerValue));else if("doubleValue"in e){const n=fe(e.doubleValue);isNaN(n)?this.Ct(t,13):(this.Ct(t,15),ri(n)?t.Ft(0):t.Ft(n))}else if("timestampValue"in e){let n=e.timestampValue;this.Ct(t,20),typeof n=="string"&&(n=Mt(n)),t.Mt(`${n.seconds||""}`),t.Ft(n.nanos||0)}else if("stringValue"in e)this.xt(e.stringValue,t),this.Ot(t);else if("bytesValue"in e)this.Ct(t,30),t.Nt(Lt(e.bytesValue)),this.Ot(t);else if("referenceValue"in e)this.Bt(e.referenceValue,t);else if("geoPointValue"in e){const n=e.geoPointValue;this.Ct(t,45),t.Ft(n.latitude||0),t.Ft(n.longitude||0)}else"mapValue"in e?fm(e)?this.Ct(t,Number.MAX_SAFE_INTEGER):ma(e)?this.Lt(e.mapValue,t):(this.kt(e.mapValue,t),this.Ot(t)):"arrayValue"in e?(this.qt(e.arrayValue,t),this.Ot(t)):B(19022,{Qt:e})}xt(e,t){this.Ct(t,25),this.$t(e,t)}$t(e,t){t.Mt(e)}kt(e,t){const n=e.fields||{};this.Ct(t,55);for(const s of Object.keys(n))this.xt(s,t),this.Dt(n[s],t)}Lt(e,t){var n,s;const i=e.fields||{};this.Ct(t,53);const o=Ur,c=((s=(n=i[o].arrayValue)===null||n===void 0?void 0:n.values)===null||s===void 0?void 0:s.length)||0;this.Ct(t,15),t.Ft(fe(c)),this.xt(o,t),this.Dt(i[o],t)}qt(e,t){const n=e.values||[];this.Ct(t,50);for(const s of n)this.Dt(s,t)}Bt(e,t){this.Ct(t,37),O.fromName(e).path.forEach((n=>{this.Ct(t,60),this.$t(n,t)}))}Ct(e,t){e.Ft(t)}Ot(e){e.Ft(2)}}Fn.Ut=new Fn;/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law | agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES | CONDITIONS OF ANY KIND, either express | implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const _r=255;function zw(r){if(r===0)return 8;let e=0;return r>>4||(e+=4,r<<=4),r>>6||(e+=2,r<<=2),r>>7||(e+=1),e}function qd(r){const e=64-(function(n){let s=0;for(let i=0;i<8;++i){const o=zw(255&n[i]);if(s+=o,o!==8)break}return s})(r);return Math.ceil(e/8)}class $w{constructor(){this.buffer=new Uint8Array(1024),this.position=0}Kt(e){const t=e[Symbol.iterator]();let n=t.next();for(;!n.done;)this.Wt(n.value),n=t.next();this.Gt()}zt(e){const t=e[Symbol.iterator]();let n=t.next();for(;!n.done;)this.jt(n.value),n=t.next();this.Jt()}Ht(e){for(const t of e){const n=t.charCodeAt(0);if(n<128)this.Wt(n);else if(n<2048)this.Wt(960|n>>>6),this.Wt(128|63&n);else if(t<"\uD800"||"\uDBFF"<t)this.Wt(480|n>>>12),this.Wt(128|63&n>>>6),this.Wt(128|63&n);else{const s=t.codePointAt(0);this.Wt(240|s>>>18),this.Wt(128|63&s>>>12),this.Wt(128|63&s>>>6),this.Wt(128|63&s)}}this.Gt()}Yt(e){for(const t of e){const n=t.charCodeAt(0);if(n<128)this.jt(n);else if(n<2048)this.jt(960|n>>>6),this.jt(128|63&n);else if(t<"\uD800"||"\uDBFF"<t)this.jt(480|n>>>12),this.jt(128|63&n>>>6),this.jt(128|63&n);else{const s=t.codePointAt(0);this.jt(240|s>>>18),this.jt(128|63&s>>>12),this.jt(128|63&s>>>6),this.jt(128|63&s)}}this.Jt()}Zt(e){const t=this.Xt(e),n=qd(t);this.en(1+n),this.buffer[this.position++]=255&n;for(let s=t.length-n;s<t.length;++s)this.buffer[this.position++]=255&t[s]}tn(e){const t=this.Xt(e),n=qd(t);this.en(1+n),this.buffer[this.position++]=~(255&n);for(let s=t.length-n;s<t.length;++s)this.buffer[this.position++]=~(255&t[s])}nn(){this.rn(_r),this.rn(255)}sn(){this._n(_r),this._n(255)}reset(){this.position=0}seed(e){this.en(e.length),this.buffer.set(e,this.position),this.position+=e.length}an(){return this.buffer.slice(0,this.position)}Xt(e){const t=(function(i){const o=new DataView(new ArrayBuffer(8));return o.setFloat64(0,i,!1),new Uint8Array(o.buffer)})(e),n=!!(128&t[0]);t[0]^=n?255:128;for(let s=1;s<t.length;++s)t[s]^=n?255:0;return t}Wt(e){const t=255&e;t===0?(this.rn(0),this.rn(255)):t===_r?(this.rn(_r),this.rn(0)):this.rn(t)}jt(e){const t=255&e;t===0?(this._n(0),this._n(255)):t===_r?(this._n(_r),this._n(0)):this._n(e)}Gt(){this.rn(0),this.rn(1)}Jt(){this._n(0),this._n(1)}rn(e){this.en(1),this.buffer[this.position++]=e}_n(e){this.en(1),this.buffer[this.position++]=~e}en(e){const t=e+this.position;if(t<=this.buffer.length)return;let n=2*this.buffer.length;n<t&&(n=t);const s=new Uint8Array(n);s.set(this.buffer),this.buffer=s}}class Gw{constructor(e){this.un=e}Nt(e){this.un.Kt(e)}Mt(e){this.un.Ht(e)}Ft(e){this.un.Zt(e)}vt(){this.un.nn()}}class Kw{constructor(e){this.un=e}Nt(e){this.un.zt(e)}Mt(e){this.un.Yt(e)}Ft(e){this.un.tn(e)}vt(){this.un.sn()}}class Vs{constructor(){this.un=new $w,this.cn=new Gw(this.un),this.ln=new Kw(this.un)}seed(e){this.un.seed(e)}hn(e){return e===0?this.cn:this.ln}an(){return this.un.an()}reset(){this.un.reset()}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Un{constructor(e,t,n,s){this.Pn=e,this.Tn=t,this.In=n,this.dn=s}En(){const e=this.dn.length,t=e===0||this.dn[e-1]===255?e+1:e,n=new Uint8Array(t);return n.set(this.dn,0),t!==e?n.set([0],this.dn.length):++n[n.length-1],new Un(this.Pn,this.Tn,this.In,n)}An(e,t,n){return{indexId:this.Pn,uid:e,arrayValue:So(this.In),directionalValue:So(this.dn),orderedDocumentKey:So(t),documentKey:n.path.toArray()}}Rn(e,t,n){const s=this.An(e,t,n);return[s.indexId,s.uid,s.arrayValue,s.directionalValue,s.orderedDocumentKey,s.documentKey]}}function Xt(r,e){let t=r.Pn-e.Pn;return t!==0?t:(t=jd(r.In,e.In),t!==0?t:(t=jd(r.dn,e.dn),t!==0?t:O.comparator(r.Tn,e.Tn)))}function jd(r,e){for(let t=0;t<r.length&&t<e.length;++t){const n=r[t]-e[t];if(n!==0)return n}return r.length-e.length}function So(r){return Gf()?(function(t){let n="";for(let s=0;s<t.length;s++)n+=String.fromCharCode(t[s]);return n})(r):r}function zd(r){return typeof r!="string"?r:(function(t){const n=new Uint8Array(t.length);for(let s=0;s<t.length;s++)n[s]=t.charCodeAt(s);return n})(r)}class $d{constructor(e){this.Vn=new ie(((t,n)=>he.comparator(t.field,n.field))),this.collectionId=e.collectionGroup!=null?e.collectionGroup:e.path.lastSegment(),this.mn=e.orderBy,this.fn=[];for(const t of e.filters){const n=t;n.isInequality()?this.Vn=this.Vn.add(n):this.fn.push(n)}}get gn(){return this.Vn.size>1}pn(e){if(q(e.collectionGroup===this.collectionId,49279),this.gn)return!1;const t=Cc(e);if(t!==void 0&&!this.yn(t))return!1;const n=xn(e);let s=new Set,i=0,o=0;for(;i<n.length&&this.yn(n[i]);++i)s=s.add(n[i].fieldPath.canonicalString());if(i===n.length)return!0;if(this.Vn.size>0){const c=this.Vn.getIterator().getNext();if(!s.has(c.field.canonicalString())){const u=n[i];if(!this.wn(c,u)||!this.Sn(this.mn[o++],u))return!1}++i}for(;i<n.length;++i){const c=n[i];if(o>=this.mn.length||!this.Sn(this.mn[o++],c))return!1}return!0}bn(){if(this.gn)return null;let e=new ie(he.comparator);const t=[];for(const n of this.fn)if(!n.field.isKeyField())if(n.op==="array-contains"||n.op==="array-contains-any")t.push(new zn(n.field,2));else{if(e.has(n.field))continue;e=e.add(n.field),t.push(new zn(n.field,0))}for(const n of this.mn)n.field.isKeyField()||e.has(n.field)||(e=e.add(n.field),t.push(new zn(n.field,n.dir==="asc"?0:1)));return new Nr(Nr.UNKNOWN_ID,this.collectionId,t,xr.empty())}yn(e){for(const t of this.fn)if(this.wn(t,e))return!0;return!1}wn(e,t){if(e===void 0||!e.field.isEqual(t.fieldPath))return!1;const n=e.op==="array-contains"||e.op==="array-contains-any";return t.kind===2===n}Sn(e,t){return!!e.field.isEqual(t.fieldPath)&&(t.kind===0&&e.dir==="asc"||t.kind===1&&e.dir==="desc")}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function sg(r){var e,t;if(q(r instanceof Y||r instanceof re,20012),r instanceof Y){if(r instanceof vm){const s=((t=(e=r.value.arrayValue)===null||e===void 0?void 0:e.values)===null||t===void 0?void 0:t.map((i=>Y.create(r.field,"==",i))))||[];return re.create(s,"or")}return r}const n=r.filters.map((s=>sg(s)));return re.create(n,r.op)}function Ww(r){if(r.getFilters().length===0)return[];const e=Kc(sg(r));return q(ig(e),7391),$c(e)||Gc(e)?[e]:e.getFilters()}function $c(r){return r instanceof Y}function Gc(r){return r instanceof re&&Ru(r)}function ig(r){return $c(r)||Gc(r)||(function(t){if(t instanceof re&&Mc(t)){for(const n of t.getFilters())if(!$c(n)&&!Gc(n))return!1;return!0}return!1})(r)}function Kc(r){if(q(r instanceof Y||r instanceof re,34018),r instanceof Y)return r;if(r.filters.length===1)return Kc(r.filters[0]);const e=r.filters.map((n=>Kc(n)));let t=re.create(e,r.op);return t=Wo(t),ig(t)?t:(q(t instanceof re,64498),q(qr(t),40251),q(t.filters.length>1,57927),t.filters.reduce(((n,s)=>Mu(n,s))))}function Mu(r,e){let t;return q(r instanceof Y||r instanceof re,38388),q(e instanceof Y||e instanceof re,25473),t=r instanceof Y?e instanceof Y?(function(s,i){return re.create([s,i],"and")})(r,e):Gd(r,e):e instanceof Y?Gd(e,r):(function(s,i){if(q(s.filters.length>0&&i.filters.length>0,48005),qr(s)&&qr(i))return Im(s,i.getFilters());const o=Mc(s)?s:i,c=Mc(s)?i:s,u=o.filters.map((h=>Mu(h,c)));return re.create(u,"or")})(r,e),Wo(t)}function Gd(r,e){if(qr(e))return Im(e,r.getFilters());{const t=e.filters.map((n=>Mu(r,n)));return re.create(t,"or")}}function Wo(r){if(q(r instanceof Y||r instanceof re,11850),r instanceof Y)return r;const e=r.getFilters();if(e.length===1)return Wo(e[0]);if(_m(r))return r;const t=e.map((s=>Wo(s))),n=[];return t.forEach((s=>{s instanceof Y?n.push(s):s instanceof re&&(s.op===r.op?n.push(...s.filters):n.push(s))})),n.length===1?n[0]:re.create(n,r.op)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Hw{constructor(){this.Dn=new Lu}addToCollectionParentIndex(e,t){return this.Dn.add(t),A.resolve()}getCollectionParents(e,t){return A.resolve(this.Dn.getEntries(t))}addFieldIndex(e,t){return A.resolve()}deleteFieldIndex(e,t){return A.resolve()}deleteAllFieldIndexes(e){return A.resolve()}createTargetIndexes(e,t){return A.resolve()}getDocumentsMatchingTarget(e,t){return A.resolve(null)}getIndexType(e,t){return A.resolve(0)}getFieldIndexes(e,t){return A.resolve([])}getNextCollectionGroupToUpdate(e){return A.resolve(null)}getMinOffset(e,t){return A.resolve(tt.min())}getMinOffsetFromCollectionGroup(e,t){return A.resolve(tt.min())}updateCollectionGroup(e,t,n){return A.resolve()}updateIndexEntries(e,t){return A.resolve()}}class Lu{constructor(){this.index={}}add(e){const t=e.lastSegment(),n=e.popLast(),s=this.index[t]||new ie(Q.comparator),i=!s.has(n);return this.index[t]=s.add(n),i}has(e){const t=e.lastSegment(),n=e.popLast(),s=this.index[t];return s&&s.has(n)}getEntries(e){return(this.index[e]||new ie(Q.comparator)).toArray()}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Kd="IndexedDbIndexManager",ao=new Uint8Array(0);class Qw{constructor(e,t){this.databaseId=t,this.vn=new Lu,this.Cn=new jt((n=>Xn(n)),((n,s)=>Ai(n,s))),this.uid=e.uid||""}addToCollectionParentIndex(e,t){if(!this.vn.has(t)){const n=t.lastSegment(),s=t.popLast();e.addOnCommittedListener((()=>{this.vn.add(t)}));const i={collectionId:n,parent:Fe(s)};return Wd(e).put(i)}return A.resolve()}getCollectionParents(e,t){const n=[],s=IDBKeyRange.bound([t,""],[Up(t),""],!1,!0);return Wd(e).j(s).next((i=>{for(const o of i){if(o.collectionId!==t)break;n.push(pt(o.parent))}return n}))}addFieldIndex(e,t){const n=Ds(e),s=(function(c){return{indexId:c.indexId,collectionGroup:c.collectionGroup,fields:c.fields.map((u=>[u.fieldPath.canonicalString(),u.kind]))}})(t);delete s.indexId;const i=n.add(s);if(t.indexState){const o=Ir(e);return i.next((c=>{o.put(Fd(c,this.uid,t.indexState.sequenceNumber,t.indexState.offset))}))}return i.next()}deleteFieldIndex(e,t){const n=Ds(e),s=Ir(e),i=yr(e);return n.delete(t.indexId).next((()=>s.delete(IDBKeyRange.bound([t.indexId],[t.indexId+1],!1,!0)))).next((()=>i.delete(IDBKeyRange.bound([t.indexId],[t.indexId+1],!1,!0))))}deleteAllFieldIndexes(e){const t=Ds(e),n=yr(e),s=Ir(e);return t.Y().next((()=>n.Y())).next((()=>s.Y()))}createTargetIndexes(e,t){return A.forEach(this.Fn(t),(n=>this.getIndexType(e,n).next((s=>{if(s===0||s===1){const i=new $d(n).bn();if(i!=null)return this.addFieldIndex(e,i)}}))))}getDocumentsMatchingTarget(e,t){const n=yr(e);let s=!0;const i=new Map;return A.forEach(this.Fn(t),(o=>this.Mn(e,o).next((c=>{s&&(s=!!c),i.set(o,c)})))).next((()=>{if(s){let o=W();const c=[];return A.forEach(i,((u,h)=>{N(Kd,`Using index ${(function(x){return`id=${x.indexId}|cg=${x.collectionGroup}|f=${x.fields.map((j=>`${j.fieldPath}:${j.kind}`)).join(",")}`})(u)} to execute ${Xn(t)}`);const f=(function(x,j){const H=Cc(j);if(H===void 0)return null;for(const $ of zo(x,H.fieldPath))switch($.op){case"array-contains-any":return $.value.arrayValue.values||[];case"array-contains":return[$.value]}return null})(h,u),p=(function(x,j){const H=new Map;for(const $ of xn(j))for(const E of zo(x,$.fieldPath))switch(E.op){case"==":case"in":H.set($.fieldPath.canonicalString(),E.value);break;case"not-in":case"!=":return H.set($.fieldPath.canonicalString(),E.value),Array.from(H.values())}return null})(h,u),m=(function(x,j){const H=[];let $=!0;for(const E of xn(j)){const _=E.kind===0?Ad(x,E.fieldPath,x.startAt):bd(x,E.fieldPath,x.startAt);H.push(_.value),$&&($=_.inclusive)}return new gn(H,$)})(h,u),T=(function(x,j){const H=[];let $=!0;for(const E of xn(j)){const _=E.kind===0?bd(x,E.fieldPath,x.endAt):Ad(x,E.fieldPath,x.endAt);H.push(_.value),$&&($=_.inclusive)}return new gn(H,$)})(h,u),P=this.xn(u,h,m),V=this.xn(u,h,T),C=this.On(u,h,p),L=this.Nn(u.indexId,f,P,m.inclusive,V,T.inclusive,C);return A.forEach(L,(U=>n.H(U,t.limit).next((x=>{x.forEach((j=>{const H=O.fromSegments(j.documentKey);o.has(H)||(o=o.add(H),c.push(H))}))}))))})).next((()=>c))}return A.resolve(null)}))}Fn(e){let t=this.Cn.get(e);return t||(e.filters.length===0?t=[e]:t=Ww(re.create(e.filters,"and")).map((n=>Fc(e.path,e.collectionGroup,e.orderBy,n.getFilters(),e.limit,e.startAt,e.endAt))),this.Cn.set(e,t),t)}Nn(e,t,n,s,i,o,c){const u=(t!=null?t.length:1)*Math.max(n.length,i.length),h=u/(t!=null?t.length:1),f=[];for(let p=0;p<u;++p){const m=t?this.Bn(t[p/h]):ao,T=this.Ln(e,m,n[p%h],s),P=this.kn(e,m,i[p%h],o),V=c.map((C=>this.Ln(e,m,C,!0)));f.push(...this.createRange(T,P,V))}return f}Ln(e,t,n,s){const i=new Un(e,O.empty(),t,n);return s?i:i.En()}kn(e,t,n,s){const i=new Un(e,O.empty(),t,n);return s?i.En():i}Mn(e,t){const n=new $d(t),s=t.collectionGroup!=null?t.collectionGroup:t.path.lastSegment();return this.getFieldIndexes(e,s).next((i=>{let o=null;for(const c of i)n.pn(c)&&(!o||c.fields.length>o.fields.length)&&(o=c);return o}))}getIndexType(e,t){let n=2;const s=this.Fn(t);return A.forEach(s,(i=>this.Mn(e,i).next((o=>{o?n!==0&&o.fields.length<(function(u){let h=new ie(he.comparator),f=!1;for(const p of u.filters)for(const m of p.getFlattenedFilters())m.field.isKeyField()||(m.op==="array-contains"||m.op==="array-contains-any"?f=!0:h=h.add(m.field));for(const p of u.orderBy)p.field.isKeyField()||(h=h.add(p.field));return h.size+(f?1:0)})(i)&&(n=1):n=0})))).next((()=>(function(o){return o.limit!==null})(t)&&s.length>1&&n===2?1:n))}qn(e,t){const n=new Vs;for(const s of xn(e)){const i=t.data.field(s.fieldPath);if(i==null)return null;const o=n.hn(s.kind);Fn.Ut.bt(i,o)}return n.an()}Bn(e){const t=new Vs;return Fn.Ut.bt(e,t.hn(0)),t.an()}Qn(e,t){const n=new Vs;return Fn.Ut.bt(Qn(this.databaseId,t),n.hn((function(i){const o=xn(i);return o.length===0?0:o[o.length-1].kind})(e))),n.an()}On(e,t,n){if(n===null)return[];let s=[];s.push(new Vs);let i=0;for(const o of xn(e)){const c=n[i++];for(const u of s)if(this.$n(t,o.fieldPath)&&li(c))s=this.Un(s,o,c);else{const h=u.hn(o.kind);Fn.Ut.bt(c,h)}}return this.Kn(s)}xn(e,t,n){return this.On(e,t,n.position)}Kn(e){const t=[];for(let n=0;n<e.length;++n)t[n]=e[n].an();return t}Un(e,t,n){const s=[...e],i=[];for(const o of n.arrayValue.values||[])for(const c of s){const u=new Vs;u.seed(c.an()),Fn.Ut.bt(o,u.hn(t.kind)),i.push(u)}return i}$n(e,t){return!!e.filters.find((n=>n instanceof Y&&n.field.isEqual(t)&&(n.op==="in"||n.op==="not-in")))}getFieldIndexes(e,t){const n=Ds(e),s=Ir(e);return(t?n.j(Vc,IDBKeyRange.bound(t,t)):n.j()).next((i=>{const o=[];return A.forEach(i,(c=>s.get([c.indexId,this.uid]).next((u=>{o.push((function(f,p){const m=p?new xr(p.sequenceNumber,new tt(er(p.readTime),new O(pt(p.documentKey)),p.largestBatchId)):xr.empty(),T=f.fields.map((([P,V])=>new zn(he.fromServerFormat(P),V)));return new Nr(f.indexId,f.collectionGroup,T,m)})(c,u))})))).next((()=>o))}))}getNextCollectionGroupToUpdate(e){return this.getFieldIndexes(e).next((t=>t.length===0?null:(t.sort(((n,s)=>{const i=n.indexState.sequenceNumber-s.indexState.sequenceNumber;return i!==0?i:G(n.collectionGroup,s.collectionGroup)})),t[0].collectionGroup)))}updateCollectionGroup(e,t,n){const s=Ds(e),i=Ir(e);return this.Wn(e).next((o=>s.j(Vc,IDBKeyRange.bound(t,t)).next((c=>A.forEach(c,(u=>i.put(Fd(u.indexId,this.uid,o,n))))))))}updateIndexEntries(e,t){const n=new Map;return A.forEach(t,((s,i)=>{const o=n.get(s.collectionGroup);return(o?A.resolve(o):this.getFieldIndexes(e,s.collectionGroup)).next((c=>(n.set(s.collectionGroup,c),A.forEach(c,(u=>this.Gn(e,s,u).next((h=>{const f=this.zn(i,u);return h.isEqual(f)?A.resolve():this.jn(e,i,u,h,f)})))))))}))}Jn(e,t,n,s){return yr(e).put(s.An(this.uid,this.Qn(n,t.key),t.key))}Hn(e,t,n,s){return yr(e).delete(s.Rn(this.uid,this.Qn(n,t.key),t.key))}Gn(e,t,n){const s=yr(e);let i=new ie(Xt);return s.X({index:Zp,range:IDBKeyRange.only([n.indexId,this.uid,So(this.Qn(n,t))])},((o,c)=>{i=i.add(new Un(n.indexId,t,zd(c.arrayValue),zd(c.directionalValue)))})).next((()=>i))}zn(e,t){let n=new ie(Xt);const s=this.qn(t,e);if(s==null)return n;const i=Cc(t);if(i!=null){const o=e.data.field(i.fieldPath);if(li(o))for(const c of o.arrayValue.values||[])n=n.add(new Un(t.indexId,e.key,this.Bn(c),s))}else n=n.add(new Un(t.indexId,e.key,ao,s));return n}jn(e,t,n,s,i){N(Kd,"Updating index entries for document '%s'",t.key);const o=[];return(function(u,h,f,p,m){const T=u.getIterator(),P=h.getIterator();let V=gr(T),C=gr(P);for(;V||C;){let L=!1,U=!1;if(V&&C){const x=f(V,C);x<0?U=!0:x>0&&(L=!0)}else V!=null?U=!0:L=!0;L?(p(C),C=gr(P)):U?(m(V),V=gr(T)):(V=gr(T),C=gr(P))}})(s,i,Xt,(c=>{o.push(this.Jn(e,t,n,c))}),(c=>{o.push(this.Hn(e,t,n,c))})),A.waitFor(o)}Wn(e){let t=1;return Ir(e).X({index:Yp,reverse:!0,range:IDBKeyRange.upperBound([this.uid,Number.MAX_SAFE_INTEGER])},((n,s,i)=>{i.done(),t=s.sequenceNumber+1})).next((()=>t))}createRange(e,t,n){n=n.sort(((o,c)=>Xt(o,c))).filter(((o,c,u)=>!c||Xt(o,u[c-1])!==0));const s=[];s.push(e);for(const o of n){const c=Xt(o,e),u=Xt(o,t);if(c===0)s[0]=e.En();else if(c>0&&u<0)s.push(o),s.push(o.En());else if(u>0)break}s.push(t);const i=[];for(let o=0;o<s.length;o+=2){if(this.Yn(s[o],s[o+1]))return[];const c=s[o].Rn(this.uid,ao,O.empty()),u=s[o+1].Rn(this.uid,ao,O.empty());i.push(IDBKeyRange.bound(c,u))}return i}Yn(e,t){return Xt(e,t)>0}getMinOffsetFromCollectionGroup(e,t){return this.getFieldIndexes(e,t).next(Hd)}getMinOffset(e,t){return A.mapArray(this.Fn(t),(n=>this.Mn(e,n).next((s=>s||B(44426))))).next(Hd)}}function Wd(r){return be(r,oi)}function yr(r){return be(r,Ws)}function Ds(r){return be(r,Eu)}function Ir(r){return be(r,Ks)}function Hd(r){q(r.length!==0,28825);let e=r[0].indexState.offset,t=e.largestBatchId;for(let n=1;n<r.length;n++){const s=r[n].indexState.offset;yu(s,e)<0&&(e=s),t<s.largestBatchId&&(t=s.largestBatchId)}return new tt(e.readTime,e.documentKey,t)}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Qd={didRun:!1,sequenceNumbersCollected:0,targetsRemoved:0,documentsRemoved:0},og=41943040;class Le{static withCacheSize(e){return new Le(e,Le.DEFAULT_COLLECTION_PERCENTILE,Le.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT)}constructor(e,t,n){this.cacheSizeCollectionThreshold=e,this.percentileToCollect=t,this.maximumSequenceNumbersToCollect=n}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ag(r,e,t){const n=r.store(it),s=r.store(Or),i=[],o=IDBKeyRange.only(t.batchId);let c=0;const u=n.X({range:o},((f,p,m)=>(c++,m.delete())));i.push(u.next((()=>{q(c===1,47070,{batchId:t.batchId})})));const h=[];for(const f of t.mutations){const p=Qp(e,f.key.path,t.batchId);i.push(s.delete(p)),h.push(f.key)}return A.waitFor(i).next((()=>h))}function Ho(r){if(!r)return 0;let e;if(r.document)e=r.document;else if(r.unknownDocument)e=r.unknownDocument;else{if(!r.noDocument)throw B(14731);e=r.noDocument}return JSON.stringify(e).length}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Le.DEFAULT_COLLECTION_PERCENTILE=10,Le.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT=1e3,Le.DEFAULT=new Le(og,Le.DEFAULT_COLLECTION_PERCENTILE,Le.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT),Le.DISABLED=new Le(-1,0,0);class va{constructor(e,t,n,s){this.userId=e,this.serializer=t,this.indexManager=n,this.referenceDelegate=s,this.Zn={}}static yt(e,t,n,s){q(e.uid!=="",64387);const i=e.isAuthenticated()?e.uid:"";return new va(i,t,n,s)}checkEmpty(e){let t=!0;const n=IDBKeyRange.bound([this.userId,Number.NEGATIVE_INFINITY],[this.userId,Number.POSITIVE_INFINITY]);return Jt(e).X({index:jn,range:n},((s,i,o)=>{t=!1,o.done()})).next((()=>t))}addMutationBatch(e,t,n,s){const i=br(e),o=Jt(e);return o.add({}).next((c=>{q(typeof c=="number",49019);const u=new Vu(c,t,n,s),h=(function(T,P,V){const C=V.baseMutations.map((U=>fi(T.gt,U))),L=V.mutations.map((U=>fi(T.gt,U)));return{userId:P,batchId:V.batchId,localWriteTimeMs:V.localWriteTime.toMillis(),baseMutations:C,mutations:L}})(this.serializer,this.userId,u),f=[];let p=new ie(((m,T)=>G(m.canonicalString(),T.canonicalString())));for(const m of s){const T=Qp(this.userId,m.key.path,c);p=p.add(m.key.path.popLast()),f.push(o.put(h)),f.push(i.put(T,kv))}return p.forEach((m=>{f.push(this.indexManager.addToCollectionParentIndex(e,m))})),e.addOnCommittedListener((()=>{this.Zn[c]=u.keys()})),A.waitFor(f).next((()=>u))}))}lookupMutationBatch(e,t){return Jt(e).get(t).next((n=>n?(q(n.userId===this.userId,48,"Unexpected user for mutation batch",{userId:n.userId,batchId:t}),Ln(this.serializer,n)):null))}Xn(e,t){return this.Zn[t]?A.resolve(this.Zn[t]):this.lookupMutationBatch(e,t).next((n=>{if(n){const s=n.keys();return this.Zn[t]=s,s}return null}))}getNextMutationBatchAfterBatchId(e,t){const n=t+1,s=IDBKeyRange.lowerBound([this.userId,n]);let i=null;return Jt(e).X({index:jn,range:s},((o,c,u)=>{c.userId===this.userId&&(q(c.batchId>=n,47524,{er:n}),i=Ln(this.serializer,c)),u.done()})).next((()=>i))}getHighestUnacknowledgedBatchId(e){const t=IDBKeyRange.upperBound([this.userId,Number.POSITIVE_INFINITY]);let n=ln;return Jt(e).X({index:jn,range:t,reverse:!0},((s,i,o)=>{n=i.batchId,o.done()})).next((()=>n))}getAllMutationBatches(e){const t=IDBKeyRange.bound([this.userId,ln],[this.userId,Number.POSITIVE_INFINITY]);return Jt(e).j(jn,t).next((n=>n.map((s=>Ln(this.serializer,s)))))}getAllMutationBatchesAffectingDocumentKey(e,t){const n=To(this.userId,t.path),s=IDBKeyRange.lowerBound(n),i=[];return br(e).X({range:s},((o,c,u)=>{const[h,f,p]=o,m=pt(f);if(h===this.userId&&t.path.isEqual(m))return Jt(e).get(p).next((T=>{if(!T)throw B(61480,{tr:o,batchId:p});q(T.userId===this.userId,10503,"Unexpected user for mutation batch",{userId:T.userId,batchId:p}),i.push(Ln(this.serializer,T))}));u.done()})).next((()=>i))}getAllMutationBatchesAffectingDocumentKeys(e,t){let n=new ie(G);const s=[];return t.forEach((i=>{const o=To(this.userId,i.path),c=IDBKeyRange.lowerBound(o),u=br(e).X({range:c},((h,f,p)=>{const[m,T,P]=h,V=pt(T);m===this.userId&&i.path.isEqual(V)?n=n.add(P):p.done()}));s.push(u)})),A.waitFor(s).next((()=>this.nr(e,n)))}getAllMutationBatchesAffectingQuery(e,t){const n=t.path,s=n.length+1,i=To(this.userId,n),o=IDBKeyRange.lowerBound(i);let c=new ie(G);return br(e).X({range:o},((u,h,f)=>{const[p,m,T]=u,P=pt(m);p===this.userId&&n.isPrefixOf(P)?P.length===s&&(c=c.add(T)):f.done()})).next((()=>this.nr(e,c)))}nr(e,t){const n=[],s=[];return t.forEach((i=>{s.push(Jt(e).get(i).next((o=>{if(o===null)throw B(35274,{batchId:i});q(o.userId===this.userId,9748,"Unexpected user for mutation batch",{userId:o.userId,batchId:i}),n.push(Ln(this.serializer,o))})))})),A.waitFor(s).next((()=>n))}removeMutationBatch(e,t){return ag(e.ce,this.userId,t).next((n=>(e.addOnCommittedListener((()=>{this.rr(t.batchId)})),A.forEach(n,(s=>this.referenceDelegate.markPotentiallyOrphaned(e,s))))))}rr(e){delete this.Zn[e]}performConsistencyCheck(e){return this.checkEmpty(e).next((t=>{if(!t)return A.resolve();const n=IDBKeyRange.lowerBound((function(o){return[o]})(this.userId)),s=[];return br(e).X({range:n},((i,o,c)=>{if(i[0]===this.userId){const u=pt(i[1]);s.push(u)}else c.done()})).next((()=>{q(s.length===0,56720,{ir:s.map((i=>i.canonicalString()))})}))}))}containsKey(e,t){return cg(e,this.userId,t)}sr(e){return ug(e).get(this.userId).next((t=>t||{userId:this.userId,lastAcknowledgedBatchId:ln,lastStreamToken:""}))}}function cg(r,e,t){const n=To(e,t.path),s=n[1],i=IDBKeyRange.lowerBound(n);let o=!1;return br(r).X({range:i,Z:!0},((c,u,h)=>{const[f,p,m]=c;f===e&&p===s&&(o=!0),h.done()})).next((()=>o))}function Jt(r){return be(r,it)}function br(r){return be(r,Or)}function ug(r){return be(r,si)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class tr{constructor(e){this._r=e}next(){return this._r+=2,this._r}static ar(){return new tr(0)}static ur(){return new tr(-1)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Xw{constructor(e,t){this.referenceDelegate=e,this.serializer=t}allocateTargetId(e){return this.cr(e).next((t=>{const n=new tr(t.highestTargetId);return t.highestTargetId=n.next(),this.lr(e,t).next((()=>t.highestTargetId))}))}getLastRemoteSnapshotVersion(e){return this.cr(e).next((t=>z.fromTimestamp(new ne(t.lastRemoteSnapshotVersion.seconds,t.lastRemoteSnapshotVersion.nanoseconds))))}getHighestSequenceNumber(e){return this.cr(e).next((t=>t.highestListenSequenceNumber))}setTargetsMetadata(e,t,n){return this.cr(e).next((s=>(s.highestListenSequenceNumber=t,n&&(s.lastRemoteSnapshotVersion=n.toTimestamp()),t>s.highestListenSequenceNumber&&(s.highestListenSequenceNumber=t),this.lr(e,s))))}addTargetData(e,t){return this.hr(e,t).next((()=>this.cr(e).next((n=>(n.targetCount+=1,this.Pr(t,n),this.lr(e,n))))))}updateTargetData(e,t){return this.hr(e,t)}removeTargetData(e,t){return this.removeMatchingKeysForTargetId(e,t.targetId).next((()=>Tr(e).delete(t.targetId))).next((()=>this.cr(e))).next((n=>(q(n.targetCount>0,8065),n.targetCount-=1,this.lr(e,n))))}removeTargets(e,t,n){let s=0;const i=[];return Tr(e).X(((o,c)=>{const u=qs(c);u.sequenceNumber<=t&&n.get(u.targetId)===null&&(s++,i.push(this.removeTargetData(e,u)))})).next((()=>A.waitFor(i))).next((()=>s))}forEachTarget(e,t){return Tr(e).X(((n,s)=>{const i=qs(s);t(i)}))}cr(e){return Xd(e).get(qo).next((t=>(q(t!==null,2888),t)))}lr(e,t){return Xd(e).put(qo,t)}hr(e,t){return Tr(e).put(rg(this.serializer,t))}Pr(e,t){let n=!1;return e.targetId>t.highestTargetId&&(t.highestTargetId=e.targetId,n=!0),e.sequenceNumber>t.highestListenSequenceNumber&&(t.highestListenSequenceNumber=e.sequenceNumber,n=!0),n}getTargetCount(e){return this.cr(e).next((t=>t.targetCount))}getTargetData(e,t){const n=Xn(t),s=IDBKeyRange.bound([n,Number.NEGATIVE_INFINITY],[n,Number.POSITIVE_INFINITY]);let i=null;return Tr(e).X({range:s,index:Jp},((o,c,u)=>{const h=qs(c);Ai(t,h.target)&&(i=h,u.done())})).next((()=>i))}addMatchingKeys(e,t,n){const s=[],i=sn(e);return t.forEach((o=>{const c=Fe(o.path);s.push(i.put({targetId:n,path:c})),s.push(this.referenceDelegate.addReference(e,n,o))})),A.waitFor(s)}removeMatchingKeys(e,t,n){const s=sn(e);return A.forEach(t,(i=>{const o=Fe(i.path);return A.waitFor([s.delete([n,o]),this.referenceDelegate.removeReference(e,n,i)])}))}removeMatchingKeysForTargetId(e,t){const n=sn(e),s=IDBKeyRange.bound([t],[t+1],!1,!0);return n.delete(s)}getMatchingKeysForTargetId(e,t){const n=IDBKeyRange.bound([t],[t+1],!1,!0),s=sn(e);let i=W();return s.X({range:n,Z:!0},((o,c,u)=>{const h=pt(o[1]),f=new O(h);i=i.add(f)})).next((()=>i))}containsKey(e,t){const n=Fe(t.path),s=IDBKeyRange.bound([n],[Up(n)],!1,!0);let i=0;return sn(e).X({index:Tu,Z:!0,range:s},(([o,c],u,h)=>{o!==0&&(i++,h.done())})).next((()=>i>0))}Et(e,t){return Tr(e).get(t).next((n=>n?qs(n):null))}}function Tr(r){return be(r,Mr)}function Xd(r){return be(r,$n)}function sn(r){return be(r,Lr)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Jd="LruGarbageCollector",lg=1048576;function Yd([r,e],[t,n]){const s=G(r,t);return s===0?G(e,n):s}class Jw{constructor(e){this.Tr=e,this.buffer=new ie(Yd),this.Ir=0}dr(){return++this.Ir}Er(e){const t=[e,this.dr()];if(this.buffer.size<this.Tr)this.buffer=this.buffer.add(t);else{const n=this.buffer.last();Yd(t,n)<0&&(this.buffer=this.buffer.delete(n).add(t))}}get maxValue(){return this.buffer.last()[0]}}class hg{constructor(e,t,n){this.garbageCollector=e,this.asyncQueue=t,this.localStore=n,this.Ar=null}start(){this.garbageCollector.params.cacheSizeCollectionThreshold!==-1&&this.Rr(6e4)}stop(){this.Ar&&(this.Ar.cancel(),this.Ar=null)}get started(){return this.Ar!==null}Rr(e){N(Jd,`Garbage collection scheduled in ${e}ms`),this.Ar=this.asyncQueue.enqueueAfterDelay("lru_garbage_collection",e,(async()=>{this.Ar=null;try{await this.localStore.collectGarbage(this.garbageCollector)}catch(t){En(t)?N(Jd,"Ignoring IndexedDB error during garbage collection: ",t):await Tn(t)}await this.Rr(3e5)}))}}class Yw{constructor(e,t){this.Vr=e,this.params=t}calculateTargetCount(e,t){return this.Vr.mr(e).next((n=>Math.floor(t/100*n)))}nthSequenceNumber(e,t){if(t===0)return A.resolve(We.ue);const n=new Jw(t);return this.Vr.forEachTarget(e,(s=>n.Er(s.sequenceNumber))).next((()=>this.Vr.gr(e,(s=>n.Er(s))))).next((()=>n.maxValue))}removeTargets(e,t,n){return this.Vr.removeTargets(e,t,n)}removeOrphanedDocuments(e,t){return this.Vr.removeOrphanedDocuments(e,t)}collect(e,t){return this.params.cacheSizeCollectionThreshold===-1?(N("LruGarbageCollector","Garbage collection skipped; disabled"),A.resolve(Qd)):this.getCacheSize(e).next((n=>n<this.params.cacheSizeCollectionThreshold?(N("LruGarbageCollector",`Garbage collection skipped; Cache size ${n} is lower than threshold ${this.params.cacheSizeCollectionThreshold}`),Qd):this.pr(e,t)))}getCacheSize(e){return this.Vr.getCacheSize(e)}pr(e,t){let n,s,i,o,c,u,h;const f=Date.now();return this.calculateTargetCount(e,this.params.percentileToCollect).next((p=>(p>this.params.maximumSequenceNumbersToCollect?(N("LruGarbageCollector",`Capping sequence numbers to collect down to the maximum of ${this.params.maximumSequenceNumbersToCollect} from ${p}`),s=this.params.maximumSequenceNumbersToCollect):s=p,o=Date.now(),this.nthSequenceNumber(e,s)))).next((p=>(n=p,c=Date.now(),this.removeTargets(e,n,t)))).next((p=>(i=p,u=Date.now(),this.removeOrphanedDocuments(e,n)))).next((p=>(h=Date.now(),vr()<=J.DEBUG&&N("LruGarbageCollector",`LRU Garbage Collection
	Counted targets in ${o-f}ms
	Determined least recently used ${s} in `+(c-o)+`ms
	Removed ${i} targets in `+(u-c)+`ms
	Removed ${p} documents in `+(h-u)+`ms
Total Duration: ${h-f}ms`),A.resolve({didRun:!0,sequenceNumbersCollected:s,targetsRemoved:i,documentsRemoved:p}))))}}function dg(r,e){return new Yw(r,e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zw{constructor(e,t){this.db=e,this.garbageCollector=dg(this,t)}mr(e){const t=this.yr(e);return this.db.getTargetCache().getTargetCount(e).next((n=>t.next((s=>n+s))))}yr(e){let t=0;return this.gr(e,(n=>{t++})).next((()=>t))}forEachTarget(e,t){return this.db.getTargetCache().forEachTarget(e,t)}gr(e,t){return this.wr(e,((n,s)=>t(s)))}addReference(e,t,n){return co(e,n)}removeReference(e,t,n){return co(e,n)}removeTargets(e,t,n){return this.db.getTargetCache().removeTargets(e,t,n)}markPotentiallyOrphaned(e,t){return co(e,t)}Sr(e,t){return(function(s,i){let o=!1;return ug(s).ee((c=>cg(s,c,i).next((u=>(u&&(o=!0),A.resolve(!u)))))).next((()=>o))})(e,t)}removeOrphanedDocuments(e,t){const n=this.db.getRemoteDocumentCache().newChangeBuffer(),s=[];let i=0;return this.wr(e,((o,c)=>{if(c<=t){const u=this.Sr(e,o).next((h=>{if(!h)return i++,n.getEntry(e,o).next((()=>(n.removeEntry(o,z.min()),sn(e).delete((function(p){return[0,Fe(p.path)]})(o)))))}));s.push(u)}})).next((()=>A.waitFor(s))).next((()=>n.apply(e))).next((()=>i))}removeTarget(e,t){const n=t.withSequenceNumber(e.currentSequenceNumber);return this.db.getTargetCache().updateTargetData(e,n)}updateLimboDocument(e,t){return co(e,t)}wr(e,t){const n=sn(e);let s,i=We.ue;return n.X({index:Tu},(([o,c],{path:u,sequenceNumber:h})=>{o===0?(i!==We.ue&&t(new O(pt(s)),i),i=h,s=u):i=We.ue})).next((()=>{i!==We.ue&&t(new O(pt(s)),i)}))}getCacheSize(e){return this.db.getRemoteDocumentCache().getSize(e)}}function co(r,e){return sn(r).put((function(n,s){return{targetId:0,path:Fe(n.path),sequenceNumber:s}})(e,r.currentSequenceNumber))}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class fg{constructor(){this.changes=new jt((e=>e.toString()),((e,t)=>e.isEqual(t))),this.changesApplied=!1}addEntry(e){this.assertNotApplied(),this.changes.set(e.key,e)}removeEntry(e,t){this.assertNotApplied(),this.changes.set(e,le.newInvalidDocument(e).setReadTime(t))}getEntry(e,t){this.assertNotApplied();const n=this.changes.get(t);return n!==void 0?A.resolve(n):this.getFromCache(e,t)}getEntries(e,t){return this.getAllFromCache(e,t)}apply(e){return this.assertNotApplied(),this.changesApplied=!0,this.applyChanges(e)}assertNotApplied(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class eA{constructor(e){this.serializer=e}setIndexManager(e){this.indexManager=e}addEntry(e,t,n){return Dn(e).put(n)}removeEntry(e,t,n){return Dn(e).delete((function(i,o){const c=i.path.toArray();return[c.slice(0,c.length-2),c[c.length-2],Ko(o),c[c.length-1]]})(t,n))}updateMetadata(e,t){return this.getMetadata(e).next((n=>(n.byteSize+=t,this.br(e,n))))}getEntry(e,t){let n=le.newInvalidDocument(t);return Dn(e).X({index:Eo,range:IDBKeyRange.only(Ns(t))},((s,i)=>{n=this.Dr(t,i)})).next((()=>n))}vr(e,t){let n={size:0,document:le.newInvalidDocument(t)};return Dn(e).X({index:Eo,range:IDBKeyRange.only(Ns(t))},((s,i)=>{n={document:this.Dr(t,i),size:Ho(i)}})).next((()=>n))}getEntries(e,t){let n=Qe();return this.Cr(e,t,((s,i)=>{const o=this.Dr(s,i);n=n.insert(s,o)})).next((()=>n))}Fr(e,t){let n=Qe(),s=new ce(O.comparator);return this.Cr(e,t,((i,o)=>{const c=this.Dr(i,o);n=n.insert(i,c),s=s.insert(i,Ho(o))})).next((()=>({documents:n,Mr:s})))}Cr(e,t,n){if(t.isEmpty())return A.resolve();let s=new ie(tf);t.forEach((u=>s=s.add(u)));const i=IDBKeyRange.bound(Ns(s.first()),Ns(s.last())),o=s.getIterator();let c=o.getNext();return Dn(e).X({index:Eo,range:i},((u,h,f)=>{const p=O.fromSegments([...h.prefixPath,h.collectionGroup,h.documentId]);for(;c&&tf(c,p)<0;)n(c,null),c=o.getNext();c&&c.isEqual(p)&&(n(c,h),c=o.hasNext()?o.getNext():null),c?f.G(Ns(c)):f.done()})).next((()=>{for(;c;)n(c,null),c=o.hasNext()?o.getNext():null}))}getDocumentsMatchingQuery(e,t,n,s,i){const o=t.path,c=[o.popLast().toArray(),o.lastSegment(),Ko(n.readTime),n.documentKey.path.isEmpty()?"":n.documentKey.path.lastSegment()],u=[o.popLast().toArray(),o.lastSegment(),[Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER],""];return Dn(e).j(IDBKeyRange.bound(c,u,!0)).next((h=>{i==null||i.incrementDocumentReadCount(h.length);let f=Qe();for(const p of h){const m=this.Dr(O.fromSegments(p.prefixPath.concat(p.collectionGroup,p.documentId)),p);m.isFoundDocument()&&(Ri(t,m)||s.has(m.key))&&(f=f.insert(m.key,m))}return f}))}getAllFromCollectionGroup(e,t,n,s){let i=Qe();const o=ef(t,n),c=ef(t,tt.max());return Dn(e).X({index:Xp,range:IDBKeyRange.bound(o,c,!0)},((u,h,f)=>{const p=this.Dr(O.fromSegments(h.prefixPath.concat(h.collectionGroup,h.documentId)),h);i=i.insert(p.key,p),i.size===s&&f.done()})).next((()=>i))}newChangeBuffer(e){return new tA(this,!!e&&e.trackRemovals)}getSize(e){return this.getMetadata(e).next((t=>t.byteSize))}getMetadata(e){return Zd(e).get(kc).next((t=>(q(!!t,20021),t)))}br(e,t){return Zd(e).put(kc,t)}Dr(e,t){if(t){const n=Bw(this.serializer,t);if(!(n.isNoDocument()&&n.version.isEqual(z.min())))return n}return le.newInvalidDocument(e)}}function pg(r){return new eA(r)}class tA extends fg{constructor(e,t){super(),this.Or=e,this.trackRemovals=t,this.Nr=new jt((n=>n.toString()),((n,s)=>n.isEqual(s)))}applyChanges(e){const t=[];let n=0,s=new ie(((i,o)=>G(i.canonicalString(),o.canonicalString())));return this.changes.forEach(((i,o)=>{const c=this.Nr.get(i);if(t.push(this.Or.removeEntry(e,i,c.readTime)),o.isValidDocument()){const u=Md(this.Or.serializer,o);s=s.add(i.path.popLast());const h=Ho(u);n+=h-c.size,t.push(this.Or.addEntry(e,i,u))}else if(n-=c.size,this.trackRemovals){const u=Md(this.Or.serializer,o.convertToNoDocument(z.min()));t.push(this.Or.addEntry(e,i,u))}})),s.forEach((i=>{t.push(this.Or.indexManager.addToCollectionParentIndex(e,i))})),t.push(this.Or.updateMetadata(e,n)),A.waitFor(t)}getFromCache(e,t){return this.Or.vr(e,t).next((n=>(this.Nr.set(t,{size:n.size,readTime:n.document.readTime}),n.document)))}getAllFromCache(e,t){return this.Or.Fr(e,t).next((({documents:n,Mr:s})=>(s.forEach(((i,o)=>{this.Nr.set(i,{size:o,readTime:n.get(i).readTime})})),n)))}}function Zd(r){return be(r,ii)}function Dn(r){return be(r,Bo)}function Ns(r){const e=r.path.toArray();return[e.slice(0,e.length-2),e[e.length-2],e[e.length-1]]}function ef(r,e){const t=e.documentKey.path.toArray();return[r,Ko(e.readTime),t.slice(0,t.length-2),t.length>0?t[t.length-1]:""]}function tf(r,e){const t=r.path.toArray(),n=e.path.toArray();let s=0;for(let i=0;i<t.length-2&&i<n.length-2;++i)if(s=G(t[i],n[i]),s)return s;return s=G(t.length,n.length),s||(s=G(t[t.length-2],n[n.length-2]),s||G(t[t.length-1],n[n.length-1]))}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class nA{constructor(e,t){this.overlayedDocument=e,this.mutatedFields=t}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class mg{constructor(e,t,n,s){this.remoteDocumentCache=e,this.mutationQueue=t,this.documentOverlayCache=n,this.indexManager=s}getDocument(e,t){let n=null;return this.documentOverlayCache.getOverlay(e,t).next((s=>(n=s,this.remoteDocumentCache.getEntry(e,t)))).next((s=>(n!==null&&Xs(n.mutation,s,He.empty(),ne.now()),s)))}getDocuments(e,t){return this.remoteDocumentCache.getEntries(e,t).next((n=>this.getLocalViewOfDocuments(e,n,W()).next((()=>n))))}getLocalViewOfDocuments(e,t,n=W()){const s=mt();return this.populateOverlays(e,s,t).next((()=>this.computeViews(e,t,s,n).next((i=>{let o=Us();return i.forEach(((c,u)=>{o=o.insert(c,u.overlayedDocument)})),o}))))}getOverlayedDocuments(e,t){const n=mt();return this.populateOverlays(e,n,t).next((()=>this.computeViews(e,t,n,W())))}populateOverlays(e,t,n){const s=[];return n.forEach((i=>{t.has(i)||s.push(i)})),this.documentOverlayCache.getOverlays(e,s).next((i=>{i.forEach(((o,c)=>{t.set(o,c)}))}))}computeViews(e,t,n,s){let i=Qe();const o=Qs(),c=(function(){return Qs()})();return t.forEach(((u,h)=>{const f=n.get(h.key);s.has(h.key)&&(f===void 0||f.mutation instanceof zt)?i=i.insert(h.key,h):f!==void 0?(o.set(h.key,f.mutation.getFieldMask()),Xs(f.mutation,h,f.mutation.getFieldMask(),ne.now())):o.set(h.key,He.empty())})),this.recalculateAndSaveOverlays(e,i).next((u=>(u.forEach(((h,f)=>o.set(h,f))),t.forEach(((h,f)=>{var p;return c.set(h,new nA(f,(p=o.get(h))!==null&&p!==void 0?p:null))})),c)))}recalculateAndSaveOverlays(e,t){const n=Qs();let s=new ce(((o,c)=>o-c)),i=W();return this.mutationQueue.getAllMutationBatchesAffectingDocumentKeys(e,t).next((o=>{for(const c of o)c.keys().forEach((u=>{const h=t.get(u);if(h===null)return;let f=n.get(u)||He.empty();f=c.applyToLocalView(h,f),n.set(u,f);const p=(s.get(c.batchId)||W()).add(u);s=s.insert(c.batchId,p)}))})).next((()=>{const o=[],c=s.getReverseIterator();for(;c.hasNext();){const u=c.getNext(),h=u.key,f=u.value,p=Vm();f.forEach((m=>{if(!i.has(m)){const T=Fm(t.get(m),n.get(m));T!==null&&p.set(m,T),i=i.add(m)}})),o.push(this.documentOverlayCache.saveOverlays(e,h,p))}return A.waitFor(o)})).next((()=>n))}recalculateAndSaveOverlaysForDocumentKeys(e,t){return this.remoteDocumentCache.getEntries(e,t).next((n=>this.recalculateAndSaveOverlays(e,n)))}getDocumentsMatchingQuery(e,t,n,s){return(function(o){return O.isDocumentKey(o.path)&&o.collectionGroup===null&&o.filters.length===0})(t)?this.getDocumentsMatchingDocumentQuery(e,t.path):Su(t)?this.getDocumentsMatchingCollectionGroupQuery(e,t,n,s):this.getDocumentsMatchingCollectionQuery(e,t,n,s)}getNextDocuments(e,t,n,s){return this.remoteDocumentCache.getAllFromCollectionGroup(e,t,n,s).next((i=>{const o=s-i.size>0?this.documentOverlayCache.getOverlaysForCollectionGroup(e,t,n.largestBatchId,s-i.size):A.resolve(mt());let c=Dr,u=i;return o.next((h=>A.forEach(h,((f,p)=>(c<p.largestBatchId&&(c=p.largestBatchId),i.get(f)?A.resolve():this.remoteDocumentCache.getEntry(e,f).next((m=>{u=u.insert(f,m)}))))).next((()=>this.populateOverlays(e,h,i))).next((()=>this.computeViews(e,u,h,W()))).next((f=>({batchId:c,changes:km(f)})))))}))}getDocumentsMatchingDocumentQuery(e,t){return this.getDocument(e,new O(t)).next((n=>{let s=Us();return n.isFoundDocument()&&(s=s.insert(n.key,n)),s}))}getDocumentsMatchingCollectionGroupQuery(e,t,n,s){const i=t.collectionGroup;let o=Us();return this.indexManager.getCollectionParents(e,i).next((c=>A.forEach(c,(u=>{const h=(function(p,m){return new qt(m,null,p.explicitOrderBy.slice(),p.filters.slice(),p.limit,p.limitType,p.startAt,p.endAt)})(t,u.child(i));return this.getDocumentsMatchingCollectionQuery(e,h,n,s).next((f=>{f.forEach(((p,m)=>{o=o.insert(p,m)}))}))})).next((()=>o))))}getDocumentsMatchingCollectionQuery(e,t,n,s){let i;return this.documentOverlayCache.getOverlaysForCollection(e,t.path,n.largestBatchId).next((o=>(i=o,this.remoteDocumentCache.getDocumentsMatchingQuery(e,t,n,i,s)))).next((o=>{i.forEach(((u,h)=>{const f=h.getKey();o.get(f)===null&&(o=o.insert(f,le.newInvalidDocument(f)))}));let c=Us();return o.forEach(((u,h)=>{const f=i.get(u);f!==void 0&&Xs(f.mutation,h,He.empty(),ne.now()),Ri(t,h)&&(c=c.insert(u,h))})),c}))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class rA{constructor(e){this.serializer=e,this.Br=new Map,this.Lr=new Map}getBundleMetadata(e,t){return A.resolve(this.Br.get(t))}saveBundleMetadata(e,t){return this.Br.set(t.id,(function(s){return{id:s.id,version:s.version,createTime:Te(s.createTime)}})(t)),A.resolve()}getNamedQuery(e,t){return A.resolve(this.Lr.get(t))}saveNamedQuery(e,t){return this.Lr.set(t.name,(function(s){return{name:s.name,query:Ta(s.bundledQuery),readTime:Te(s.readTime)}})(t)),A.resolve()}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class sA{constructor(){this.overlays=new ce(O.comparator),this.kr=new Map}getOverlay(e,t){return A.resolve(this.overlays.get(t))}getOverlays(e,t){const n=mt();return A.forEach(t,(s=>this.getOverlay(e,s).next((i=>{i!==null&&n.set(s,i)})))).next((()=>n))}saveOverlays(e,t,n){return n.forEach(((s,i)=>{this.wt(e,t,i)})),A.resolve()}removeOverlaysForBatchId(e,t,n){const s=this.kr.get(n);return s!==void 0&&(s.forEach((i=>this.overlays=this.overlays.remove(i))),this.kr.delete(n)),A.resolve()}getOverlaysForCollection(e,t,n){const s=mt(),i=t.length+1,o=new O(t.child("")),c=this.overlays.getIteratorFrom(o);for(;c.hasNext();){const u=c.getNext().value,h=u.getKey();if(!t.isPrefixOf(h.path))break;h.path.length===i&&u.largestBatchId>n&&s.set(u.getKey(),u)}return A.resolve(s)}getOverlaysForCollectionGroup(e,t,n,s){let i=new ce(((h,f)=>h-f));const o=this.overlays.getIterator();for(;o.hasNext();){const h=o.getNext().value;if(h.getKey().getCollectionGroup()===t&&h.largestBatchId>n){let f=i.get(h.largestBatchId);f===null&&(f=mt(),i=i.insert(h.largestBatchId,f)),f.set(h.getKey(),h)}}const c=mt(),u=i.getIterator();for(;u.hasNext()&&(u.getNext().value.forEach(((h,f)=>c.set(h,f))),!(c.size()>=s)););return A.resolve(c)}wt(e,t,n){const s=this.overlays.get(n.key);if(s!==null){const o=this.kr.get(s.largestBatchId).delete(n.key);this.kr.set(s.largestBatchId,o)}this.overlays=this.overlays.insert(n.key,new Nu(t,n));let i=this.kr.get(t);i===void 0&&(i=W(),this.kr.set(t,i)),this.kr.set(t,i.add(n.key))}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class iA{constructor(){this.sessionToken=ge.EMPTY_BYTE_STRING}getSessionToken(e){return A.resolve(this.sessionToken)}setSessionToken(e,t){return this.sessionToken=t,A.resolve()}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Fu{constructor(){this.qr=new ie(Re.Qr),this.$r=new ie(Re.Ur)}isEmpty(){return this.qr.isEmpty()}addReference(e,t){const n=new Re(e,t);this.qr=this.qr.add(n),this.$r=this.$r.add(n)}Kr(e,t){e.forEach((n=>this.addReference(n,t)))}removeReference(e,t){this.Wr(new Re(e,t))}Gr(e,t){e.forEach((n=>this.removeReference(n,t)))}zr(e){const t=new O(new Q([])),n=new Re(t,e),s=new Re(t,e+1),i=[];return this.$r.forEachInRange([n,s],(o=>{this.Wr(o),i.push(o.key)})),i}jr(){this.qr.forEach((e=>this.Wr(e)))}Wr(e){this.qr=this.qr.delete(e),this.$r=this.$r.delete(e)}Jr(e){const t=new O(new Q([])),n=new Re(t,e),s=new Re(t,e+1);let i=W();return this.$r.forEachInRange([n,s],(o=>{i=i.add(o.key)})),i}containsKey(e){const t=new Re(e,0),n=this.qr.firstAfterOrEqual(t);return n!==null&&e.isEqual(n.key)}}class Re{constructor(e,t){this.key=e,this.Hr=t}static Qr(e,t){return O.comparator(e.key,t.key)||G(e.Hr,t.Hr)}static Ur(e,t){return G(e.Hr,t.Hr)||O.comparator(e.key,t.key)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class oA{constructor(e,t){this.indexManager=e,this.referenceDelegate=t,this.mutationQueue=[],this.er=1,this.Yr=new ie(Re.Qr)}checkEmpty(e){return A.resolve(this.mutationQueue.length===0)}addMutationBatch(e,t,n,s){const i=this.er;this.er++,this.mutationQueue.length>0&&this.mutationQueue[this.mutationQueue.length-1];const o=new Vu(i,t,n,s);this.mutationQueue.push(o);for(const c of s)this.Yr=this.Yr.add(new Re(c.key,i)),this.indexManager.addToCollectionParentIndex(e,c.key.path.popLast());return A.resolve(o)}lookupMutationBatch(e,t){return A.resolve(this.Zr(t))}getNextMutationBatchAfterBatchId(e,t){const n=t+1,s=this.Xr(n),i=s<0?0:s;return A.resolve(this.mutationQueue.length>i?this.mutationQueue[i]:null)}getHighestUnacknowledgedBatchId(){return A.resolve(this.mutationQueue.length===0?ln:this.er-1)}getAllMutationBatches(e){return A.resolve(this.mutationQueue.slice())}getAllMutationBatchesAffectingDocumentKey(e,t){const n=new Re(t,0),s=new Re(t,Number.POSITIVE_INFINITY),i=[];return this.Yr.forEachInRange([n,s],(o=>{const c=this.Zr(o.Hr);i.push(c)})),A.resolve(i)}getAllMutationBatchesAffectingDocumentKeys(e,t){let n=new ie(G);return t.forEach((s=>{const i=new Re(s,0),o=new Re(s,Number.POSITIVE_INFINITY);this.Yr.forEachInRange([i,o],(c=>{n=n.add(c.Hr)}))})),A.resolve(this.ei(n))}getAllMutationBatchesAffectingQuery(e,t){const n=t.path,s=n.length+1;let i=n;O.isDocumentKey(i)||(i=i.child(""));const o=new Re(new O(i),0);let c=new ie(G);return this.Yr.forEachWhile((u=>{const h=u.key.path;return!!n.isPrefixOf(h)&&(h.length===s&&(c=c.add(u.Hr)),!0)}),o),A.resolve(this.ei(c))}ei(e){const t=[];return e.forEach((n=>{const s=this.Zr(n);s!==null&&t.push(s)})),t}removeMutationBatch(e,t){q(this.ti(t.batchId,"removed")===0,55003),this.mutationQueue.shift();let n=this.Yr;return A.forEach(t.mutations,(s=>{const i=new Re(s.key,t.batchId);return n=n.delete(i),this.referenceDelegate.markPotentiallyOrphaned(e,s.key)})).next((()=>{this.Yr=n}))}rr(e){}containsKey(e,t){const n=new Re(t,0),s=this.Yr.firstAfterOrEqual(n);return A.resolve(t.isEqual(s&&s.key))}performConsistencyCheck(e){return this.mutationQueue.length,A.resolve()}ti(e,t){return this.Xr(e)}Xr(e){return this.mutationQueue.length===0?0:e-this.mutationQueue[0].batchId}Zr(e){const t=this.Xr(e);return t<0||t>=this.mutationQueue.length?null:this.mutationQueue[t]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class aA{constructor(e){this.ni=e,this.docs=(function(){return new ce(O.comparator)})(),this.size=0}setIndexManager(e){this.indexManager=e}addEntry(e,t){const n=t.key,s=this.docs.get(n),i=s?s.size:0,o=this.ni(t);return this.docs=this.docs.insert(n,{document:t.mutableCopy(),size:o}),this.size+=o-i,this.indexManager.addToCollectionParentIndex(e,n.path.popLast())}removeEntry(e){const t=this.docs.get(e);t&&(this.docs=this.docs.remove(e),this.size-=t.size)}getEntry(e,t){const n=this.docs.get(t);return A.resolve(n?n.document.mutableCopy():le.newInvalidDocument(t))}getEntries(e,t){let n=Qe();return t.forEach((s=>{const i=this.docs.get(s);n=n.insert(s,i?i.document.mutableCopy():le.newInvalidDocument(s))})),A.resolve(n)}getDocumentsMatchingQuery(e,t,n,s){let i=Qe();const o=t.path,c=new O(o.child("__id-9223372036854775808__")),u=this.docs.getIteratorFrom(c);for(;u.hasNext();){const{key:h,value:{document:f}}=u.getNext();if(!o.isPrefixOf(h.path))break;h.path.length>o.length+1||yu($p(f),n)<=0||(s.has(f.key)||Ri(t,f))&&(i=i.insert(f.key,f.mutableCopy()))}return A.resolve(i)}getAllFromCollectionGroup(e,t,n,s){B(9500)}ri(e,t){return A.forEach(this.docs,(n=>t(n)))}newChangeBuffer(e){return new cA(this)}getSize(e){return A.resolve(this.size)}}class cA extends fg{constructor(e){super(),this.Or=e}applyChanges(e){const t=[];return this.changes.forEach(((n,s)=>{s.isValidDocument()?t.push(this.Or.addEntry(e,s)):this.Or.removeEntry(n)})),A.waitFor(t)}getFromCache(e,t){return this.Or.getEntry(e,t)}getAllFromCache(e,t){return this.Or.getEntries(e,t)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class uA{constructor(e){this.persistence=e,this.ii=new jt((t=>Xn(t)),Ai),this.lastRemoteSnapshotVersion=z.min(),this.highestTargetId=0,this.si=0,this.oi=new Fu,this.targetCount=0,this._i=tr.ar()}forEachTarget(e,t){return this.ii.forEach(((n,s)=>t(s))),A.resolve()}getLastRemoteSnapshotVersion(e){return A.resolve(this.lastRemoteSnapshotVersion)}getHighestSequenceNumber(e){return A.resolve(this.si)}allocateTargetId(e){return this.highestTargetId=this._i.next(),A.resolve(this.highestTargetId)}setTargetsMetadata(e,t,n){return n&&(this.lastRemoteSnapshotVersion=n),t>this.si&&(this.si=t),A.resolve()}hr(e){this.ii.set(e.target,e);const t=e.targetId;t>this.highestTargetId&&(this._i=new tr(t),this.highestTargetId=t),e.sequenceNumber>this.si&&(this.si=e.sequenceNumber)}addTargetData(e,t){return this.hr(t),this.targetCount+=1,A.resolve()}updateTargetData(e,t){return this.hr(t),A.resolve()}removeTargetData(e,t){return this.ii.delete(t.target),this.oi.zr(t.targetId),this.targetCount-=1,A.resolve()}removeTargets(e,t,n){let s=0;const i=[];return this.ii.forEach(((o,c)=>{c.sequenceNumber<=t&&n.get(c.targetId)===null&&(this.ii.delete(o),i.push(this.removeMatchingKeysForTargetId(e,c.targetId)),s++)})),A.waitFor(i).next((()=>s))}getTargetCount(e){return A.resolve(this.targetCount)}getTargetData(e,t){const n=this.ii.get(t)||null;return A.resolve(n)}addMatchingKeys(e,t,n){return this.oi.Kr(t,n),A.resolve()}removeMatchingKeys(e,t,n){this.oi.Gr(t,n);const s=this.persistence.referenceDelegate,i=[];return s&&t.forEach((o=>{i.push(s.markPotentiallyOrphaned(e,o))})),A.waitFor(i)}removeMatchingKeysForTargetId(e,t){return this.oi.zr(t),A.resolve()}getMatchingKeysForTargetId(e,t){const n=this.oi.Jr(t);return A.resolve(n)}containsKey(e,t){return A.resolve(this.oi.containsKey(t))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Uu{constructor(e,t){this.ai={},this.overlays={},this.ui=new We(0),this.ci=!1,this.ci=!0,this.li=new iA,this.referenceDelegate=e(this),this.hi=new uA(this),this.indexManager=new Hw,this.remoteDocumentCache=(function(s){return new aA(s)})((n=>this.referenceDelegate.Pi(n))),this.serializer=new ng(t),this.Ti=new rA(this.serializer)}start(){return Promise.resolve()}shutdown(){return this.ci=!1,Promise.resolve()}get started(){return this.ci}setDatabaseDeletedListener(){}setNetworkEnabled(){}getIndexManager(e){return this.indexManager}getDocumentOverlayCache(e){let t=this.overlays[e.toKey()];return t||(t=new sA,this.overlays[e.toKey()]=t),t}getMutationQueue(e,t){let n=this.ai[e.toKey()];return n||(n=new oA(t,this.referenceDelegate),this.ai[e.toKey()]=n),n}getGlobalsCache(){return this.li}getTargetCache(){return this.hi}getRemoteDocumentCache(){return this.remoteDocumentCache}getBundleCache(){return this.Ti}runTransaction(e,t,n){N("MemoryPersistence","Starting transaction:",e);const s=new lA(this.ui.next());return this.referenceDelegate.Ii(),n(s).next((i=>this.referenceDelegate.di(s).next((()=>i)))).toPromise().then((i=>(s.raiseOnCommittedEvent(),i)))}Ei(e,t){return A.or(Object.values(this.ai).map((n=>()=>n.containsKey(e,t))))}}class lA extends Kp{constructor(e){super(),this.currentSequenceNumber=e}}class wa{constructor(e){this.persistence=e,this.Ai=new Fu,this.Ri=null}static Vi(e){return new wa(e)}get mi(){if(this.Ri)return this.Ri;throw B(60996)}addReference(e,t,n){return this.Ai.addReference(n,t),this.mi.delete(n.toString()),A.resolve()}removeReference(e,t,n){return this.Ai.removeReference(n,t),this.mi.add(n.toString()),A.resolve()}markPotentiallyOrphaned(e,t){return this.mi.add(t.toString()),A.resolve()}removeTarget(e,t){this.Ai.zr(t.targetId).forEach((s=>this.mi.add(s.toString())));const n=this.persistence.getTargetCache();return n.getMatchingKeysForTargetId(e,t.targetId).next((s=>{s.forEach((i=>this.mi.add(i.toString())))})).next((()=>n.removeTargetData(e,t)))}Ii(){this.Ri=new Set}di(e){const t=this.persistence.getRemoteDocumentCache().newChangeBuffer();return A.forEach(this.mi,(n=>{const s=O.fromPath(n);return this.fi(e,s).next((i=>{i||t.removeEntry(s,z.min())}))})).next((()=>(this.Ri=null,t.apply(e))))}updateLimboDocument(e,t){return this.fi(e,t).next((n=>{n?this.mi.delete(t.toString()):this.mi.add(t.toString())}))}Pi(e){return 0}fi(e,t){return A.or([()=>A.resolve(this.Ai.containsKey(t)),()=>this.persistence.getTargetCache().containsKey(e,t),()=>this.persistence.Ei(e,t)])}}class Qo{constructor(e,t){this.persistence=e,this.gi=new jt((n=>Fe(n.path)),((n,s)=>n.isEqual(s))),this.garbageCollector=dg(this,t)}static Vi(e,t){return new Qo(e,t)}Ii(){}di(e){return A.resolve()}forEachTarget(e,t){return this.persistence.getTargetCache().forEachTarget(e,t)}mr(e){const t=this.yr(e);return this.persistence.getTargetCache().getTargetCount(e).next((n=>t.next((s=>n+s))))}yr(e){let t=0;return this.gr(e,(n=>{t++})).next((()=>t))}gr(e,t){return A.forEach(this.gi,((n,s)=>this.Sr(e,n,s).next((i=>i?A.resolve():t(s)))))}removeTargets(e,t,n){return this.persistence.getTargetCache().removeTargets(e,t,n)}removeOrphanedDocuments(e,t){let n=0;const s=this.persistence.getRemoteDocumentCache(),i=s.newChangeBuffer();return s.ri(e,(o=>this.Sr(e,o,t).next((c=>{c||(n++,i.removeEntry(o,z.min()))})))).next((()=>i.apply(e))).next((()=>n))}markPotentiallyOrphaned(e,t){return this.gi.set(t,e.currentSequenceNumber),A.resolve()}removeTarget(e,t){const n=t.withSequenceNumber(e.currentSequenceNumber);return this.persistence.getTargetCache().updateTargetData(e,n)}addReference(e,t,n){return this.gi.set(n,e.currentSequenceNumber),A.resolve()}removeReference(e,t,n){return this.gi.set(n,e.currentSequenceNumber),A.resolve()}updateLimboDocument(e,t){return this.gi.set(t,e.currentSequenceNumber),A.resolve()}Pi(e){let t=e.key.toString().length;return e.isFoundDocument()&&(t+=wo(e.data.value)),t}Sr(e,t,n){return A.or([()=>this.persistence.Ei(e,t),()=>this.persistence.getTargetCache().containsKey(e,t),()=>{const s=this.gi.get(t);return A.resolve(s!==void 0&&s>n)}])}getCacheSize(e){return this.persistence.getRemoteDocumentCache().getSize(e)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hA{constructor(e){this.serializer=e}q(e,t,n,s){const i=new ua("createOrUpgrade",t);n<1&&s>=1&&((function(u){u.createObjectStore(wi)})(e),(function(u){u.createObjectStore(si,{keyPath:Cv}),u.createObjectStore(it,{keyPath:dd,autoIncrement:!0}).createIndex(jn,fd,{unique:!0}),u.createObjectStore(Or)})(e),nf(e),(function(u){u.createObjectStore(On)})(e));let o=A.resolve();return n<3&&s>=3&&(n!==0&&((function(u){u.deleteObjectStore(Lr),u.deleteObjectStore(Mr),u.deleteObjectStore($n)})(e),nf(e)),o=o.next((()=>(function(u){const h=u.store($n),f={highestTargetId:0,highestListenSequenceNumber:0,lastRemoteSnapshotVersion:z.min().toTimestamp(),targetCount:0};return h.put(qo,f)})(i)))),n<4&&s>=4&&(n!==0&&(o=o.next((()=>(function(u,h){return h.store(it).j().next((p=>{u.deleteObjectStore(it),u.createObjectStore(it,{keyPath:dd,autoIncrement:!0}).createIndex(jn,fd,{unique:!0});const m=h.store(it),T=p.map((P=>m.put(P)));return A.waitFor(T)}))})(e,i)))),o=o.next((()=>{(function(u){u.createObjectStore(Fr,{keyPath:Fv})})(e)}))),n<5&&s>=5&&(o=o.next((()=>this.pi(i)))),n<6&&s>=6&&(o=o.next((()=>((function(u){u.createObjectStore(ii)})(e),this.yi(i))))),n<7&&s>=7&&(o=o.next((()=>this.wi(i)))),n<8&&s>=8&&(o=o.next((()=>this.Si(e,i)))),n<9&&s>=9&&(o=o.next((()=>{(function(u){u.objectStoreNames.contains("remoteDocumentChanges")&&u.deleteObjectStore("remoteDocumentChanges")})(e)}))),n<10&&s>=10&&(o=o.next((()=>this.bi(i)))),n<11&&s>=11&&(o=o.next((()=>{(function(u){u.createObjectStore(la,{keyPath:Uv})})(e),(function(u){u.createObjectStore(ha,{keyPath:Bv})})(e)}))),n<12&&s>=12&&(o=o.next((()=>{(function(u){const h=u.createObjectStore(da,{keyPath:Wv});h.createIndex(Dc,Hv,{unique:!1}),h.createIndex(em,Qv,{unique:!1})})(e)}))),n<13&&s>=13&&(o=o.next((()=>(function(u){const h=u.createObjectStore(Bo,{keyPath:Vv});h.createIndex(Eo,Dv),h.createIndex(Xp,Nv)})(e))).next((()=>this.Di(e,i))).next((()=>e.deleteObjectStore(On)))),n<14&&s>=14&&(o=o.next((()=>this.Ci(e,i)))),n<15&&s>=15&&(o=o.next((()=>(function(u){u.createObjectStore(Eu,{keyPath:qv,autoIncrement:!0}).createIndex(Vc,jv,{unique:!1}),u.createObjectStore(Ks,{keyPath:zv}).createIndex(Yp,$v,{unique:!1}),u.createObjectStore(Ws,{keyPath:Gv}).createIndex(Zp,Kv,{unique:!1})})(e)))),n<16&&s>=16&&(o=o.next((()=>{t.objectStore(Ks).clear()})).next((()=>{t.objectStore(Ws).clear()}))),n<17&&s>=17&&(o=o.next((()=>{(function(u){u.createObjectStore(vu,{keyPath:Xv})})(e)}))),n<18&&s>=18&&Gf()&&(o=o.next((()=>{t.objectStore(Ks).clear()})).next((()=>{t.objectStore(Ws).clear()}))),o}yi(e){let t=0;return e.store(On).X(((n,s)=>{t+=Ho(s)})).next((()=>{const n={byteSize:t};return e.store(ii).put(kc,n)}))}pi(e){const t=e.store(si),n=e.store(it);return t.j().next((s=>A.forEach(s,(i=>{const o=IDBKeyRange.bound([i.userId,ln],[i.userId,i.lastAcknowledgedBatchId]);return n.j(jn,o).next((c=>A.forEach(c,(u=>{q(u.userId===i.userId,18650,"Cannot process batch from unexpected user",{batchId:u.batchId});const h=Ln(this.serializer,u);return ag(e,i.userId,h).next((()=>{}))}))))}))))}wi(e){const t=e.store(Lr),n=e.store(On);return e.store($n).get(qo).next((s=>{const i=[];return n.X(((o,c)=>{const u=new Q(o),h=(function(p){return[0,Fe(p)]})(u);i.push(t.get(h).next((f=>f?A.resolve():(p=>t.put({targetId:0,path:Fe(p),sequenceNumber:s.highestListenSequenceNumber}))(u))))})).next((()=>A.waitFor(i)))}))}Si(e,t){e.createObjectStore(oi,{keyPath:Lv});const n=t.store(oi),s=new Lu,i=o=>{if(s.add(o)){const c=o.lastSegment(),u=o.popLast();return n.put({collectionId:c,parent:Fe(u)})}};return t.store(On).X({Z:!0},((o,c)=>{const u=new Q(o);return i(u.popLast())})).next((()=>t.store(Or).X({Z:!0},(([o,c,u],h)=>{const f=pt(c);return i(f.popLast())}))))}bi(e){const t=e.store(Mr);return t.X(((n,s)=>{const i=qs(s),o=rg(this.serializer,i);return t.put(o)}))}Di(e,t){const n=t.store(On),s=[];return n.X(((i,o)=>{const c=t.store(Bo),u=(function(p){return p.document?new O(Q.fromString(p.document.name).popFirst(5)):p.noDocument?O.fromSegments(p.noDocument.path):p.unknownDocument?O.fromSegments(p.unknownDocument.path):B(36783)})(o).path.toArray(),h={prefixPath:u.slice(0,u.length-2),collectionGroup:u[u.length-2],documentId:u[u.length-1],readTime:o.readTime||[0,0],unknownDocument:o.unknownDocument,noDocument:o.noDocument,document:o.document,hasCommittedMutations:!!o.hasCommittedMutations};s.push(c.put(h))})).next((()=>A.waitFor(s)))}Ci(e,t){const n=t.store(it),s=pg(this.serializer),i=new Uu(wa.Vi,this.serializer.gt);return n.j().next((o=>{const c=new Map;return o.forEach((u=>{var h;let f=(h=c.get(u.userId))!==null&&h!==void 0?h:W();Ln(this.serializer,u).keys().forEach((p=>f=f.add(p))),c.set(u.userId,f)})),A.forEach(c,((u,h)=>{const f=new Se(h),p=Ea.yt(this.serializer,f),m=i.getIndexManager(f),T=va.yt(f,this.serializer,m,i.referenceDelegate);return new mg(s,T,p,m).recalculateAndSaveOverlaysForDocumentKeys(new Nc(t,We.ue),u).next()}))}))}}function nf(r){r.createObjectStore(Lr,{keyPath:Ov}).createIndex(Tu,Mv,{unique:!0}),r.createObjectStore(Mr,{keyPath:"targetId"}).createIndex(Jp,xv,{unique:!0}),r.createObjectStore($n)}const Yt="IndexedDbPersistence",lc=18e5,hc=5e3,dc="Failed to obtain exclusive access to the persistence layer. To allow shared access, multi-tab synchronization has to be enabled in all tabs. If you are using `experimentalForceOwningTab:true`, make sure that only one tab has persistence enabled at any given time.",gg="main";class Bu{constructor(e,t,n,s,i,o,c,u,h,f,p=18){if(this.allowTabSynchronization=e,this.persistenceKey=t,this.clientId=n,this.Fi=i,this.window=o,this.document=c,this.Mi=h,this.xi=f,this.Oi=p,this.ui=null,this.ci=!1,this.isPrimary=!1,this.networkEnabled=!0,this.Ni=null,this.inForeground=!1,this.Bi=null,this.Li=null,this.ki=Number.NEGATIVE_INFINITY,this.qi=m=>Promise.resolve(),!Bu.C())throw new D(R.UNIMPLEMENTED,"This platform is either missing IndexedDB or is known to have an incomplete implementation. Offline persistence has been disabled.");this.referenceDelegate=new Zw(this,s),this.Qi=t+gg,this.serializer=new ng(u),this.$i=new It(this.Qi,this.Oi,new hA(this.serializer)),this.li=new jw,this.hi=new Xw(this.referenceDelegate,this.serializer),this.remoteDocumentCache=pg(this.serializer),this.Ti=new qw,this.window&&this.window.localStorage?this.Ui=this.window.localStorage:(this.Ui=null,f===!1&&Ie(Yt,"LocalStorage is unavailable. As a result, persistence may not work reliably. In particular enablePersistence() could fail immediately after refreshing the page."))}start(){return this.Ki().then((()=>{if(!this.isPrimary&&!this.allowTabSynchronization)throw new D(R.FAILED_PRECONDITION,dc);return this.Wi(),this.Gi(),this.zi(),this.runTransaction("getHighestListenSequenceNumber","readonly",(e=>this.hi.getHighestSequenceNumber(e)))})).then((e=>{this.ui=new We(e,this.Mi)})).then((()=>{this.ci=!0})).catch((e=>(this.$i&&this.$i.close(),Promise.reject(e))))}ji(e){return this.qi=async t=>{if(this.started)return e(t)},e(this.isPrimary)}setDatabaseDeletedListener(e){this.$i.setDatabaseDeletedListener(e)}setNetworkEnabled(e){this.networkEnabled!==e&&(this.networkEnabled=e,this.Fi.enqueueAndForget((async()=>{this.started&&await this.Ki()})))}Ki(){return this.runTransaction("updateClientMetadataAndTryBecomePrimary","readwrite",(e=>uo(e).put({clientId:this.clientId,updateTimeMs:Date.now(),networkEnabled:this.networkEnabled,inForeground:this.inForeground}).next((()=>{if(this.isPrimary)return this.Ji(e).next((t=>{t||(this.isPrimary=!1,this.Fi.enqueueRetryable((()=>this.qi(!1))))}))})).next((()=>this.Hi(e))).next((t=>this.isPrimary&&!t?this.Yi(e).next((()=>!1)):!!t&&this.Zi(e).next((()=>!0)))))).catch((e=>{if(En(e))return N(Yt,"Failed to extend owner lease: ",e),this.isPrimary;if(!this.allowTabSynchronization)throw e;return N(Yt,"Releasing owner lease after error during lease refresh",e),!1})).then((e=>{this.isPrimary!==e&&this.Fi.enqueueRetryable((()=>this.qi(e))),this.isPrimary=e}))}Ji(e){return xs(e).get(mr).next((t=>A.resolve(this.Xi(t))))}es(e){return uo(e).delete(this.clientId)}async ts(){if(this.isPrimary&&!this.ns(this.ki,lc)){this.ki=Date.now();const e=await this.runTransaction("maybeGarbageCollectMultiClientState","readwrite-primary",(t=>{const n=be(t,Fr);return n.j().next((s=>{const i=this.rs(s,lc),o=s.filter((c=>i.indexOf(c)===-1));return A.forEach(o,(c=>n.delete(c.clientId))).next((()=>o))}))})).catch((()=>[]));if(this.Ui)for(const t of e)this.Ui.removeItem(this.ss(t.clientId))}}zi(){this.Li=this.Fi.enqueueAfterDelay("client_metadata_refresh",4e3,(()=>this.Ki().then((()=>this.ts())).then((()=>this.zi()))))}Xi(e){return!!e&&e.ownerId===this.clientId}Hi(e){return this.xi?A.resolve(!0):xs(e).get(mr).next((t=>{if(t!==null&&this.ns(t.leaseTimestampMs,hc)&&!this._s(t.ownerId)){if(this.Xi(t)&&this.networkEnabled)return!0;if(!this.Xi(t)){if(!t.allowTabSynchronization)throw new D(R.FAILED_PRECONDITION,dc);return!1}}return!(!this.networkEnabled||!this.inForeground)||uo(e).j().next((n=>this.rs(n,hc).find((s=>{if(this.clientId!==s.clientId){const i=!this.networkEnabled&&s.networkEnabled,o=!this.inForeground&&s.inForeground,c=this.networkEnabled===s.networkEnabled;if(i||o&&c)return!0}return!1}))===void 0))})).next((t=>(this.isPrimary!==t&&N(Yt,`Client ${t?"is":"is not"} eligible for a primary lease.`),t)))}async shutdown(){this.ci=!1,this.us(),this.Li&&(this.Li.cancel(),this.Li=null),this.cs(),this.ls(),await this.$i.runTransaction("shutdown","readwrite",[wi,Fr],(e=>{const t=new Nc(e,We.ue);return this.Yi(t).next((()=>this.es(t)))})),this.$i.close(),this.hs()}rs(e,t){return e.filter((n=>this.ns(n.updateTimeMs,t)&&!this._s(n.clientId)))}Ps(){return this.runTransaction("getActiveClients","readonly",(e=>uo(e).j().next((t=>this.rs(t,lc).map((n=>n.clientId))))))}get started(){return this.ci}getGlobalsCache(){return this.li}getMutationQueue(e,t){return va.yt(e,this.serializer,t,this.referenceDelegate)}getTargetCache(){return this.hi}getRemoteDocumentCache(){return this.remoteDocumentCache}getIndexManager(e){return new Qw(e,this.serializer.gt.databaseId)}getDocumentOverlayCache(e){return Ea.yt(this.serializer,e)}getBundleCache(){return this.Ti}runTransaction(e,t,n){N(Yt,"Starting transaction:",e);const s=t==="readonly"?"readonly":"readwrite",i=(function(u){return u===18?Zv:u===17?sm:u===16?Yv:u===15?wu:u===14?rm:u===13?nm:u===12?Jv:u===11?tm:void B(60245)})(this.Oi);let o;return this.$i.runTransaction(e,s,i,(c=>(o=new Nc(c,this.ui?this.ui.next():We.ue),t==="readwrite-primary"?this.Ji(o).next((u=>!!u||this.Hi(o))).next((u=>{if(!u)throw Ie(`Failed to obtain primary lease for action '${e}'.`),this.isPrimary=!1,this.Fi.enqueueRetryable((()=>this.qi(!1))),new D(R.FAILED_PRECONDITION,Gp);return n(o)})).next((u=>this.Zi(o).next((()=>u)))):this.Ts(o).next((()=>n(o)))))).then((c=>(o.raiseOnCommittedEvent(),c)))}Ts(e){return xs(e).get(mr).next((t=>{if(t!==null&&this.ns(t.leaseTimestampMs,hc)&&!this._s(t.ownerId)&&!this.Xi(t)&&!(this.xi||this.allowTabSynchronization&&t.allowTabSynchronization))throw new D(R.FAILED_PRECONDITION,dc)}))}Zi(e){const t={ownerId:this.clientId,allowTabSynchronization:this.allowTabSynchronization,leaseTimestampMs:Date.now()};return xs(e).put(mr,t)}static C(){return It.C()}Yi(e){const t=xs(e);return t.get(mr).next((n=>this.Xi(n)?(N(Yt,"Releasing primary lease."),t.delete(mr)):A.resolve()))}ns(e,t){const n=Date.now();return!(e<n-t)&&(!(e>n)||(Ie(`Detected an update time that is in the future: ${e} > ${n}`),!1))}Wi(){this.document!==null&&typeof this.document.addEventListener=="function"&&(this.Bi=()=>{this.Fi.enqueueAndForget((()=>(this.inForeground=this.document.visibilityState==="visible",this.Ki())))},this.document.addEventListener("visibilitychange",this.Bi),this.inForeground=this.document.visibilityState==="visible")}cs(){this.Bi&&(this.document.removeEventListener("visibilitychange",this.Bi),this.Bi=null)}Gi(){var e;typeof((e=this.window)===null||e===void 0?void 0:e.addEventListener)=="function"&&(this.Ni=()=>{this.us();const t=/(?:Version|Mobile)\/1[456]/;$f()&&(navigator.appVersion.match(t)||navigator.userAgent.match(t))&&this.Fi.enterRestrictedMode(!0),this.Fi.enqueueAndForget((()=>this.shutdown()))},this.window.addEventListener("pagehide",this.Ni))}ls(){this.Ni&&(this.window.removeEventListener("pagehide",this.Ni),this.Ni=null)}_s(e){var t;try{const n=((t=this.Ui)===null||t===void 0?void 0:t.getItem(this.ss(e)))!==null;return N(Yt,`Client '${e}' ${n?"is":"is not"} zombied in LocalStorage`),n}catch(n){return Ie(Yt,"Failed to get zombied client id.",n),!1}}us(){if(this.Ui)try{this.Ui.setItem(this.ss(this.clientId),String(Date.now()))}catch(e){Ie("Failed to set zombie client id.",e)}}hs(){if(this.Ui)try{this.Ui.removeItem(this.ss(this.clientId))}catch{}}ss(e){return`firestore_zombie_${this.persistenceKey}_${e}`}}function xs(r){return be(r,wi)}function uo(r){return be(r,Fr)}function qu(r,e){let t=r.projectId;return r.isDefaultDatabase||(t+="."+r.database),"firestore/"+e+"/"+t+"/"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ju{constructor(e,t,n,s){this.targetId=e,this.fromCache=t,this.Is=n,this.ds=s}static Es(e,t){let n=W(),s=W();for(const i of t.docChanges)switch(i.type){case 0:n=n.add(i.doc.key);break;case 1:s=s.add(i.doc.key)}return new ju(e,t.fromCache,n,s)}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class dA{constructor(){this._documentReadCount=0}get documentReadCount(){return this._documentReadCount}incrementDocumentReadCount(e){this._documentReadCount+=e}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _g{constructor(){this.As=!1,this.Rs=!1,this.Vs=100,this.fs=(function(){return $f()?8:Wp(we())>0?6:4})()}initialize(e,t){this.gs=e,this.indexManager=t,this.As=!0}getDocumentsMatchingQuery(e,t,n,s){const i={result:null};return this.ps(e,t).next((o=>{i.result=o})).next((()=>{if(!i.result)return this.ys(e,t,s,n).next((o=>{i.result=o}))})).next((()=>{if(i.result)return;const o=new dA;return this.ws(e,t,o).next((c=>{if(i.result=c,this.Rs)return this.Ss(e,t,o,c.size)}))})).next((()=>i.result))}Ss(e,t,n,s){return n.documentReadCount<this.Vs?(vr()<=J.DEBUG&&N("QueryEngine","SDK will not create cache indexes for query:",wr(t),"since it only creates cache indexes for collection contains","more than or equal to",this.Vs,"documents"),A.resolve()):(vr()<=J.DEBUG&&N("QueryEngine","Query:",wr(t),"scans",n.documentReadCount,"local documents and returns",s,"documents as results."),n.documentReadCount>this.fs*s?(vr()<=J.DEBUG&&N("QueryEngine","The SDK decides to create cache indexes for query:",wr(t),"as using cache indexes may help improve performance."),this.indexManager.createTargetIndexes(e,Ue(t))):A.resolve())}ps(e,t){if(Rd(t))return A.resolve(null);let n=Ue(t);return this.indexManager.getIndexType(e,n).next((s=>s===0?null:(t.limit!==null&&s===1&&(t=$o(t,null,"F"),n=Ue(t)),this.indexManager.getDocumentsMatchingTarget(e,n).next((i=>{const o=W(...i);return this.gs.getDocuments(e,o).next((c=>this.indexManager.getMinOffset(e,n).next((u=>{const h=this.bs(t,c);return this.Ds(t,h,o,u.readTime)?this.ps(e,$o(t,null,"F")):this.vs(e,h,t,u)}))))})))))}ys(e,t,n,s){return Rd(t)||s.isEqual(z.min())?A.resolve(null):this.gs.getDocuments(e,n).next((i=>{const o=this.bs(t,i);return this.Ds(t,o,n,s)?A.resolve(null):(vr()<=J.DEBUG&&N("QueryEngine","Re-using previous result from %s to execute query: %s",s.toString(),wr(t)),this.vs(e,o,t,zp(s,Dr)).next((c=>c)))}))}bs(e,t){let n=new ie(Pm(e));return t.forEach(((s,i)=>{Ri(e,i)&&(n=n.add(i))})),n}Ds(e,t,n,s){if(e.limit===null)return!1;if(n.size!==t.size)return!0;const i=e.limitType==="F"?t.last():t.first();return!!i&&(i.hasPendingWrites||i.version.compareTo(s)>0)}ws(e,t,n){return vr()<=J.DEBUG&&N("QueryEngine","Using full collection scan to execute query:",wr(t)),this.gs.getDocumentsMatchingQuery(e,t,tt.min(),n)}vs(e,t,n,s){return this.gs.getDocumentsMatchingQuery(e,n,s).next((i=>(t.forEach((o=>{i=i.insert(o.key,o)})),i)))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const zu="LocalStore",fA=3e8;class pA{constructor(e,t,n,s){this.persistence=e,this.Cs=t,this.serializer=s,this.Fs=new ce(G),this.Ms=new jt((i=>Xn(i)),Ai),this.xs=new Map,this.Os=e.getRemoteDocumentCache(),this.hi=e.getTargetCache(),this.Ti=e.getBundleCache(),this.Ns(n)}Ns(e){this.documentOverlayCache=this.persistence.getDocumentOverlayCache(e),this.indexManager=this.persistence.getIndexManager(e),this.mutationQueue=this.persistence.getMutationQueue(e,this.indexManager),this.localDocuments=new mg(this.Os,this.mutationQueue,this.documentOverlayCache,this.indexManager),this.Os.setIndexManager(this.indexManager),this.Cs.initialize(this.localDocuments,this.indexManager)}collectGarbage(e){return this.persistence.runTransaction("Collect garbage","readwrite-primary",(t=>e.collect(t,this.Fs)))}}function yg(r,e,t,n){return new pA(r,e,t,n)}async function Ig(r,e){const t=M(r);return await t.persistence.runTransaction("Handle user change","readonly",(n=>{let s;return t.mutationQueue.getAllMutationBatches(n).next((i=>(s=i,t.Ns(e),t.mutationQueue.getAllMutationBatches(n)))).next((i=>{const o=[],c=[];let u=W();for(const h of s){o.push(h.batchId);for(const f of h.mutations)u=u.add(f.key)}for(const h of i){c.push(h.batchId);for(const f of h.mutations)u=u.add(f.key)}return t.localDocuments.getDocuments(n,u).next((h=>({Bs:h,removedBatchIds:o,addedBatchIds:c})))}))}))}function mA(r,e){const t=M(r);return t.persistence.runTransaction("Acknowledge batch","readwrite-primary",(n=>{const s=e.batch.keys(),i=t.Os.newChangeBuffer({trackRemovals:!0});return(function(c,u,h,f){const p=h.batch,m=p.keys();let T=A.resolve();return m.forEach((P=>{T=T.next((()=>f.getEntry(u,P))).next((V=>{const C=h.docVersions.get(P);q(C!==null,48541),V.version.compareTo(C)<0&&(p.applyToRemoteDocument(V,h),V.isValidDocument()&&(V.setReadTime(h.commitVersion),f.addEntry(V)))}))})),T.next((()=>c.mutationQueue.removeMutationBatch(u,p)))})(t,n,e,i).next((()=>i.apply(n))).next((()=>t.mutationQueue.performConsistencyCheck(n))).next((()=>t.documentOverlayCache.removeOverlaysForBatchId(n,s,e.batch.batchId))).next((()=>t.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(n,(function(c){let u=W();for(let h=0;h<c.mutationResults.length;++h)c.mutationResults[h].transformResults.length>0&&(u=u.add(c.batch.mutations[h].key));return u})(e)))).next((()=>t.localDocuments.getDocuments(n,s)))}))}function Tg(r){const e=M(r);return e.persistence.runTransaction("Get last remote snapshot version","readonly",(t=>e.hi.getLastRemoteSnapshotVersion(t)))}function gA(r,e){const t=M(r),n=e.snapshotVersion;let s=t.Fs;return t.persistence.runTransaction("Apply remote event","readwrite-primary",(i=>{const o=t.Os.newChangeBuffer({trackRemovals:!0});s=t.Fs;const c=[];e.targetChanges.forEach(((f,p)=>{const m=s.get(p);if(!m)return;c.push(t.hi.removeMatchingKeys(i,f.removedDocuments,p).next((()=>t.hi.addMatchingKeys(i,f.addedDocuments,p))));let T=m.withSequenceNumber(i.currentSequenceNumber);e.targetMismatches.get(p)!==null?T=T.withResumeToken(ge.EMPTY_BYTE_STRING,z.min()).withLastLimboFreeSnapshotVersion(z.min()):f.resumeToken.approximateByteSize()>0&&(T=T.withResumeToken(f.resumeToken,n)),s=s.insert(p,T),(function(V,C,L){return V.resumeToken.approximateByteSize()===0||C.snapshotVersion.toMicroseconds()-V.snapshotVersion.toMicroseconds()>=fA?!0:L.addedDocuments.size+L.modifiedDocuments.size+L.removedDocuments.size>0})(m,T,f)&&c.push(t.hi.updateTargetData(i,T))}));let u=Qe(),h=W();if(e.documentUpdates.forEach((f=>{e.resolvedLimboDocuments.has(f)&&c.push(t.persistence.referenceDelegate.updateLimboDocument(i,f))})),c.push(Eg(i,o,e.documentUpdates).next((f=>{u=f.Ls,h=f.ks}))),!n.isEqual(z.min())){const f=t.hi.getLastRemoteSnapshotVersion(i).next((p=>t.hi.setTargetsMetadata(i,i.currentSequenceNumber,n)));c.push(f)}return A.waitFor(c).next((()=>o.apply(i))).next((()=>t.localDocuments.getLocalViewOfDocuments(i,u,h))).next((()=>u))})).then((i=>(t.Fs=s,i)))}function Eg(r,e,t){let n=W(),s=W();return t.forEach((i=>n=n.add(i))),e.getEntries(r,n).next((i=>{let o=Qe();return t.forEach(((c,u)=>{const h=i.get(c);u.isFoundDocument()!==h.isFoundDocument()&&(s=s.add(c)),u.isNoDocument()&&u.version.isEqual(z.min())?(e.removeEntry(c,u.readTime),o=o.insert(c,u)):!h.isValidDocument()||u.version.compareTo(h.version)>0||u.version.compareTo(h.version)===0&&h.hasPendingWrites?(e.addEntry(u),o=o.insert(c,u)):N(zu,"Ignoring outdated watch update for ",c,". Current version:",h.version," Watch version:",u.version)})),{Ls:o,ks:s}}))}function _A(r,e){const t=M(r);return t.persistence.runTransaction("Get next mutation batch","readonly",(n=>(e===void 0&&(e=ln),t.mutationQueue.getNextMutationBatchAfterBatchId(n,e))))}function Gr(r,e){const t=M(r);return t.persistence.runTransaction("Allocate target","readwrite",(n=>{let s;return t.hi.getTargetData(n,e).next((i=>i?(s=i,A.resolve(s)):t.hi.allocateTargetId(n).next((o=>(s=new kt(e,o,"TargetPurposeListen",n.currentSequenceNumber),t.hi.addTargetData(n,s).next((()=>s)))))))})).then((n=>{const s=t.Fs.get(n.targetId);return(s===null||n.snapshotVersion.compareTo(s.snapshotVersion)>0)&&(t.Fs=t.Fs.insert(n.targetId,n),t.Ms.set(e,n.targetId)),n}))}async function Kr(r,e,t){const n=M(r),s=n.Fs.get(e),i=t?"readwrite":"readwrite-primary";try{t||await n.persistence.runTransaction("Release target",i,(o=>n.persistence.referenceDelegate.removeTarget(o,s)))}catch(o){if(!En(o))throw o;N(zu,`Failed to update sequence numbers for target ${e}: ${o}`)}n.Fs=n.Fs.remove(e),n.Ms.delete(s.target)}function Xo(r,e,t){const n=M(r);let s=z.min(),i=W();return n.persistence.runTransaction("Execute query","readwrite",(o=>(function(u,h,f){const p=M(u),m=p.Ms.get(f);return m!==void 0?A.resolve(p.Fs.get(m)):p.hi.getTargetData(h,f)})(n,o,Ue(e)).next((c=>{if(c)return s=c.lastLimboFreeSnapshotVersion,n.hi.getMatchingKeysForTargetId(o,c.targetId).next((u=>{i=u}))})).next((()=>n.Cs.getDocumentsMatchingQuery(o,e,t?s:z.min(),t?i:W()))).next((c=>(Ag(n,Sm(e),c),{documents:c,qs:i})))))}function vg(r,e){const t=M(r),n=M(t.hi),s=t.Fs.get(e);return s?Promise.resolve(s.target):t.persistence.runTransaction("Get target data","readonly",(i=>n.Et(i,e).next((o=>o?o.target:null))))}function wg(r,e){const t=M(r),n=t.xs.get(e)||z.min();return t.persistence.runTransaction("Get new document changes","readonly",(s=>t.Os.getAllFromCollectionGroup(s,e,zp(n,Dr),Number.MAX_SAFE_INTEGER))).then((s=>(Ag(t,e,s),s)))}function Ag(r,e,t){let n=r.xs.get(e)||z.min();t.forEach(((s,i)=>{i.readTime.compareTo(n)>0&&(n=i.readTime)})),r.xs.set(e,n)}async function yA(r,e,t,n){const s=M(r);let i=W(),o=Qe();for(const h of t){const f=e.Qs(h.metadata.name);h.document&&(i=i.add(f));const p=e.$s(h);p.setReadTime(e.Us(h.metadata.readTime)),o=o.insert(f,p)}const c=s.Os.newChangeBuffer({trackRemovals:!0}),u=await Gr(s,(function(f){return Ue(ts(Q.fromString(`__bundle__/docs/${f}`)))})(n));return s.persistence.runTransaction("Apply bundle documents","readwrite",(h=>Eg(h,c,o).next((f=>(c.apply(h),f))).next((f=>s.hi.removeMatchingKeysForTargetId(h,u.targetId).next((()=>s.hi.addMatchingKeys(h,i,u.targetId))).next((()=>s.localDocuments.getLocalViewOfDocuments(h,f.Ls,f.ks))).next((()=>f.Ls))))))}async function IA(r,e,t=W()){const n=await Gr(r,Ue(Ta(e.bundledQuery))),s=M(r);return s.persistence.runTransaction("Save named query","readwrite",(i=>{const o=Te(e.readTime);if(n.snapshotVersion.compareTo(o)>=0)return s.Ti.saveNamedQuery(i,e);const c=n.withResumeToken(ge.EMPTY_BYTE_STRING,o);return s.Fs=s.Fs.insert(c.targetId,c),s.hi.updateTargetData(i,c).next((()=>s.hi.removeMatchingKeysForTargetId(i,n.targetId))).next((()=>s.hi.addMatchingKeys(i,t,n.targetId))).next((()=>s.Ti.saveNamedQuery(i,e)))}))}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const bg="firestore_clients";function rf(r,e){return`${bg}_${r}_${e}`}const Rg="firestore_mutations";function sf(r,e,t){let n=`${Rg}_${r}_${t}`;return e.isAuthenticated()&&(n+=`_${e.uid}`),n}const Sg="firestore_targets";function fc(r,e){return`${Sg}_${r}_${e}`}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ft="SharedClientState";class Jo{constructor(e,t,n,s){this.user=e,this.batchId=t,this.state=n,this.error=s}static Ks(e,t,n){const s=JSON.parse(n);let i,o=typeof s=="object"&&["pending","acknowledged","rejected"].indexOf(s.state)!==-1&&(s.error===void 0||typeof s.error=="object");return o&&s.error&&(o=typeof s.error.message=="string"&&typeof s.error.code=="string",o&&(i=new D(s.error.code,s.error.message))),o?new Jo(e,t,s.state,i):(Ie(ft,`Failed to parse mutation state for ID '${t}': ${n}`),null)}Ws(){const e={state:this.state,updateTimeMs:Date.now()};return this.error&&(e.error={code:this.error.code,message:this.error.message}),JSON.stringify(e)}}class Js{constructor(e,t,n){this.targetId=e,this.state=t,this.error=n}static Ks(e,t){const n=JSON.parse(t);let s,i=typeof n=="object"&&["not-current","current","rejected"].indexOf(n.state)!==-1&&(n.error===void 0||typeof n.error=="object");return i&&n.error&&(i=typeof n.error.message=="string"&&typeof n.error.code=="string",i&&(s=new D(n.error.code,n.error.message))),i?new Js(e,n.state,s):(Ie(ft,`Failed to parse target state for ID '${e}': ${t}`),null)}Ws(){const e={state:this.state,updateTimeMs:Date.now()};return this.error&&(e.error={code:this.error.code,message:this.error.message}),JSON.stringify(e)}}class Yo{constructor(e,t){this.clientId=e,this.activeTargetIds=t}static Ks(e,t){const n=JSON.parse(t);let s=typeof n=="object"&&n.activeTargetIds instanceof Array,i=Pu();for(let o=0;s&&o<n.activeTargetIds.length;++o)s=Hp(n.activeTargetIds[o]),i=i.add(n.activeTargetIds[o]);return s?new Yo(e,i):(Ie(ft,`Failed to parse client data for instance '${e}': ${t}`),null)}}class $u{constructor(e,t){this.clientId=e,this.onlineState=t}static Ks(e){const t=JSON.parse(e);return typeof t=="object"&&["Unknown","Online","Offline"].indexOf(t.onlineState)!==-1&&typeof t.clientId=="string"?new $u(t.clientId,t.onlineState):(Ie(ft,`Failed to parse online state: ${e}`),null)}}class Wc{constructor(){this.activeTargetIds=Pu()}Gs(e){this.activeTargetIds=this.activeTargetIds.add(e)}zs(e){this.activeTargetIds=this.activeTargetIds.delete(e)}Ws(){const e={activeTargetIds:this.activeTargetIds.toArray(),updateTimeMs:Date.now()};return JSON.stringify(e)}}class pc{constructor(e,t,n,s,i){this.window=e,this.Fi=t,this.persistenceKey=n,this.js=s,this.syncEngine=null,this.onlineStateHandler=null,this.sequenceNumberHandler=null,this.Js=this.Hs.bind(this),this.Ys=new ce(G),this.started=!1,this.Zs=[];const o=n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");this.storage=this.window.localStorage,this.currentUser=i,this.Xs=rf(this.persistenceKey,this.js),this.eo=(function(u){return`firestore_sequence_number_${u}`})(this.persistenceKey),this.Ys=this.Ys.insert(this.js,new Wc),this.no=new RegExp(`^${bg}_${o}_([^_]*)$`),this.ro=new RegExp(`^${Rg}_${o}_(\\d+)(?:_(.*))?$`),this.io=new RegExp(`^${Sg}_${o}_(\\d+)$`),this.so=(function(u){return`firestore_online_state_${u}`})(this.persistenceKey),this.oo=(function(u){return`firestore_bundle_loaded_v2_${u}`})(this.persistenceKey),this.window.addEventListener("storage",this.Js)}static C(e){return!(!e||!e.localStorage)}async start(){const e=await this.syncEngine.Ps();for(const n of e){if(n===this.js)continue;const s=this.getItem(rf(this.persistenceKey,n));if(s){const i=Yo.Ks(n,s);i&&(this.Ys=this.Ys.insert(i.clientId,i))}}this._o();const t=this.storage.getItem(this.so);if(t){const n=this.ao(t);n&&this.uo(n)}for(const n of this.Zs)this.Hs(n);this.Zs=[],this.window.addEventListener("pagehide",(()=>this.shutdown())),this.started=!0}writeSequenceNumber(e){this.setItem(this.eo,JSON.stringify(e))}getAllActiveQueryTargets(){return this.co(this.Ys)}isActiveQueryTarget(e){let t=!1;return this.Ys.forEach(((n,s)=>{s.activeTargetIds.has(e)&&(t=!0)})),t}addPendingMutation(e){this.lo(e,"pending")}updateMutationState(e,t,n){this.lo(e,t,n),this.ho(e)}addLocalQueryTarget(e,t=!0){let n="not-current";if(this.isActiveQueryTarget(e)){const s=this.storage.getItem(fc(this.persistenceKey,e));if(s){const i=Js.Ks(e,s);i&&(n=i.state)}}return t&&this.Po.Gs(e),this._o(),n}removeLocalQueryTarget(e){this.Po.zs(e),this._o()}isLocalQueryTarget(e){return this.Po.activeTargetIds.has(e)}clearQueryState(e){this.removeItem(fc(this.persistenceKey,e))}updateQueryState(e,t,n){this.To(e,t,n)}handleUserChange(e,t,n){t.forEach((s=>{this.ho(s)})),this.currentUser=e,n.forEach((s=>{this.addPendingMutation(s)}))}setOnlineState(e){this.Io(e)}notifyBundleLoaded(e){this.Eo(e)}shutdown(){this.started&&(this.window.removeEventListener("storage",this.Js),this.removeItem(this.Xs),this.started=!1)}getItem(e){const t=this.storage.getItem(e);return N(ft,"READ",e,t),t}setItem(e,t){N(ft,"SET",e,t),this.storage.setItem(e,t)}removeItem(e){N(ft,"REMOVE",e),this.storage.removeItem(e)}Hs(e){const t=e;if(t.storageArea===this.storage){if(N(ft,"EVENT",t.key,t.newValue),t.key===this.Xs)return void Ie("Received WebStorage notification for local change. Another client might have garbage-collected our state");this.Fi.enqueueRetryable((async()=>{if(this.started){if(t.key!==null){if(this.no.test(t.key)){if(t.newValue==null){const n=this.Ao(t.key);return this.Ro(n,null)}{const n=this.Vo(t.key,t.newValue);if(n)return this.Ro(n.clientId,n)}}else if(this.ro.test(t.key)){if(t.newValue!==null){const n=this.mo(t.key,t.newValue);if(n)return this.fo(n)}}else if(this.io.test(t.key)){if(t.newValue!==null){const n=this.po(t.key,t.newValue);if(n)return this.yo(n)}}else if(t.key===this.so){if(t.newValue!==null){const n=this.ao(t.newValue);if(n)return this.uo(n)}}else if(t.key===this.eo){const n=(function(i){let o=We.ue;if(i!=null)try{const c=JSON.parse(i);q(typeof c=="number",30636,{wo:i}),o=c}catch(c){Ie(ft,"Failed to read sequence number from WebStorage",c)}return o})(t.newValue);n!==We.ue&&this.sequenceNumberHandler(n)}else if(t.key===this.oo){const n=this.So(t.newValue);await Promise.all(n.map((s=>this.syncEngine.bo(s))))}}}else this.Zs.push(t)}))}}get Po(){return this.Ys.get(this.js)}_o(){this.setItem(this.Xs,this.Po.Ws())}lo(e,t,n){const s=new Jo(this.currentUser,e,t,n),i=sf(this.persistenceKey,this.currentUser,e);this.setItem(i,s.Ws())}ho(e){const t=sf(this.persistenceKey,this.currentUser,e);this.removeItem(t)}Io(e){const t={clientId:this.js,onlineState:e};this.storage.setItem(this.so,JSON.stringify(t))}To(e,t,n){const s=fc(this.persistenceKey,e),i=new Js(e,t,n);this.setItem(s,i.Ws())}Eo(e){const t=JSON.stringify(Array.from(e));this.setItem(this.oo,t)}Ao(e){const t=this.no.exec(e);return t?t[1]:null}Vo(e,t){const n=this.Ao(e);return Yo.Ks(n,t)}mo(e,t){const n=this.ro.exec(e),s=Number(n[1]),i=n[2]!==void 0?n[2]:null;return Jo.Ks(new Se(i),s,t)}po(e,t){const n=this.io.exec(e),s=Number(n[1]);return Js.Ks(s,t)}ao(e){return $u.Ks(e)}So(e){return JSON.parse(e)}async fo(e){if(e.user.uid===this.currentUser.uid)return this.syncEngine.Do(e.batchId,e.state,e.error);N(ft,`Ignoring mutation for non-active user ${e.user.uid}`)}yo(e){return this.syncEngine.vo(e.targetId,e.state,e.error)}Ro(e,t){const n=t?this.Ys.insert(e,t):this.Ys.remove(e),s=this.co(this.Ys),i=this.co(n),o=[],c=[];return i.forEach((u=>{s.has(u)||o.push(u)})),s.forEach((u=>{i.has(u)||c.push(u)})),this.syncEngine.Co(o,c).then((()=>{this.Ys=n}))}uo(e){this.Ys.get(e.clientId)&&this.onlineStateHandler(e.onlineState)}co(e){let t=Pu();return e.forEach(((n,s)=>{t=t.unionWith(s.activeTargetIds)})),t}}class Pg{constructor(){this.Fo=new Wc,this.Mo={},this.onlineStateHandler=null,this.sequenceNumberHandler=null}addPendingMutation(e){}updateMutationState(e,t,n){}addLocalQueryTarget(e,t=!0){return t&&this.Fo.Gs(e),this.Mo[e]||"not-current"}updateQueryState(e,t,n){this.Mo[e]=t}removeLocalQueryTarget(e){this.Fo.zs(e)}isLocalQueryTarget(e){return this.Fo.activeTargetIds.has(e)}clearQueryState(e){delete this.Mo[e]}getAllActiveQueryTargets(){return this.Fo.activeTargetIds}isActiveQueryTarget(e){return this.Fo.activeTargetIds.has(e)}start(){return this.Fo=new Wc,Promise.resolve()}handleUserChange(e,t,n){}setOnlineState(e){}shutdown(){}writeSequenceNumber(e){}notifyBundleLoaded(e){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class TA{xo(e){}shutdown(){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const of="ConnectivityMonitor";class af{constructor(){this.Oo=()=>this.No(),this.Bo=()=>this.Lo(),this.ko=[],this.qo()}xo(e){this.ko.push(e)}shutdown(){window.removeEventListener("online",this.Oo),window.removeEventListener("offline",this.Bo)}qo(){window.addEventListener("online",this.Oo),window.addEventListener("offline",this.Bo)}No(){N(of,"Network connectivity changed: AVAILABLE");for(const e of this.ko)e(0)}Lo(){N(of,"Network connectivity changed: UNAVAILABLE");for(const e of this.ko)e(1)}static C(){return typeof window<"u"&&window.addEventListener!==void 0&&window.removeEventListener!==void 0}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let lo=null;function Hc(){return lo===null?lo=(function(){return 268435456+Math.round(2147483648*Math.random())})():lo++,"0x"+lo.toString(16)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const mc="RestConnection",EA={BatchGetDocuments:"batchGet",Commit:"commit",RunQuery:"runQuery",RunAggregationQuery:"runAggregationQuery"};class vA{get Qo(){return!1}constructor(e){this.databaseInfo=e,this.databaseId=e.databaseId;const t=e.ssl?"https":"http",n=encodeURIComponent(this.databaseId.projectId),s=encodeURIComponent(this.databaseId.database);this.$o=t+"://"+e.host,this.Uo=`projects/${n}/databases/${s}`,this.Ko=this.databaseId.database===ci?`project_id=${n}`:`project_id=${n}&database_id=${s}`}Wo(e,t,n,s,i){const o=Hc(),c=this.Go(e,t.toUriEncodedString());N(mc,`Sending RPC '${e}' ${o}:`,c,n);const u={"google-cloud-resource-prefix":this.Uo,"x-goog-request-params":this.Ko};this.zo(u,s,i);const{host:h}=new URL(c),f=Ft(h);return this.jo(e,c,u,n,f).then((p=>(N(mc,`Received RPC '${e}' ${o}: `,p),p)),(p=>{throw Be(mc,`RPC '${e}' ${o} failed with error: `,p,"url: ",c,"request:",n),p}))}Jo(e,t,n,s,i,o){return this.Wo(e,t,n,s,i)}zo(e,t,n){e["X-Goog-Api-Client"]=(function(){return"gl-js/ fire/"+es})(),e["Content-Type"]="text/plain",this.databaseInfo.appId&&(e["X-Firebase-GMPID"]=this.databaseInfo.appId),t&&t.headers.forEach(((s,i)=>e[i]=s)),n&&n.headers.forEach(((s,i)=>e[i]=s))}Go(e,t){const n=EA[e];return`${this.$o}/v1/${t}:${n}`}terminate(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wA{constructor(e){this.Ho=e.Ho,this.Yo=e.Yo}Zo(e){this.Xo=e}e_(e){this.t_=e}n_(e){this.r_=e}onMessage(e){this.i_=e}close(){this.Yo()}send(e){this.Ho(e)}s_(){this.Xo()}o_(){this.t_()}__(e){this.r_(e)}a_(e){this.i_(e)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Me="WebChannelConnection";class AA extends vA{constructor(e){super(e),this.u_=[],this.forceLongPolling=e.forceLongPolling,this.autoDetectLongPolling=e.autoDetectLongPolling,this.useFetchStreams=e.useFetchStreams,this.longPollingOptions=e.longPollingOptions}jo(e,t,n,s,i){const o=Hc();return new Promise(((c,u)=>{const h=new Vp;h.setWithCredentials(!0),h.listenOnce(Dp.COMPLETE,(()=>{try{switch(h.getLastErrorCode()){case Io.NO_ERROR:const p=h.getResponseJson();N(Me,`XHR for RPC '${e}' ${o} received:`,JSON.stringify(p)),c(p);break;case Io.TIMEOUT:N(Me,`RPC '${e}' ${o} timed out`),u(new D(R.DEADLINE_EXCEEDED,"Request time out"));break;case Io.HTTP_ERROR:const m=h.getStatus();if(N(Me,`RPC '${e}' ${o} failed with status:`,m,"response text:",h.getResponseText()),m>0){let T=h.getResponseJson();Array.isArray(T)&&(T=T[0]);const P=T==null?void 0:T.error;if(P&&P.status&&P.message){const V=(function(L){const U=L.toLowerCase().replace(/_/g,"-");return Object.values(R).indexOf(U)>=0?U:R.UNKNOWN})(P.status);u(new D(V,P.message))}else u(new D(R.UNKNOWN,"Server responded with status "+h.getStatus()))}else u(new D(R.UNAVAILABLE,"Connection failed."));break;default:B(9055,{c_:e,streamId:o,l_:h.getLastErrorCode(),h_:h.getLastError()})}}finally{N(Me,`RPC '${e}' ${o} completed.`)}}));const f=JSON.stringify(s);N(Me,`RPC '${e}' ${o} sending request:`,s),h.send(t,"POST",f,n,15)}))}P_(e,t,n){const s=Hc(),i=[this.$o,"/","google.firestore.v1.Firestore","/",e,"/channel"],o=Op(),c=xp(),u={httpSessionIdParam:"gsessionid",initMessageHeaders:{},messageUrlParams:{database:`projects/${this.databaseId.projectId}/databases/${this.databaseId.database}`},sendRawJson:!0,supportsCrossDomainXhr:!0,internalChannelParams:{forwardChannelRequestTimeoutMs:6e5},forceLongPolling:this.forceLongPolling,detectBufferingProxy:this.autoDetectLongPolling},h=this.longPollingOptions.timeoutSeconds;h!==void 0&&(u.longPollingTimeout=Math.round(1e3*h)),this.useFetchStreams&&(u.useFetchStreams=!0),this.zo(u.initMessageHeaders,t,n),u.encodeInitMessageHeaders=!0;const f=i.join("");N(Me,`Creating RPC '${e}' stream ${s}: ${f}`,u);const p=o.createWebChannel(f,u);this.T_(p);let m=!1,T=!1;const P=new wA({Ho:C=>{T?N(Me,`Not sending because RPC '${e}' stream ${s} is closed:`,C):(m||(N(Me,`Opening RPC '${e}' stream ${s} transport.`),p.open(),m=!0),N(Me,`RPC '${e}' stream ${s} sending:`,C),p.send(C))},Yo:()=>p.close()}),V=(C,L,U)=>{C.listen(L,(x=>{try{U(x)}catch(j){setTimeout((()=>{throw j}),0)}}))};return V(p,Fs.EventType.OPEN,(()=>{T||(N(Me,`RPC '${e}' stream ${s} transport opened.`),P.s_())})),V(p,Fs.EventType.CLOSE,(()=>{T||(T=!0,N(Me,`RPC '${e}' stream ${s} transport closed`),P.__(),this.I_(p))})),V(p,Fs.EventType.ERROR,(C=>{T||(T=!0,Be(Me,`RPC '${e}' stream ${s} transport errored. Name:`,C.name,"Message:",C.message),P.__(new D(R.UNAVAILABLE,"The operation could not be completed")))})),V(p,Fs.EventType.MESSAGE,(C=>{var L;if(!T){const U=C.data[0];q(!!U,16349);const x=U,j=(x==null?void 0:x.error)||((L=x[0])===null||L===void 0?void 0:L.error);if(j){N(Me,`RPC '${e}' stream ${s} received error:`,j);const H=j.status;let $=(function(y){const v=Ee[y];if(v!==void 0)return jm(v)})(H),E=j.message;$===void 0&&($=R.INTERNAL,E="Unknown error status: "+H+" with message "+j.message),T=!0,P.__(new D($,E)),p.close()}else N(Me,`RPC '${e}' stream ${s} received:`,U),P.a_(U)}})),V(c,Np.STAT_EVENT,(C=>{C.stat===bc.PROXY?N(Me,`RPC '${e}' stream ${s} detected buffering proxy`):C.stat===bc.NOPROXY&&N(Me,`RPC '${e}' stream ${s} detected no buffering proxy`)})),setTimeout((()=>{P.o_()}),0),P}terminate(){this.u_.forEach((e=>e.close())),this.u_=[]}T_(e){this.u_.push(e)}I_(e){this.u_=this.u_.filter((t=>t===e))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Cg(){return typeof window<"u"?window:null}function Po(){return typeof document<"u"?document:null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ar(r){return new kw(r,!0)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Gu{constructor(e,t,n=1e3,s=1.5,i=6e4){this.Fi=e,this.timerId=t,this.d_=n,this.E_=s,this.A_=i,this.R_=0,this.V_=null,this.m_=Date.now(),this.reset()}reset(){this.R_=0}f_(){this.R_=this.A_}g_(e){this.cancel();const t=Math.floor(this.R_+this.p_()),n=Math.max(0,Date.now()-this.m_),s=Math.max(0,t-n);s>0&&N("ExponentialBackoff",`Backing off for ${s} ms (base delay: ${this.R_} ms, delay with jitter: ${t} ms, last attempt: ${n} ms ago)`),this.V_=this.Fi.enqueueAfterDelay(this.timerId,s,(()=>(this.m_=Date.now(),e()))),this.R_*=this.E_,this.R_<this.d_&&(this.R_=this.d_),this.R_>this.A_&&(this.R_=this.A_)}y_(){this.V_!==null&&(this.V_.skipDelay(),this.V_=null)}cancel(){this.V_!==null&&(this.V_.cancel(),this.V_=null)}p_(){return(Math.random()-.5)*this.R_}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const cf="PersistentStream";class kg{constructor(e,t,n,s,i,o,c,u){this.Fi=e,this.w_=n,this.S_=s,this.connection=i,this.authCredentialsProvider=o,this.appCheckCredentialsProvider=c,this.listener=u,this.state=0,this.b_=0,this.D_=null,this.v_=null,this.stream=null,this.C_=0,this.F_=new Gu(e,t)}M_(){return this.state===1||this.state===5||this.x_()}x_(){return this.state===2||this.state===3}start(){this.C_=0,this.state!==4?this.auth():this.O_()}async stop(){this.M_()&&await this.close(0)}N_(){this.state=0,this.F_.reset()}B_(){this.x_()&&this.D_===null&&(this.D_=this.Fi.enqueueAfterDelay(this.w_,6e4,(()=>this.L_())))}k_(e){this.q_(),this.stream.send(e)}async L_(){if(this.x_())return this.close(0)}q_(){this.D_&&(this.D_.cancel(),this.D_=null)}Q_(){this.v_&&(this.v_.cancel(),this.v_=null)}async close(e,t){this.q_(),this.Q_(),this.F_.cancel(),this.b_++,e!==4?this.F_.reset():t&&t.code===R.RESOURCE_EXHAUSTED?(Ie(t.toString()),Ie("Using maximum backoff delay to prevent overloading the backend."),this.F_.f_()):t&&t.code===R.UNAUTHENTICATED&&this.state!==3&&(this.authCredentialsProvider.invalidateToken(),this.appCheckCredentialsProvider.invalidateToken()),this.stream!==null&&(this.U_(),this.stream.close(),this.stream=null),this.state=e,await this.listener.n_(t)}U_(){}auth(){this.state=1;const e=this.K_(this.b_),t=this.b_;Promise.all([this.authCredentialsProvider.getToken(),this.appCheckCredentialsProvider.getToken()]).then((([n,s])=>{this.b_===t&&this.W_(n,s)}),(n=>{e((()=>{const s=new D(R.UNKNOWN,"Fetching auth token failed: "+n.message);return this.G_(s)}))}))}W_(e,t){const n=this.K_(this.b_);this.stream=this.z_(e,t),this.stream.Zo((()=>{n((()=>this.listener.Zo()))})),this.stream.e_((()=>{n((()=>(this.state=2,this.v_=this.Fi.enqueueAfterDelay(this.S_,1e4,(()=>(this.x_()&&(this.state=3),Promise.resolve()))),this.listener.e_())))})),this.stream.n_((s=>{n((()=>this.G_(s)))})),this.stream.onMessage((s=>{n((()=>++this.C_==1?this.j_(s):this.onNext(s)))}))}O_(){this.state=5,this.F_.g_((async()=>{this.state=0,this.start()}))}G_(e){return N(cf,`close with error: ${e}`),this.stream=null,this.close(4,e)}K_(e){return t=>{this.Fi.enqueueAndForget((()=>this.b_===e?t():(N(cf,"stream callback skipped by getCloseGuardedDispatcher."),Promise.resolve())))}}}class bA extends kg{constructor(e,t,n,s,i,o){super(e,"listen_stream_connection_backoff","listen_stream_idle","health_check_timeout",t,n,s,o),this.serializer=i}z_(e,t){return this.connection.P_("Listen",e,t)}j_(e){return this.onNext(e)}onNext(e){this.F_.reset();const t=Nw(this.serializer,e),n=(function(i){if(!("targetChange"in i))return z.min();const o=i.targetChange;return o.targetIds&&o.targetIds.length?z.min():o.readTime?Te(o.readTime):z.min()})(e);return this.listener.J_(t,n)}H_(e){const t={};t.database=jc(this.serializer),t.addTarget=(function(i,o){let c;const u=o.target;if(c=jo(u)?{documents:Xm(i,u)}:{query:Ia(i,u).Vt},c.targetId=o.targetId,o.resumeToken.approximateByteSize()>0){c.resumeToken=Gm(i,o.resumeToken);const h=Bc(i,o.expectedCount);h!==null&&(c.expectedCount=h)}else if(o.snapshotVersion.compareTo(z.min())>0){c.readTime=$r(i,o.snapshotVersion.toTimestamp());const h=Bc(i,o.expectedCount);h!==null&&(c.expectedCount=h)}return c})(this.serializer,e);const n=Ow(this.serializer,e);n&&(t.labels=n),this.k_(t)}Y_(e){const t={};t.database=jc(this.serializer),t.removeTarget=e,this.k_(t)}}class RA extends kg{constructor(e,t,n,s,i,o){super(e,"write_stream_connection_backoff","write_stream_idle","health_check_timeout",t,n,s,o),this.serializer=i}get Z_(){return this.C_>0}start(){this.lastStreamToken=void 0,super.start()}U_(){this.Z_&&this.X_([])}z_(e,t){return this.connection.P_("Write",e,t)}j_(e){return q(!!e.streamToken,31322),this.lastStreamToken=e.streamToken,q(!e.writeResults||e.writeResults.length===0,55816),this.listener.ea()}onNext(e){q(!!e.streamToken,12678),this.lastStreamToken=e.streamToken,this.F_.reset();const t=xw(e.writeResults,e.commitTime),n=Te(e.commitTime);return this.listener.ta(n,t)}na(){const e={};e.database=jc(this.serializer),this.k_(e)}X_(e){const t={streamToken:this.lastStreamToken,writes:e.map((n=>fi(this.serializer,n)))};this.k_(t)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class SA{}class PA extends SA{constructor(e,t,n,s){super(),this.authCredentials=e,this.appCheckCredentials=t,this.connection=n,this.serializer=s,this.ra=!1}ia(){if(this.ra)throw new D(R.FAILED_PRECONDITION,"The client has already been terminated.")}Wo(e,t,n,s){return this.ia(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then((([i,o])=>this.connection.Wo(e,qc(t,n),s,i,o))).catch((i=>{throw i.name==="FirebaseError"?(i.code===R.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),i):new D(R.UNKNOWN,i.toString())}))}Jo(e,t,n,s,i){return this.ia(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then((([o,c])=>this.connection.Jo(e,qc(t,n),s,o,c,i))).catch((o=>{throw o.name==="FirebaseError"?(o.code===R.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),o):new D(R.UNKNOWN,o.toString())}))}terminate(){this.ra=!0,this.connection.terminate()}}class CA{constructor(e,t){this.asyncQueue=e,this.onlineStateHandler=t,this.state="Unknown",this.sa=0,this.oa=null,this._a=!0}aa(){this.sa===0&&(this.ua("Unknown"),this.oa=this.asyncQueue.enqueueAfterDelay("online_state_timeout",1e4,(()=>(this.oa=null,this.ca("Backend didn't respond within 10 seconds."),this.ua("Offline"),Promise.resolve()))))}la(e){this.state==="Online"?this.ua("Unknown"):(this.sa++,this.sa>=1&&(this.ha(),this.ca(`Connection failed 1 times. Most recent error: ${e.toString()}`),this.ua("Offline")))}set(e){this.ha(),this.sa=0,e==="Online"&&(this._a=!1),this.ua(e)}ua(e){e!==this.state&&(this.state=e,this.onlineStateHandler(e))}ca(e){const t=`Could not reach Cloud Firestore backend. ${e}
This typically indicates that your device does not have a healthy Internet connection at the moment. The client will operate in offline mode until it is able to successfully connect to the backend.`;this._a?(Ie(t),this._a=!1):N("OnlineStateTracker",t)}ha(){this.oa!==null&&(this.oa.cancel(),this.oa=null)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const nr="RemoteStore";class kA{constructor(e,t,n,s,i){this.localStore=e,this.datastore=t,this.asyncQueue=n,this.remoteSyncer={},this.Pa=[],this.Ta=new Map,this.Ia=new Set,this.da=[],this.Ea=i,this.Ea.xo((o=>{n.enqueueAndForget((async()=>{wn(this)&&(N(nr,"Restarting streams for network reachability change."),await(async function(u){const h=M(u);h.Ia.add(4),await ss(h),h.Aa.set("Unknown"),h.Ia.delete(4),await ki(h)})(this))}))})),this.Aa=new CA(n,s)}}async function ki(r){if(wn(r))for(const e of r.da)await e(!0)}async function ss(r){for(const e of r.da)await e(!1)}function Aa(r,e){const t=M(r);t.Ta.has(e.targetId)||(t.Ta.set(e.targetId,e),Hu(t)?Wu(t):os(t).x_()&&Ku(t,e))}function Wr(r,e){const t=M(r),n=os(t);t.Ta.delete(e),n.x_()&&Vg(t,e),t.Ta.size===0&&(n.x_()?n.B_():wn(t)&&t.Aa.set("Unknown"))}function Ku(r,e){if(r.Ra.$e(e.targetId),e.resumeToken.approximateByteSize()>0||e.snapshotVersion.compareTo(z.min())>0){const t=r.remoteSyncer.getRemoteKeysForTarget(e.targetId).size;e=e.withExpectedCount(t)}os(r).H_(e)}function Vg(r,e){r.Ra.$e(e),os(r).Y_(e)}function Wu(r){r.Ra=new Rw({getRemoteKeysForTarget:e=>r.remoteSyncer.getRemoteKeysForTarget(e),Et:e=>r.Ta.get(e)||null,lt:()=>r.datastore.serializer.databaseId}),os(r).start(),r.Aa.aa()}function Hu(r){return wn(r)&&!os(r).M_()&&r.Ta.size>0}function wn(r){return M(r).Ia.size===0}function Dg(r){r.Ra=void 0}async function VA(r){r.Aa.set("Online")}async function DA(r){r.Ta.forEach(((e,t)=>{Ku(r,e)}))}async function NA(r,e){Dg(r),Hu(r)?(r.Aa.la(e),Wu(r)):r.Aa.set("Unknown")}async function xA(r,e,t){if(r.Aa.set("Online"),e instanceof $m&&e.state===2&&e.cause)try{await(async function(s,i){const o=i.cause;for(const c of i.targetIds)s.Ta.has(c)&&(await s.remoteSyncer.rejectListen(c,o),s.Ta.delete(c),s.Ra.removeTarget(c))})(r,e)}catch(n){N(nr,"Failed to remove targets %s: %s ",e.targetIds.join(","),n),await Zo(r,n)}else if(e instanceof Ro?r.Ra.Ye(e):e instanceof zm?r.Ra.it(e):r.Ra.et(e),!t.isEqual(z.min()))try{const n=await Tg(r.localStore);t.compareTo(n)>=0&&await(function(i,o){const c=i.Ra.Pt(o);return c.targetChanges.forEach(((u,h)=>{if(u.resumeToken.approximateByteSize()>0){const f=i.Ta.get(h);f&&i.Ta.set(h,f.withResumeToken(u.resumeToken,o))}})),c.targetMismatches.forEach(((u,h)=>{const f=i.Ta.get(u);if(!f)return;i.Ta.set(u,f.withResumeToken(ge.EMPTY_BYTE_STRING,f.snapshotVersion)),Vg(i,u);const p=new kt(f.target,u,h,f.sequenceNumber);Ku(i,p)})),i.remoteSyncer.applyRemoteEvent(c)})(r,t)}catch(n){N(nr,"Failed to raise snapshot:",n),await Zo(r,n)}}async function Zo(r,e,t){if(!En(e))throw e;r.Ia.add(1),await ss(r),r.Aa.set("Offline"),t||(t=()=>Tg(r.localStore)),r.asyncQueue.enqueueRetryable((async()=>{N(nr,"Retrying IndexedDB access"),await t(),r.Ia.delete(1),await ki(r)}))}function Ng(r,e){return e().catch((t=>Zo(r,t,e)))}async function is(r){const e=M(r),t=_n(e);let n=e.Pa.length>0?e.Pa[e.Pa.length-1].batchId:ln;for(;OA(e);)try{const s=await _A(e.localStore,n);if(s===null){e.Pa.length===0&&t.B_();break}n=s.batchId,MA(e,s)}catch(s){await Zo(e,s)}xg(e)&&Og(e)}function OA(r){return wn(r)&&r.Pa.length<10}function MA(r,e){r.Pa.push(e);const t=_n(r);t.x_()&&t.Z_&&t.X_(e.mutations)}function xg(r){return wn(r)&&!_n(r).M_()&&r.Pa.length>0}function Og(r){_n(r).start()}async function LA(r){_n(r).na()}async function FA(r){const e=_n(r);for(const t of r.Pa)e.X_(t.mutations)}async function UA(r,e,t){const n=r.Pa.shift(),s=Du.from(n,e,t);await Ng(r,(()=>r.remoteSyncer.applySuccessfulWrite(s))),await is(r)}async function BA(r,e){e&&_n(r).Z_&&await(async function(n,s){if((function(o){return qm(o)&&o!==R.ABORTED})(s.code)){const i=n.Pa.shift();_n(n).N_(),await Ng(n,(()=>n.remoteSyncer.rejectFailedWrite(i.batchId,s))),await is(n)}})(r,e),xg(r)&&Og(r)}async function uf(r,e){const t=M(r);t.asyncQueue.verifyOperationInProgress(),N(nr,"RemoteStore received new credentials");const n=wn(t);t.Ia.add(3),await ss(t),n&&t.Aa.set("Unknown"),await t.remoteSyncer.handleCredentialChange(e),t.Ia.delete(3),await ki(t)}async function Qc(r,e){const t=M(r);e?(t.Ia.delete(2),await ki(t)):e||(t.Ia.add(2),await ss(t),t.Aa.set("Unknown"))}function os(r){return r.Va||(r.Va=(function(t,n,s){const i=M(t);return i.ia(),new bA(n,i.connection,i.authCredentials,i.appCheckCredentials,i.serializer,s)})(r.datastore,r.asyncQueue,{Zo:VA.bind(null,r),e_:DA.bind(null,r),n_:NA.bind(null,r),J_:xA.bind(null,r)}),r.da.push((async e=>{e?(r.Va.N_(),Hu(r)?Wu(r):r.Aa.set("Unknown")):(await r.Va.stop(),Dg(r))}))),r.Va}function _n(r){return r.ma||(r.ma=(function(t,n,s){const i=M(t);return i.ia(),new RA(n,i.connection,i.authCredentials,i.appCheckCredentials,i.serializer,s)})(r.datastore,r.asyncQueue,{Zo:()=>Promise.resolve(),e_:LA.bind(null,r),n_:BA.bind(null,r),ea:FA.bind(null,r),ta:UA.bind(null,r)}),r.da.push((async e=>{e?(r.ma.N_(),await is(r)):(await r.ma.stop(),r.Pa.length>0&&(N(nr,`Stopping write stream with ${r.Pa.length} pending writes`),r.Pa=[]))}))),r.ma}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qu{constructor(e,t,n,s,i){this.asyncQueue=e,this.timerId=t,this.targetTimeMs=n,this.op=s,this.removalCallback=i,this.deferred=new Pe,this.then=this.deferred.promise.then.bind(this.deferred.promise),this.deferred.promise.catch((o=>{}))}get promise(){return this.deferred.promise}static createAndSchedule(e,t,n,s,i){const o=Date.now()+n,c=new Qu(e,t,o,s,i);return c.start(n),c}start(e){this.timerHandle=setTimeout((()=>this.handleDelayElapsed()),e)}skipDelay(){return this.handleDelayElapsed()}cancel(e){this.timerHandle!==null&&(this.clearTimeout(),this.deferred.reject(new D(R.CANCELLED,"Operation cancelled"+(e?": "+e:""))))}handleDelayElapsed(){this.asyncQueue.enqueueAndForget((()=>this.timerHandle!==null?(this.clearTimeout(),this.op().then((e=>this.deferred.resolve(e)))):Promise.resolve()))}clearTimeout(){this.timerHandle!==null&&(this.removalCallback(this),clearTimeout(this.timerHandle),this.timerHandle=null)}}function as(r,e){if(Ie("AsyncQueue",`${e}: ${r}`),En(r))return new D(R.UNAVAILABLE,`${e}: ${r}`);throw r}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Gn{static emptySet(e){return new Gn(e.comparator)}constructor(e){this.comparator=e?(t,n)=>e(t,n)||O.comparator(t.key,n.key):(t,n)=>O.comparator(t.key,n.key),this.keyedMap=Us(),this.sortedSet=new ce(this.comparator)}has(e){return this.keyedMap.get(e)!=null}get(e){return this.keyedMap.get(e)}first(){return this.sortedSet.minKey()}last(){return this.sortedSet.maxKey()}isEmpty(){return this.sortedSet.isEmpty()}indexOf(e){const t=this.keyedMap.get(e);return t?this.sortedSet.indexOf(t):-1}get size(){return this.sortedSet.size}forEach(e){this.sortedSet.inorderTraversal(((t,n)=>(e(t),!1)))}add(e){const t=this.delete(e.key);return t.copy(t.keyedMap.insert(e.key,e),t.sortedSet.insert(e,null))}delete(e){const t=this.get(e);return t?this.copy(this.keyedMap.remove(e),this.sortedSet.remove(t)):this}isEqual(e){if(!(e instanceof Gn)||this.size!==e.size)return!1;const t=this.sortedSet.getIterator(),n=e.sortedSet.getIterator();for(;t.hasNext();){const s=t.getNext().key,i=n.getNext().key;if(!s.isEqual(i))return!1}return!0}toString(){const e=[];return this.forEach((t=>{e.push(t.toString())})),e.length===0?"DocumentSet ()":`DocumentSet (
  `+e.join(`  
`)+`
)`}copy(e,t){const n=new Gn;return n.comparator=this.comparator,n.keyedMap=e,n.sortedSet=t,n}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class lf{constructor(){this.fa=new ce(O.comparator)}track(e){const t=e.doc.key,n=this.fa.get(t);n?e.type!==0&&n.type===3?this.fa=this.fa.insert(t,e):e.type===3&&n.type!==1?this.fa=this.fa.insert(t,{type:n.type,doc:e.doc}):e.type===2&&n.type===2?this.fa=this.fa.insert(t,{type:2,doc:e.doc}):e.type===2&&n.type===0?this.fa=this.fa.insert(t,{type:0,doc:e.doc}):e.type===1&&n.type===0?this.fa=this.fa.remove(t):e.type===1&&n.type===2?this.fa=this.fa.insert(t,{type:1,doc:n.doc}):e.type===0&&n.type===1?this.fa=this.fa.insert(t,{type:2,doc:e.doc}):B(63341,{At:e,ga:n}):this.fa=this.fa.insert(t,e)}pa(){const e=[];return this.fa.inorderTraversal(((t,n)=>{e.push(n)})),e}}class rr{constructor(e,t,n,s,i,o,c,u,h){this.query=e,this.docs=t,this.oldDocs=n,this.docChanges=s,this.mutatedKeys=i,this.fromCache=o,this.syncStateChanged=c,this.excludesMetadataChanges=u,this.hasCachedResults=h}static fromInitialDocuments(e,t,n,s,i){const o=[];return t.forEach((c=>{o.push({type:0,doc:c})})),new rr(e,t,Gn.emptySet(t),o,n,s,!0,!1,i)}get hasPendingWrites(){return!this.mutatedKeys.isEmpty()}isEqual(e){if(!(this.fromCache===e.fromCache&&this.hasCachedResults===e.hasCachedResults&&this.syncStateChanged===e.syncStateChanged&&this.mutatedKeys.isEqual(e.mutatedKeys)&&bi(this.query,e.query)&&this.docs.isEqual(e.docs)&&this.oldDocs.isEqual(e.oldDocs)))return!1;const t=this.docChanges,n=e.docChanges;if(t.length!==n.length)return!1;for(let s=0;s<t.length;s++)if(t[s].type!==n[s].type||!t[s].doc.isEqual(n[s].doc))return!1;return!0}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class qA{constructor(){this.ya=void 0,this.wa=[]}Sa(){return this.wa.some((e=>e.ba()))}}class jA{constructor(){this.queries=hf(),this.onlineState="Unknown",this.Da=new Set}terminate(){(function(t,n){const s=M(t),i=s.queries;s.queries=hf(),i.forEach(((o,c)=>{for(const u of c.wa)u.onError(n)}))})(this,new D(R.ABORTED,"Firestore shutting down"))}}function hf(){return new jt((r=>Rm(r)),bi)}async function Xu(r,e){const t=M(r);let n=3;const s=e.query;let i=t.queries.get(s);i?!i.Sa()&&e.ba()&&(n=2):(i=new qA,n=e.ba()?0:1);try{switch(n){case 0:i.ya=await t.onListen(s,!0);break;case 1:i.ya=await t.onListen(s,!1);break;case 2:await t.onFirstRemoteStoreListen(s)}}catch(o){const c=as(o,`Initialization of query '${wr(e.query)}' failed`);return void e.onError(c)}t.queries.set(s,i),i.wa.push(e),e.va(t.onlineState),i.ya&&e.Ca(i.ya)&&Yu(t)}async function Ju(r,e){const t=M(r),n=e.query;let s=3;const i=t.queries.get(n);if(i){const o=i.wa.indexOf(e);o>=0&&(i.wa.splice(o,1),i.wa.length===0?s=e.ba()?0:1:!i.Sa()&&e.ba()&&(s=2))}switch(s){case 0:return t.queries.delete(n),t.onUnlisten(n,!0);case 1:return t.queries.delete(n),t.onUnlisten(n,!1);case 2:return t.onLastRemoteStoreUnlisten(n);default:return}}function zA(r,e){const t=M(r);let n=!1;for(const s of e){const i=s.query,o=t.queries.get(i);if(o){for(const c of o.wa)c.Ca(s)&&(n=!0);o.ya=s}}n&&Yu(t)}function $A(r,e,t){const n=M(r),s=n.queries.get(e);if(s)for(const i of s.wa)i.onError(t);n.queries.delete(e)}function Yu(r){r.Da.forEach((e=>{e.next()}))}var Xc,df;(df=Xc||(Xc={})).Fa="default",df.Cache="cache";class Zu{constructor(e,t,n){this.query=e,this.Ma=t,this.xa=!1,this.Oa=null,this.onlineState="Unknown",this.options=n||{}}Ca(e){if(!this.options.includeMetadataChanges){const n=[];for(const s of e.docChanges)s.type!==3&&n.push(s);e=new rr(e.query,e.docs,e.oldDocs,n,e.mutatedKeys,e.fromCache,e.syncStateChanged,!0,e.hasCachedResults)}let t=!1;return this.xa?this.Na(e)&&(this.Ma.next(e),t=!0):this.Ba(e,this.onlineState)&&(this.La(e),t=!0),this.Oa=e,t}onError(e){this.Ma.error(e)}va(e){this.onlineState=e;let t=!1;return this.Oa&&!this.xa&&this.Ba(this.Oa,e)&&(this.La(this.Oa),t=!0),t}Ba(e,t){if(!e.fromCache||!this.ba())return!0;const n=t!=="Offline";return(!this.options.ka||!n)&&(!e.docs.isEmpty()||e.hasCachedResults||t==="Offline")}Na(e){if(e.docChanges.length>0)return!0;const t=this.Oa&&this.Oa.hasPendingWrites!==e.hasPendingWrites;return!(!e.syncStateChanged&&!t)&&this.options.includeMetadataChanges===!0}La(e){e=rr.fromInitialDocuments(e.query,e.docs,e.mutatedKeys,e.fromCache,e.hasCachedResults),this.xa=!0,this.Ma.next(e)}ba(){return this.options.source!==Xc.Cache}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Mg{constructor(e,t){this.qa=e,this.byteLength=t}Qa(){return"metadata"in this.qa}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ff{constructor(e){this.serializer=e}Qs(e){return Tt(this.serializer,e)}$s(e){return e.metadata.exists?ya(this.serializer,e.document,!1):le.newNoDocument(this.Qs(e.metadata.name),this.Us(e.metadata.readTime))}Us(e){return Te(e)}}class el{constructor(e,t){this.$a=e,this.serializer=t,this.Ua=[],this.Ka=[],this.collectionGroups=new Set,this.progress=Lg(e)}get queries(){return this.Ua}get documents(){return this.Ka}Wa(e){this.progress.bytesLoaded+=e.byteLength;let t=this.progress.documentsLoaded;if(e.qa.namedQuery)this.Ua.push(e.qa.namedQuery);else if(e.qa.documentMetadata){this.Ka.push({metadata:e.qa.documentMetadata}),e.qa.documentMetadata.exists||++t;const n=Q.fromString(e.qa.documentMetadata.name);this.collectionGroups.add(n.get(n.length-2))}else e.qa.document&&(this.Ka[this.Ka.length-1].document=e.qa.document,++t);return t!==this.progress.documentsLoaded?(this.progress.documentsLoaded=t,Object.assign({},this.progress)):null}Ga(e){const t=new Map,n=new ff(this.serializer);for(const s of e)if(s.metadata.queries){const i=n.Qs(s.metadata.name);for(const o of s.metadata.queries){const c=(t.get(o)||W()).add(i);t.set(o,c)}}return t}async za(e){const t=await yA(e,new ff(this.serializer),this.Ka,this.$a.id),n=this.Ga(this.documents);for(const s of this.Ua)await IA(e,s,n.get(s.name));return this.progress.taskState="Success",{progress:this.progress,ja:this.collectionGroups,Ja:t}}}function Lg(r){return{taskState:"Running",documentsLoaded:0,bytesLoaded:0,totalDocuments:r.totalDocuments,totalBytes:r.totalBytes}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Fg{constructor(e){this.key=e}}class Ug{constructor(e){this.key=e}}class Bg{constructor(e,t){this.query=e,this.Ha=t,this.Ya=null,this.hasCachedResults=!1,this.current=!1,this.Za=W(),this.mutatedKeys=W(),this.Xa=Pm(e),this.eu=new Gn(this.Xa)}get tu(){return this.Ha}nu(e,t){const n=t?t.ru:new lf,s=t?t.eu:this.eu;let i=t?t.mutatedKeys:this.mutatedKeys,o=s,c=!1;const u=this.query.limitType==="F"&&s.size===this.query.limit?s.last():null,h=this.query.limitType==="L"&&s.size===this.query.limit?s.first():null;if(e.inorderTraversal(((f,p)=>{const m=s.get(f),T=Ri(this.query,p)?p:null,P=!!m&&this.mutatedKeys.has(m.key),V=!!T&&(T.hasLocalMutations||this.mutatedKeys.has(T.key)&&T.hasCommittedMutations);let C=!1;m&&T?m.data.isEqual(T.data)?P!==V&&(n.track({type:3,doc:T}),C=!0):this.iu(m,T)||(n.track({type:2,doc:T}),C=!0,(u&&this.Xa(T,u)>0||h&&this.Xa(T,h)<0)&&(c=!0)):!m&&T?(n.track({type:0,doc:T}),C=!0):m&&!T&&(n.track({type:1,doc:m}),C=!0,(u||h)&&(c=!0)),C&&(T?(o=o.add(T),i=V?i.add(f):i.delete(f)):(o=o.delete(f),i=i.delete(f)))})),this.query.limit!==null)for(;o.size>this.query.limit;){const f=this.query.limitType==="F"?o.last():o.first();o=o.delete(f.key),i=i.delete(f.key),n.track({type:1,doc:f})}return{eu:o,ru:n,Ds:c,mutatedKeys:i}}iu(e,t){return e.hasLocalMutations&&t.hasCommittedMutations&&!t.hasLocalMutations}applyChanges(e,t,n,s){const i=this.eu;this.eu=e.eu,this.mutatedKeys=e.mutatedKeys;const o=e.ru.pa();o.sort(((f,p)=>(function(T,P){const V=C=>{switch(C){case 0:return 1;case 2:case 3:return 2;case 1:return 0;default:return B(20277,{At:C})}};return V(T)-V(P)})(f.type,p.type)||this.Xa(f.doc,p.doc))),this.su(n),s=s!=null&&s;const c=t&&!s?this.ou():[],u=this.Za.size===0&&this.current&&!s?1:0,h=u!==this.Ya;return this.Ya=u,o.length!==0||h?{snapshot:new rr(this.query,e.eu,i,o,e.mutatedKeys,u===0,h,!1,!!n&&n.resumeToken.approximateByteSize()>0),_u:c}:{_u:c}}va(e){return this.current&&e==="Offline"?(this.current=!1,this.applyChanges({eu:this.eu,ru:new lf,mutatedKeys:this.mutatedKeys,Ds:!1},!1)):{_u:[]}}au(e){return!this.Ha.has(e)&&!!this.eu.has(e)&&!this.eu.get(e).hasLocalMutations}su(e){e&&(e.addedDocuments.forEach((t=>this.Ha=this.Ha.add(t))),e.modifiedDocuments.forEach((t=>{})),e.removedDocuments.forEach((t=>this.Ha=this.Ha.delete(t))),this.current=e.current)}ou(){if(!this.current)return[];const e=this.Za;this.Za=W(),this.eu.forEach((n=>{this.au(n.key)&&(this.Za=this.Za.add(n.key))}));const t=[];return e.forEach((n=>{this.Za.has(n)||t.push(new Ug(n))})),this.Za.forEach((n=>{e.has(n)||t.push(new Fg(n))})),t}uu(e){this.Ha=e.qs,this.Za=W();const t=this.nu(e.documents);return this.applyChanges(t,!0)}cu(){return rr.fromInitialDocuments(this.query,this.eu,this.mutatedKeys,this.Ya===0,this.hasCachedResults)}}const An="SyncEngine";class GA{constructor(e,t,n){this.query=e,this.targetId=t,this.view=n}}class KA{constructor(e){this.key=e,this.lu=!1}}class WA{constructor(e,t,n,s,i,o){this.localStore=e,this.remoteStore=t,this.eventManager=n,this.sharedClientState=s,this.currentUser=i,this.maxConcurrentLimboResolutions=o,this.hu={},this.Pu=new jt((c=>Rm(c)),bi),this.Tu=new Map,this.Iu=new Set,this.du=new ce(O.comparator),this.Eu=new Map,this.Au=new Fu,this.Ru={},this.Vu=new Map,this.mu=tr.ur(),this.onlineState="Unknown",this.fu=void 0}get isPrimaryClient(){return this.fu===!0}}async function HA(r,e,t=!0){const n=ba(r);let s;const i=n.Pu.get(e);return i?(n.sharedClientState.addLocalQueryTarget(i.targetId),s=i.view.cu()):s=await qg(n,e,t,!0),s}async function QA(r,e){const t=ba(r);await qg(t,e,!0,!1)}async function qg(r,e,t,n){const s=await Gr(r.localStore,Ue(e)),i=s.targetId,o=r.sharedClientState.addLocalQueryTarget(i,t);let c;return n&&(c=await tl(r,e,i,o==="current",s.resumeToken)),r.isPrimaryClient&&t&&Aa(r.remoteStore,s),c}async function tl(r,e,t,n,s){r.gu=(p,m,T)=>(async function(V,C,L,U){let x=C.view.nu(L);x.Ds&&(x=await Xo(V.localStore,C.query,!1).then((({documents:E})=>C.view.nu(E,x))));const j=U&&U.targetChanges.get(C.targetId),H=U&&U.targetMismatches.get(C.targetId)!=null,$=C.view.applyChanges(x,V.isPrimaryClient,j,H);return Jc(V,C.targetId,$._u),$.snapshot})(r,p,m,T);const i=await Xo(r.localStore,e,!0),o=new Bg(e,i.qs),c=o.nu(i.documents),u=Ci.createSynthesizedTargetChangeForCurrentChange(t,n&&r.onlineState!=="Offline",s),h=o.applyChanges(c,r.isPrimaryClient,u);Jc(r,t,h._u);const f=new GA(e,t,o);return r.Pu.set(e,f),r.Tu.has(t)?r.Tu.get(t).push(e):r.Tu.set(t,[e]),h.snapshot}async function XA(r,e,t){const n=M(r),s=n.Pu.get(e),i=n.Tu.get(s.targetId);if(i.length>1)return n.Tu.set(s.targetId,i.filter((o=>!bi(o,e)))),void n.Pu.delete(e);n.isPrimaryClient?(n.sharedClientState.removeLocalQueryTarget(s.targetId),n.sharedClientState.isActiveQueryTarget(s.targetId)||await Kr(n.localStore,s.targetId,!1).then((()=>{n.sharedClientState.clearQueryState(s.targetId),t&&Wr(n.remoteStore,s.targetId),Hr(n,s.targetId)})).catch(Tn)):(Hr(n,s.targetId),await Kr(n.localStore,s.targetId,!0))}async function JA(r,e){const t=M(r),n=t.Pu.get(e),s=t.Tu.get(n.targetId);t.isPrimaryClient&&s.length===1&&(t.sharedClientState.removeLocalQueryTarget(n.targetId),Wr(t.remoteStore,n.targetId))}async function YA(r,e,t){const n=il(r);try{const s=await(function(o,c){const u=M(o),h=ne.now(),f=c.reduce(((T,P)=>T.add(P.key)),W());let p,m;return u.persistence.runTransaction("Locally write mutations","readwrite",(T=>{let P=Qe(),V=W();return u.Os.getEntries(T,f).next((C=>{P=C,P.forEach(((L,U)=>{U.isValidDocument()||(V=V.add(L))}))})).next((()=>u.localDocuments.getOverlayedDocuments(T,P))).next((C=>{p=C;const L=[];for(const U of c){const x=ww(U,p.get(U.key).overlayedDocument);x!=null&&L.push(new zt(U.key,x,mm(x.value.mapValue),pe.exists(!0)))}return u.mutationQueue.addMutationBatch(T,h,L,c)})).next((C=>{m=C;const L=C.applyToLocalDocumentSet(p,V);return u.documentOverlayCache.saveOverlays(T,C.batchId,L)}))})).then((()=>({batchId:m.batchId,changes:km(p)})))})(n.localStore,e);n.sharedClientState.addPendingMutation(s.batchId),(function(o,c,u){let h=o.Ru[o.currentUser.toKey()];h||(h=new ce(G)),h=h.insert(c,u),o.Ru[o.currentUser.toKey()]=h})(n,s.batchId,t),await $t(n,s.changes),await is(n.remoteStore)}catch(s){const i=as(s,"Failed to persist write");t.reject(i)}}async function jg(r,e){const t=M(r);try{const n=await gA(t.localStore,e);e.targetChanges.forEach(((s,i)=>{const o=t.Eu.get(i);o&&(q(s.addedDocuments.size+s.modifiedDocuments.size+s.removedDocuments.size<=1,22616),s.addedDocuments.size>0?o.lu=!0:s.modifiedDocuments.size>0?q(o.lu,14607):s.removedDocuments.size>0&&(q(o.lu,42227),o.lu=!1))})),await $t(t,n,e)}catch(n){await Tn(n)}}function pf(r,e,t){const n=M(r);if(n.isPrimaryClient&&t===0||!n.isPrimaryClient&&t===1){const s=[];n.Pu.forEach(((i,o)=>{const c=o.view.va(e);c.snapshot&&s.push(c.snapshot)})),(function(o,c){const u=M(o);u.onlineState=c;let h=!1;u.queries.forEach(((f,p)=>{for(const m of p.wa)m.va(c)&&(h=!0)})),h&&Yu(u)})(n.eventManager,e),s.length&&n.hu.J_(s),n.onlineState=e,n.isPrimaryClient&&n.sharedClientState.setOnlineState(e)}}async function ZA(r,e,t){const n=M(r);n.sharedClientState.updateQueryState(e,"rejected",t);const s=n.Eu.get(e),i=s&&s.key;if(i){let o=new ce(O.comparator);o=o.insert(i,le.newNoDocument(i,z.min()));const c=W().add(i),u=new Pi(z.min(),new Map,new ce(G),o,c);await jg(n,u),n.du=n.du.remove(i),n.Eu.delete(e),sl(n)}else await Kr(n.localStore,e,!1).then((()=>Hr(n,e,t))).catch(Tn)}async function eb(r,e){const t=M(r),n=e.batch.batchId;try{const s=await mA(t.localStore,e);rl(t,n,null),nl(t,n),t.sharedClientState.updateMutationState(n,"acknowledged"),await $t(t,s)}catch(s){await Tn(s)}}async function tb(r,e,t){const n=M(r);try{const s=await(function(o,c){const u=M(o);return u.persistence.runTransaction("Reject batch","readwrite-primary",(h=>{let f;return u.mutationQueue.lookupMutationBatch(h,c).next((p=>(q(p!==null,37113),f=p.keys(),u.mutationQueue.removeMutationBatch(h,p)))).next((()=>u.mutationQueue.performConsistencyCheck(h))).next((()=>u.documentOverlayCache.removeOverlaysForBatchId(h,f,c))).next((()=>u.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(h,f))).next((()=>u.localDocuments.getDocuments(h,f)))}))})(n.localStore,e);rl(n,e,t),nl(n,e),n.sharedClientState.updateMutationState(e,"rejected",t),await $t(n,s)}catch(s){await Tn(s)}}async function nb(r,e){const t=M(r);wn(t.remoteStore)||N(An,"The network is disabled. The task returned by 'awaitPendingWrites()' will not complete until the network is enabled.");try{const n=await(function(o){const c=M(o);return c.persistence.runTransaction("Get highest unacknowledged batch id","readonly",(u=>c.mutationQueue.getHighestUnacknowledgedBatchId(u)))})(t.localStore);if(n===ln)return void e.resolve();const s=t.Vu.get(n)||[];s.push(e),t.Vu.set(n,s)}catch(n){const s=as(n,"Initialization of waitForPendingWrites() operation failed");e.reject(s)}}function nl(r,e){(r.Vu.get(e)||[]).forEach((t=>{t.resolve()})),r.Vu.delete(e)}function rl(r,e,t){const n=M(r);let s=n.Ru[n.currentUser.toKey()];if(s){const i=s.get(e);i&&(t?i.reject(t):i.resolve(),s=s.remove(e)),n.Ru[n.currentUser.toKey()]=s}}function Hr(r,e,t=null){r.sharedClientState.removeLocalQueryTarget(e);for(const n of r.Tu.get(e))r.Pu.delete(n),t&&r.hu.pu(n,t);r.Tu.delete(e),r.isPrimaryClient&&r.Au.zr(e).forEach((n=>{r.Au.containsKey(n)||zg(r,n)}))}function zg(r,e){r.Iu.delete(e.path.canonicalString());const t=r.du.get(e);t!==null&&(Wr(r.remoteStore,t),r.du=r.du.remove(e),r.Eu.delete(t),sl(r))}function Jc(r,e,t){for(const n of t)n instanceof Fg?(r.Au.addReference(n.key,e),rb(r,n)):n instanceof Ug?(N(An,"Document no longer in limbo: "+n.key),r.Au.removeReference(n.key,e),r.Au.containsKey(n.key)||zg(r,n.key)):B(19791,{yu:n})}function rb(r,e){const t=e.key,n=t.path.canonicalString();r.du.get(t)||r.Iu.has(n)||(N(An,"New document in limbo: "+t),r.Iu.add(n),sl(r))}function sl(r){for(;r.Iu.size>0&&r.du.size<r.maxConcurrentLimboResolutions;){const e=r.Iu.values().next().value;r.Iu.delete(e);const t=new O(Q.fromString(e)),n=r.mu.next();r.Eu.set(n,new KA(t)),r.du=r.du.insert(t,n),Aa(r.remoteStore,new kt(Ue(ts(t.path)),n,"TargetPurposeLimboResolution",We.ue))}}async function $t(r,e,t){const n=M(r),s=[],i=[],o=[];n.Pu.isEmpty()||(n.Pu.forEach(((c,u)=>{o.push(n.gu(u,e,t).then((h=>{var f;if((h||t)&&n.isPrimaryClient){const p=h?!h.fromCache:(f=t==null?void 0:t.targetChanges.get(u.targetId))===null||f===void 0?void 0:f.current;n.sharedClientState.updateQueryState(u.targetId,p?"current":"not-current")}if(h){s.push(h);const p=ju.Es(u.targetId,h);i.push(p)}})))})),await Promise.all(o),n.hu.J_(s),await(async function(u,h){const f=M(u);try{await f.persistence.runTransaction("notifyLocalViewChanges","readwrite",(p=>A.forEach(h,(m=>A.forEach(m.Is,(T=>f.persistence.referenceDelegate.addReference(p,m.targetId,T))).next((()=>A.forEach(m.ds,(T=>f.persistence.referenceDelegate.removeReference(p,m.targetId,T)))))))))}catch(p){if(!En(p))throw p;N(zu,"Failed to update sequence numbers: "+p)}for(const p of h){const m=p.targetId;if(!p.fromCache){const T=f.Fs.get(m),P=T.snapshotVersion,V=T.withLastLimboFreeSnapshotVersion(P);f.Fs=f.Fs.insert(m,V)}}})(n.localStore,i))}async function sb(r,e){const t=M(r);if(!t.currentUser.isEqual(e)){N(An,"User change. New user:",e.toKey());const n=await Ig(t.localStore,e);t.currentUser=e,(function(i,o){i.Vu.forEach((c=>{c.forEach((u=>{u.reject(new D(R.CANCELLED,o))}))})),i.Vu.clear()})(t,"'waitForPendingWrites' promise is rejected due to a user change."),t.sharedClientState.handleUserChange(e,n.removedBatchIds,n.addedBatchIds),await $t(t,n.Bs)}}function ib(r,e){const t=M(r),n=t.Eu.get(e);if(n&&n.lu)return W().add(n.key);{let s=W();const i=t.Tu.get(e);if(!i)return s;for(const o of i){const c=t.Pu.get(o);s=s.unionWith(c.view.tu)}return s}}async function ob(r,e){const t=M(r),n=await Xo(t.localStore,e.query,!0),s=e.view.uu(n);return t.isPrimaryClient&&Jc(t,e.targetId,s._u),s}async function ab(r,e){const t=M(r);return wg(t.localStore,e).then((n=>$t(t,n)))}async function cb(r,e,t,n){const s=M(r),i=await(function(c,u){const h=M(c),f=M(h.mutationQueue);return h.persistence.runTransaction("Lookup mutation documents","readonly",(p=>f.Xn(p,u).next((m=>m?h.localDocuments.getDocuments(p,m):A.resolve(null)))))})(s.localStore,e);i!==null?(t==="pending"?await is(s.remoteStore):t==="acknowledged"||t==="rejected"?(rl(s,e,n||null),nl(s,e),(function(c,u){M(M(c).mutationQueue).rr(u)})(s.localStore,e)):B(6720,"Unknown batchState",{wu:t}),await $t(s,i)):N(An,"Cannot apply mutation batch with id: "+e)}async function ub(r,e){const t=M(r);if(ba(t),il(t),e===!0&&t.fu!==!0){const n=t.sharedClientState.getAllActiveQueryTargets(),s=await mf(t,n.toArray());t.fu=!0,await Qc(t.remoteStore,!0);for(const i of s)Aa(t.remoteStore,i)}else if(e===!1&&t.fu!==!1){const n=[];let s=Promise.resolve();t.Tu.forEach(((i,o)=>{t.sharedClientState.isLocalQueryTarget(o)?n.push(o):s=s.then((()=>(Hr(t,o),Kr(t.localStore,o,!0)))),Wr(t.remoteStore,o)})),await s,await mf(t,n),(function(o){const c=M(o);c.Eu.forEach(((u,h)=>{Wr(c.remoteStore,h)})),c.Au.jr(),c.Eu=new Map,c.du=new ce(O.comparator)})(t),t.fu=!1,await Qc(t.remoteStore,!1)}}async function mf(r,e,t){const n=M(r),s=[],i=[];for(const o of e){let c;const u=n.Tu.get(o);if(u&&u.length!==0){c=await Gr(n.localStore,Ue(u[0]));for(const h of u){const f=n.Pu.get(h),p=await ob(n,f);p.snapshot&&i.push(p.snapshot)}}else{const h=await vg(n.localStore,o);c=await Gr(n.localStore,h),await tl(n,$g(h),o,!1,c.resumeToken)}s.push(c)}return n.hu.J_(i),s}function $g(r){return wm(r.path,r.collectionGroup,r.orderBy,r.filters,r.limit,"F",r.startAt,r.endAt)}function lb(r){return(function(t){return M(M(t).persistence).Ps()})(M(r).localStore)}async function hb(r,e,t,n){const s=M(r);if(s.fu)return void N(An,"Ignoring unexpected query state notification.");const i=s.Tu.get(e);if(i&&i.length>0)switch(t){case"current":case"not-current":{const o=await wg(s.localStore,Sm(i[0])),c=Pi.createSynthesizedRemoteEventForCurrentChange(e,t==="current",ge.EMPTY_BYTE_STRING);await $t(s,o,c);break}case"rejected":await Kr(s.localStore,e,!0),Hr(s,e,n);break;default:B(64155,t)}}async function db(r,e,t){const n=ba(r);if(n.fu){for(const s of e){if(n.Tu.has(s)&&n.sharedClientState.isActiveQueryTarget(s)){N(An,"Adding an already active target "+s);continue}const i=await vg(n.localStore,s),o=await Gr(n.localStore,i);await tl(n,$g(i),o.targetId,!1,o.resumeToken),Aa(n.remoteStore,o)}for(const s of t)n.Tu.has(s)&&await Kr(n.localStore,s,!1).then((()=>{Wr(n.remoteStore,s),Hr(n,s)})).catch(Tn)}}function ba(r){const e=M(r);return e.remoteStore.remoteSyncer.applyRemoteEvent=jg.bind(null,e),e.remoteStore.remoteSyncer.getRemoteKeysForTarget=ib.bind(null,e),e.remoteStore.remoteSyncer.rejectListen=ZA.bind(null,e),e.hu.J_=zA.bind(null,e.eventManager),e.hu.pu=$A.bind(null,e.eventManager),e}function il(r){const e=M(r);return e.remoteStore.remoteSyncer.applySuccessfulWrite=eb.bind(null,e),e.remoteStore.remoteSyncer.rejectFailedWrite=tb.bind(null,e),e}function fb(r,e,t){const n=M(r);(async function(i,o,c){try{const u=await o.getMetadata();if(await(function(T,P){const V=M(T),C=Te(P.createTime);return V.persistence.runTransaction("hasNewerBundle","readonly",(L=>V.Ti.getBundleMetadata(L,P.id))).then((L=>!!L&&L.createTime.compareTo(C)>=0))})(i.localStore,u))return await o.close(),c._completeWith((function(T){return{taskState:"Success",documentsLoaded:T.totalDocuments,bytesLoaded:T.totalBytes,totalDocuments:T.totalDocuments,totalBytes:T.totalBytes}})(u)),Promise.resolve(new Set);c._updateProgress(Lg(u));const h=new el(u,o.serializer);let f=await o.Su();for(;f;){const m=await h.Wa(f);m&&c._updateProgress(m),f=await o.Su()}const p=await h.za(i.localStore);return await $t(i,p.Ja,void 0),await(function(T,P){const V=M(T);return V.persistence.runTransaction("Save bundle","readwrite",(C=>V.Ti.saveBundleMetadata(C,P)))})(i.localStore,u),c._completeWith(p.progress),Promise.resolve(p.ja)}catch(u){return Be(An,`Loading bundle failed with ${u}`),c._failWith(u),Promise.resolve(new Set)}})(n,e,t).then((s=>{n.sharedClientState.notifyBundleLoaded(s)}))}class Qr{constructor(){this.kind="memory",this.synchronizeTabs=!1}async initialize(e){this.serializer=ar(e.databaseInfo.databaseId),this.sharedClientState=this.bu(e),this.persistence=this.Du(e),await this.persistence.start(),this.localStore=this.vu(e),this.gcScheduler=this.Cu(e,this.localStore),this.indexBackfillerScheduler=this.Fu(e,this.localStore)}Cu(e,t){return null}Fu(e,t){return null}vu(e){return yg(this.persistence,new _g,e.initialUser,this.serializer)}Du(e){return new Uu(wa.Vi,this.serializer)}bu(e){return new Pg}async terminate(){var e,t;(e=this.gcScheduler)===null||e===void 0||e.stop(),(t=this.indexBackfillerScheduler)===null||t===void 0||t.stop(),this.sharedClientState.shutdown(),await this.persistence.shutdown()}}Qr.provider={build:()=>new Qr};class ol extends Qr{constructor(e){super(),this.cacheSizeBytes=e}Cu(e,t){q(this.persistence.referenceDelegate instanceof Qo,46915);const n=this.persistence.referenceDelegate.garbageCollector;return new hg(n,e.asyncQueue,t)}Du(e){const t=this.cacheSizeBytes!==void 0?Le.withCacheSize(this.cacheSizeBytes):Le.DEFAULT;return new Uu((n=>Qo.Vi(n,t)),this.serializer)}}class al extends Qr{constructor(e,t,n){super(),this.Mu=e,this.cacheSizeBytes=t,this.forceOwnership=n,this.kind="persistent",this.synchronizeTabs=!1}async initialize(e){await super.initialize(e),await this.Mu.initialize(this,e),await il(this.Mu.syncEngine),await is(this.Mu.remoteStore),await this.persistence.ji((()=>(this.gcScheduler&&!this.gcScheduler.started&&this.gcScheduler.start(),this.indexBackfillerScheduler&&!this.indexBackfillerScheduler.started&&this.indexBackfillerScheduler.start(),Promise.resolve())))}vu(e){return yg(this.persistence,new _g,e.initialUser,this.serializer)}Cu(e,t){const n=this.persistence.referenceDelegate.garbageCollector;return new hg(n,e.asyncQueue,t)}Fu(e,t){const n=new Sv(t,this.persistence);return new Rv(e.asyncQueue,n)}Du(e){const t=qu(e.databaseInfo.databaseId,e.databaseInfo.persistenceKey),n=this.cacheSizeBytes!==void 0?Le.withCacheSize(this.cacheSizeBytes):Le.DEFAULT;return new Bu(this.synchronizeTabs,t,e.clientId,n,e.asyncQueue,Cg(),Po(),this.serializer,this.sharedClientState,!!this.forceOwnership)}bu(e){return new Pg}}class Gg extends al{constructor(e,t){super(e,t,!1),this.Mu=e,this.cacheSizeBytes=t,this.synchronizeTabs=!0}async initialize(e){await super.initialize(e);const t=this.Mu.syncEngine;this.sharedClientState instanceof pc&&(this.sharedClientState.syncEngine={Do:cb.bind(null,t),vo:hb.bind(null,t),Co:db.bind(null,t),Ps:lb.bind(null,t),bo:ab.bind(null,t)},await this.sharedClientState.start()),await this.persistence.ji((async n=>{await ub(this.Mu.syncEngine,n),this.gcScheduler&&(n&&!this.gcScheduler.started?this.gcScheduler.start():n||this.gcScheduler.stop()),this.indexBackfillerScheduler&&(n&&!this.indexBackfillerScheduler.started?this.indexBackfillerScheduler.start():n||this.indexBackfillerScheduler.stop())}))}bu(e){const t=Cg();if(!pc.C(t))throw new D(R.UNIMPLEMENTED,"IndexedDB persistence is only available on platforms that support LocalStorage.");const n=qu(e.databaseInfo.databaseId,e.databaseInfo.persistenceKey);return new pc(t,e.asyncQueue,n,e.clientId,e.initialUser)}}class yn{async initialize(e,t){this.localStore||(this.localStore=e.localStore,this.sharedClientState=e.sharedClientState,this.datastore=this.createDatastore(t),this.remoteStore=this.createRemoteStore(t),this.eventManager=this.createEventManager(t),this.syncEngine=this.createSyncEngine(t,!e.synchronizeTabs),this.sharedClientState.onlineStateHandler=n=>pf(this.syncEngine,n,1),this.remoteStore.remoteSyncer.handleCredentialChange=sb.bind(null,this.syncEngine),await Qc(this.remoteStore,this.syncEngine.isPrimaryClient))}createEventManager(e){return(function(){return new jA})()}createDatastore(e){const t=ar(e.databaseInfo.databaseId),n=(function(i){return new AA(i)})(e.databaseInfo);return(function(i,o,c,u){return new PA(i,o,c,u)})(e.authCredentials,e.appCheckCredentials,n,t)}createRemoteStore(e){return(function(n,s,i,o,c){return new kA(n,s,i,o,c)})(this.localStore,this.datastore,e.asyncQueue,(t=>pf(this.syncEngine,t,0)),(function(){return af.C()?new af:new TA})())}createSyncEngine(e,t){return(function(s,i,o,c,u,h,f){const p=new WA(s,i,o,c,u,h);return f&&(p.fu=!0),p})(this.localStore,this.remoteStore,this.eventManager,this.sharedClientState,e.initialUser,e.maxConcurrentLimboResolutions,t)}async terminate(){var e,t;await(async function(s){const i=M(s);N(nr,"RemoteStore shutting down."),i.Ia.add(5),await ss(i),i.Ea.shutdown(),i.Aa.set("Unknown")})(this.remoteStore),(e=this.datastore)===null||e===void 0||e.terminate(),(t=this.eventManager)===null||t===void 0||t.terminate()}}yn.provider={build:()=>new yn};function gf(r,e=10240){let t=0;return{async read(){if(t<r.byteLength){const n={value:r.slice(t,t+e),done:!1};return t+=e,n}return{done:!0}},async cancel(){},releaseLock(){},closed:Promise.resolve()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ra{constructor(e){this.observer=e,this.muted=!1}next(e){this.muted||this.observer.next&&this.xu(this.observer.next,e)}error(e){this.muted||(this.observer.error?this.xu(this.observer.error,e):Ie("Uncaught Error in snapshot listener:",e.toString()))}Ou(){this.muted=!0}xu(e,t){setTimeout((()=>{this.muted||e(t)}),0)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pb{constructor(e,t){this.Nu=e,this.serializer=t,this.metadata=new Pe,this.buffer=new Uint8Array,this.Bu=(function(){return new TextDecoder("utf-8")})(),this.Lu().then((n=>{n&&n.Qa()?this.metadata.resolve(n.qa.metadata):this.metadata.reject(new Error(`The first element of the bundle is not a metadata, it is
             ${JSON.stringify(n==null?void 0:n.qa)}`))}),(n=>this.metadata.reject(n)))}close(){return this.Nu.cancel()}async getMetadata(){return this.metadata.promise}async Su(){return await this.getMetadata(),this.Lu()}async Lu(){const e=await this.ku();if(e===null)return null;const t=this.Bu.decode(e),n=Number(t);isNaN(n)&&this.qu(`length string (${t}) is not valid number`);const s=await this.Qu(n);return new Mg(JSON.parse(s),e.length+n)}$u(){return this.buffer.findIndex((e=>e===123))}async ku(){for(;this.$u()<0&&!await this.Uu(););if(this.buffer.length===0)return null;const e=this.$u();e<0&&this.qu("Reached the end of bundle when a length string is expected.");const t=this.buffer.slice(0,e);return this.buffer=this.buffer.slice(e),t}async Qu(e){for(;this.buffer.length<e;)await this.Uu()&&this.qu("Reached the end of bundle when more is expected.");const t=this.Bu.decode(this.buffer.slice(0,e));return this.buffer=this.buffer.slice(e),t}qu(e){throw this.Nu.cancel(),new Error(`Invalid bundle format: ${e}`)}async Uu(){const e=await this.Nu.read();if(!e.done){const t=new Uint8Array(this.buffer.length+e.value.length);t.set(this.buffer),t.set(e.value,this.buffer.length),this.buffer=t}return e.done}}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class mb{constructor(e,t){this.bundleData=e,this.serializer=t,this.cursor=0,this.elements=[];let n=this.Su();if(!n||!n.Qa())throw new Error(`The first element of the bundle is not a metadata object, it is
         ${JSON.stringify(n==null?void 0:n.qa)}`);this.metadata=n;do n=this.Su(),n!==null&&this.elements.push(n);while(n!==null)}getMetadata(){return this.metadata}Ku(){return this.elements}Su(){if(this.cursor===this.bundleData.length)return null;const e=this.ku(),t=this.Qu(e);return new Mg(JSON.parse(t),e)}Qu(e){if(this.cursor+e>this.bundleData.length)throw new D(R.INTERNAL,"Reached the end of bundle when more is expected.");return this.bundleData.slice(this.cursor,this.cursor+=e)}ku(){const e=this.cursor;let t=this.cursor;for(;t<this.bundleData.length;){if(this.bundleData[t]==="{"){if(t===e)throw new Error("First character is a bracket and not a number");return this.cursor=t,Number(this.bundleData.slice(e,t))}t++}throw new Error("Reached the end of bundle when more is expected.")}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class gb{constructor(e){this.datastore=e,this.readVersions=new Map,this.mutations=[],this.committed=!1,this.lastTransactionError=null,this.writtenDocs=new Set}async lookup(e){if(this.ensureCommitNotCalled(),this.mutations.length>0)throw this.lastTransactionError=new D(R.INVALID_ARGUMENT,"Firestore transactions require all reads to be executed before all writes."),this.lastTransactionError;const t=await(async function(s,i){const o=M(s),c={documents:i.map((p=>di(o.serializer,p)))},u=await o.Jo("BatchGetDocuments",o.serializer.databaseId,Q.emptyPath(),c,i.length),h=new Map;u.forEach((p=>{const m=Dw(o.serializer,p);h.set(m.key.toString(),m)}));const f=[];return i.forEach((p=>{const m=h.get(p.toString());q(!!m,55234,{key:p}),f.push(m)})),f})(this.datastore,e);return t.forEach((n=>this.recordVersion(n))),t}set(e,t){this.write(t.toMutation(e,this.precondition(e))),this.writtenDocs.add(e.toString())}update(e,t){try{this.write(t.toMutation(e,this.preconditionForUpdate(e)))}catch(n){this.lastTransactionError=n}this.writtenDocs.add(e.toString())}delete(e){this.write(new rs(e,this.precondition(e))),this.writtenDocs.add(e.toString())}async commit(){if(this.ensureCommitNotCalled(),this.lastTransactionError)throw this.lastTransactionError;const e=this.readVersions;this.mutations.forEach((t=>{e.delete(t.key.toString())})),e.forEach(((t,n)=>{const s=O.fromPath(n);this.mutations.push(new ku(s,this.precondition(s)))})),await(async function(n,s){const i=M(n),o={writes:s.map((c=>fi(i.serializer,c)))};await i.Wo("Commit",i.serializer.databaseId,Q.emptyPath(),o)})(this.datastore,this.mutations),this.committed=!0}recordVersion(e){let t;if(e.isFoundDocument())t=e.version;else{if(!e.isNoDocument())throw B(50498,{Wu:e.constructor.name});t=z.min()}const n=this.readVersions.get(e.key.toString());if(n){if(!t.isEqual(n))throw new D(R.ABORTED,"Document version changed between two reads.")}else this.readVersions.set(e.key.toString(),t)}precondition(e){const t=this.readVersions.get(e.toString());return!this.writtenDocs.has(e.toString())&&t?t.isEqual(z.min())?pe.exists(!1):pe.updateTime(t):pe.none()}preconditionForUpdate(e){const t=this.readVersions.get(e.toString());if(!this.writtenDocs.has(e.toString())&&t){if(t.isEqual(z.min()))throw new D(R.INVALID_ARGUMENT,"Can't update a document that doesn't exist.");return pe.updateTime(t)}return pe.exists(!0)}write(e){this.ensureCommitNotCalled(),this.mutations.push(e)}ensureCommitNotCalled(){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _b{constructor(e,t,n,s,i){this.asyncQueue=e,this.datastore=t,this.options=n,this.updateFunction=s,this.deferred=i,this.Gu=n.maxAttempts,this.F_=new Gu(this.asyncQueue,"transaction_retry")}zu(){this.Gu-=1,this.ju()}ju(){this.F_.g_((async()=>{const e=new gb(this.datastore),t=this.Ju(e);t&&t.then((n=>{this.asyncQueue.enqueueAndForget((()=>e.commit().then((()=>{this.deferred.resolve(n)})).catch((s=>{this.Hu(s)}))))})).catch((n=>{this.Hu(n)}))}))}Ju(e){try{const t=this.updateFunction(e);return!vi(t)&&t.catch&&t.then?t:(this.deferred.reject(Error("Transaction callback must return a Promise")),null)}catch(t){return this.deferred.reject(t),null}}Hu(e){this.Gu>0&&this.Yu(e)?(this.Gu-=1,this.asyncQueue.enqueueAndForget((()=>(this.ju(),Promise.resolve())))):this.deferred.reject(e)}Yu(e){if(e.name==="FirebaseError"){const t=e.code;return t==="aborted"||t==="failed-precondition"||t==="already-exists"||!qm(t)}return!1}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const In="FirestoreClient";class yb{constructor(e,t,n,s,i){this.authCredentials=e,this.appCheckCredentials=t,this.asyncQueue=n,this.databaseInfo=s,this.user=Se.UNAUTHENTICATED,this.clientId=aa.newId(),this.authCredentialListener=()=>Promise.resolve(),this.appCheckCredentialListener=()=>Promise.resolve(),this._uninitializedComponentsProvider=i,this.authCredentials.start(n,(async o=>{N(In,"Received user=",o.uid),await this.authCredentialListener(o),this.user=o})),this.appCheckCredentials.start(n,(o=>(N(In,"Received new app check token=",o),this.appCheckCredentialListener(o,this.user))))}get configuration(){return{asyncQueue:this.asyncQueue,databaseInfo:this.databaseInfo,clientId:this.clientId,authCredentials:this.authCredentials,appCheckCredentials:this.appCheckCredentials,initialUser:this.user,maxConcurrentLimboResolutions:100}}setCredentialChangeListener(e){this.authCredentialListener=e}setAppCheckTokenChangeListener(e){this.appCheckCredentialListener=e}terminate(){this.asyncQueue.enterRestrictedMode();const e=new Pe;return this.asyncQueue.enqueueAndForgetEvenWhileRestricted((async()=>{try{this._onlineComponents&&await this._onlineComponents.terminate(),this._offlineComponents&&await this._offlineComponents.terminate(),this.authCredentials.shutdown(),this.appCheckCredentials.shutdown(),e.resolve()}catch(t){const n=as(t,"Failed to shutdown persistence");e.reject(n)}})),e.promise}}async function gc(r,e){r.asyncQueue.verifyOperationInProgress(),N(In,"Initializing OfflineComponentProvider");const t=r.configuration;await e.initialize(t);let n=t.initialUser;r.setCredentialChangeListener((async s=>{n.isEqual(s)||(await Ig(e.localStore,s),n=s)})),e.persistence.setDatabaseDeletedListener((()=>{Be("Terminating Firestore due to IndexedDb database deletion"),r.terminate().then((()=>{N("Terminating Firestore due to IndexedDb database deletion completed successfully")})).catch((s=>{Be("Terminating Firestore due to IndexedDb database deletion failed",s)}))})),r._offlineComponents=e}async function _f(r,e){r.asyncQueue.verifyOperationInProgress();const t=await cl(r);N(In,"Initializing OnlineComponentProvider"),await e.initialize(t,r.configuration),r.setCredentialChangeListener((n=>uf(e.remoteStore,n))),r.setAppCheckTokenChangeListener(((n,s)=>uf(e.remoteStore,s))),r._onlineComponents=e}async function cl(r){if(!r._offlineComponents)if(r._uninitializedComponentsProvider){N(In,"Using user provided OfflineComponentProvider");try{await gc(r,r._uninitializedComponentsProvider._offline)}catch(e){const t=e;if(!(function(s){return s.name==="FirebaseError"?s.code===R.FAILED_PRECONDITION||s.code===R.UNIMPLEMENTED:!(typeof DOMException<"u"&&s instanceof DOMException)||s.code===22||s.code===20||s.code===11})(t))throw t;Be("Error using user provided cache. Falling back to memory cache: "+t),await gc(r,new Qr)}}else N(In,"Using default OfflineComponentProvider"),await gc(r,new ol(void 0));return r._offlineComponents}async function Sa(r){return r._onlineComponents||(r._uninitializedComponentsProvider?(N(In,"Using user provided OnlineComponentProvider"),await _f(r,r._uninitializedComponentsProvider._online)):(N(In,"Using default OnlineComponentProvider"),await _f(r,new yn))),r._onlineComponents}function Kg(r){return cl(r).then((e=>e.persistence))}function cs(r){return cl(r).then((e=>e.localStore))}function Wg(r){return Sa(r).then((e=>e.remoteStore))}function ul(r){return Sa(r).then((e=>e.syncEngine))}function Hg(r){return Sa(r).then((e=>e.datastore))}async function Xr(r){const e=await Sa(r),t=e.eventManager;return t.onListen=HA.bind(null,e.syncEngine),t.onUnlisten=XA.bind(null,e.syncEngine),t.onFirstRemoteStoreListen=QA.bind(null,e.syncEngine),t.onLastRemoteStoreUnlisten=JA.bind(null,e.syncEngine),t}function Ib(r){return r.asyncQueue.enqueue((async()=>{const e=await Kg(r),t=await Wg(r);return e.setNetworkEnabled(!0),(function(s){const i=M(s);return i.Ia.delete(0),ki(i)})(t)}))}function Tb(r){return r.asyncQueue.enqueue((async()=>{const e=await Kg(r),t=await Wg(r);return e.setNetworkEnabled(!1),(async function(s){const i=M(s);i.Ia.add(0),await ss(i),i.Aa.set("Offline")})(t)}))}function Eb(r,e){const t=new Pe;return r.asyncQueue.enqueueAndForget((async()=>(async function(s,i,o){try{const c=await(function(h,f){const p=M(h);return p.persistence.runTransaction("read document","readonly",(m=>p.localDocuments.getDocument(m,f)))})(s,i);c.isFoundDocument()?o.resolve(c):c.isNoDocument()?o.resolve(null):o.reject(new D(R.UNAVAILABLE,"Failed to get document from cache. (However, this document may exist on the server. Run again without setting 'source' in the GetOptions to attempt to retrieve the document from the server.)"))}catch(c){const u=as(c,`Failed to get document '${i} from cache`);o.reject(u)}})(await cs(r),e,t))),t.promise}function Qg(r,e,t={}){const n=new Pe;return r.asyncQueue.enqueueAndForget((async()=>(function(i,o,c,u,h){const f=new Ra({next:m=>{f.Ou(),o.enqueueAndForget((()=>Ju(i,p)));const T=m.docs.has(c);!T&&m.fromCache?h.reject(new D(R.UNAVAILABLE,"Failed to get document because the client is offline.")):T&&m.fromCache&&u&&u.source==="server"?h.reject(new D(R.UNAVAILABLE,'Failed to get document from server. (However, this document does exist in the local cache. Run again without setting source to "server" to retrieve the cached document.)')):h.resolve(m)},error:m=>h.reject(m)}),p=new Zu(ts(c.path),f,{includeMetadataChanges:!0,ka:!0});return Xu(i,p)})(await Xr(r),r.asyncQueue,e,t,n))),n.promise}function vb(r,e){const t=new Pe;return r.asyncQueue.enqueueAndForget((async()=>(async function(s,i,o){try{const c=await Xo(s,i,!0),u=new Bg(i,c.qs),h=u.nu(c.documents),f=u.applyChanges(h,!1);o.resolve(f.snapshot)}catch(c){const u=as(c,`Failed to execute query '${i} against cache`);o.reject(u)}})(await cs(r),e,t))),t.promise}function Xg(r,e,t={}){const n=new Pe;return r.asyncQueue.enqueueAndForget((async()=>(function(i,o,c,u,h){const f=new Ra({next:m=>{f.Ou(),o.enqueueAndForget((()=>Ju(i,p))),m.fromCache&&u.source==="server"?h.reject(new D(R.UNAVAILABLE,'Failed to get documents from server. (However, these documents may exist in the local cache. Run again without setting source to "server" to retrieve the cached documents.)')):h.resolve(m)},error:m=>h.reject(m)}),p=new Zu(c,f,{includeMetadataChanges:!0,ka:!0});return Xu(i,p)})(await Xr(r),r.asyncQueue,e,t,n))),n.promise}function wb(r,e,t){const n=new Pe;return r.asyncQueue.enqueueAndForget((async()=>{try{const s=await Hg(r);n.resolve((async function(o,c,u){var h;const f=M(o),{request:p,ft:m,parent:T}=Jm(f.serializer,Am(c),u);f.connection.Qo||delete p.parent;const P=(await f.Jo("RunAggregationQuery",f.serializer.databaseId,T,p,1)).filter((C=>!!C.result));q(P.length===1,64727);const V=(h=P[0].result)===null||h===void 0?void 0:h.aggregateFields;return Object.keys(V).reduce(((C,L)=>(C[m[L]]=V[L],C)),{})})(s,e,t))}catch(s){n.reject(s)}})),n.promise}function Ab(r,e){const t=new Ra(e);return r.asyncQueue.enqueueAndForget((async()=>(function(s,i){M(s).Da.add(i),i.next()})(await Xr(r),t))),()=>{t.Ou(),r.asyncQueue.enqueueAndForget((async()=>(function(s,i){M(s).Da.delete(i)})(await Xr(r),t)))}}function bb(r,e,t,n){const s=(function(o,c){let u;return u=typeof o=="string"?gu().encode(o):o,(function(f,p){return new pb(f,p)})((function(f,p){if(f instanceof Uint8Array)return gf(f,p);if(f instanceof ArrayBuffer)return gf(new Uint8Array(f),p);if(f instanceof ReadableStream)return f.getReader();throw new Error("Source of `toByteStreamReader` has to be a ArrayBuffer or ReadableStream")})(u),c)})(t,ar(e));r.asyncQueue.enqueueAndForget((async()=>{fb(await ul(r),s,n)}))}function Rb(r,e){return r.asyncQueue.enqueue((async()=>(function(n,s){const i=M(n);return i.persistence.runTransaction("Get named query","readonly",(o=>i.Ti.getNamedQuery(o,s)))})(await cs(r),e)))}function Jg(r,e){return(function(n,s){return new mb(n,s)})(r,e)}function Sb(r,e){return r.asyncQueue.enqueue((async()=>(async function(n,s){const i=M(n),o=i.indexManager,c=[];return i.persistence.runTransaction("Configure indexes","readwrite",(u=>o.getFieldIndexes(u).next((h=>(function(p,m,T,P,V){p=[...p],m=[...m],p.sort(T),m.sort(T);const C=p.length,L=m.length;let U=0,x=0;for(;U<L&&x<C;){const j=T(p[x],m[U]);j<0?V(p[x++]):j>0?P(m[U++]):(U++,x++)}for(;U<L;)P(m[U++]);for(;x<C;)V(p[x++])})(h,s,vv,(f=>{c.push(o.addFieldIndex(u,f))}),(f=>{c.push(o.deleteFieldIndex(u,f))})))).next((()=>A.waitFor(c)))))})(await cs(r),e)))}function Pb(r,e){return r.asyncQueue.enqueue((async()=>(function(n,s){M(n).Cs.Rs=s})(await cs(r),e)))}function Cb(r){return r.asyncQueue.enqueue((async()=>(function(t){const n=M(t),s=n.indexManager;return n.persistence.runTransaction("Delete All Indexes","readwrite",(i=>s.deleteAllFieldIndexes(i)))})(await cs(r))))}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Yg(r){const e={};return r.timeoutSeconds!==void 0&&(e.timeoutSeconds=r.timeoutSeconds),e}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const yf=new Map;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Zg="firestore.googleapis.com",If=!0;class Tf{constructor(e){var t,n;if(e.host===void 0){if(e.ssl!==void 0)throw new D(R.INVALID_ARGUMENT,"Can't provide ssl option if host option is not set");this.host=Zg,this.ssl=If}else this.host=e.host,this.ssl=(t=e.ssl)!==null&&t!==void 0?t:If;if(this.isUsingEmulator=e.emulatorOptions!==void 0,this.credentials=e.credentials,this.ignoreUndefinedProperties=!!e.ignoreUndefinedProperties,this.localCache=e.localCache,e.cacheSizeBytes===void 0)this.cacheSizeBytes=og;else{if(e.cacheSizeBytes!==-1&&e.cacheSizeBytes<lg)throw new D(R.INVALID_ARGUMENT,"cacheSizeBytes must be at least 1048576");this.cacheSizeBytes=e.cacheSizeBytes}Bp("experimentalForceLongPolling",e.experimentalForceLongPolling,"experimentalAutoDetectLongPolling",e.experimentalAutoDetectLongPolling),this.experimentalForceLongPolling=!!e.experimentalForceLongPolling,this.experimentalForceLongPolling?this.experimentalAutoDetectLongPolling=!1:e.experimentalAutoDetectLongPolling===void 0?this.experimentalAutoDetectLongPolling=!0:this.experimentalAutoDetectLongPolling=!!e.experimentalAutoDetectLongPolling,this.experimentalLongPollingOptions=Yg((n=e.experimentalLongPollingOptions)!==null&&n!==void 0?n:{}),(function(i){if(i.timeoutSeconds!==void 0){if(isNaN(i.timeoutSeconds))throw new D(R.INVALID_ARGUMENT,`invalid long polling timeout: ${i.timeoutSeconds} (must not be NaN)`);if(i.timeoutSeconds<5)throw new D(R.INVALID_ARGUMENT,`invalid long polling timeout: ${i.timeoutSeconds} (minimum allowed value is 5)`);if(i.timeoutSeconds>30)throw new D(R.INVALID_ARGUMENT,`invalid long polling timeout: ${i.timeoutSeconds} (maximum allowed value is 30)`)}})(this.experimentalLongPollingOptions),this.useFetchStreams=!!e.useFetchStreams}isEqual(e){return this.host===e.host&&this.ssl===e.ssl&&this.credentials===e.credentials&&this.cacheSizeBytes===e.cacheSizeBytes&&this.experimentalForceLongPolling===e.experimentalForceLongPolling&&this.experimentalAutoDetectLongPolling===e.experimentalAutoDetectLongPolling&&(function(n,s){return n.timeoutSeconds===s.timeoutSeconds})(this.experimentalLongPollingOptions,e.experimentalLongPollingOptions)&&this.ignoreUndefinedProperties===e.ignoreUndefinedProperties&&this.useFetchStreams===e.useFetchStreams}}class Vi{constructor(e,t,n,s){this._authCredentials=e,this._appCheckCredentials=t,this._databaseId=n,this._app=s,this.type="firestore-lite",this._persistenceKey="(lite)",this._settings=new Tf({}),this._settingsFrozen=!1,this._emulatorOptions={},this._terminateTask="notTerminated"}get app(){if(!this._app)throw new D(R.FAILED_PRECONDITION,"Firestore was not initialized using the Firebase SDK. 'app' is not available");return this._app}get _initialized(){return this._settingsFrozen}get _terminated(){return this._terminateTask!=="notTerminated"}_setSettings(e){if(this._settingsFrozen)throw new D(R.FAILED_PRECONDITION,"Firestore has already been started and its settings can no longer be changed. You can only modify settings before calling any other methods on a Firestore object.");this._settings=new Tf(e),this._emulatorOptions=e.emulatorOptions||{},e.credentials!==void 0&&(this._authCredentials=(function(n){if(!n)return new Fp;switch(n.type){case"firstParty":return new gv(n.sessionIndex||"0",n.iamToken||null,n.authTokenFactory||null);case"provider":return n.client;default:throw new D(R.INVALID_ARGUMENT,"makeAuthCredentialsProvider failed due to invalid credential type")}})(e.credentials))}_getSettings(){return this._settings}_getEmulatorOptions(){return this._emulatorOptions}_freezeSettings(){return this._settingsFrozen=!0,this._settings}_delete(){return this._terminateTask==="notTerminated"&&(this._terminateTask=this._terminate()),this._terminateTask}async _restart(){this._terminateTask==="notTerminated"?await this._terminate():this._terminateTask="notTerminated"}toJSON(){return{app:this._app,databaseId:this._databaseId,settings:this._settings}}_terminate(){return(function(t){const n=yf.get(t);n&&(N("ComponentProvider","Removing Datastore"),yf.delete(t),n.terminate())})(this),Promise.resolve()}}function e_(r,e,t,n={}){var s;r=X(r,Vi);const i=Ft(e),o=r._getSettings(),c=Object.assign(Object.assign({},o),{emulatorOptions:r._getEmulatorOptions()}),u=`${e}:${t}`;i&&(ra(`https://${u}`),nu("Firestore",!0)),o.host!==Zg&&o.host!==u&&Be("Host has been set in both settings() and connectFirestoreEmulator(), emulator host will be used.");const h=Object.assign(Object.assign({},o),{host:u,ssl:i,emulatorOptions:n});if(!ht(h,c)&&(r._setSettings(h),n.mockUserToken)){let f,p;if(typeof n.mockUserToken=="string")f=n.mockUserToken,p=Se.MOCK_USER;else{f=jf(n.mockUserToken,(s=r._app)===null||s===void 0?void 0:s.options.projectId);const m=n.mockUserToken.sub||n.mockUserToken.user_id;if(!m)throw new D(R.INVALID_ARGUMENT,"mockUserToken must contain 'sub' or 'user_id' field!");p=new Se(m)}r._authCredentials=new fv(new Lp(f,p))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ae{constructor(e,t,n){this.converter=t,this._query=n,this.type="query",this.firestore=e}withConverter(e){return new Ae(this.firestore,e,this._query)}}class se{constructor(e,t,n){this.converter=t,this._key=n,this.type="document",this.firestore=e}get _path(){return this._key.path}get id(){return this._key.path.lastSegment()}get path(){return this._key.path.canonicalString()}get parent(){return new ut(this.firestore,this.converter,this._key.path.popLast())}withConverter(e){return new se(this.firestore,e,this._key)}toJSON(){return{type:se._jsonSchemaVersion,referencePath:this._key.toString()}}static fromJSON(e,t,n){if(or(t,se._jsonSchema))return new se(e,n||null,new O(Q.fromString(t.referencePath)))}}se._jsonSchemaVersion="firestore/documentReference/1.0",se._jsonSchema={type:ve("string",se._jsonSchemaVersion),referencePath:ve("string")};class ut extends Ae{constructor(e,t,n){super(e,t,ts(n)),this._path=n,this.type="collection"}get id(){return this._query.path.lastSegment()}get path(){return this._query.path.canonicalString()}get parent(){const e=this._path.popLast();return e.isEmpty()?null:new se(this.firestore,null,new O(e))}withConverter(e){return new ut(this.firestore,e,this._path)}}function kb(r,e,...t){if(r=Z(r),_u("collection","path",e),r instanceof Vi){const n=Q.fromString(e,...t);return ad(n),new ut(r,null,n)}{if(!(r instanceof se||r instanceof ut))throw new D(R.INVALID_ARGUMENT,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const n=r._path.child(Q.fromString(e,...t));return ad(n),new ut(r.firestore,null,n)}}function Vb(r,e){if(r=X(r,Vi),_u("collectionGroup","collection id",e),e.indexOf("/")>=0)throw new D(R.INVALID_ARGUMENT,`Invalid collection ID '${e}' passed to function collectionGroup(). Collection IDs must not contain '/'.`);return new Ae(r,null,(function(n){return new qt(Q.emptyPath(),n)})(e))}function t_(r,e,...t){if(r=Z(r),arguments.length===1&&(e=aa.newId()),_u("doc","path",e),r instanceof Vi){const n=Q.fromString(e,...t);return od(n),new se(r,null,new O(n))}{if(!(r instanceof se||r instanceof ut))throw new D(R.INVALID_ARGUMENT,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const n=r._path.child(Q.fromString(e,...t));return od(n),new se(r.firestore,r instanceof ut?r.converter:null,new O(n))}}function Db(r,e){return r=Z(r),e=Z(e),(r instanceof se||r instanceof ut)&&(e instanceof se||e instanceof ut)&&r.firestore===e.firestore&&r.path===e.path&&r.converter===e.converter}function ll(r,e){return r=Z(r),e=Z(e),r instanceof Ae&&e instanceof Ae&&r.firestore===e.firestore&&bi(r._query,e._query)&&r.converter===e.converter}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ef="AsyncQueue";class vf{constructor(e=Promise.resolve()){this.Zu=[],this.Xu=!1,this.ec=[],this.tc=null,this.nc=!1,this.rc=!1,this.sc=[],this.F_=new Gu(this,"async_queue_retry"),this.oc=()=>{const n=Po();n&&N(Ef,"Visibility state changed to "+n.visibilityState),this.F_.y_()},this._c=e;const t=Po();t&&typeof t.addEventListener=="function"&&t.addEventListener("visibilitychange",this.oc)}get isShuttingDown(){return this.Xu}enqueueAndForget(e){this.enqueue(e)}enqueueAndForgetEvenWhileRestricted(e){this.ac(),this.uc(e)}enterRestrictedMode(e){if(!this.Xu){this.Xu=!0,this.rc=e||!1;const t=Po();t&&typeof t.removeEventListener=="function"&&t.removeEventListener("visibilitychange",this.oc)}}enqueue(e){if(this.ac(),this.Xu)return new Promise((()=>{}));const t=new Pe;return this.uc((()=>this.Xu&&this.rc?Promise.resolve():(e().then(t.resolve,t.reject),t.promise))).then((()=>t.promise))}enqueueRetryable(e){this.enqueueAndForget((()=>(this.Zu.push(e),this.cc())))}async cc(){if(this.Zu.length!==0){try{await this.Zu[0](),this.Zu.shift(),this.F_.reset()}catch(e){if(!En(e))throw e;N(Ef,"Operation failed with retryable error: "+e)}this.Zu.length>0&&this.F_.g_((()=>this.cc()))}}uc(e){const t=this._c.then((()=>(this.nc=!0,e().catch((n=>{throw this.tc=n,this.nc=!1,Ie("INTERNAL UNHANDLED ERROR: ",wf(n)),n})).then((n=>(this.nc=!1,n))))));return this._c=t,t}enqueueAfterDelay(e,t,n){this.ac(),this.sc.indexOf(e)>-1&&(t=0);const s=Qu.createAndSchedule(this,e,t,n,(i=>this.lc(i)));return this.ec.push(s),s}ac(){this.tc&&B(47125,{hc:wf(this.tc)})}verifyOperationInProgress(){}async Pc(){let e;do e=this._c,await e;while(e!==this._c)}Tc(e){for(const t of this.ec)if(t.timerId===e)return!0;return!1}Ic(e){return this.Pc().then((()=>{this.ec.sort(((t,n)=>t.targetTimeMs-n.targetTimeMs));for(const t of this.ec)if(t.skipDelay(),e!=="all"&&t.timerId===e)break;return this.Pc()}))}dc(e){this.sc.push(e)}lc(e){const t=this.ec.indexOf(e);this.ec.splice(t,1)}}function wf(r){let e=r.message||"";return r.stack&&(e=r.stack.includes(r.message)?r.stack:r.message+`
`+r.stack),e}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function kr(r){return(function(t,n){if(typeof t!="object"||t===null)return!1;const s=t;for(const i of n)if(i in s&&typeof s[i]=="function")return!0;return!1})(r,["next","error","complete"])}class n_{constructor(){this._progressObserver={},this._taskCompletionResolver=new Pe,this._lastProgress={taskState:"Running",totalBytes:0,totalDocuments:0,bytesLoaded:0,documentsLoaded:0}}onProgress(e,t,n){this._progressObserver={next:e,error:t,complete:n}}catch(e){return this._taskCompletionResolver.promise.catch(e)}then(e,t){return this._taskCompletionResolver.promise.then(e,t)}_completeWith(e){this._updateProgress(e),this._progressObserver.complete&&this._progressObserver.complete(),this._taskCompletionResolver.resolve(e)}_failWith(e){this._lastProgress.taskState="Error",this._progressObserver.next&&this._progressObserver.next(this._lastProgress),this._progressObserver.error&&this._progressObserver.error(e),this._taskCompletionResolver.reject(e)}_updateProgress(e){this._lastProgress=e,this._progressObserver.next&&this._progressObserver.next(e)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Nb=-1;class oe extends Vi{constructor(e,t,n,s){super(e,t,n,s),this.type="firestore",this._queue=new vf,this._persistenceKey=(s==null?void 0:s.name)||"[DEFAULT]"}async _terminate(){if(this._firestoreClient){const e=this._firestoreClient.terminate();this._queue=new vf(e),this._firestoreClient=void 0,await e}}}function xb(r,e,t){t||(t=ci);const n=Yr(r,"firestore");if(n.isInitialized(t)){const s=n.getImmediate({identifier:t}),i=n.getOptions(t);if(ht(i,e))return s;throw new D(R.FAILED_PRECONDITION,"initializeFirestore() has already been called with different options. To avoid this error, call initializeFirestore() with the same options as when it was originally called, or call getFirestore() to return the already initialized instance.")}if(e.cacheSizeBytes!==void 0&&e.localCache!==void 0)throw new D(R.INVALID_ARGUMENT,"cache and cacheSizeBytes cannot be specified at the same time as cacheSizeBytes willbe deprecated. Instead, specify the cache size in the cache object");if(e.cacheSizeBytes!==void 0&&e.cacheSizeBytes!==-1&&e.cacheSizeBytes<lg)throw new D(R.INVALID_ARGUMENT,"cacheSizeBytes must be at least 1048576");return e.host&&Ft(e.host)&&ra(e.host),n.initialize({options:e,instanceIdentifier:t})}function Ob(r,e){const t=typeof r=="object"?r:su(),n=typeof r=="string"?r:e||ci,s=Yr(t,"firestore").getImmediate({identifier:n});if(!s._initialized){const i=Uf("firestore");i&&e_(s,...i)}return s}function me(r){if(r._terminated)throw new D(R.FAILED_PRECONDITION,"The client has already been terminated.");return r._firestoreClient||r_(r),r._firestoreClient}function r_(r){var e,t,n;const s=r._freezeSettings(),i=(function(c,u,h,f){return new nw(c,u,h,f.host,f.ssl,f.experimentalForceLongPolling,f.experimentalAutoDetectLongPolling,Yg(f.experimentalLongPollingOptions),f.useFetchStreams,f.isUsingEmulator)})(r._databaseId,((e=r._app)===null||e===void 0?void 0:e.options.appId)||"",r._persistenceKey,s);r._componentsProvider||!((t=s.localCache)===null||t===void 0)&&t._offlineComponentProvider&&(!((n=s.localCache)===null||n===void 0)&&n._onlineComponentProvider)&&(r._componentsProvider={_offline:s.localCache._offlineComponentProvider,_online:s.localCache._onlineComponentProvider}),r._firestoreClient=new yb(r._authCredentials,r._appCheckCredentials,r._queue,i,r._componentsProvider&&(function(c){const u=c==null?void 0:c._online.build();return{_offline:c==null?void 0:c._offline.build(u),_online:u}})(r._componentsProvider))}function Mb(r,e){Be("enableIndexedDbPersistence() will be deprecated in the future, you can use `FirestoreSettings.cache` instead.");const t=r._freezeSettings();return s_(r,yn.provider,{build:n=>new al(n,t.cacheSizeBytes,e==null?void 0:e.forceOwnership)}),Promise.resolve()}async function Lb(r){Be("enableMultiTabIndexedDbPersistence() will be deprecated in the future, you can use `FirestoreSettings.cache` instead.");const e=r._freezeSettings();s_(r,yn.provider,{build:t=>new Gg(t,e.cacheSizeBytes)})}function s_(r,e,t){if((r=X(r,oe))._firestoreClient||r._terminated)throw new D(R.FAILED_PRECONDITION,"Firestore has already been started and persistence can no longer be enabled. You can only enable persistence before calling any other methods on a Firestore object.");if(r._componentsProvider||r._getSettings().localCache)throw new D(R.FAILED_PRECONDITION,"SDK cache is already specified.");r._componentsProvider={_online:e,_offline:t},r_(r)}function Fb(r){if(r._initialized&&!r._terminated)throw new D(R.FAILED_PRECONDITION,"Persistence can only be cleared before a Firestore instance is initialized or after it is terminated.");const e=new Pe;return r._queue.enqueueAndForgetEvenWhileRestricted((async()=>{try{await(async function(n){if(!It.C())return Promise.resolve();const s=n+gg;await It.delete(s)})(qu(r._databaseId,r._persistenceKey)),e.resolve()}catch(t){e.reject(t)}})),e.promise}function Ub(r){return(function(t){const n=new Pe;return t.asyncQueue.enqueueAndForget((async()=>nb(await ul(t),n))),n.promise})(me(r=X(r,oe)))}function Bb(r){return Ib(me(r=X(r,oe)))}function qb(r){return Tb(me(r=X(r,oe)))}function jb(r){return FI(r.app,"firestore",r._databaseId.database),r._delete()}function Yc(r,e){const t=me(r=X(r,oe)),n=new n_;return bb(t,r._databaseId,e,n),n}function i_(r,e){return Rb(me(r=X(r,oe)),e).then((t=>t?new Ae(r,null,t.query):null))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Jr{constructor(e="count",t){this._internalFieldPath=t,this.type="AggregateField",this.aggregateType=e}}class o_{constructor(e,t,n){this._userDataWriter=t,this._data=n,this.type="AggregateQuerySnapshot",this.query=e}data(){return this._userDataWriter.convertObjectMap(this._data)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ke{constructor(e){this._byteString=e}static fromBase64String(e){try{return new Ke(ge.fromBase64String(e))}catch(t){throw new D(R.INVALID_ARGUMENT,"Failed to construct data from Base64 string: "+t)}}static fromUint8Array(e){return new Ke(ge.fromUint8Array(e))}toBase64(){return this._byteString.toBase64()}toUint8Array(){return this._byteString.toUint8Array()}toString(){return"Bytes(base64: "+this.toBase64()+")"}isEqual(e){return this._byteString.isEqual(e._byteString)}toJSON(){return{type:Ke._jsonSchemaVersion,bytes:this.toBase64()}}static fromJSON(e){if(or(e,Ke._jsonSchema))return Ke.fromBase64String(e.bytes)}}Ke._jsonSchemaVersion="firestore/bytes/1.0",Ke._jsonSchema={type:ve("string",Ke._jsonSchemaVersion),bytes:ve("string")};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class bn{constructor(...e){for(let t=0;t<e.length;++t)if(e[t].length===0)throw new D(R.INVALID_ARGUMENT,"Invalid field name at argument $(i + 1). Field names must not be empty.");this._internalPath=new he(e)}isEqual(e){return this._internalPath.isEqual(e._internalPath)}}function zb(){return new bn(Pc)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Rn{constructor(e){this._methodName=e}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class lt{constructor(e,t){if(!isFinite(e)||e<-90||e>90)throw new D(R.INVALID_ARGUMENT,"Latitude must be a number between -90 and 90, but was: "+e);if(!isFinite(t)||t<-180||t>180)throw new D(R.INVALID_ARGUMENT,"Longitude must be a number between -180 and 180, but was: "+t);this._lat=e,this._long=t}get latitude(){return this._lat}get longitude(){return this._long}isEqual(e){return this._lat===e._lat&&this._long===e._long}_compareTo(e){return G(this._lat,e._lat)||G(this._long,e._long)}toJSON(){return{latitude:this._lat,longitude:this._long,type:lt._jsonSchemaVersion}}static fromJSON(e){if(or(e,lt._jsonSchema))return new lt(e.latitude,e.longitude)}}lt._jsonSchemaVersion="firestore/geoPoint/1.0",lt._jsonSchema={type:ve("string",lt._jsonSchemaVersion),latitude:ve("number"),longitude:ve("number")};/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class nt{constructor(e){this._values=(e||[]).map((t=>t))}toArray(){return this._values.map((e=>e))}isEqual(e){return(function(n,s){if(n.length!==s.length)return!1;for(let i=0;i<n.length;++i)if(n[i]!==s[i])return!1;return!0})(this._values,e._values)}toJSON(){return{type:nt._jsonSchemaVersion,vectorValues:this._values}}static fromJSON(e){if(or(e,nt._jsonSchema)){if(Array.isArray(e.vectorValues)&&e.vectorValues.every((t=>typeof t=="number")))return new nt(e.vectorValues);throw new D(R.INVALID_ARGUMENT,"Expected 'vectorValues' field to be a number array")}}}nt._jsonSchemaVersion="firestore/vectorValue/1.0",nt._jsonSchema={type:ve("string",nt._jsonSchemaVersion),vectorValues:ve("object")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const $b=/^__.*__$/;class Gb{constructor(e,t,n){this.data=e,this.fieldMask=t,this.fieldTransforms=n}toMutation(e,t){return this.fieldMask!==null?new zt(e,this.data,this.fieldMask,t,this.fieldTransforms):new ns(e,this.data,t,this.fieldTransforms)}}class a_{constructor(e,t,n){this.data=e,this.fieldMask=t,this.fieldTransforms=n}toMutation(e,t){return new zt(e,this.data,this.fieldMask,t,this.fieldTransforms)}}function c_(r){switch(r){case 0:case 2:case 1:return!0;case 3:case 4:return!1;default:throw B(40011,{Ec:r})}}class Pa{constructor(e,t,n,s,i,o){this.settings=e,this.databaseId=t,this.serializer=n,this.ignoreUndefinedProperties=s,i===void 0&&this.Ac(),this.fieldTransforms=i||[],this.fieldMask=o||[]}get path(){return this.settings.path}get Ec(){return this.settings.Ec}Rc(e){return new Pa(Object.assign(Object.assign({},this.settings),e),this.databaseId,this.serializer,this.ignoreUndefinedProperties,this.fieldTransforms,this.fieldMask)}Vc(e){var t;const n=(t=this.path)===null||t===void 0?void 0:t.child(e),s=this.Rc({path:n,mc:!1});return s.fc(e),s}gc(e){var t;const n=(t=this.path)===null||t===void 0?void 0:t.child(e),s=this.Rc({path:n,mc:!1});return s.Ac(),s}yc(e){return this.Rc({path:void 0,mc:!0})}wc(e){return ea(e,this.settings.methodName,this.settings.Sc||!1,this.path,this.settings.bc)}contains(e){return this.fieldMask.find((t=>e.isPrefixOf(t)))!==void 0||this.fieldTransforms.find((t=>e.isPrefixOf(t.field)))!==void 0}Ac(){if(this.path)for(let e=0;e<this.path.length;e++)this.fc(this.path.get(e))}fc(e){if(e.length===0)throw this.wc("Document fields must not be empty");if(c_(this.Ec)&&$b.test(e))throw this.wc('Document fields cannot begin and end with "__"')}}class Kb{constructor(e,t,n){this.databaseId=e,this.ignoreUndefinedProperties=t,this.serializer=n||ar(e)}Dc(e,t,n,s=!1){return new Pa({Ec:e,methodName:t,bc:n,path:he.emptyPath(),mc:!1,Sc:s},this.databaseId,this.serializer,this.ignoreUndefinedProperties)}}function cr(r){const e=r._freezeSettings(),t=ar(r._databaseId);return new Kb(r._databaseId,!!e.ignoreUndefinedProperties,t)}function Ca(r,e,t,n,s,i={}){const o=r.Dc(i.merge||i.mergeFields?2:0,e,t,s);_l("Data must be an object, but it was:",o,n);const c=h_(n,o);let u,h;if(i.merge)u=new He(o.fieldMask),h=o.fieldTransforms;else if(i.mergeFields){const f=[];for(const p of i.mergeFields){const m=pi(e,p,t);if(!o.contains(m))throw new D(R.INVALID_ARGUMENT,`Field '${m}' is specified in your field mask but missing from your input data.`);f_(f,m)||f.push(m)}u=new He(f),h=o.fieldTransforms.filter((p=>u.covers(p.field)))}else u=null,h=o.fieldTransforms;return new Gb(new Ve(c),u,h)}class Di extends Rn{_toFieldTransform(e){if(e.Ec!==2)throw e.Ec===1?e.wc(`${this._methodName}() can only appear at the top level of your update data`):e.wc(`${this._methodName}() cannot be used with set() unless you pass {merge:true}`);return e.fieldMask.push(e.path),null}isEqual(e){return e instanceof Di}}function u_(r,e,t){return new Pa({Ec:3,bc:e.settings.bc,methodName:r._methodName,mc:t},e.databaseId,e.serializer,e.ignoreUndefinedProperties)}class hl extends Rn{_toFieldTransform(e){return new Si(e.path,new jr)}isEqual(e){return e instanceof hl}}class dl extends Rn{constructor(e,t){super(e),this.vc=t}_toFieldTransform(e){const t=u_(this,e,!0),n=this.vc.map((i=>ur(i,t))),s=new Jn(n);return new Si(e.path,s)}isEqual(e){return e instanceof dl&&ht(this.vc,e.vc)}}class fl extends Rn{constructor(e,t){super(e),this.vc=t}_toFieldTransform(e){const t=u_(this,e,!0),n=this.vc.map((i=>ur(i,t))),s=new Yn(n);return new Si(e.path,s)}isEqual(e){return e instanceof fl&&ht(this.vc,e.vc)}}class pl extends Rn{constructor(e,t){super(e),this.Cc=t}_toFieldTransform(e){const t=new zr(e.serializer,Nm(e.serializer,this.Cc));return new Si(e.path,t)}isEqual(e){return e instanceof pl&&this.Cc===e.Cc}}function ml(r,e,t,n){const s=r.Dc(1,e,t);_l("Data must be an object, but it was:",s,n);const i=[],o=Ve.empty();vn(n,((u,h)=>{const f=ka(e,u,t);h=Z(h);const p=s.gc(f);if(h instanceof Di)i.push(f);else{const m=ur(h,p);m!=null&&(i.push(f),o.set(f,m))}}));const c=new He(i);return new a_(o,c,s.fieldTransforms)}function gl(r,e,t,n,s,i){const o=r.Dc(1,e,t),c=[pi(e,n,t)],u=[s];if(i.length%2!=0)throw new D(R.INVALID_ARGUMENT,`Function ${e}() needs to be called with an even number of arguments that alternate between field names and values.`);for(let m=0;m<i.length;m+=2)c.push(pi(e,i[m])),u.push(i[m+1]);const h=[],f=Ve.empty();for(let m=c.length-1;m>=0;--m)if(!f_(h,c[m])){const T=c[m];let P=u[m];P=Z(P);const V=o.gc(T);if(P instanceof Di)h.push(T);else{const C=ur(P,V);C!=null&&(h.push(T),f.set(T,C))}}const p=new He(h);return new a_(f,p,o.fieldTransforms)}function l_(r,e,t,n=!1){return ur(t,r.Dc(n?4:3,e))}function ur(r,e){if(d_(r=Z(r)))return _l("Unsupported field value:",e,r),h_(r,e);if(r instanceof Rn)return(function(n,s){if(!c_(s.Ec))throw s.wc(`${n._methodName}() can only be used with update() and set()`);if(!s.path)throw s.wc(`${n._methodName}() is not currently supported inside arrays`);const i=n._toFieldTransform(s);i&&s.fieldTransforms.push(i)})(r,e),null;if(r===void 0&&e.ignoreUndefinedProperties)return null;if(e.path&&e.fieldMask.push(e.path),r instanceof Array){if(e.settings.mc&&e.Ec!==4)throw e.wc("Nested arrays are not supported");return(function(n,s){const i=[];let o=0;for(const c of n){let u=ur(c,s.yc(o));u==null&&(u={nullValue:"NULL_VALUE"}),i.push(u),o++}return{arrayValue:{values:i}}})(r,e)}return(function(n,s){if((n=Z(n))===null)return{nullValue:"NULL_VALUE"};if(typeof n=="number")return Nm(s.serializer,n);if(typeof n=="boolean")return{booleanValue:n};if(typeof n=="string")return{stringValue:n};if(n instanceof Date){const i=ne.fromDate(n);return{timestampValue:$r(s.serializer,i)}}if(n instanceof ne){const i=new ne(n.seconds,1e3*Math.floor(n.nanoseconds/1e3));return{timestampValue:$r(s.serializer,i)}}if(n instanceof lt)return{geoPointValue:{latitude:n.latitude,longitude:n.longitude}};if(n instanceof Ke)return{bytesValue:Gm(s.serializer,n._byteString)};if(n instanceof se){const i=s.databaseId,o=n.firestore._databaseId;if(!o.isEqual(i))throw s.wc(`Document reference is for database ${o.projectId}/${o.database} but should be for database ${i.projectId}/${i.database}`);return{referenceValue:Ou(n.firestore._databaseId||s.databaseId,n._key.path)}}if(n instanceof nt)return(function(o,c){return{mapValue:{fields:{[Au]:{stringValue:bu},[Ur]:{arrayValue:{values:o.toArray().map((h=>{if(typeof h!="number")throw c.wc("VectorValues must only contain numeric values.");return Cu(c.serializer,h)}))}}}}}})(n,s);throw s.wc(`Unsupported field value: ${ca(n)}`)})(r,e)}function h_(r,e){const t={};return om(r)?e.path&&e.path.length>0&&e.fieldMask.push(e.path):vn(r,((n,s)=>{const i=ur(s,e.Vc(n));i!=null&&(t[n]=i)})),{mapValue:{fields:t}}}function d_(r){return!(typeof r!="object"||r===null||r instanceof Array||r instanceof Date||r instanceof ne||r instanceof lt||r instanceof Ke||r instanceof se||r instanceof Rn||r instanceof nt)}function _l(r,e,t){if(!d_(t)||!qp(t)){const n=ca(t);throw n==="an object"?e.wc(r+" a custom object"):e.wc(r+" "+n)}}function pi(r,e,t){if((e=Z(e))instanceof bn)return e._internalPath;if(typeof e=="string")return ka(r,e);throw ea("Field path arguments must be of type string or ",r,!1,void 0,t)}const Wb=new RegExp("[~\\*/\\[\\]]");function ka(r,e,t){if(e.search(Wb)>=0)throw ea(`Invalid field path (${e}). Paths must not contain '~', '*', '/', '[', or ']'`,r,!1,void 0,t);try{return new bn(...e.split("."))._internalPath}catch{throw ea(`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`,r,!1,void 0,t)}}function ea(r,e,t,n,s){const i=n&&!n.isEmpty(),o=s!==void 0;let c=`Function ${e}() called with invalid data`;t&&(c+=" (via `toFirestore()`)"),c+=". ";let u="";return(i||o)&&(u+=" (found",i&&(u+=` in field ${n}`),o&&(u+=` in document ${s}`),u+=")"),new D(R.INVALID_ARGUMENT,c+r+u)}function f_(r,e){return r.some((t=>t.isEqual(e)))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class mi{constructor(e,t,n,s,i){this._firestore=e,this._userDataWriter=t,this._key=n,this._document=s,this._converter=i}get id(){return this._key.path.lastSegment()}get ref(){return new se(this._firestore,this._converter,this._key)}exists(){return this._document!==null}data(){if(this._document){if(this._converter){const e=new Hb(this._firestore,this._userDataWriter,this._key,this._document,null);return this._converter.fromFirestore(e)}return this._userDataWriter.convertValue(this._document.data.value)}}get(e){if(this._document){const t=this._document.data.field(Va("DocumentSnapshot.get",e));if(t!==null)return this._userDataWriter.convertValue(t)}}}class Hb extends mi{data(){return super.data()}}function Va(r,e){return typeof e=="string"?ka(r,e):e instanceof bn?e._internalPath:e._delegate._internalPath}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function p_(r){if(r.limitType==="L"&&r.explicitOrderBy.length===0)throw new D(R.UNIMPLEMENTED,"limitToLast() queries require specifying at least one orderBy() clause")}class yl{}class us extends yl{}function Qb(r,e,...t){let n=[];e instanceof yl&&n.push(e),n=n.concat(t),(function(i){const o=i.filter((u=>u instanceof lr)).length,c=i.filter((u=>u instanceof ls)).length;if(o>1||o>0&&c>0)throw new D(R.INVALID_ARGUMENT,"InvalidQuery. When using composite filters, you cannot use more than one filter at the top level. Consider nesting the multiple filters within an `and(...)` statement. For example: change `query(query, where(...), or(...))` to `query(query, and(where(...), or(...)))`.")})(n);for(const s of n)r=s._apply(r);return r}class ls extends us{constructor(e,t,n){super(),this._field=e,this._op=t,this._value=n,this.type="where"}static _create(e,t,n){return new ls(e,t,n)}_apply(e){const t=this._parse(e);return g_(e._query,t),new Ae(e.firestore,e.converter,Uc(e._query,t))}_parse(e){const t=cr(e.firestore);return(function(i,o,c,u,h,f,p){let m;if(h.isKeyField()){if(f==="array-contains"||f==="array-contains-any")throw new D(R.INVALID_ARGUMENT,`Invalid Query. You can't perform '${f}' queries on documentId().`);if(f==="in"||f==="not-in"){bf(p,f);const P=[];for(const V of p)P.push(Af(u,i,V));m={arrayValue:{values:P}}}else m=Af(u,i,p)}else f!=="in"&&f!=="not-in"&&f!=="array-contains-any"||bf(p,f),m=l_(c,o,p,f==="in"||f==="not-in");return Y.create(h,f,m)})(e._query,"where",t,e.firestore._databaseId,this._field,this._op,this._value)}}function Xb(r,e,t){const n=e,s=Va("where",r);return ls._create(s,n,t)}class lr extends yl{constructor(e,t){super(),this.type=e,this._queryConstraints=t}static _create(e,t){return new lr(e,t)}_parse(e){const t=this._queryConstraints.map((n=>n._parse(e))).filter((n=>n.getFilters().length>0));return t.length===1?t[0]:re.create(t,this._getOperator())}_apply(e){const t=this._parse(e);return t.getFilters().length===0?e:((function(s,i){let o=s;const c=i.getFlattenedFilters();for(const u of c)g_(o,u),o=Uc(o,u)})(e._query,t),new Ae(e.firestore,e.converter,Uc(e._query,t)))}_getQueryConstraints(){return this._queryConstraints}_getOperator(){return this.type==="and"?"and":"or"}}function Jb(...r){return r.forEach((e=>__("or",e))),lr._create("or",r)}function Yb(...r){return r.forEach((e=>__("and",e))),lr._create("and",r)}class Da extends us{constructor(e,t){super(),this._field=e,this._direction=t,this.type="orderBy"}static _create(e,t){return new Da(e,t)}_apply(e){const t=(function(s,i,o){if(s.startAt!==null)throw new D(R.INVALID_ARGUMENT,"Invalid query. You must not call startAt() or startAfter() before calling orderBy().");if(s.endAt!==null)throw new D(R.INVALID_ARGUMENT,"Invalid query. You must not call endAt() or endBefore() before calling orderBy().");return new hi(i,o)})(e._query,this._field,this._direction);return new Ae(e.firestore,e.converter,(function(s,i){const o=s.explicitOrderBy.concat([i]);return new qt(s.path,s.collectionGroup,o,s.filters.slice(),s.limit,s.limitType,s.startAt,s.endAt)})(e._query,t))}}function Zb(r,e="asc"){const t=e,n=Va("orderBy",r);return Da._create(n,t)}class Ni extends us{constructor(e,t,n){super(),this.type=e,this._limit=t,this._limitType=n}static _create(e,t,n){return new Ni(e,t,n)}_apply(e){return new Ae(e.firestore,e.converter,$o(e._query,this._limit,this._limitType))}}function eR(r){return jp("limit",r),Ni._create("limit",r,"F")}function tR(r){return jp("limitToLast",r),Ni._create("limitToLast",r,"L")}class xi extends us{constructor(e,t,n){super(),this.type=e,this._docOrFields=t,this._inclusive=n}static _create(e,t,n){return new xi(e,t,n)}_apply(e){const t=m_(e,this.type,this._docOrFields,this._inclusive);return new Ae(e.firestore,e.converter,(function(s,i){return new qt(s.path,s.collectionGroup,s.explicitOrderBy.slice(),s.filters.slice(),s.limit,s.limitType,i,s.endAt)})(e._query,t))}}function nR(...r){return xi._create("startAt",r,!0)}function rR(...r){return xi._create("startAfter",r,!1)}class Oi extends us{constructor(e,t,n){super(),this.type=e,this._docOrFields=t,this._inclusive=n}static _create(e,t,n){return new Oi(e,t,n)}_apply(e){const t=m_(e,this.type,this._docOrFields,this._inclusive);return new Ae(e.firestore,e.converter,(function(s,i){return new qt(s.path,s.collectionGroup,s.explicitOrderBy.slice(),s.filters.slice(),s.limit,s.limitType,s.startAt,i)})(e._query,t))}}function sR(...r){return Oi._create("endBefore",r,!1)}function iR(...r){return Oi._create("endAt",r,!0)}function m_(r,e,t,n){if(t[0]=Z(t[0]),t[0]instanceof mi)return(function(i,o,c,u,h){if(!u)throw new D(R.NOT_FOUND,`Can't use a DocumentSnapshot that doesn't exist for ${c}().`);const f=[];for(const p of Cr(i))if(p.field.isKeyField())f.push(Qn(o,u.key));else{const m=u.data.field(p.field);if(fa(m))throw new D(R.INVALID_ARGUMENT,'Invalid query. You are trying to start or end a query using a document for which the field "'+p.field+'" is an uncommitted server timestamp. (Since the value of this field is unknown, you cannot start/end a query with it.)');if(m===null){const T=p.field.canonicalString();throw new D(R.INVALID_ARGUMENT,`Invalid query. You are trying to start or end a query using a document for which the field '${T}' (used as the orderBy) does not exist.`)}f.push(m)}return new gn(f,h)})(r._query,r.firestore._databaseId,e,t[0]._document,n);{const s=cr(r.firestore);return(function(o,c,u,h,f,p){const m=o.explicitOrderBy;if(f.length>m.length)throw new D(R.INVALID_ARGUMENT,`Too many arguments provided to ${h}(). The number of arguments must be less than or equal to the number of orderBy() clauses`);const T=[];for(let P=0;P<f.length;P++){const V=f[P];if(m[P].field.isKeyField()){if(typeof V!="string")throw new D(R.INVALID_ARGUMENT,`Invalid query. Expected a string for document ID in ${h}(), but got a ${typeof V}`);if(!Su(o)&&V.indexOf("/")!==-1)throw new D(R.INVALID_ARGUMENT,`Invalid query. When querying a collection and ordering by documentId(), the value passed to ${h}() must be a plain document ID, but '${V}' contains a slash.`);const C=o.path.child(Q.fromString(V));if(!O.isDocumentKey(C))throw new D(R.INVALID_ARGUMENT,`Invalid query. When querying a collection group and ordering by documentId(), the value passed to ${h}() must result in a valid document path, but '${C}' is not because it contains an odd number of segments.`);const L=new O(C);T.push(Qn(c,L))}else{const C=l_(u,h,V);T.push(C)}}return new gn(T,p)})(r._query,r.firestore._databaseId,s,e,t,n)}}function Af(r,e,t){if(typeof(t=Z(t))=="string"){if(t==="")throw new D(R.INVALID_ARGUMENT,"Invalid query. When querying with documentId(), you must provide a valid document ID, but it was an empty string.");if(!Su(e)&&t.indexOf("/")!==-1)throw new D(R.INVALID_ARGUMENT,`Invalid query. When querying a collection by documentId(), you must provide a plain document ID, but '${t}' contains a '/' character.`);const n=e.path.child(Q.fromString(t));if(!O.isDocumentKey(n))throw new D(R.INVALID_ARGUMENT,`Invalid query. When querying a collection group by documentId(), the value provided must result in a valid document path, but '${n}' is not because it has an odd number of segments (${n.length}).`);return Qn(r,new O(n))}if(t instanceof se)return Qn(r,t._key);throw new D(R.INVALID_ARGUMENT,`Invalid query. When querying with documentId(), you must provide a valid string or a DocumentReference, but it was: ${ca(t)}.`)}function bf(r,e){if(!Array.isArray(r)||r.length===0)throw new D(R.INVALID_ARGUMENT,`Invalid Query. A non-empty array is required for '${e.toString()}' filters.`)}function g_(r,e){const t=(function(s,i){for(const o of s)for(const c of o.getFlattenedFilters())if(i.indexOf(c.op)>=0)return c.op;return null})(r.filters,(function(s){switch(s){case"!=":return["!=","not-in"];case"array-contains-any":case"in":return["not-in"];case"not-in":return["array-contains-any","in","not-in","!="];default:return[]}})(e.op));if(t!==null)throw t===e.op?new D(R.INVALID_ARGUMENT,`Invalid query. You cannot use more than one '${e.op.toString()}' filter.`):new D(R.INVALID_ARGUMENT,`Invalid query. You cannot use '${e.op.toString()}' filters with '${t.toString()}' filters.`)}function __(r,e){if(!(e instanceof ls||e instanceof lr))throw new D(R.INVALID_ARGUMENT,`Function ${r}() requires AppliableConstraints created with a call to 'where(...)', 'or(...)', or 'and(...)'.`)}class Il{convertValue(e,t="none"){switch(pn(e)){case 0:return null;case 1:return e.booleanValue;case 2:return fe(e.integerValue||e.doubleValue);case 3:return this.convertTimestamp(e.timestampValue);case 4:return this.convertServerTimestamp(e,t);case 5:return e.stringValue;case 6:return this.convertBytes(Lt(e.bytesValue));case 7:return this.convertReference(e.referenceValue);case 8:return this.convertGeoPoint(e.geoPointValue);case 9:return this.convertArray(e.arrayValue,t);case 11:return this.convertObject(e.mapValue,t);case 10:return this.convertVectorValue(e.mapValue);default:throw B(62114,{value:e})}}convertObject(e,t){return this.convertObjectMap(e.fields,t)}convertObjectMap(e,t="none"){const n={};return vn(e,((s,i)=>{n[s]=this.convertValue(i,t)})),n}convertVectorValue(e){var t,n,s;const i=(s=(n=(t=e.fields)===null||t===void 0?void 0:t[Ur].arrayValue)===null||n===void 0?void 0:n.values)===null||s===void 0?void 0:s.map((o=>fe(o.doubleValue)));return new nt(i)}convertGeoPoint(e){return new lt(fe(e.latitude),fe(e.longitude))}convertArray(e,t){return(e.values||[]).map((n=>this.convertValue(n,t)))}convertServerTimestamp(e,t){switch(t){case"previous":const n=pa(e);return n==null?null:this.convertValue(n,t);case"estimate":return this.convertTimestamp(ai(e));default:return null}}convertTimestamp(e){const t=Mt(e);return new ne(t.seconds,t.nanos)}convertDocumentKey(e,t){const n=Q.fromString(e);q(tg(n),9688,{name:e});const s=new fn(n.get(1),n.get(3)),i=new O(n.popFirst(5));return s.isEqual(t)||Ie(`Document ${i} contains a document reference within a different database (${s.projectId}/${s.database}) which is not supported. It will be treated as a reference in the current database (${t.projectId}/${t.database}) instead.`),i}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Na(r,e,t){let n;return n=r?t&&(t.merge||t.mergeFields)?r.toFirestore(e,t):r.toFirestore(e):e,n}class Tl extends Il{constructor(e){super(),this.firestore=e}convertBytes(e){return new Ke(e)}convertReference(e){const t=this.convertDocumentKey(e,this.firestore._databaseId);return new se(this.firestore,null,t)}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function oR(r){return new Jr("sum",pi("sum",r))}function aR(r){return new Jr("avg",pi("average",r))}function y_(){return new Jr("count")}function cR(r,e){var t,n;return r instanceof Jr&&e instanceof Jr&&r.aggregateType===e.aggregateType&&((t=r._internalFieldPath)===null||t===void 0?void 0:t.canonicalString())===((n=e._internalFieldPath)===null||n===void 0?void 0:n.canonicalString())}function uR(r,e){return ll(r.query,e.query)&&ht(r.data(),e.data())}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const I_="NOT SUPPORTED";class Vt{constructor(e,t){this.hasPendingWrites=e,this.fromCache=t}isEqual(e){return this.hasPendingWrites===e.hasPendingWrites&&this.fromCache===e.fromCache}}class Xe extends mi{constructor(e,t,n,s,i,o){super(e,t,n,s,o),this._firestore=e,this._firestoreImpl=e,this.metadata=i}exists(){return super.exists()}data(e={}){if(this._document){if(this._converter){const t=new Ys(this._firestore,this._userDataWriter,this._key,this._document,this.metadata,null);return this._converter.fromFirestore(t,e)}return this._userDataWriter.convertValue(this._document.data.value,e.serverTimestamps)}}get(e,t={}){if(this._document){const n=this._document.data.field(Va("DocumentSnapshot.get",e));if(n!==null)return this._userDataWriter.convertValue(n,t.serverTimestamps)}}toJSON(){if(this.metadata.hasPendingWrites)throw new D(R.FAILED_PRECONDITION,"DocumentSnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");const e=this._document,t={};return t.type=Xe._jsonSchemaVersion,t.bundle="",t.bundleSource="DocumentSnapshot",t.bundleName=this._key.toString(),!e||!e.isValidDocument()||!e.isFoundDocument()?t:(this._userDataWriter.convertObjectMap(e.data.value.mapValue.fields,"previous"),t.bundle=(this._firestore,this.ref.path,"NOT SUPPORTED"),t)}}function lR(r,e,t){if(or(e,Xe._jsonSchema)){if(e.bundle===I_)throw new D(R.INVALID_ARGUMENT,"The provided JSON object was created in a client environment, which is not supported.");const n=ar(r._databaseId),s=Jg(e.bundle,n),i=s.Ku(),o=new el(s.getMetadata(),n);for(const f of i)o.Wa(f);const c=o.documents;if(c.length!==1)throw new D(R.INVALID_ARGUMENT,`Expected bundle data to contain 1 document, but it contains ${c.length} documents.`);const u=ya(n,c[0].document),h=new O(Q.fromString(e.bundleName));return new Xe(r,new Tl(r),h,u,new Vt(!1,!1),t||null)}}Xe._jsonSchemaVersion="firestore/documentSnapshot/1.0",Xe._jsonSchema={type:ve("string",Xe._jsonSchemaVersion),bundleSource:ve("string","DocumentSnapshot"),bundleName:ve("string"),bundle:ve("string")};class Ys extends Xe{data(e={}){return super.data(e)}}class Je{constructor(e,t,n,s){this._firestore=e,this._userDataWriter=t,this._snapshot=s,this.metadata=new Vt(s.hasPendingWrites,s.fromCache),this.query=n}get docs(){const e=[];return this.forEach((t=>e.push(t))),e}get size(){return this._snapshot.docs.size}get empty(){return this.size===0}forEach(e,t){this._snapshot.docs.forEach((n=>{e.call(t,new Ys(this._firestore,this._userDataWriter,n.key,n,new Vt(this._snapshot.mutatedKeys.has(n.key),this._snapshot.fromCache),this.query.converter))}))}docChanges(e={}){const t=!!e.includeMetadataChanges;if(t&&this._snapshot.excludesMetadataChanges)throw new D(R.INVALID_ARGUMENT,"To include metadata changes with your document changes, you must also pass { includeMetadataChanges:true } to onSnapshot().");return this._cachedChanges&&this._cachedChangesIncludeMetadataChanges===t||(this._cachedChanges=(function(s,i){if(s._snapshot.oldDocs.isEmpty()){let o=0;return s._snapshot.docChanges.map((c=>{const u=new Ys(s._firestore,s._userDataWriter,c.doc.key,c.doc,new Vt(s._snapshot.mutatedKeys.has(c.doc.key),s._snapshot.fromCache),s.query.converter);return c.doc,{type:"added",doc:u,oldIndex:-1,newIndex:o++}}))}{let o=s._snapshot.oldDocs;return s._snapshot.docChanges.filter((c=>i||c.type!==3)).map((c=>{const u=new Ys(s._firestore,s._userDataWriter,c.doc.key,c.doc,new Vt(s._snapshot.mutatedKeys.has(c.doc.key),s._snapshot.fromCache),s.query.converter);let h=-1,f=-1;return c.type!==0&&(h=o.indexOf(c.doc.key),o=o.delete(c.doc.key)),c.type!==1&&(o=o.add(c.doc),f=o.indexOf(c.doc.key)),{type:dR(c.type),doc:u,oldIndex:h,newIndex:f}}))}})(this,t),this._cachedChangesIncludeMetadataChanges=t),this._cachedChanges}toJSON(){if(this.metadata.hasPendingWrites)throw new D(R.FAILED_PRECONDITION,"QuerySnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");const e={};e.type=Je._jsonSchemaVersion,e.bundleSource="QuerySnapshot",e.bundleName=aa.newId(),this._firestore._databaseId.database,this._firestore._databaseId.projectId;const t=[],n=[],s=[];return this.docs.forEach((i=>{i._document!==null&&(t.push(i._document),n.push(this._userDataWriter.convertObjectMap(i._document.data.value.mapValue.fields,"previous")),s.push(i.ref.path))})),e.bundle=(this._firestore,this.query._query,e.bundleName,"NOT SUPPORTED"),e}}function hR(r,e,t){if(or(e,Je._jsonSchema)){if(e.bundle===I_)throw new D(R.INVALID_ARGUMENT,"The provided JSON object was created in a client environment, which is not supported.");const n=ar(r._databaseId),s=Jg(e.bundle,n),i=s.Ku(),o=new el(s.getMetadata(),n);for(const m of i)o.Wa(m);if(o.queries.length!==1)throw new D(R.INVALID_ARGUMENT,`Snapshot data expected 1 query but found ${o.queries.length} queries.`);const c=Ta(o.queries[0].bundledQuery),u=o.documents;let h=new Gn;u.map((m=>{const T=ya(n,m.document);h=h.add(T)}));const f=rr.fromInitialDocuments(c,h,W(),!1,!1),p=new Ae(r,t||null,c);return new Je(r,new Tl(r),p,f)}}function dR(r){switch(r){case 0:return"added";case 2:case 3:return"modified";case 1:return"removed";default:return B(61501,{type:r})}}function fR(r,e){return r instanceof Xe&&e instanceof Xe?r._firestore===e._firestore&&r._key.isEqual(e._key)&&(r._document===null?e._document===null:r._document.isEqual(e._document))&&r._converter===e._converter:r instanceof Je&&e instanceof Je&&r._firestore===e._firestore&&ll(r.query,e.query)&&r.metadata.isEqual(e.metadata)&&r._snapshot.isEqual(e._snapshot)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function pR(r){r=X(r,se);const e=X(r.firestore,oe);return Qg(me(e),r._key).then((t=>El(e,r,t)))}Je._jsonSchemaVersion="firestore/querySnapshot/1.0",Je._jsonSchema={type:ve("string",Je._jsonSchemaVersion),bundleSource:ve("string","QuerySnapshot"),bundleName:ve("string"),bundle:ve("string")};class Sn extends Il{constructor(e){super(),this.firestore=e}convertBytes(e){return new Ke(e)}convertReference(e){const t=this.convertDocumentKey(e,this.firestore._databaseId);return new se(this.firestore,null,t)}}function mR(r){r=X(r,se);const e=X(r.firestore,oe),t=me(e),n=new Sn(e);return Eb(t,r._key).then((s=>new Xe(e,n,r._key,s,new Vt(s!==null&&s.hasLocalMutations,!0),r.converter)))}function gR(r){r=X(r,se);const e=X(r.firestore,oe);return Qg(me(e),r._key,{source:"server"}).then((t=>El(e,r,t)))}function _R(r){r=X(r,Ae);const e=X(r.firestore,oe),t=me(e),n=new Sn(e);return p_(r._query),Xg(t,r._query).then((s=>new Je(e,n,r,s)))}function yR(r){r=X(r,Ae);const e=X(r.firestore,oe),t=me(e),n=new Sn(e);return vb(t,r._query).then((s=>new Je(e,n,r,s)))}function IR(r){r=X(r,Ae);const e=X(r.firestore,oe),t=me(e),n=new Sn(e);return Xg(t,r._query,{source:"server"}).then((s=>new Je(e,n,r,s)))}function TR(r,e,t){r=X(r,se);const n=X(r.firestore,oe),s=Na(r.converter,e,t);return hs(n,[Ca(cr(n),"setDoc",r._key,s,r.converter!==null,t).toMutation(r._key,pe.none())])}function ER(r,e,t,...n){r=X(r,se);const s=X(r.firestore,oe),i=cr(s);let o;return o=typeof(e=Z(e))=="string"||e instanceof bn?gl(i,"updateDoc",r._key,e,t,n):ml(i,"updateDoc",r._key,e),hs(s,[o.toMutation(r._key,pe.exists(!0))])}function vR(r){return hs(X(r.firestore,oe),[new rs(r._key,pe.none())])}function wR(r,e){const t=X(r.firestore,oe),n=t_(r),s=Na(r.converter,e);return hs(t,[Ca(cr(r.firestore),"addDoc",n._key,s,r.converter!==null,{}).toMutation(n._key,pe.exists(!1))]).then((()=>n))}function Zc(r,...e){var t,n,s;r=Z(r);let i={includeMetadataChanges:!1,source:"default"},o=0;typeof e[o]!="object"||kr(e[o])||(i=e[o++]);const c={includeMetadataChanges:i.includeMetadataChanges,source:i.source};if(kr(e[o])){const p=e[o];e[o]=(t=p.next)===null||t===void 0?void 0:t.bind(p),e[o+1]=(n=p.error)===null||n===void 0?void 0:n.bind(p),e[o+2]=(s=p.complete)===null||s===void 0?void 0:s.bind(p)}let u,h,f;if(r instanceof se)h=X(r.firestore,oe),f=ts(r._key.path),u={next:p=>{e[o]&&e[o](El(h,r,p))},error:e[o+1],complete:e[o+2]};else{const p=X(r,Ae);h=X(p.firestore,oe),f=p._query;const m=new Sn(h);u={next:T=>{e[o]&&e[o](new Je(h,m,p,T))},error:e[o+1],complete:e[o+2]},p_(r._query)}return(function(m,T,P,V){const C=new Ra(V),L=new Zu(T,C,P);return m.asyncQueue.enqueueAndForget((async()=>Xu(await Xr(m),L))),()=>{C.Ou(),m.asyncQueue.enqueueAndForget((async()=>Ju(await Xr(m),L)))}})(me(h),f,c,u)}function AR(r,e,...t){const n=Z(r),s=(function(u){const h={bundle:"",bundleName:"",bundleSource:""},f=["bundle","bundleName","bundleSource"];for(const p of f){if(!(p in u)){h.error=`snapshotJson missing required field: ${p}`;break}const m=u[p];if(typeof m!="string"){h.error=`snapshotJson field '${p}' must be a string.`;break}if(m.length===0){h.error=`snapshotJson field '${p}' cannot be an empty string.`;break}p==="bundle"?h.bundle=m:p==="bundleName"?h.bundleName=m:p==="bundleSource"&&(h.bundleSource=m)}return h})(e);if(s.error)throw new D(R.INVALID_ARGUMENT,s.error);let i,o=0;if(typeof t[o]!="object"||kr(t[o])||(i=t[o++]),s.bundleSource==="QuerySnapshot"){let c=null;if(typeof t[o]=="object"&&kr(t[o])){const u=t[o++];c={next:u.next,error:u.error,complete:u.complete}}else c={next:t[o++],error:t[o++],complete:t[o++]};return(function(h,f,p,m,T){let P,V=!1;return Yc(h,f.bundle).then((()=>i_(h,f.bundleName))).then((L=>{L&&!V&&(T&&L.withConverter(T),P=Zc(L,p||{},m))})).catch((L=>(m.error&&m.error(L),()=>{}))),()=>{V||(V=!0,P&&P())}})(n,s,i,c,t[o])}if(s.bundleSource==="DocumentSnapshot"){let c=null;if(typeof t[o]=="object"&&kr(t[o])){const u=t[o++];c={next:u.next,error:u.error,complete:u.complete}}else c={next:t[o++],error:t[o++],complete:t[o++]};return(function(h,f,p,m,T){let P,V=!1;return Yc(h,f.bundle).then((()=>{if(!V){const L=new se(h,T||null,O.fromPath(f.bundleName));P=Zc(L,p||{},m)}})).catch((L=>(m.error&&m.error(L),()=>{}))),()=>{V||(V=!0,P&&P())}})(n,s,i,c,t[o])}throw new D(R.INVALID_ARGUMENT,`unsupported bundle source: ${s.bundleSource}`)}function bR(r,e){return Ab(me(r=X(r,oe)),kr(e)?e:{next:e})}function hs(r,e){return(function(n,s){const i=new Pe;return n.asyncQueue.enqueueAndForget((async()=>YA(await ul(n),s,i))),i.promise})(me(r),e)}function El(r,e,t){const n=t.docs.get(e._key),s=new Sn(r);return new Xe(r,s,e._key,n,new Vt(t.hasPendingWrites,t.fromCache),e.converter)}function RR(r){return T_(r,{count:y_()})}function T_(r,e){const t=X(r.firestore,oe),n=me(t),s=im(e,((i,o)=>new Bm(o,i.aggregateType,i._internalFieldPath)));return wb(n,r._query,s).then((i=>(function(c,u,h){const f=new Sn(c);return new o_(u,f,h)})(t,r,i)))}class SR{constructor(e){this.kind="memory",this._onlineComponentProvider=yn.provider,e!=null&&e.garbageCollector?this._offlineComponentProvider=e.garbageCollector._offlineComponentProvider:this._offlineComponentProvider={build:()=>new ol(void 0)}}toJSON(){return{kind:this.kind}}}class PR{constructor(e){let t;this.kind="persistent",e!=null&&e.tabManager?(e.tabManager._initialize(e),t=e.tabManager):(t=E_(void 0),t._initialize(e)),this._onlineComponentProvider=t._onlineComponentProvider,this._offlineComponentProvider=t._offlineComponentProvider}toJSON(){return{kind:this.kind}}}class CR{constructor(){this.kind="memoryEager",this._offlineComponentProvider=Qr.provider}toJSON(){return{kind:this.kind}}}class kR{constructor(e){this.kind="memoryLru",this._offlineComponentProvider={build:()=>new ol(e)}}toJSON(){return{kind:this.kind}}}function VR(){return new CR}function DR(r){return new kR(r==null?void 0:r.cacheSizeBytes)}function NR(r){return new SR(r)}function xR(r){return new PR(r)}class OR{constructor(e){this.forceOwnership=e,this.kind="persistentSingleTab"}toJSON(){return{kind:this.kind}}_initialize(e){this._onlineComponentProvider=yn.provider,this._offlineComponentProvider={build:t=>new al(t,e==null?void 0:e.cacheSizeBytes,this.forceOwnership)}}}class MR{constructor(){this.kind="PersistentMultipleTab"}toJSON(){return{kind:this.kind}}_initialize(e){this._onlineComponentProvider=yn.provider,this._offlineComponentProvider={build:t=>new Gg(t,e==null?void 0:e.cacheSizeBytes)}}}function E_(r){return new OR(r==null?void 0:r.forceOwnership)}function LR(){return new MR}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const FR={maxAttempts:5};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class v_{constructor(e,t){this._firestore=e,this._commitHandler=t,this._mutations=[],this._committed=!1,this._dataReader=cr(e)}set(e,t,n){this._verifyNotCommitted();const s=an(e,this._firestore),i=Na(s.converter,t,n),o=Ca(this._dataReader,"WriteBatch.set",s._key,i,s.converter!==null,n);return this._mutations.push(o.toMutation(s._key,pe.none())),this}update(e,t,n,...s){this._verifyNotCommitted();const i=an(e,this._firestore);let o;return o=typeof(t=Z(t))=="string"||t instanceof bn?gl(this._dataReader,"WriteBatch.update",i._key,t,n,s):ml(this._dataReader,"WriteBatch.update",i._key,t),this._mutations.push(o.toMutation(i._key,pe.exists(!0))),this}delete(e){this._verifyNotCommitted();const t=an(e,this._firestore);return this._mutations=this._mutations.concat(new rs(t._key,pe.none())),this}commit(){return this._verifyNotCommitted(),this._committed=!0,this._mutations.length>0?this._commitHandler(this._mutations):Promise.resolve()}_verifyNotCommitted(){if(this._committed)throw new D(R.FAILED_PRECONDITION,"A write batch can no longer be used after commit() has been called.")}}function an(r,e){if((r=Z(r)).firestore!==e)throw new D(R.INVALID_ARGUMENT,"Provided document reference is from a different Firestore instance.");return r}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class UR{constructor(e,t){this._firestore=e,this._transaction=t,this._dataReader=cr(e)}get(e){const t=an(e,this._firestore),n=new Tl(this._firestore);return this._transaction.lookup([t._key]).then((s=>{if(!s||s.length!==1)return B(24041);const i=s[0];if(i.isFoundDocument())return new mi(this._firestore,n,i.key,i,t.converter);if(i.isNoDocument())return new mi(this._firestore,n,t._key,null,t.converter);throw B(18433,{doc:i})}))}set(e,t,n){const s=an(e,this._firestore),i=Na(s.converter,t,n),o=Ca(this._dataReader,"Transaction.set",s._key,i,s.converter!==null,n);return this._transaction.set(s._key,o),this}update(e,t,n,...s){const i=an(e,this._firestore);let o;return o=typeof(t=Z(t))=="string"||t instanceof bn?gl(this._dataReader,"Transaction.update",i._key,t,n,s):ml(this._dataReader,"Transaction.update",i._key,t),this._transaction.update(i._key,o),this}delete(e){const t=an(e,this._firestore);return this._transaction.delete(t._key),this}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class w_ extends UR{constructor(e,t){super(e,t),this._firestore=e}get(e){const t=an(e,this._firestore),n=new Sn(this._firestore);return super.get(e).then((s=>new Xe(this._firestore,n,t._key,s._document,new Vt(!1,!1),t.converter)))}}function BR(r,e,t){r=X(r,oe);const n=Object.assign(Object.assign({},FR),t);return(function(i){if(i.maxAttempts<1)throw new D(R.INVALID_ARGUMENT,"Max attempts must be at least 1")})(n),(function(i,o,c){const u=new Pe;return i.asyncQueue.enqueueAndForget((async()=>{const h=await Hg(i);new _b(i.asyncQueue,h,c,o,u).zu()})),u.promise})(me(r),(s=>e(new w_(r,s))),n)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function qR(){return new Di("deleteField")}function jR(){return new hl("serverTimestamp")}function zR(...r){return new dl("arrayUnion",r)}function $R(...r){return new fl("arrayRemove",r)}function GR(r){return new pl("increment",r)}function KR(r){return new nt(r)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function WR(r){return me(r=X(r,oe)),new v_(r,(e=>hs(r,e)))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function HR(r,e){const t=me(r=X(r,oe));if(!t._uninitializedComponentsProvider||t._uninitializedComponentsProvider._offline.kind==="memory")return Be("Cannot enable indexes when persistence is disabled"),Promise.resolve();const n=(function(i){const o=typeof i=="string"?(function(h){try{return JSON.parse(h)}catch(f){throw new D(R.INVALID_ARGUMENT,"Failed to parse JSON: "+(f==null?void 0:f.message))}})(i):i,c=[];if(Array.isArray(o.indexes))for(const u of o.indexes){const h=Rf(u,"collectionGroup"),f=[];if(Array.isArray(u.fields))for(const p of u.fields){const m=ka("setIndexConfiguration",Rf(p,"fieldPath"));p.arrayConfig==="CONTAINS"?f.push(new zn(m,2)):p.order==="ASCENDING"?f.push(new zn(m,0)):p.order==="DESCENDING"&&f.push(new zn(m,1))}c.push(new Nr(Nr.UNKNOWN_ID,h,f,xr.empty()))}return c})(e);return Sb(t,n)}function Rf(r,e){if(typeof r[e]!="string")throw new D(R.INVALID_ARGUMENT,"Missing string value for: "+e);return r[e]}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class A_{constructor(e){this._firestore=e,this.type="PersistentCacheIndexManager"}}function QR(r){var e;r=X(r,oe);const t=Sf.get(r);if(t)return t;if(((e=me(r)._uninitializedComponentsProvider)===null||e===void 0?void 0:e._offline.kind)!=="persistent")return null;const n=new A_(r);return Sf.set(r,n),n}function XR(r){b_(r,!0)}function JR(r){b_(r,!1)}function YR(r){Cb(me(r._firestore)).then((e=>N("deleting all persistent cache indexes succeeded"))).catch((e=>Be("deleting all persistent cache indexes failed",e)))}function b_(r,e){Pb(me(r._firestore),e).then((t=>N(`setting persistent cache index auto creation isEnabled=${e} succeeded`))).catch((t=>Be(`setting persistent cache index auto creation isEnabled=${e} failed`,t)))}const Sf=new WeakMap;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ZR(r){var e;const t=(e=me(X(r.firestore,oe))._onlineComponents)===null||e===void 0?void 0:e.datastore.serializer;return t===void 0?null:Ia(t,Ue(r._query)).Vt}function eS(r,e){var t;const n=im(e,((i,o)=>new Bm(o,i.aggregateType,i._internalFieldPath))),s=(t=me(X(r.firestore,oe))._onlineComponents)===null||t===void 0?void 0:t.datastore.serializer;return s===void 0?null:Jm(s,Am(r._query),n,!0).request}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class tS{constructor(){throw new Error("instances of this class should not be created")}static onExistenceFilterMismatch(e){return vl.instance.onExistenceFilterMismatch(e)}}class vl{constructor(){this.Fc=new Map}static get instance(){return ho||(ho=new vl,(function(t){if(Go)throw new Error("a TestingHooksSpi instance is already set");Go=t})(ho)),ho}ct(e){this.Fc.forEach((t=>t(e)))}onExistenceFilterMismatch(e){const t=Symbol(),n=this.Fc;return n.set(t,e),()=>n.delete(t)}}let ho=null;(function(e,t=!0){(function(s){es=s})(ir),Wn(new hn("firestore",((n,{instanceIdentifier:s,options:i})=>{const o=n.getProvider("app").getImmediate(),c=new oe(new pv(n.getProvider("auth-internal")),new _v(o,n.getProvider("app-check-internal")),(function(h,f){if(!Object.prototype.hasOwnProperty.apply(h.options,["projectId"]))throw new D(R.INVALID_ARGUMENT,'"projectId" not provided in firebase.initializeApp.');return new fn(h.options.projectId,f)})(o,s),o);return i=Object.assign({useFetchStreams:t},i),c._setSettings(i),c}),"PUBLIC").setMultipleInstances(!0)),gt(rd,sd,e),gt(rd,sd,"esm2017")})();const wP=Object.freeze(Object.defineProperty({__proto__:null,AbstractUserDataWriter:Il,AggregateField:Jr,AggregateQuerySnapshot:o_,Bytes:Ke,CACHE_SIZE_UNLIMITED:Nb,CollectionReference:ut,DocumentReference:se,DocumentSnapshot:Xe,FieldPath:bn,FieldValue:Rn,Firestore:oe,FirestoreError:D,GeoPoint:lt,LoadBundleTask:n_,PersistentCacheIndexManager:A_,Query:Ae,QueryCompositeFilterConstraint:lr,QueryConstraint:us,QueryDocumentSnapshot:Ys,QueryEndAtConstraint:Oi,QueryFieldFilterConstraint:ls,QueryLimitConstraint:Ni,QueryOrderByConstraint:Da,QuerySnapshot:Je,QueryStartAtConstraint:xi,SnapshotMetadata:Vt,Timestamp:ne,Transaction:w_,VectorValue:nt,WriteBatch:v_,_AutoId:aa,_ByteString:ge,_DatabaseId:fn,_DocumentKey:O,_EmptyAppCheckTokenProvider:yv,_EmptyAuthCredentialsProvider:Fp,_FieldPath:he,_TestingHooks:tS,_cast:X,_debugAssert:dv,_internalAggregationQueryToProtoRunAggregationQueryRequest:eS,_internalQueryToProtoQueryTarget:ZR,_isBase64Available:ew,_logWarn:Be,_validateIsNotUsedTogether:Bp,addDoc:wR,aggregateFieldEqual:cR,aggregateQuerySnapshotEqual:uR,and:Yb,arrayRemove:$R,arrayUnion:zR,average:aR,clearIndexedDbPersistence:Fb,collection:kb,collectionGroup:Vb,connectFirestoreEmulator:e_,count:y_,deleteAllPersistentCacheIndexes:YR,deleteDoc:vR,deleteField:qR,disableNetwork:qb,disablePersistentCacheIndexAutoCreation:JR,doc:t_,documentId:zb,documentSnapshotFromJSON:lR,enableIndexedDbPersistence:Mb,enableMultiTabIndexedDbPersistence:Lb,enableNetwork:Bb,enablePersistentCacheIndexAutoCreation:XR,endAt:iR,endBefore:sR,ensureFirestoreConfigured:me,executeWrite:hs,getAggregateFromServer:T_,getCountFromServer:RR,getDoc:pR,getDocFromCache:mR,getDocFromServer:gR,getDocs:_R,getDocsFromCache:yR,getDocsFromServer:IR,getFirestore:Ob,getPersistentCacheIndexManager:QR,increment:GR,initializeFirestore:xb,limit:eR,limitToLast:tR,loadBundle:Yc,memoryEagerGarbageCollector:VR,memoryLocalCache:NR,memoryLruGarbageCollector:DR,namedQuery:i_,onSnapshot:Zc,onSnapshotResume:AR,onSnapshotsInSync:bR,or:Jb,orderBy:Zb,persistentLocalCache:xR,persistentMultipleTabManager:LR,persistentSingleTabManager:E_,query:Qb,queryEqual:ll,querySnapshotFromJSON:hR,refEqual:Db,runTransaction:BR,serverTimestamp:jR,setDoc:TR,setIndexConfiguration:HR,setLogLevel:hv,snapshotEqual:fR,startAfter:rR,startAt:nR,sum:oR,terminate:jb,updateDoc:ER,vector:KR,waitForPendingWrites:Ub,where:Xb,writeBatch:WR},Symbol.toStringTag,{value:"Module"}));/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const R_="firebasestorage.googleapis.com",S_="storageBucket",nS=120*1e3,rS=600*1e3,sS=1e3;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _e extends vt{constructor(e,t,n=0){super(_c(e),`Firebase Storage: ${t} (${_c(e)})`),this.status_=n,this.customData={serverResponse:null},this._baseMessage=this.message,Object.setPrototypeOf(this,_e.prototype)}get status(){return this.status_}set status(e){this.status_=e}_codeEquals(e){return _c(e)===this.code}get serverResponse(){return this.customData.serverResponse}set serverResponse(e){this.customData.serverResponse=e,this.customData.serverResponse?this.message=`${this._baseMessage}
${this.customData.serverResponse}`:this.message=this._baseMessage}}var de;(function(r){r.UNKNOWN="unknown",r.OBJECT_NOT_FOUND="object-not-found",r.BUCKET_NOT_FOUND="bucket-not-found",r.PROJECT_NOT_FOUND="project-not-found",r.QUOTA_EXCEEDED="quota-exceeded",r.UNAUTHENTICATED="unauthenticated",r.UNAUTHORIZED="unauthorized",r.UNAUTHORIZED_APP="unauthorized-app",r.RETRY_LIMIT_EXCEEDED="retry-limit-exceeded",r.INVALID_CHECKSUM="invalid-checksum",r.CANCELED="canceled",r.INVALID_EVENT_NAME="invalid-event-name",r.INVALID_URL="invalid-url",r.INVALID_DEFAULT_BUCKET="invalid-default-bucket",r.NO_DEFAULT_BUCKET="no-default-bucket",r.CANNOT_SLICE_BLOB="cannot-slice-blob",r.SERVER_FILE_WRONG_SIZE="server-file-wrong-size",r.NO_DOWNLOAD_URL="no-download-url",r.INVALID_ARGUMENT="invalid-argument",r.INVALID_ARGUMENT_COUNT="invalid-argument-count",r.APP_DELETED="app-deleted",r.INVALID_ROOT_OPERATION="invalid-root-operation",r.INVALID_FORMAT="invalid-format",r.INTERNAL_ERROR="internal-error",r.UNSUPPORTED_ENVIRONMENT="unsupported-environment"})(de||(de={}));function _c(r){return"storage/"+r}function wl(){const r="An unknown error occurred, please check the error payload for server response.";return new _e(de.UNKNOWN,r)}function iS(r){return new _e(de.OBJECT_NOT_FOUND,"Object '"+r+"' does not exist.")}function oS(r){return new _e(de.QUOTA_EXCEEDED,"Quota for bucket '"+r+"' exceeded, please view quota on https://firebase.google.com/pricing/.")}function aS(){const r="User is not authenticated, please authenticate using Firebase Authentication and try again.";return new _e(de.UNAUTHENTICATED,r)}function cS(){return new _e(de.UNAUTHORIZED_APP,"This app does not have permission to access Firebase Storage on this project.")}function uS(r){return new _e(de.UNAUTHORIZED,"User does not have permission to access '"+r+"'.")}function P_(){return new _e(de.RETRY_LIMIT_EXCEEDED,"Max retry time for operation exceeded, please try again.")}function C_(){return new _e(de.CANCELED,"User canceled the upload/download.")}function lS(r){return new _e(de.INVALID_URL,"Invalid URL '"+r+"'.")}function hS(r){return new _e(de.INVALID_DEFAULT_BUCKET,"Invalid default bucket '"+r+"'.")}function dS(){return new _e(de.NO_DEFAULT_BUCKET,"No default bucket found. Did you set the '"+S_+"' property when initializing the app?")}function k_(){return new _e(de.CANNOT_SLICE_BLOB,"Cannot slice blob for upload. Please retry the upload.")}function fS(){return new _e(de.SERVER_FILE_WRONG_SIZE,"Server recorded incorrect upload file size, please retry the upload.")}function pS(){return new _e(de.NO_DOWNLOAD_URL,"The given file does not have any download URLs.")}function mS(r){return new _e(de.UNSUPPORTED_ENVIRONMENT,`${r} is missing. Make sure to install the required polyfills. See https://firebase.google.com/docs/web/environments-js-sdk#polyfills for more information.`)}function eu(r){return new _e(de.INVALID_ARGUMENT,r)}function V_(){return new _e(de.APP_DELETED,"The Firebase app was deleted.")}function gS(r){return new _e(de.INVALID_ROOT_OPERATION,"The operation '"+r+"' cannot be performed on a root reference, create a non-root reference using child, such as .child('file.png').")}function Zs(r,e){return new _e(de.INVALID_FORMAT,"String does not match format '"+r+"': "+e)}function Os(r){throw new _e(de.INTERNAL_ERROR,"Internal error: "+r)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class et{constructor(e,t){this.bucket=e,this.path_=t}get path(){return this.path_}get isRoot(){return this.path.length===0}fullServerUrl(){const e=encodeURIComponent;return"/b/"+e(this.bucket)+"/o/"+e(this.path)}bucketOnlyServerUrl(){return"/b/"+encodeURIComponent(this.bucket)+"/o"}static makeFromBucketSpec(e,t){let n;try{n=et.makeFromUrl(e,t)}catch{return new et(e,"")}if(n.path==="")return n;throw hS(e)}static makeFromUrl(e,t){let n=null;const s="([A-Za-z0-9.\\-_]+)";function i(j){j.path.charAt(j.path.length-1)==="/"&&(j.path_=j.path_.slice(0,-1))}const o="(/(.*))?$",c=new RegExp("^gs://"+s+o,"i"),u={bucket:1,path:3};function h(j){j.path_=decodeURIComponent(j.path)}const f="v[A-Za-z0-9_]+",p=t.replace(/[.]/g,"\\."),m="(/([^?#]*).*)?$",T=new RegExp(`^https?://${p}/${f}/b/${s}/o${m}`,"i"),P={bucket:1,path:3},V=t===R_?"(?:storage.googleapis.com|storage.cloud.google.com)":t,C="([^?#]*)",L=new RegExp(`^https?://${V}/${s}/${C}`,"i"),x=[{regex:c,indices:u,postModify:i},{regex:T,indices:P,postModify:h},{regex:L,indices:{bucket:1,path:2},postModify:h}];for(let j=0;j<x.length;j++){const H=x[j],$=H.regex.exec(e);if($){const E=$[H.indices.bucket];let _=$[H.indices.path];_||(_=""),n=new et(E,_),H.postModify(n);break}}if(n==null)throw lS(e);return n}}class _S{constructor(e){this.promise_=Promise.reject(e)}getPromise(){return this.promise_}cancel(e=!1){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function yS(r,e,t){let n=1,s=null,i=null,o=!1,c=0;function u(){return c===2}let h=!1;function f(...C){h||(h=!0,e.apply(null,C))}function p(C){s=setTimeout(()=>{s=null,r(T,u())},C)}function m(){i&&clearTimeout(i)}function T(C,...L){if(h){m();return}if(C){m(),f.call(null,C,...L);return}if(u()||o){m(),f.call(null,C,...L);return}n<64&&(n*=2);let x;c===1?(c=2,x=0):x=(n+Math.random())*1e3,p(x)}let P=!1;function V(C){P||(P=!0,m(),!h&&(s!==null?(C||(c=2),clearTimeout(s),p(0)):C||(c=1)))}return p(0),i=setTimeout(()=>{o=!0,V(!0)},t),V}function IS(r){r(!1)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function TS(r){return r!==void 0}function ES(r){return typeof r=="function"}function vS(r){return typeof r=="object"&&!Array.isArray(r)}function xa(r){return typeof r=="string"||r instanceof String}function Pf(r){return Al()&&r instanceof Blob}function Al(){return typeof Blob<"u"}function Cf(r,e,t,n){if(n<e)throw eu(`Invalid value for '${r}'. Expected ${e} or greater.`);if(n>t)throw eu(`Invalid value for '${r}'. Expected ${t} or less.`)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Mi(r,e,t){let n=e;return t==null&&(n=`https://${e}`),`${t}://${n}/v0${r}`}function D_(r){const e=encodeURIComponent;let t="?";for(const n in r)if(r.hasOwnProperty(n)){const s=e(n)+"="+e(r[n]);t=t+s+"&"}return t=t.slice(0,-1),t}var Kn;(function(r){r[r.NO_ERROR=0]="NO_ERROR",r[r.NETWORK_ERROR=1]="NETWORK_ERROR",r[r.ABORT=2]="ABORT"})(Kn||(Kn={}));/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function N_(r,e){const t=r>=500&&r<600,s=[408,429].indexOf(r)!==-1,i=e.indexOf(r)!==-1;return t||s||i}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wS{constructor(e,t,n,s,i,o,c,u,h,f,p,m=!0,T=!1){this.url_=e,this.method_=t,this.headers_=n,this.body_=s,this.successCodes_=i,this.additionalRetryCodes_=o,this.callback_=c,this.errorCallback_=u,this.timeout_=h,this.progressCallback_=f,this.connectionFactory_=p,this.retry=m,this.isUsingEmulator=T,this.pendingConnection_=null,this.backoffId_=null,this.canceled_=!1,this.appDelete_=!1,this.promise_=new Promise((P,V)=>{this.resolve_=P,this.reject_=V,this.start_()})}start_(){const e=(n,s)=>{if(s){n(!1,new fo(!1,null,!0));return}const i=this.connectionFactory_();this.pendingConnection_=i;const o=c=>{const u=c.loaded,h=c.lengthComputable?c.total:-1;this.progressCallback_!==null&&this.progressCallback_(u,h)};this.progressCallback_!==null&&i.addUploadProgressListener(o),i.send(this.url_,this.method_,this.isUsingEmulator,this.body_,this.headers_).then(()=>{this.progressCallback_!==null&&i.removeUploadProgressListener(o),this.pendingConnection_=null;const c=i.getErrorCode()===Kn.NO_ERROR,u=i.getStatus();if(!c||N_(u,this.additionalRetryCodes_)&&this.retry){const f=i.getErrorCode()===Kn.ABORT;n(!1,new fo(!1,null,f));return}const h=this.successCodes_.indexOf(u)!==-1;n(!0,new fo(h,i))})},t=(n,s)=>{const i=this.resolve_,o=this.reject_,c=s.connection;if(s.wasSuccessCode)try{const u=this.callback_(c,c.getResponse());TS(u)?i(u):i()}catch(u){o(u)}else if(c!==null){const u=wl();u.serverResponse=c.getErrorText(),this.errorCallback_?o(this.errorCallback_(c,u)):o(u)}else if(s.canceled){const u=this.appDelete_?V_():C_();o(u)}else{const u=P_();o(u)}};this.canceled_?t(!1,new fo(!1,null,!0)):this.backoffId_=yS(e,t,this.timeout_)}getPromise(){return this.promise_}cancel(e){this.canceled_=!0,this.appDelete_=e||!1,this.backoffId_!==null&&IS(this.backoffId_),this.pendingConnection_!==null&&this.pendingConnection_.abort()}}class fo{constructor(e,t,n){this.wasSuccessCode=e,this.connection=t,this.canceled=!!n}}function AS(r,e){e!==null&&e.length>0&&(r.Authorization="Firebase "+e)}function bS(r,e){r["X-Firebase-Storage-Version"]="webjs/"+(e??"AppManager")}function RS(r,e){e&&(r["X-Firebase-GMPID"]=e)}function SS(r,e){e!==null&&(r["X-Firebase-AppCheck"]=e)}function PS(r,e,t,n,s,i,o=!0,c=!1){const u=D_(r.urlParams),h=r.url+u,f=Object.assign({},r.headers);return RS(f,e),AS(f,t),bS(f,i),SS(f,n),new wS(h,r.method,f,r.body,r.successCodes,r.additionalRetryCodes,r.handler,r.errorHandler,r.timeout,r.progressCallback,s,o,c)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function CS(){return typeof BlobBuilder<"u"?BlobBuilder:typeof WebKitBlobBuilder<"u"?WebKitBlobBuilder:void 0}function kS(...r){const e=CS();if(e!==void 0){const t=new e;for(let n=0;n<r.length;n++)t.append(r[n]);return t.getBlob()}else{if(Al())return new Blob(r);throw new _e(de.UNSUPPORTED_ENVIRONMENT,"This browser doesn't seem to support creating Blobs")}}function VS(r,e,t){return r.webkitSlice?r.webkitSlice(e,t):r.mozSlice?r.mozSlice(e,t):r.slice?r.slice(e,t):null}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function DS(r){if(typeof atob>"u")throw mS("base-64");return atob(r)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const at={RAW:"raw",BASE64:"base64",BASE64URL:"base64url",DATA_URL:"data_url"};class yc{constructor(e,t){this.data=e,this.contentType=t||null}}function x_(r,e){switch(r){case at.RAW:return new yc(O_(e));case at.BASE64:case at.BASE64URL:return new yc(M_(r,e));case at.DATA_URL:return new yc(xS(e),OS(e))}throw wl()}function O_(r){const e=[];for(let t=0;t<r.length;t++){let n=r.charCodeAt(t);if(n<=127)e.push(n);else if(n<=2047)e.push(192|n>>6,128|n&63);else if((n&64512)===55296)if(!(t<r.length-1&&(r.charCodeAt(t+1)&64512)===56320))e.push(239,191,189);else{const i=n,o=r.charCodeAt(++t);n=65536|(i&1023)<<10|o&1023,e.push(240|n>>18,128|n>>12&63,128|n>>6&63,128|n&63)}else(n&64512)===56320?e.push(239,191,189):e.push(224|n>>12,128|n>>6&63,128|n&63)}return new Uint8Array(e)}function NS(r){let e;try{e=decodeURIComponent(r)}catch{throw Zs(at.DATA_URL,"Malformed data URL.")}return O_(e)}function M_(r,e){switch(r){case at.BASE64:{const s=e.indexOf("-")!==-1,i=e.indexOf("_")!==-1;if(s||i)throw Zs(r,"Invalid character '"+(s?"-":"_")+"' found: is it base64url encoded?");break}case at.BASE64URL:{const s=e.indexOf("+")!==-1,i=e.indexOf("/")!==-1;if(s||i)throw Zs(r,"Invalid character '"+(s?"+":"/")+"' found: is it base64 encoded?");e=e.replace(/-/g,"+").replace(/_/g,"/");break}}let t;try{t=DS(e)}catch(s){throw s.message.includes("polyfill")?s:Zs(r,"Invalid character found")}const n=new Uint8Array(t.length);for(let s=0;s<t.length;s++)n[s]=t.charCodeAt(s);return n}class L_{constructor(e){this.base64=!1,this.contentType=null;const t=e.match(/^data:([^,]+)?,/);if(t===null)throw Zs(at.DATA_URL,"Must be formatted 'data:[<mediatype>][;base64],<data>");const n=t[1]||null;n!=null&&(this.base64=MS(n,";base64"),this.contentType=this.base64?n.substring(0,n.length-7):n),this.rest=e.substring(e.indexOf(",")+1)}}function xS(r){const e=new L_(r);return e.base64?M_(at.BASE64,e.rest):NS(e.rest)}function OS(r){return new L_(r).contentType}function MS(r,e){return r.length>=e.length?r.substring(r.length-e.length)===e:!1}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class St{constructor(e,t){let n=0,s="";Pf(e)?(this.data_=e,n=e.size,s=e.type):e instanceof ArrayBuffer?(t?this.data_=new Uint8Array(e):(this.data_=new Uint8Array(e.byteLength),this.data_.set(new Uint8Array(e))),n=this.data_.length):e instanceof Uint8Array&&(t?this.data_=e:(this.data_=new Uint8Array(e.length),this.data_.set(e)),n=e.length),this.size_=n,this.type_=s}size(){return this.size_}type(){return this.type_}slice(e,t){if(Pf(this.data_)){const n=this.data_,s=VS(n,e,t);return s===null?null:new St(s)}else{const n=new Uint8Array(this.data_.buffer,e,t-e);return new St(n,!0)}}static getBlob(...e){if(Al()){const t=e.map(n=>n instanceof St?n.data_:n);return new St(kS.apply(null,t))}else{const t=e.map(o=>xa(o)?x_(at.RAW,o).data:o.data_);let n=0;t.forEach(o=>{n+=o.byteLength});const s=new Uint8Array(n);let i=0;return t.forEach(o=>{for(let c=0;c<o.length;c++)s[i++]=o[c]}),new St(s,!0)}}uploadData(){return this.data_}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function F_(r){let e;try{e=JSON.parse(r)}catch{return null}return vS(e)?e:null}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function LS(r){if(r.length===0)return null;const e=r.lastIndexOf("/");return e===-1?"":r.slice(0,e)}function FS(r,e){const t=e.split("/").filter(n=>n.length>0).join("/");return r.length===0?t:r+"/"+t}function U_(r){const e=r.lastIndexOf("/",r.length-2);return e===-1?r:r.slice(e+1)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function US(r,e){return e}class ze{constructor(e,t,n,s){this.server=e,this.local=t||e,this.writable=!!n,this.xform=s||US}}let po=null;function BS(r){return!xa(r)||r.length<2?r:U_(r)}function bl(){if(po)return po;const r=[];r.push(new ze("bucket")),r.push(new ze("generation")),r.push(new ze("metageneration")),r.push(new ze("name","fullPath",!0));function e(i,o){return BS(o)}const t=new ze("name");t.xform=e,r.push(t);function n(i,o){return o!==void 0?Number(o):o}const s=new ze("size");return s.xform=n,r.push(s),r.push(new ze("timeCreated")),r.push(new ze("updated")),r.push(new ze("md5Hash",null,!0)),r.push(new ze("cacheControl",null,!0)),r.push(new ze("contentDisposition",null,!0)),r.push(new ze("contentEncoding",null,!0)),r.push(new ze("contentLanguage",null,!0)),r.push(new ze("contentType",null,!0)),r.push(new ze("metadata","customMetadata",!0)),po=r,po}function qS(r,e){function t(){const n=r.bucket,s=r.fullPath,i=new et(n,s);return e._makeStorageReference(i)}Object.defineProperty(r,"ref",{get:t})}function jS(r,e,t){const n={};n.type="file";const s=t.length;for(let i=0;i<s;i++){const o=t[i];n[o.local]=o.xform(n,e[o.server])}return qS(n,r),n}function B_(r,e,t){const n=F_(e);return n===null?null:jS(r,n,t)}function zS(r,e,t,n){const s=F_(e);if(s===null||!xa(s.downloadTokens))return null;const i=s.downloadTokens;if(i.length===0)return null;const o=encodeURIComponent;return i.split(",").map(h=>{const f=r.bucket,p=r.fullPath,m="/b/"+o(f)+"/o/"+o(p),T=Mi(m,t,n),P=D_({alt:"media",token:h});return T+P})[0]}function q_(r,e){const t={},n=e.length;for(let s=0;s<n;s++){const i=e[s];i.writable&&(t[i.server]=r[i.local])}return JSON.stringify(t)}class ds{constructor(e,t,n,s){this.url=e,this.method=t,this.handler=n,this.timeout=s,this.urlParams={},this.headers={},this.body=null,this.errorHandler=null,this.progressCallback=null,this.successCodes=[200],this.additionalRetryCodes=[]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Dt(r){if(!r)throw wl()}function Rl(r,e){function t(n,s){const i=B_(r,s,e);return Dt(i!==null),i}return t}function $S(r,e){function t(n,s){const i=B_(r,s,e);return Dt(i!==null),zS(i,s,r.host,r._protocol)}return t}function Li(r){function e(t,n){let s;return t.getStatus()===401?t.getErrorText().includes("Firebase App Check token is invalid")?s=cS():s=aS():t.getStatus()===402?s=oS(r.bucket):t.getStatus()===403?s=uS(r.path):s=n,s.status=t.getStatus(),s.serverResponse=n.serverResponse,s}return e}function j_(r){const e=Li(r);function t(n,s){let i=e(n,s);return n.getStatus()===404&&(i=iS(r.path)),i.serverResponse=s.serverResponse,i}return t}function GS(r,e,t){const n=e.fullServerUrl(),s=Mi(n,r.host,r._protocol),i="GET",o=r.maxOperationRetryTime,c=new ds(s,i,Rl(r,t),o);return c.errorHandler=j_(e),c}function KS(r,e,t){const n=e.fullServerUrl(),s=Mi(n,r.host,r._protocol),i="GET",o=r.maxOperationRetryTime,c=new ds(s,i,$S(r,t),o);return c.errorHandler=j_(e),c}function WS(r,e){return r&&r.contentType||e&&e.type()||"application/octet-stream"}function z_(r,e,t){const n=Object.assign({},t);return n.fullPath=r.path,n.size=e.size(),n.contentType||(n.contentType=WS(null,e)),n}function $_(r,e,t,n,s){const i=e.bucketOnlyServerUrl(),o={"X-Goog-Upload-Protocol":"multipart"};function c(){let x="";for(let j=0;j<2;j++)x=x+Math.random().toString().slice(2);return x}const u=c();o["Content-Type"]="multipart/related; boundary="+u;const h=z_(e,n,s),f=q_(h,t),p="--"+u+`\r
Content-Type: application/json; charset=utf-8\r
\r
`+f+`\r
--`+u+`\r
Content-Type: `+h.contentType+`\r
\r
`,m=`\r
--`+u+"--",T=St.getBlob(p,n,m);if(T===null)throw k_();const P={name:h.fullPath},V=Mi(i,r.host,r._protocol),C="POST",L=r.maxUploadRetryTime,U=new ds(V,C,Rl(r,t),L);return U.urlParams=P,U.headers=o,U.body=T.uploadData(),U.errorHandler=Li(e),U}class ta{constructor(e,t,n,s){this.current=e,this.total=t,this.finalized=!!n,this.metadata=s||null}}function Sl(r,e){let t=null;try{t=r.getResponseHeader("X-Goog-Upload-Status")}catch{Dt(!1)}return Dt(!!t&&(e||["active"]).indexOf(t)!==-1),t}function HS(r,e,t,n,s){const i=e.bucketOnlyServerUrl(),o=z_(e,n,s),c={name:o.fullPath},u=Mi(i,r.host,r._protocol),h="POST",f={"X-Goog-Upload-Protocol":"resumable","X-Goog-Upload-Command":"start","X-Goog-Upload-Header-Content-Length":`${n.size()}`,"X-Goog-Upload-Header-Content-Type":o.contentType,"Content-Type":"application/json; charset=utf-8"},p=q_(o,t),m=r.maxUploadRetryTime;function T(V){Sl(V);let C;try{C=V.getResponseHeader("X-Goog-Upload-URL")}catch{Dt(!1)}return Dt(xa(C)),C}const P=new ds(u,h,T,m);return P.urlParams=c,P.headers=f,P.body=p,P.errorHandler=Li(e),P}function QS(r,e,t,n){const s={"X-Goog-Upload-Command":"query"};function i(h){const f=Sl(h,["active","final"]);let p=null;try{p=h.getResponseHeader("X-Goog-Upload-Size-Received")}catch{Dt(!1)}p||Dt(!1);const m=Number(p);return Dt(!isNaN(m)),new ta(m,n.size(),f==="final")}const o="POST",c=r.maxUploadRetryTime,u=new ds(t,o,i,c);return u.headers=s,u.errorHandler=Li(e),u}const kf=256*1024;function XS(r,e,t,n,s,i,o,c){const u=new ta(0,0);if(o?(u.current=o.current,u.total=o.total):(u.current=0,u.total=n.size()),n.size()!==u.total)throw fS();const h=u.total-u.current;let f=h;s>0&&(f=Math.min(f,s));const p=u.current,m=p+f;let T="";f===0?T="finalize":h===f?T="upload, finalize":T="upload";const P={"X-Goog-Upload-Command":T,"X-Goog-Upload-Offset":`${u.current}`},V=n.slice(p,m);if(V===null)throw k_();function C(j,H){const $=Sl(j,["active","final"]),E=u.current+f,_=n.size();let y;return $==="final"?y=Rl(e,i)(j,H):y=null,new ta(E,_,$==="final",y)}const L="POST",U=e.maxUploadRetryTime,x=new ds(t,L,C,U);return x.headers=P,x.body=V.uploadData(),x.progressCallback=c||null,x.errorHandler=Li(r),x}const Ge={RUNNING:"running",PAUSED:"paused",SUCCESS:"success",CANCELED:"canceled",ERROR:"error"};function Ic(r){switch(r){case"running":case"pausing":case"canceling":return Ge.RUNNING;case"paused":return Ge.PAUSED;case"success":return Ge.SUCCESS;case"canceled":return Ge.CANCELED;case"error":return Ge.ERROR;default:return Ge.ERROR}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class JS{constructor(e,t,n){if(ES(e)||t!=null||n!=null)this.next=e,this.error=t??void 0,this.complete=n??void 0;else{const i=e;this.next=i.next,this.error=i.error,this.complete=i.complete}}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Er(r){return(...e)=>{Promise.resolve().then(()=>r(...e))}}class YS{constructor(){this.sent_=!1,this.xhr_=new XMLHttpRequest,this.initXhr(),this.errorCode_=Kn.NO_ERROR,this.sendPromise_=new Promise(e=>{this.xhr_.addEventListener("abort",()=>{this.errorCode_=Kn.ABORT,e()}),this.xhr_.addEventListener("error",()=>{this.errorCode_=Kn.NETWORK_ERROR,e()}),this.xhr_.addEventListener("load",()=>{e()})})}send(e,t,n,s,i){if(this.sent_)throw Os("cannot .send() more than once");if(Ft(e)&&n&&(this.xhr_.withCredentials=!0),this.sent_=!0,this.xhr_.open(t,e,!0),i!==void 0)for(const o in i)i.hasOwnProperty(o)&&this.xhr_.setRequestHeader(o,i[o].toString());return s!==void 0?this.xhr_.send(s):this.xhr_.send(),this.sendPromise_}getErrorCode(){if(!this.sent_)throw Os("cannot .getErrorCode() before sending");return this.errorCode_}getStatus(){if(!this.sent_)throw Os("cannot .getStatus() before sending");try{return this.xhr_.status}catch{return-1}}getResponse(){if(!this.sent_)throw Os("cannot .getResponse() before sending");return this.xhr_.response}getErrorText(){if(!this.sent_)throw Os("cannot .getErrorText() before sending");return this.xhr_.statusText}abort(){this.xhr_.abort()}getResponseHeader(e){return this.xhr_.getResponseHeader(e)}addUploadProgressListener(e){this.xhr_.upload!=null&&this.xhr_.upload.addEventListener("progress",e)}removeUploadProgressListener(e){this.xhr_.upload!=null&&this.xhr_.upload.removeEventListener("progress",e)}}class ZS extends YS{initXhr(){this.xhr_.responseType="text"}}function Bn(){return new ZS}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class eP{isExponentialBackoffExpired(){return this.sleepTime>this.maxSleepTime}constructor(e,t,n=null){this._transferred=0,this._needToFetchStatus=!1,this._needToFetchMetadata=!1,this._observers=[],this._error=void 0,this._uploadUrl=void 0,this._request=void 0,this._chunkMultiplier=1,this._resolve=void 0,this._reject=void 0,this._ref=e,this._blob=t,this._metadata=n,this._mappings=bl(),this._resumable=this._shouldDoResumable(this._blob),this._state="running",this._errorHandler=s=>{if(this._request=void 0,this._chunkMultiplier=1,s._codeEquals(de.CANCELED))this._needToFetchStatus=!0,this.completeTransitions_();else{const i=this.isExponentialBackoffExpired();if(N_(s.status,[]))if(i)s=P_();else{this.sleepTime=Math.max(this.sleepTime*2,sS),this._needToFetchStatus=!0,this.completeTransitions_();return}this._error=s,this._transition("error")}},this._metadataErrorHandler=s=>{this._request=void 0,s._codeEquals(de.CANCELED)?this.completeTransitions_():(this._error=s,this._transition("error"))},this.sleepTime=0,this.maxSleepTime=this._ref.storage.maxUploadRetryTime,this._promise=new Promise((s,i)=>{this._resolve=s,this._reject=i,this._start()}),this._promise.then(null,()=>{})}_makeProgressCallback(){const e=this._transferred;return t=>this._updateProgress(e+t)}_shouldDoResumable(e){return e.size()>256*1024}_start(){this._state==="running"&&this._request===void 0&&(this._resumable?this._uploadUrl===void 0?this._createResumable():this._needToFetchStatus?this._fetchStatus():this._needToFetchMetadata?this._fetchMetadata():this.pendingTimeout=setTimeout(()=>{this.pendingTimeout=void 0,this._continueUpload()},this.sleepTime):this._oneShotUpload())}_resolveToken(e){Promise.all([this._ref.storage._getAuthToken(),this._ref.storage._getAppCheckToken()]).then(([t,n])=>{switch(this._state){case"running":e(t,n);break;case"canceling":this._transition("canceled");break;case"pausing":this._transition("paused");break}})}_createResumable(){this._resolveToken((e,t)=>{const n=HS(this._ref.storage,this._ref._location,this._mappings,this._blob,this._metadata),s=this._ref.storage._makeRequest(n,Bn,e,t);this._request=s,s.getPromise().then(i=>{this._request=void 0,this._uploadUrl=i,this._needToFetchStatus=!1,this.completeTransitions_()},this._errorHandler)})}_fetchStatus(){const e=this._uploadUrl;this._resolveToken((t,n)=>{const s=QS(this._ref.storage,this._ref._location,e,this._blob),i=this._ref.storage._makeRequest(s,Bn,t,n);this._request=i,i.getPromise().then(o=>{o=o,this._request=void 0,this._updateProgress(o.current),this._needToFetchStatus=!1,o.finalized&&(this._needToFetchMetadata=!0),this.completeTransitions_()},this._errorHandler)})}_continueUpload(){const e=kf*this._chunkMultiplier,t=new ta(this._transferred,this._blob.size()),n=this._uploadUrl;this._resolveToken((s,i)=>{let o;try{o=XS(this._ref._location,this._ref.storage,n,this._blob,e,this._mappings,t,this._makeProgressCallback())}catch(u){this._error=u,this._transition("error");return}const c=this._ref.storage._makeRequest(o,Bn,s,i,!1);this._request=c,c.getPromise().then(u=>{this._increaseMultiplier(),this._request=void 0,this._updateProgress(u.current),u.finalized?(this._metadata=u.metadata,this._transition("success")):this.completeTransitions_()},this._errorHandler)})}_increaseMultiplier(){kf*this._chunkMultiplier*2<32*1024*1024&&(this._chunkMultiplier*=2)}_fetchMetadata(){this._resolveToken((e,t)=>{const n=GS(this._ref.storage,this._ref._location,this._mappings),s=this._ref.storage._makeRequest(n,Bn,e,t);this._request=s,s.getPromise().then(i=>{this._request=void 0,this._metadata=i,this._transition("success")},this._metadataErrorHandler)})}_oneShotUpload(){this._resolveToken((e,t)=>{const n=$_(this._ref.storage,this._ref._location,this._mappings,this._blob,this._metadata),s=this._ref.storage._makeRequest(n,Bn,e,t);this._request=s,s.getPromise().then(i=>{this._request=void 0,this._metadata=i,this._updateProgress(this._blob.size()),this._transition("success")},this._errorHandler)})}_updateProgress(e){const t=this._transferred;this._transferred=e,this._transferred!==t&&this._notifyObservers()}_transition(e){if(this._state!==e)switch(e){case"canceling":case"pausing":this._state=e,this._request!==void 0?this._request.cancel():this.pendingTimeout&&(clearTimeout(this.pendingTimeout),this.pendingTimeout=void 0,this.completeTransitions_());break;case"running":const t=this._state==="paused";this._state=e,t&&(this._notifyObservers(),this._start());break;case"paused":this._state=e,this._notifyObservers();break;case"canceled":this._error=C_(),this._state=e,this._notifyObservers();break;case"error":this._state=e,this._notifyObservers();break;case"success":this._state=e,this._notifyObservers();break}}completeTransitions_(){switch(this._state){case"pausing":this._transition("paused");break;case"canceling":this._transition("canceled");break;case"running":this._start();break}}get snapshot(){const e=Ic(this._state);return{bytesTransferred:this._transferred,totalBytes:this._blob.size(),state:e,metadata:this._metadata,task:this,ref:this._ref}}on(e,t,n,s){const i=new JS(t||void 0,n||void 0,s||void 0);return this._addObserver(i),()=>{this._removeObserver(i)}}then(e,t){return this._promise.then(e,t)}catch(e){return this.then(null,e)}_addObserver(e){this._observers.push(e),this._notifyObserver(e)}_removeObserver(e){const t=this._observers.indexOf(e);t!==-1&&this._observers.splice(t,1)}_notifyObservers(){this._finishPromise(),this._observers.slice().forEach(t=>{this._notifyObserver(t)})}_finishPromise(){if(this._resolve!==void 0){let e=!0;switch(Ic(this._state)){case Ge.SUCCESS:Er(this._resolve.bind(null,this.snapshot))();break;case Ge.CANCELED:case Ge.ERROR:const t=this._reject;Er(t.bind(null,this._error))();break;default:e=!1;break}e&&(this._resolve=void 0,this._reject=void 0)}}_notifyObserver(e){switch(Ic(this._state)){case Ge.RUNNING:case Ge.PAUSED:e.next&&Er(e.next.bind(e,this.snapshot))();break;case Ge.SUCCESS:e.complete&&Er(e.complete.bind(e))();break;case Ge.CANCELED:case Ge.ERROR:e.error&&Er(e.error.bind(e,this._error))();break;default:e.error&&Er(e.error.bind(e,this._error))()}}resume(){const e=this._state==="paused"||this._state==="pausing";return e&&this._transition("running"),e}pause(){const e=this._state==="running";return e&&this._transition("pausing"),e}cancel(){const e=this._state==="running"||this._state==="pausing";return e&&this._transition("canceling"),e}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class sr{constructor(e,t){this._service=e,t instanceof et?this._location=t:this._location=et.makeFromUrl(t,e.host)}toString(){return"gs://"+this._location.bucket+"/"+this._location.path}_newRef(e,t){return new sr(e,t)}get root(){const e=new et(this._location.bucket,"");return this._newRef(this._service,e)}get bucket(){return this._location.bucket}get fullPath(){return this._location.path}get name(){return U_(this._location.path)}get storage(){return this._service}get parent(){const e=LS(this._location.path);if(e===null)return null;const t=new et(this._location.bucket,e);return new sr(this._service,t)}_throwIfRoot(e){if(this._location.path==="")throw gS(e)}}function G_(r,e,t){r._throwIfRoot("uploadBytes");const n=$_(r.storage,r._location,bl(),new St(e,!0),t);return r.storage.makeRequestWithTokens(n,Bn).then(s=>({metadata:s,ref:r}))}function tP(r,e,t){return r._throwIfRoot("uploadBytesResumable"),new eP(r,new St(e),t)}function nP(r,e,t=at.RAW,n){r._throwIfRoot("uploadString");const s=x_(t,e),i=Object.assign({},n);return i.contentType==null&&s.contentType!=null&&(i.contentType=s.contentType),G_(r,s.data,i)}function rP(r){r._throwIfRoot("getDownloadURL");const e=KS(r.storage,r._location,bl());return r.storage.makeRequestWithTokens(e,Bn).then(t=>{if(t===null)throw pS();return t})}function sP(r,e){const t=FS(r._location.path,e),n=new et(r._location.bucket,t);return new sr(r.storage,n)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function iP(r){return/^[A-Za-z]+:\/\//.test(r)}function oP(r,e){return new sr(r,e)}function K_(r,e){if(r instanceof Pl){const t=r;if(t._bucket==null)throw dS();const n=new sr(t,t._bucket);return e!=null?K_(n,e):n}else return e!==void 0?sP(r,e):r}function aP(r,e){if(e&&iP(e)){if(r instanceof Pl)return oP(r,e);throw eu("To use ref(service, url), the first argument must be a Storage instance.")}else return K_(r,e)}function Vf(r,e){const t=e==null?void 0:e[S_];return t==null?null:et.makeFromBucketSpec(t,r)}function cP(r,e,t,n={}){r.host=`${e}:${t}`;const s=Ft(e);s&&(ra(`https://${r.host}/b`),nu("Storage",!0)),r._isUsingEmulator=!0,r._protocol=s?"https":"http";const{mockUserToken:i}=n;i&&(r._overrideAuthToken=typeof i=="string"?i:jf(i,r.app.options.projectId))}class Pl{constructor(e,t,n,s,i,o=!1){this.app=e,this._authProvider=t,this._appCheckProvider=n,this._url=s,this._firebaseVersion=i,this._isUsingEmulator=o,this._bucket=null,this._host=R_,this._protocol="https",this._appId=null,this._deleted=!1,this._maxOperationRetryTime=nS,this._maxUploadRetryTime=rS,this._requests=new Set,s!=null?this._bucket=et.makeFromBucketSpec(s,this._host):this._bucket=Vf(this._host,this.app.options)}get host(){return this._host}set host(e){this._host=e,this._url!=null?this._bucket=et.makeFromBucketSpec(this._url,e):this._bucket=Vf(e,this.app.options)}get maxUploadRetryTime(){return this._maxUploadRetryTime}set maxUploadRetryTime(e){Cf("time",0,Number.POSITIVE_INFINITY,e),this._maxUploadRetryTime=e}get maxOperationRetryTime(){return this._maxOperationRetryTime}set maxOperationRetryTime(e){Cf("time",0,Number.POSITIVE_INFINITY,e),this._maxOperationRetryTime=e}async _getAuthToken(){if(this._overrideAuthToken)return this._overrideAuthToken;const e=this._authProvider.getImmediate({optional:!0});if(e){const t=await e.getToken();if(t!==null)return t.accessToken}return null}async _getAppCheckToken(){if($e(this.app)&&this.app.settings.appCheckToken)return this.app.settings.appCheckToken;const e=this._appCheckProvider.getImmediate({optional:!0});return e?(await e.getToken()).token:null}_delete(){return this._deleted||(this._deleted=!0,this._requests.forEach(e=>e.cancel()),this._requests.clear()),Promise.resolve()}_makeStorageReference(e){return new sr(this,e)}_makeRequest(e,t,n,s,i=!0){if(this._deleted)return new _S(V_());{const o=PS(e,this._appId,n,s,t,this._firebaseVersion,i,this._isUsingEmulator);return this._requests.add(o),o.getPromise().then(()=>this._requests.delete(o),()=>this._requests.delete(o)),o}}async makeRequestWithTokens(e,t){const[n,s]=await Promise.all([this._getAuthToken(),this._getAppCheckToken()]);return this._makeRequest(e,t,n,s).getPromise()}}const Df="@firebase/storage",Nf="0.13.14";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const W_="storage";function AP(r,e,t){return r=Z(r),G_(r,e,t)}function bP(r,e,t,n){return r=Z(r),nP(r,e,t,n)}function RP(r,e,t){return r=Z(r),tP(r,e,t)}function SP(r){return r=Z(r),rP(r)}function PP(r,e){return r=Z(r),aP(r,e)}function CP(r=su(),e){r=Z(r);const n=Yr(r,W_).getImmediate({identifier:e}),s=Uf("storage");return s&&uP(n,...s),n}function uP(r,e,t,n={}){cP(r,e,t,n)}function lP(r,{instanceIdentifier:e}){const t=r.getProvider("app").getImmediate(),n=r.getProvider("auth-internal"),s=r.getProvider("app-check-internal");return new Pl(t,n,s,e,ir)}function hP(){Wn(new hn(W_,lP,"PUBLIC").setMultipleInstances(!0)),gt(Df,Nf,""),gt(Df,Nf,"esm2017")}hP();export{BR as A,_P as B,pP as C,jR as D,TR as E,fP as F,en as G,gP as H,TP as I,IP as J,ER as K,AP as L,RP as M,bP as N,Xb as O,WR as P,wR as a,Yb as b,$R as c,zR as d,kb as e,Vb as f,mP as g,vR as h,qR as i,t_ as j,EP as k,pR as l,_R as m,SP as n,Ob as o,CP as p,GR as q,wP as r,qI as s,eR as t,yP as u,Zc as v,Jb as w,Zb as x,Qb as y,PP as z};
