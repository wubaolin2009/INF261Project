/**
 * This file is mainly used to start the encryption process,
 * 1. Get current user information
 * 2. Get the receipts of the email
 * 3. Get the pub keys for receipts, async call back to 4, at the same time
 *    Bind a specific url to this email so others can retrieve it using the url
 * 4. Encrypt the messages using different pub keys
 * 5. Upload the encrypted data
 *    {'user_email': encyprted_data_used_by_pub_key_of_this user,
 *     'another_user_email', ... }
 */
/** Reference urls
 * createUser
 */
/** reference url
 *
 http://52.25.168.169:8888/createUser?userEmail=useremail&userPublicKey=userpubkey
 http://52.25.168.169:8888/createUser?userEmail=otheremail&userPublicKey=otherpubkey

 http://52.25.168.169:8888/getUserPublicKeys?userNames=useremail,otheremail

 http://52.25.168.169:8888/createEmail?fromUser=useremail&emailId=emailid1&encryptedData=encryptedDataForEmail1

 http://52.25.168.169:8888/addCiphterKeyToEmail?emailId=emailid1&userName=useremail&encryptedKey=keyuser1
 http://52.25.168.169:8888/addCiphterKeyToEmail?emailId=emailid1&userName=otheremail&encryptedKey=keyuser2

 http://52.25.168.169:8888/getEmail?emailId=emailid1&userName=useremail
 http://52.25.168.169:8888/getEmail?emailId=emailid1&userName=otheremail
 * @type {string}
 */
var ServerAddress = "https://52.27.236.62:8888";

function generateEncryptedEmail(emailId, fromUser, subject) {
    var html = "||||Dear|||| You recieved an email from " + fromUser + " ";
    html += "<br> The subject is:" + "Hidden" + "<br>";
    html += "<a href=\"" + ServerAddress + "/getEmail?userName=" + fromUser + "&emailId=" + emailId + "\" >Decrypt It!</a>";
    // add hidden meta info
    html += "<div>" + "<input type=\"hidden\" name=\"enc261\" value=\"\"/>";
    if(gDelTime > 0) {
        html += "<input type=\"hidden\" name=\"enc261_timed\" value=\""+ "" + "\"/>";
    }
    html += "<input type=\"hidden\" name=\"enc261_funcName\" value=\""+ "encStoreInServer" + "\"/>" + "<input type=\"hidden\" name=\"enc261_emailId\" value=\""+emailId + "\"/>" +"</div>";
    html += "<div id='qrcode'></div>";
    console.log("WBL: HTML:", html);
    return html;
}

function generateEmailId() {
    // We may not be able to get email id from gmail now, we use this as temporary solution
    var dd = new Date(Date.now());
    return dd.toString();
}
// test run:
/*
var data = {}; data.body = "try to decrypt me!!!";
 generateEncryptedDataSentToServer("123", "baolinw@uci.edu",data);
*/
function generateEncryptedDataSentToServer(emailId, fromEmail, data) {
    console.log("in generateEncryptedDataSentToServer: id, from data, ", emailId, fromEmail, data);
    //1. generate a key, it is may not be the correct way, Never mind
    var key = sjcl.hash.sha256.hash(sjcl.random.randomWords(16));
    key = key.toString();
    //2. use this key to encrypt the data
    var encryptedEmail = sjcl.encrypt(key, data.body);
    var encryptedSubject = sjcl.encrypt(key, data.subject);
    // backu the reciptes, don't include the CC now
    var toCcs = [];
    for(var i = 0; i < data.to.length - 1; i++) {
        toCcs.push(data.to[i]);
    }
    // functions called when ajax returned, in time-reverse order
    // Called after participants' public key got from server
    var funcHandleParticipantPubKey = function(data) {
        //use the public key to encrypt key and store it to server
        // For each pub, send sjcl.encrypt(pub, key) to serve
        console.log("5. get participants key:", data);
        for(userEmail in Object.keys(data.keys)) { var pubKey = data.keys[userEmail]; }
        for(index in Object.keys(data.keys)) {
            var user = Object.keys(data.keys)[index];
            var pubKey = data.keys[user];
            var encryptedKey = sjcl.encrypt(deserialzePublicKey(pubKey), key);
            $.ajax({
                    dataType: 'json',
                    method: "GET",
                    url: ServerAddress + "/addCiphterKeyToEmail?userName=" + user + "&emailId=" + emailId + "&encryptedKey=" + encodeURIComponent(encryptedKey)
                })
                .done(function (data) {
                    //Email Finally finished
                    console.log("6. email paritally succesfully for participants:" + data);
                });
        }
    };
    //3. Called after encrypted email sent to server
    var funcHandleEmailCreated = function(data) {
        console.log("3.email Sent! Id" + emailId);
        console.log("Sample of data:", data);
        //get all participants public key
        toCcs.push(fromEmail);
        var participant = toCcs;
        console.log("4. participant in this email", participant);
        $.ajax({
                dataType: 'json',
                method: "GET",
                url: ServerAddress + "/getUserPublicKeys?userNames=" + participant.join(","),
                success: funcHandleParticipantPubKey
            });
    };
    // Start the chain of callbacks
    $.ajax({
        dataType: 'json',
        method:"GET",
        url: ServerAddress + "/createEmail?del=" + gDelAfterRead.toString() + "&expired=" + gDelTime.toString() + "&fromUser=" + fromEmail + "&emailId=" + emailId + "&subject=" + encodeURIComponent(encryptedSubject) + "&encryptedData=" + encodeURIComponent(encryptedEmail),
        success:funcHandleEmailCreated
    });
}

function createUser(emailAddress) {
    // 1. generate a key pair
    var pair = sjcl.ecc.elGamal.generateKeys(256);
    console.log("WBL Generated pair");
    // 2. Serialize
    var pub = pair.pub.get();
    var sec = pair.sec.get();
    pub = sjcl.codec.base64.fromBits(pub.x.concat(pub.y));
    sec = sjcl.codec.base64.fromBits(sec);
    // 2. push the pub to idp (just simple server.. for prototype)
    $.ajax({dataType: 'xml', method:"GET", url: ServerAddress + "/createUser?userEmail=" + emailAddress + "&userPublicKey=" + encodeURIComponent(pub) })
        .done(function( data ) {
            console.log("user created!");
            console.log( "Sample of data:", data);
        });
    // 3. store it to local storage
    localStorage[emailAddress + "_pub"] = pub;
    localStorage[emailAddress + "_sec"] = sec;
}

function deserialzePublicKey(pubKey) {
    return new sjcl.ecc.elGamal.publicKey(
        sjcl.ecc.curves.c256,
        sjcl.codec.base64.toBits(pubKey)
    );
}
function loadPair(emailAddress) {
    var pair = {};
    var pubLocal =  localStorage[emailAddress + "_pub"];
    var secLocal = localStorage[emailAddress + "_sec"];
    var pub = deserialzePublicKey(pubLocal);
    // Unserialized private key:
    sec = new sjcl.ecc.elGamal.secretKey(
        sjcl.ecc.curves.c256,
        sjcl.ecc.curves.c256.field.fromBits(sjcl.codec.base64.toBits(secLocal))
    )
    pair.pub = pub;
    pair.sec = sec;
    return pair;
}

function encryptWithPwd(body, fromUser, subject, password) {
    // Encrypt
    var encText = sjcl.encrypt(password, body);
    var html = "||||Dear|||| You recieved a Password Encrypted email from " + fromUser + " ";
    html += "<br> The subject is:" + "Subject" + "<br>";
    // add hidden meta info
    html += "<div>";
    html += "<input type=\"hidden\" name=\"enc261\" value=\"\"/>";
    html += "<input type=\"hidden\" name=\"enc261_funcName\" value=\""+ "encPwd" + "\"/>";
    html += "<input type=\"hidden\" name=\"enc261_encText\" value=\""+ encodeURIComponent(encText) + "\"/>";
    html += "<input type=\"hidden\" name=\"enc261_subject\" value=\""+ encodeURIComponent(sjcl.encrypt(password, subject)) + "\"/>";
    html += "</div>";
    return html;
}
function startEncryptProcess(body, data, xhr) {
    var body_params = xhr.xhrParams.body_params;
    var body = body_params.body;
    // start a asynchorous call to server
    var emailId = generateEmailId();
    var fromUser=gmail.get.user_email();
    if(gEncryptMode == 0) {
        generateEncryptedDataSentToServer(emailId, fromUser, data);
        // It seems the email body should start with
        return "<div dir=\"ltr\">" + generateEncryptedEmail(emailId, fromUser, data) + "</div>";
    } else if(gEncryptMode == 1) {
        // password
        var composerid = xhr.xhrParams.body_params.composeid;
        var password = gmail.dom.composes(composerid)[0].find("#pwd_" + composerid).val();
        var subject = data.subject;
        return "<div dir=\"ltr\">" + encryptWithPwd(body, fromUser, subject, password) + "</div>";
    } else if(gEncryptMode == 2) {
        var participants = [gmail.get.user_email()];
        var subject = data.subject;
        // get tos email address
        for(var i = 0; i < data.to.length - 1; i++) {
            participants.push(data.to[i]);
        }
        // get the public keys, for demo, we assume all public keys are store locally.
        var key = sjcl.hash.sha256.hash(sjcl.random.randomWords(16));
        key = key.toString();
        var html = "||||Dear|||| You recieved a P2P Encrypted email from " + fromUser + " ";
        html += "<br> The subject is:" + "Subject" + "<br>";
            // add hidden meta info
        html += "<div>";
        html += "<input type=\"hidden\" name=\"enc261\" value=\"\"/>";
        html += "<input type=\"hidden\" name=\"enc261_funcName\" value=\""+ "encP2P" + "\"/>";
        html += "<input type=\"hidden\" name=\"enc261_subject\" value=\""+ encodeURIComponent(sjcl.encrypt(key, subject)) + "\"/>";
        for(index in participants) {
            var user = participants[index];
            var pubKey = loadPair(user).pub;
            var encryptedKey = sjcl.encrypt(pubKey, key);
            html += "<input type='hidden' name='enc261_p2p_" + user + "' value=''/>";
            html += "<input type='hidden' name='enc261_p2p_" + user + "_key'" + " value='" + encodeURIComponent(encryptedKey) + "'/>";
        }
        var encText = sjcl.encrypt(key, body);
        html += "<input type='hidden' name='enc261_p2p_enctext' value='" + encodeURIComponent(encText) +"'/>";
        html += "</div>";
        console.log(html);
        return "<div dir=\"ltr\">" + html + "</div>";
    }
}

/* test:
getEmail("baolinw@uci.edu", "123");
 */
// get email using email id and user, number, try to decrypt it using the private key
function getEmail(userEmail, emailId, emailSender, callback) {
    // 1. get the encrypted email and encrypted key for this email
    $.ajax({
        dataType: 'json',
        method:"GET",
        url: ServerAddress + "/getEmail?emailId=" + emailId + "&userName=" + userEmail,
        success: function(data) {
            //load local storage
            var keyPair = loadPair(userEmail);
            //2. decrypt the key
            if(data.keys.encKey == null) {
                //This means, you are havn't created user when the email is sent. The solution is:
                // Pop up a window asking whether you want to create a user using this email
                // if not return, else create a user,
                // then send the email to the guy who sent this email
                if(data.success == false) {
                    alert("The email doesn't exist!");
                    return;
                }
                if(confirm('You are not in the participants of the enrypted email. You should create user and send a request' +
                    ' to the sender. Do you want to continue?')) {
                    $.ajax({
                        dataType: 'json',
                        method: "GET",
                        url: ServerAddress + "/sendNeedAccessEmail?emailId=" + emailId + "&emailFrom=" + userEmail + "&emailTo=" + emailSender,
                        success: function (data) {
                            alert("Email Sent!");
                        }
                    });
                }
                return;
            }
            var decryptKey = sjcl.decrypt(keyPair.sec, data.keys.encKey);
            //3. decrypt the email
            var decrypteEmail = sjcl.decrypt(decryptKey, data.keys.data);
            var decrypteSubject = sjcl.decrypt(decryptKey, data.keys.subject);

            console.log("The email decrypted is: " + decrypteEmail);
            callback(null, getHTMLDecrypted(decrypteSubject, decrypteEmail));
            //callback(null, "<div>Subject is:<h3>" + decrypteSubject + "</h3><br></div>" + decrypteEmail);
        }
    });

}

function genEmailForRequestEmailAccess(emailId, requestSentToUser) {
    var currentUser = gmail.get.user_email();

}
