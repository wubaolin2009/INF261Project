
var j = document.createElement('script');
j.src = chrome.extension.getURL('jquery-1.10.2.min.js');
(document.head || document.documentElement).appendChild(j);

var g = document.createElement('script');
g.src = chrome.extension.getURL('gmail.js');
(document.head || document.documentElement).appendChild(g);

var s = document.createElement('script');
s.src = chrome.extension.getURL('main.js');
(document.head || document.documentElement).appendChild(s);

var encrypt_process_js = document.createElement('script');
encrypt_process_js.src = chrome.extension.getURL('encrypt_process.js');
(document.head || document.documentElement).appendChild(encrypt_process_js);

var encrypLib = document.createElement('script');
encrypLib.src = chrome.extension.getURL('/libs/sjcl/sjcl.js');
(document.head || document.documentElement).appendChild(encrypLib);

var encrypLibbb = document.createElement('script');
encrypLibbb.src = chrome.extension.getURL('/libs/sjcl/core/bn.js');
(document.head || document.documentElement).appendChild(encrypLibbb);

var encrypLibecc = document.createElement('script');
encrypLibecc.src = chrome.extension.getURL('/libs/sjcl/core/ecc.js');
(document.head || document.documentElement).appendChild(encrypLibecc);

var b = document.createElement('script');
b.src = chrome.extension.getURL('bootstrap-switch.min.js');
(document.head || document.documentElement).appendChild(b);

var bb = document.createElement('link');
bb.href = chrome.extension.getURL('bootstrap-switch.min.css');
bb.rel="stylesheet";
(document.head || document.documentElement).appendChild(bb);
