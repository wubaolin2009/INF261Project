/**
 * Created by Baolin on 11/28/2015.
 */

function genHTMLDefault(email, emailId) {
    var html = "<div class='panel panel-default'> \
        <div id='enc261_header' class='panel-heading'> \
            Dear User: \
        </div> \
        <div id='enc261_body' class='panel-body'> \
            <h4> \
                You got an encrypted email (Encrypted Stored in Server) from ##email_from. \
            </h4> \
            <p>You can click the button to decrypt it. Or use your mobile device to scan the QR code below. </p> \
            <button type='button' id='decrypt261' class='btn btn-primary'>Decrypt It!</button> \
            <br> \
        </div> \
        <div class='panel-footer'> \
            <div id='qrcode'> \
            </div> \
        </div> \
    </div>";

    html = html.replace("##email_from", email.from().email);

    email.body(html);

    $('#qrcode').qrcode({width: 128,height: 128,text: emailId});
    $('#decrypt261').click(function(event) {
        tryDecryptEmail(email, emailId);
    });
}

function genHTMLP2P(email, realSub, realText) {
    var html = "<div class='panel panel-default'> \
        <div id='enc261_header' class='panel-heading'> \
            Dear User: \
        </div> \
        <div id='enc261_body' class='panel-body'> \
            <h4> \
                You got an P2P encrypted email from ##email_from. \
            </h4> \
            <p>You can click the button to decrypt it. Or use your mobile device to scan the QR code below. </p> \
            <button type='button' id='decrypt261' class='btn btn-primary'>Decrypt It!</button> \
            <br> \
        </div> \
        <div class='panel-footer'> \
            <div id='qrcode'> \
            </div> \
        </div> \
    </div>";

    html = html.replace("##email_from", email.from().email);
    email.body(html);

    $('#qrcode').qrcode({width: 128,height: 128,text: realText});
    $('#decrypt261').click(function(event) {
        email.body(getHTMLDecrypted(realSub, realText));
    });
}

function getHTMLDecrypted(decryptedSub, decryptedBody) {
    var html = "<div class='panel panel-default'> \
        <div id='enc261_header' class='panel-heading'> \
            Subject: ##emailsubject \
        </div> \
        <div id='enc261_body' class='panel-body'> \
            <h4>The decrypted email is: </h4> \
            ##emailbody \
        </div> \
        <div class='panel-footer'> \
        </div> \
    </div>";
    html = html.replace("##emailsubject", decryptedSub);
    html = html.replace("##emailbody", decryptedBody);
    return html;
}

function genHTMLPWDShown(email) {
    var html = "<div class='panel panel-default'> \
        <div id='enc261_header' class='panel-heading'> \
            Dear User: \
        </div> \
        <div id='enc261_body' class='panel-body'> \
            <h4> \
                You got an Password Encrypted email from ##email_from. \
            </h4> \
            <p>Input the password then click decrypt it.</p> \
            <input name='enc261_pwd_input' type='password' value='Input Password'></input> \
            <button type='button' id='decrypt261' class='btn btn-primary'>Decrypt It!</button> \
            <br> \
        </div> \
        <div class='panel-footer'> \
            <div id='qrcode'> \
            </div> \
        </div> \
    </div>";

    html = html.replace("##email_from", email.from().email);

    var dom = $(email.body());
    var text = dom.find("input[name='enc261_encText']")[0].value;
    var subject = dom.find("input[name='enc261_subject']")[0].value;

    email.body(html);
    //$('#qrcode').qrcode({width: 128,height: 128,text: emailId});

    $("#decrypt261").click(function(event) {
        var password = $("input[name='enc261_pwd_input']").val();
        // decrypt the email
        var correct = true;
        try {
            text = decodeURIComponent(text);
            text = sjcl.decrypt(password, text);
            subject = decodeURIComponent(subject);
            //text = "<div>subject is:<br>" + "<h3>" + sjcl.decrypt(password, subject) +"</h3></div>" + text;
            email.body(getHTMLDecrypted(sjcl.decrypt(password, subject), text));
        } catch(err) {
            correct = false;
        }
        if (!correct) {
            alert("password error!");
        }
    });
}
