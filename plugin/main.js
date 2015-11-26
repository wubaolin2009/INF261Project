var gmail;
mapComposerIdToEncryptionOnOff = new Array();
var gDefaultEnabled = false;
var gEncryptMode = 0; // 0, store in server, 1 password, 2 p2p
var gDelAfterRead = 0; // only valid when gEncryptMode == 0
var gDelTime = 0;  // for demo purpose,

function refresh(f) {
  if( (/in/.test(document.readyState)) || (undefined === Gmail) ) {
    setTimeout('refresh(' + f + ')', 10);
  } else {
    f();
  }
}

// Generate a input on top of composer, return the string
function genSwitchForEncryption(name, size, checked) {
  var html = "Enabled Encryption? <input type=\"checkbox\" name=\"";
  html = html + name + "\" ";
  if(checked == true) {
    html = html + "checked ";
  }
  html = html + " size=\"" + size + "\">";
  return html;
}
// Insert a switch to composer, this happens when gmail loaded and a new composer poped up
// type is not used.
function insertSwitchToComposer(compose,type) {
  var table = compose.find('.I5');
  // insert the password input
  if (gEncryptMode == 1) { // password
    var pwdName = "pwd_" + compose.id();
    table.prepend("<br><input type='password' id='"+ pwdName + "'> Password </input><br>");
  }

  // insert a switch into table
  var switchName = "switch_" + compose.id();
  table.prepend(genSwitchForEncryption(switchName, "small", gDefaultEnabled));

  mapComposerIdToEncryptionOnOff[compose.id()] = gDefaultEnabled;

  $("[name='" + switchName + "']").bootstrapSwitch(); // show the table
  $("[name='" + switchName + "']").on('switchChange.bootstrapSwitch', function(event, state) {
    // Change the button send to send Encrypt or vice versa
    var originState = mapComposerIdToEncryptionOnOff[compose.id()];
    if (state != originState) {
      var sendButton = compose.find(".T-I-atl")[0];
      var pwdId = "pwd_" + compose.id();
      if(state) {
        sendButton.innerText = "Send Encrypt";
      } else {
        sendButton.innerText = "Send";
      }
      var pwdInput = compose.find("#" + pwdId);
      if(pwdInput) {

      } else {

      }
    }
    mapComposerIdToEncryptionOnOff[compose.id()] = state;
    console.log("WBL: state for " + switchName + " state changed to:" + state);
  });
}

function tryDecryptEmail(domEmail, emailId, callback) {
  getEmail(gmail.get.user_email(), emailId, domEmail.from().email, function(err, result) {
    if(err) {
      alert("can't decrypt the email!");
    } else {
      domEmail.body(result);
      if(callback) {
        callback(domEmail, emailId, result);
      }
    }
  });
}
function checkEmailEncrypted(email) {
  // email is a DOM object
  var body = email.body();
  // check whether it contains some specfic name in the body, like id = "encrypted261"
  // is it encrypted?
  body = $(body);
  var id = body.find("input[name='enc261']");
  if(id == null) return;
  // get the function
  var func = body.find("input[name='enc261_funcName']").val();
  if(func == "encStoreInServer") { // the thing is encrypted in client and stored in server using publickey encryption
    var emailId = body.find("input[name='enc261_emailId']").val();
    tryDecryptEmail(email, emailId);
  } else if(func == "grantAccess") { // some others are requesting u to give them access to an email
    var emailId = body.find("input[name='enc261_emailId']").val();
    var fromUser = body.find("input[name='enc261_fromUser']").val();
    tryDecryptEmail(email, emailId, function(domEmail, emailId, result) {
      if(confirm("The email decrypted is shown. Do you want to give access to " + fromUser)) {
        console.log("Begining grant access to " + fromUser + " of email id:" + emailId);
        // 1. called after the public key is got
        function pubKeyGot(data) {
          var user = Object.keys(data.keys)[0];
          var pubKey = data.keys[user];
          pubKey = deserialzePublicKey(pubKey);
          console.log("Got user:" + user + " PubKey:" + pubKey);
          // get this email again
          $.ajax({
            dataType: 'json',
            method: "GET",
            url: ServerAddress + "/getEmail?emailId=" + emailId + "&userName=" + gmail.get.user_email(),
            success: function(data) {
              var keyPair = loadPair(gmail.get.user_email());
              if(data.keys.encKey == null) {
                //This means Error!
                alert("ERROR: When granting access, can't find user!");
                return;
              }
              var decryptKey = sjcl.decrypt(keyPair.sec, data.keys.encKey);
              var encryptedKey = sjcl.encrypt(pubKey, decryptKey);
              // add new encrypted key to server
              $.ajax({
                    dataType: 'json',
                    method: "GET",
                    url: ServerAddress + "/addCiphterKeyToEmail?userName=" + fromUser + "&emailId=" + emailId + "&encryptedKey=" + encodeURIComponent(encryptedKey)
                  })
                  .done(function (data) {
                    //Email Finally finished
                    console.log("Grant access succeed!");
                  });
            }
          });
        }
        var participant = [fromUser];
        $.ajax({
          dataType: 'json',
          method: "GET",
          url: ServerAddress + "/getUserPublicKeys?userNames=" + participant.join(","),
          success: pubKeyGot
        });
      }
    });
  } // end of else if
  else if(func == "encPwd") {
    // add something into this email
    var uiPwd = "<input name='enc261_pwd_input' value='Input Password'>password</input><button id='enc261_pwd_button'>Decrypt it!</button><br>";
    email.body(uiPwd + email.body());
    $("#enc261_pwd_button").click(function(event) {
      var password = $("input[name='enc261_pwd_input']").val();
      // decrypt the email
      var correct = true;
      try {
        var dom = $(email.body());
        var text = dom.find("input[name='enc261_encText']")[0].value;
        text = decodeURIComponent(text);
        text = sjcl.decrypt(password, text);
        var subject = dom.find("input[name='enc261_subject']")[0].value;
        subject = decodeURIComponent(subject);
        text = "<div>subject is:<br>" + "<h3>" + sjcl.decrypt(password, subject) +"</h3></div>" + text;
        email.body(text);
      } catch(err) {
        correct = false;
      }
      if (!correct) {
        alert("password error!");
      }
    });
  }
  else if(func == "encP2P") {
    var myEmail = gmail.get.user_email();
    if(!confirm("This email is encrypted P2P, do you want to decrypt it?")) {
      return;
    }
    // find the key
    var key = "enc261_p2p_" + myEmail + "_key";
    var encryptedKey = body.find("input[name='" + key + "']")[0].value;
    var secKey = loadPair(myEmail).sec;
    var decryptedKey = sjcl.decrypt(secKey, decodeURIComponent(encryptedKey));
    // use the decryptedKey to decipher the text
    var encryptedText = body.find("input[name='enc261_p2p_enctext']")[0].value;
    encryptedText = decodeURIComponent(encryptedText);
    var realText = sjcl.decrypt(decryptedKey, encryptedText);

    var subject = body.find("input[name='enc261_subject']")[0].value;
    subject = decodeURIComponent(subject);
    realText = "<div>subject is:<br>" + "<h3>" + sjcl.decrypt(decryptedKey, subject) +"</h3></div>" + realText;

    email.body(realText);
  } else if(func == "encDelAfterRead") { // must be stored in server actually, not pwd, and not p2p

  }
}
// Set up initializations after gmail fully initialized
function Init() {
  gmail.observe.on("load", function(params) {
    console.log("WBL: in Init()");
    // DOM observers, called when composer poped up
    gmail.observe.on("compose", function(compose, type) {
      // type can be compose, reply or forward
      console.log('WBL: api.dom.compose object:', compose, 'type is:', type);
      insertSwitchToComposer(compose, type);
    });
    // Hook the procedure of send an email, the main logic behind this is in encrypt_process.js
    gmail.observe.before('send_message', function(url, body, data, xhr){
      var body_params = xhr.xhrParams.body_params;
      // Extract the composer id
      var composerId = body_params.composeid;
      if(mapComposerIdToEncryptionOnOff[composerId] != true) {
        return;
      };
      // body is a bunch of raw data like composerid=xxx&from=xxx
      // get the body, we don't support encrypting encrypted attachments now
      var overrideBody = startEncryptProcess(body, data, xhr);
      console.log("WBL: the override body is:", overrideBody);
      body_params.body = overrideBody;
      // now change the subject, we may hide the sending email in the near future
      body_params.subject = "Encrypted Message from " + gmail.get.user_email() + " ";
      if(gDelAfterRead) {
        body_params.subject = "[ReadThenDelete!]" + body_params.subject;
      }
      if(gDelTime > 0) {
        var eTime = new Date().getTime();
        eTime += gDelTime;
        var eDate = new Date(eTime);
        eDate = eDate.toString();
        body_params.subject = "[Expired after: ]" + eDate + body_params.subject;
      }
      console.log("WBL: sending message, url:", url, 'body', body, 'email_data', data, 'xhr', xhr);
    });
    // Hook the procedure of opening an email, if it is encrypted, it should be decrypted
    gmail.observe.on("open_email",function(id, url, body, xhr) {
      console.log("WBL open id:", id, "url:", url, 'body', body, 'xhr', xhr);
      //console.log(gmail.get.email_data(id));
      var email = new gmail.dom.email(id);
      // check whether this email is encrypted
      checkEmailEncrypted(email);
    })
    gmail.observe.after("send_message", function(url, body, data, response, xhr) {
      console.log("WBL: message sent", "url:", url, 'body', body, 'email_data', data, 'response', response, 'xhr', xhr);
    })
    // Add a html running inside gmail http://192.168.1.106:3000/
    var fakeWindow = " <iframe id=\"tutu\" src=\"http://192.168.1.106:3000\" width=\"600px\" height=\"600px\">MM</iframe>";
    //$(".Cr.aqJ").prepend(fakeWindow)
  });
}
var main = function(){
  // NOTE: Always use the latest version of gmail.js from
  // https://github.com/KartikTalwar/gmail.js
  gmail = new Gmail();
  console.log('Hello,', gmail.get.user_email())
  Init();
}

refresh(main);